"""
Sheet-metal unfolding using cadquery / OpenCASCADE.

Pipeline:
1. Load STEP  →  cadquery Shape
2. Classify faces (planar / cylindrical / other)
3. Build face adjacency graph via shared edges
4. Identify bend faces (cylindrical connecting two planar faces)
5. BFS from the largest planar face, rotating each neighbor flat
6. Tessellate each planar face, apply cumulative transforms
7. Return JSON with flat vertices, cut edges, bend edges
"""
import os
os.environ["OCP_NO_DISPLAY"] = "1"
import math
import json
import numpy as np
import cadquery as cq

# OpenCASCADE imports (OCP)
from OCP.BRep import BRep_Tool
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.TopAbs import TopAbs_FACE, TopAbs_EDGE, TopAbs_FORWARD
from OCP.TopExp import TopExp, TopExp_Explorer
from OCP.TopTools import TopTools_IndexedMapOfShape, TopTools_IndexedDataMapOfShapeListOfShape
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Surface, BRepAdaptor_Curve
from OCP.GeomAbs import (
    GeomAbs_Plane, GeomAbs_Cylinder, GeomAbs_Line, 
    GeomAbs_Circle, GeomAbs_Ellipse
)
from OCP.Geom import Geom_Plane, Geom_CylindricalSurface
from OCP.TopLoc import TopLoc_Location
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.gp import gp_Trsf, gp_Ax1, gp_Pnt, gp_Dir, gp_Vec

# Default K-factor for neutral fiber calculation (0.44 = industry standard mild steel)
K_FACTOR = 0.44


def _get_faces(shape):
    """Extract all faces from the shape."""
    face_map = TopTools_IndexedMapOfShape()
    TopExp.MapShapes_s(shape, TopAbs_FACE, face_map)
    return [TopoDS.Face_s(face_map.FindKey(i)) for i in range(1, face_map.Extent() + 1)]


def _get_edges(shape):
    """Extract all edges from the shape."""
    edge_map = TopTools_IndexedMapOfShape()
    TopExp.MapShapes_s(shape, TopAbs_EDGE, edge_map)
    return [TopoDS.Edge_s(edge_map.FindKey(i)) for i in range(1, edge_map.Extent() + 1)]


def _classify_face(face):
    """Return ('plane', normal, point) or ('cylinder', axis, radius, center) or ('other',)."""
    adaptor = BRepAdaptor_Surface(face)
    stype = adaptor.GetType()
    if stype == GeomAbs_Plane:
        pln = adaptor.Plane()
        ax = pln.Axis()
        n = ax.Direction()
        p = ax.Location()
        return ("plane", np.array([n.X(), n.Y(), n.Z()]), np.array([p.X(), p.Y(), p.Z()]))
    elif stype == GeomAbs_Cylinder:
        cyl = adaptor.Cylinder()
        ax = cyl.Axis()
        d = ax.Direction()
        p = ax.Location()
        r = cyl.Radius()
        return ("cylinder", np.array([d.X(), d.Y(), d.Z()]), r, np.array([p.X(), p.Y(), p.Z()]))
    return ("other",)


def _face_area(face):
    props = GProp_GProps()
    BRepGProp.SurfaceProperties_s(face, props)
    return props.Mass()


def _face_centroid(face):
    """Calculate the absolute volumetric center of a face using its 3D bounding box."""
    bbox = Bnd_Box()
    BRepBndLib.Add_s(face, bbox)
    xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
    return np.array([
        (xmin + xmax) / 2.0,
        (ymin + ymax) / 2.0,
        (zmin + zmax) / 2.0
    ], dtype=np.float64)


def _build_face_edge_adjacency(shape, faces):
    """Build a map: edge_index -> list of face indices that share that edge."""
    edge_map = TopTools_IndexedMapOfShape()
    TopExp.MapShapes_s(shape, TopAbs_EDGE, edge_map)

    # For each face, find its edges and record adjacency
    edge_to_faces = {}
    for fi, face in enumerate(faces):
        fe_map = TopTools_IndexedMapOfShape()
        TopExp.MapShapes_s(face, TopAbs_EDGE, fe_map)
        for ei in range(1, fe_map.Extent() + 1):
            edge = fe_map.FindKey(ei)
            # Find this edge in the global map
            global_idx = edge_map.FindIndex(edge)
            if global_idx > 0:
                edge_to_faces.setdefault(global_idx, []).append(fi)
    return edge_to_faces, edge_map


def _json_safe(obj):
    """Recursively convert NaNs, Infinites, and NumPy types for JSON compatibility."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return obj
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.float64) or isinstance(obj, np.float32):
        return float(obj)
    elif isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    elif isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    return obj


def _normalize(vec):
    length = np.linalg.norm(vec)
    if length < 1e-12:
        return vec.copy()
    return vec / length


def _planes_are_coplanar(face_a_info, face_b_info, angular_tol=0.999, dist_tol=1e-3):
    """Check whether two planar faces lie on the same geometric plane."""
    if face_a_info[0] != "plane" or face_b_info[0] != "plane":
        return False

    _, n_a, p_a = face_a_info
    _, n_b, p_b = face_b_info
    n_a = _normalize(n_a)
    n_b = _normalize(n_b)

    if abs(np.dot(n_a, n_b)) < angular_tol:
        return False

    return abs(np.dot(n_a, p_b - p_a)) <= dist_tol


def _is_real_bend_pair(face_a_info, face_b_info, angular_tol=0.985):
    """
    True for actual flange-style bends, false for hole walls and parallel top/bottom skins.
    """
    if face_a_info[0] != "plane" or face_b_info[0] != "plane":
        return False

    _, n_a, _ = face_a_info
    _, n_b, _ = face_b_info
    n_a = _normalize(n_a)
    n_b = _normalize(n_b)
    return abs(np.dot(n_a, n_b)) < angular_tol


def _tessellate_face(face, deflection=0.1):
    """Tessellate a face and return (vertices Nx3, triangles Mx3)."""
    BRepMesh_IncrementalMesh(face, deflection)
    loc = TopLoc_Location()
    triangulation = BRep_Tool.Triangulation_s(face, loc)
    if triangulation is None:
        return np.empty((0, 3)), np.empty((0, 3), dtype=int)

    trsf = loc.Transformation()
    nv = triangulation.NbNodes()
    nt = triangulation.NbTriangles()

    verts = np.empty((nv, 3), dtype=np.float64)
    for i in range(1, nv + 1):
        p = triangulation.Node(i).Transformed(trsf)
        verts[i - 1] = [p.X(), p.Y(), p.Z()]

    tris = np.empty((nt, 3), dtype=np.int32)
    for i in range(1, nt + 1):
        tri = triangulation.Triangle(i)
        n1, n2, n3 = tri.Get()
        if face.Orientation() == TopAbs_FORWARD:
            tris[i - 1] = [n1 - 1, n2 - 1, n3 - 1]
        else:
            tris[i - 1] = [n1 - 1, n3 - 1, n2 - 1]

    return verts, tris


def _edge_endpoints(edge_shape):
    """Get start and end points of an edge."""
    curve = BRepAdaptor_Curve(edge_shape)
    first = curve.FirstParameter()
    last = curve.LastParameter()
    if not math.isfinite(first) or not math.isfinite(last):
        return None, None
    p1 = curve.Value(first)
    p2 = curve.Value(last)
    return np.array([p1.X(), p1.Y(), p1.Z()]), np.array([p2.X(), p2.Y(), p2.Z()])


def _sample_edge_points(edge_shape):
    """
    Approximate a topological edge with enough points to preserve circular/curved cuts.
    """
    curve = BRepAdaptor_Curve(edge_shape)
    first = curve.FirstParameter()
    last = curve.LastParameter()
    if not math.isfinite(first) or not math.isfinite(last):
        endpoints = _edge_endpoints(edge_shape)
        return [pt for pt in endpoints if pt is not None]

    curve_type = curve.GetType()
    if curve_type == GeomAbs_Line:
        sample_count = 2
    elif curve_type in (GeomAbs_Circle, GeomAbs_Ellipse):
        # Roughly 10-degree resolution for smooth circles/arcs.
        sample_count = max(12, int(math.ceil(abs(last - first) / (math.pi / 18))) + 1)
    else:
        sample_count = 24

    points = []
    for i in range(sample_count):
        u = first if sample_count == 1 else first + (last - first) * (i / (sample_count - 1))
        p = curve.Value(u)
        points.append(np.array([p.X(), p.Y(), p.Z()]))
    return points


def _edge_direction(edge_shape):
    """Unit direction from the edge endpoints."""
    p1, p2 = _edge_endpoints(edge_shape)
    if p1 is None or p2 is None:
        return None
    delta = p2 - p1
    length = np.linalg.norm(delta)
    if length < 1e-9:
        return None
    return delta / length


def _estimate_cylinder_thickness(face_info):
    """Return the modal concentric-cylinder radius delta for formed sheet."""
    radius_groups = {}
    for info in face_info:
        if info[0] != "cylinder":
            continue
        _kind, axis, radius, center = info
        axis = _normalize(np.asarray(axis, dtype=float))
        if tuple(np.round(axis, 5)) < tuple(np.round(-axis, 5)):
            axis = -axis
        center = np.asarray(center, dtype=float)
        projected_center = center - (np.dot(center, axis) * axis)
        key = tuple(np.round(np.concatenate((axis, projected_center)), 4))
        radius_groups.setdefault(key, []).append(float(radius))

    deltas = []
    for radii in radius_groups.values():
        if len(radii) < 2:
            continue
        for idx, first in enumerate(radii):
            for second in radii[idx + 1:]:
                delta = abs(first - second)
                if delta > 0.05:
                    deltas.append(round(delta, 4))

    if not deltas:
        return 0.0

    counts = {}
    for delta in deltas:
        counts[delta] = counts.get(delta, 0) + 1
    return float(min(counts, key=lambda value: (-counts[value], value)))


def _estimate_thickness(faces, face_info, face_areas):
    """
    Estimate sheet metal thickness as the distance between the two largest
    anti-parallel (top/bottom skin) planar faces.  Returns 0.0 if unknown.
    """
    planar = [
        (i, info, face_areas[i])
        for i, info in enumerate(face_info)
        if info[0] == "plane"
    ]
    planar.sort(key=lambda x: -x[2])
    candidates = []

    # The previous implementation returned the first anti-parallel pair among
    # the largest faces. On formed parts that can be the distance between two
    # flanges, not the material thickness. Evaluate all plausible skin pairs
    # and choose the smallest matching separation instead.
    for idx_i, (fi, info_i, area_i) in enumerate(planar[:48]):
        n_i = _normalize(info_i[1])
        p_i = info_i[2]
        for fi2, info_j, area_j in planar[idx_i + 1:48]:
            n_j = _normalize(info_j[1])
            if np.dot(n_i, n_j) < -0.99:            # anti-parallel normals → opposite skins
                d = abs(float(np.dot(n_i, info_j[2] - p_i)))
                if d > 0.05:
                    area_ratio = min(area_i, area_j) / max(area_i, area_j, 1e-9)
                    candidates.append((d, area_ratio))

    cylinder_thickness = _estimate_cylinder_thickness(face_info)
    matched_skin_pairs = [d for d, ratio in candidates if ratio >= 0.45]
    planar_thickness = 0.0
    if matched_skin_pairs:
        planar_thickness = min(matched_skin_pairs)
    elif candidates:
        planar_thickness = min(d for d, _ratio in candidates)

    # On formed geometry, flange separation can be tens of times larger than
    # the material gauge. Prefer the repeated bend-radius delta in that case.
    if cylinder_thickness > 0 and (
        planar_thickness <= 0 or cylinder_thickness <= planar_thickness * 0.5
    ):
        return cylinder_thickness
    return planar_thickness


def _canonical_axis_line(axis, center, precision=3):
    """Stable key for cylinders that share the same physical center line."""
    axis = _normalize(np.asarray(axis, dtype=float))
    if tuple(np.round(axis, 6)) < tuple(np.round(-axis, 6)):
        axis = -axis
    center = np.asarray(center, dtype=float)
    projected_center = center - np.dot(center, axis) * axis
    return tuple(np.round(np.concatenate((axis, projected_center)), precision))


def _physical_bend_groups(
    bend_connections,
    face_info,
    faces,
    edge_map,
    thickness,
):
    """
    Pair the inner and outer cylindrical skins of each physical bend.

    STEP files contain both sheet skins and often many short cylindrical
    fillets. A physical sheet bend is the concentric cylinder pair whose
    radius delta equals the material thickness. Returning only those pairs
    prevents render segments and corner fillets from becoming billable bends.
    """
    if thickness <= 1e-6:
        return []

    connections_by_cylinder = {}
    cylinders_by_axis = {}
    for connection in bend_connections:
        ci = connection[2]
        connections_by_cylinder.setdefault(ci, []).append(connection)
        _kind, axis, radius, center = face_info[ci]
        key = _canonical_axis_line(axis, center)
        cylinders_by_axis.setdefault(key, []).append((ci, float(radius)))

    tolerance = max(0.08, thickness * 0.12)
    groups = []
    used_cylinders = set()
    for axis_key, cylinders in cylinders_by_axis.items():
        candidates = []
        for index, (first_ci, first_radius) in enumerate(cylinders):
            for second_ci, second_radius in cylinders[index + 1:]:
                delta_error = abs(abs(first_radius - second_radius) - thickness)
                if delta_error <= tolerance:
                    candidates.append(
                        (delta_error, first_ci, first_radius, second_ci, second_radius)
                    )

        for _error, first_ci, first_radius, second_ci, second_radius in sorted(candidates):
            if first_ci in used_cylinders or second_ci in used_cylinders:
                continue
            if first_radius <= second_radius:
                inner_ci, inner_radius = first_ci, first_radius
                outer_ci, outer_radius = second_ci, second_radius
            else:
                inner_ci, inner_radius = second_ci, second_radius
                outer_ci, outer_radius = first_ci, first_radius

            outer_connections = connections_by_cylinder.get(outer_ci, [])
            inner_connections = connections_by_cylinder.get(inner_ci, [])
            if not outer_connections or not inner_connections:
                continue

            best_axis = None
            best_length = 0.0
            for connection in outer_connections + inner_connections:
                for edge_id in connection[3] + connection[4]:
                    edge_shape = TopoDS.Edge_s(edge_map.FindKey(edge_id))
                    p0, p1 = _edge_endpoints(edge_shape)
                    if p0 is None or p1 is None:
                        continue
                    length = float(np.linalg.norm(p1 - p0))
                    if length > best_length:
                        best_length = length
                        best_axis = (p0, p1)

            representative = outer_connections[0]
            bend_angle = _compute_bend_angle(
                face_info[representative[0]],
                face_info[representative[1]],
                face_info[outer_ci],
            )
            groups.append({
                "axis_key": axis_key,
                "inner_cylinder": inner_ci,
                "outer_cylinder": outer_ci,
                "inner_radius": inner_radius,
                "outer_radius": outer_radius,
                "outer_connections": outer_connections,
                "inner_connections": inner_connections,
                "outside_faces": {
                    face_id
                    for connection in outer_connections
                    for face_id in connection[:2]
                },
                "axis_points": best_axis,
                "length": best_length,
                "angle": bend_angle,
            })
            used_cylinders.update((inner_ci, outer_ci))

    return groups


def _build_bend_tree(seed, planar_adj, face_info, faces, edge_map, bend_connections=None):
    """
    Construct the hierarchical bend tree that HierarchicalProjectViewer expects.

    Node schema:
      {
        id, parentId, children,
        initialNormal,
        isCoplanar,
        extraFaceIds,                  # list of non-planar (cylinder/other) face IDs to render
        bendAxis: {p0, p1, length},   # only on bent children
        initialAngle,                  # degrees, only on bent children
      }
    """
    # Build a mapping: child_planar_face_id → list of associated cylinder face IDs
    # Cylinders are assigned to the CHILD face so they move with the rotating flange
    cyl_for_child = {}
    if bend_connections:
        # We don't know which is parent/child until BFS; build both-way lookup
        for pa, pb, ci, _ea, _eb in bend_connections:
            cyl_for_child.setdefault(pb, []).append(ci)
            cyl_for_child.setdefault(pa, []).append(ci)

    nodes = {}
    root = {
        "id": seed,
        "parentId": None,
        "children": [],
        "initialNormal": _normalize(face_info[seed][1]).tolist(),
        "isCoplanar": False,
        "extraFaceIds": [],
    }
    nodes[seed] = root

    visited = {seed}
    assigned_cyls = set()  # track which cylinders have been assigned to avoid duplicates
    queue = [seed]

    while queue:
        cur = queue.pop(0)
        cur_node = nodes[cur]

        for conn in planar_adj.get(cur, []):
            nb = conn["neighbor"]
            if nb in visited:
                continue
            visited.add(nb)
            queue.append(nb)

            _, nb_normal, _ = face_info[nb]

            # Assign the shared cylinder face to this child node (once only)
            extra_ids = []
            if conn["type"] == "bend":
                ci = conn.get("cylinder")
                if ci is not None and ci not in assigned_cyls:
                    extra_ids.append(ci)
                    assigned_cyls.add(ci)

            child = {
                "id": nb,
                "parentId": cur,
                "children": [],
                "initialNormal": _normalize(nb_normal).tolist(),
                "isCoplanar": conn["type"] == "coplanar",
                "extraFaceIds": extra_ids,
            }

            if conn["type"] == "bend":
                shared_edges = conn.get("edges_a", conn.get("edges", []))
                p0_coords = p1_coords = None
                if shared_edges:
                    edge_shape = TopoDS.Edge_s(edge_map.FindKey(shared_edges[0]))
                    ep1, ep2 = _edge_endpoints(edge_shape)
                    if ep1 is not None:
                        p0_coords = [round(float(v), 4) for v in ep1]
                        p1_coords = [round(float(v), 4) for v in ep2]

                if p0_coords is None:
                    # Fallback: construct axis stub from cylinder axis + face centroids
                    axis_dir = _normalize(conn["axis"])
                    mid = (_face_centroid(faces[cur]) + _face_centroid(faces[nb])) / 2.0
                    half = axis_dir * 50.0
                    p0_coords = (mid - half).tolist()
                    p1_coords = (mid + half).tolist()

                length = float(np.linalg.norm(np.array(p1_coords) - np.array(p0_coords)))
                child["bendAxis"] = {
                    "p0": p0_coords,
                    "p1": p1_coords,
                    "length": round(length, 4),
                }
                child["initialAngle"] = round(math.degrees(conn["angle"]), 2)

            nodes[nb] = child
            cur_node["children"].append(child)

    return root


def _compute_bend_angle(face_a_info, face_b_info, cyl_info):
    """
    Compute the bend angle between two planar faces connected by a cylindrical bend.
    Returns angle in radians (positive = valley bend, negative = mountain).
    """
    _, n_a, _ = face_a_info
    _, n_b, _ = face_b_info
    dot = np.clip(np.dot(n_a, n_b), -1.0, 1.0)
    angle = math.acos(abs(dot))
    return math.pi - angle  # bend angle = supplement of dihedral


def _rotation_matrix(axis, angle, point):
    """Compute a 4x4 rotation matrix around axis through point."""
    axis = axis / np.linalg.norm(axis)
    c = math.cos(angle)
    s = math.sin(angle)
    t = 1 - c
    x, y, z = axis

    R = np.array([
        [t*x*x + c,   t*x*y - s*z, t*x*z + s*y],
        [t*x*y + s*z, t*y*y + c,   t*y*z - s*x],
        [t*x*z - s*y, t*y*z + s*x, t*z*z + c  ],
    ])

    # Translation component: point - R @ point
    trans = point - R @ point
    return R, trans


def _rotation_between_vectors(vec_from, vec_to):
    """Return a 3x3 rotation matrix that maps vec_from onto vec_to."""
    a = _normalize(vec_from)
    b = _normalize(vec_to)
    dot = float(np.clip(np.dot(a, b), -1.0, 1.0))

    if dot > 0.999999:
        return np.eye(3)

    if dot < -0.999999:
        axis = np.cross(a, np.array([1.0, 0.0, 0.0]))
        if np.linalg.norm(axis) < 1e-6:
            axis = np.cross(a, np.array([0.0, 1.0, 0.0]))
        axis = _normalize(axis)
        return _rotation_matrix(axis, math.pi, np.zeros(3))[0]

    axis = _normalize(np.cross(a, b))
    angle = math.acos(dot)
    return _rotation_matrix(axis, angle, np.zeros(3))[0]


def _transform_point(point, R, t):
    return R @ point + t


def _flatten_points_to_xy(points):
    flattened = []
    for pt in points:
        flat = pt.copy()
        flat[2] = 0.0
        flattened.append(flat)
    return flattened


def _append_polyline_segments(output, points, R, t):
    if len(points) < 2:
        return

    transformed = [_transform_point(pt, R, t) for pt in points]
    transformed = _flatten_points_to_xy(transformed)
    for start, end in zip(transformed, transformed[1:]):
        output.extend(start.tolist())
        output.extend(end.tolist())


def _get_line_hash(line, tol=0.1):
    """Generate a canonical hashable tuple for a line segment regardless of orientation."""
    p1 = (round(line[0]/tol)*tol, round(line[1]/tol)*tol, round(line[2]/tol)*tol)
    p2 = (round(line[3]/tol)*tol, round(line[4]/tol)*tol, round(line[5]/tol)*tol)
    # Sort endpoints to ensure same hash for same segment in any order
    return tuple(sorted([p1, p2]))


def _get_projection_edges(shape, plane_code="xy", edge_to_faces=None, edge_map=None, face_info=None, limit_to_edges=None, exclude_edges=None):
    """
    Project visible edges onto a plane. 
    limit_to_edges: Optional list of global edge indices to project (e.g. only bends).
    exclude_edges: Optional list of global edge indices to SKIP.
    """
    view_axis_idx = {"xy": 2, "xz": 1, "yz": 0}[plane_code]
    
    if limit_to_edges is not None:
        # Only process the requested edges (e.g. for folded bend lines)
        edges_to_process = []
        for eidx in limit_to_edges:
            if 0 < eidx <= edge_map.Extent():
                edges_to_process.append(TopoDS.Edge_s(edge_map.FindKey(eidx)))
    else:
        edges_to_process = _get_edges(shape)

    coords = []
    seen_edges = set()

    for edge in edges_to_process:
        eidx = edge_map.FindIndex(edge)
        
        # EXCLUSION: Skip edges that are already handled by other layers (e.g. bends)
        if exclude_edges is not None and eidx in exclude_edges:
            continue

        if eidx in seen_edges and limit_to_edges is None:
            continue
        
        # VISIBILITY FILTER (only for the main silhouette)
        if limit_to_edges is None and edge_to_faces is not None and face_info is not None:
            adj_faces = edge_to_faces.get(eidx, [])
            is_visible = False
            for fi in adj_faces:
                info = face_info[fi]
                if info[0] == "plane":
                    if info[1][view_axis_idx] > 0.05:
                        is_visible = True
                        break
                else:
                    is_visible = True
                    break
            if not is_visible:
                continue

        # SMOOTHING: Use direct endpoints for straight lines to avoid jagged tessellation
        adaptor = BRepAdaptor_Curve(edge)
        if adaptor.GetType() == GeomAbs_Line:
            p1, p2 = _edge_endpoints(edge)
            pts = [p1, p2] if (p1 is not None and p2 is not None) else []
        else:
            pts = _sample_edge_points(edge)

        if len(pts) < 2:
            continue

        seen_edges.add(eidx)

        # Project and flatten
        projected = []
        for p in pts:
            if plane_code == "xy":
                projected.append([p[0], p[1], 0.0])
            elif plane_code == "xz":
                projected.append([p[0], p[2], 0.0])
            elif plane_code == "yz":
                projected.append([p[1], p[2], 0.0])

        for i in range(len(projected) - 1):
            coords.extend([round(v, 4) for v in projected[i]])
            coords.extend([round(v, 4) for v in projected[i+1]])
    return coords


def _compute_cluster_angular_span(cluster_items, axis):
    """
    Returns total angular span (degrees) of tessellated cluster faces projected
    around `axis`.  A full drilled hole = ~360°; a slot end = ~180°.
    Uses the largest gap in the angle distribution to compute span = 360 - gap.
    Works correctly for cylinders in any orientation (vertical, horizontal, etc.).
    """
    # Build two orthogonal basis vectors in the plane perpendicular to axis
    axis = np.asarray(axis, dtype=float)
    u = np.array([1.0, 0.0, 0.0])
    if abs(np.dot(u, axis)) > 0.9:   # axis is nearly along X, pick Y instead
        u = np.array([0.0, 1.0, 0.0])
    u = u - np.dot(u, axis) * axis
    u /= np.linalg.norm(u)
    w = np.cross(axis, u)             # w is the second basis vector

    all_angles = []
    for face, cyl_center in cluster_items:
        verts, _ = _tessellate_face(face)
        if verts.shape[0] == 0:
            continue
        rel = verts - cyl_center
        proj = np.dot(rel, axis)[:, None] * axis
        in_plane = rel - proj
        for v in in_plane:
            if np.linalg.norm(v) > 1e-6:
                all_angles.append(math.atan2(float(np.dot(v, w)), float(np.dot(v, u))))
    if len(all_angles) < 3:
        return 0.0
    all_angles = sorted(all_angles)
    n = len(all_angles)
    gaps = [(all_angles[(i + 1) % n] - all_angles[i]) % (2 * math.pi) for i in range(n)]
    return math.degrees(2 * math.pi - max(gaps))


def detect_holes_in_step(filepath: str) -> list:
    """
    Detect cylindrical holes in a STEP file.

    Returns a list of dicts:
        [{"id": "hole_1", "diameter_mm": float, "diameter_in": float, "position": [x, y, z]}]

    Two cylindrical faces are considered the same hole when they share the same
    radius (within 0.5 %), have parallel axes (dot-product ≥ 0.995), and their
    centres are collinear with that axis (perpendicular distance ≤ 0.5 × radius
    + 0.5 mm).
    """
    shape = cq.importers.importStep(filepath)
    occ_shape = shape.val().wrapped

    faces = _get_faces(occ_shape)
    face_info = [_classify_face(f) for f in faces]

    # Collect cylindrical faces that represent interior holes.
    # FORWARD orientation = convex exterior rounded edge → skip.
    # REVERSED orientation = concave interior surface → drilled/milled hole.
    # Also skip sub-millimetre radii which are CAD fillets, not drilled holes.
    raw = []
    for fi, info in enumerate(face_info):
        if info[0] != "cylinder":
            continue
        _, axis, radius, center = info

        if radius < 0.5:          # < 1 mm diameter → fillet artefact
            continue
        if faces[fi].Orientation() == TopAbs_FORWARD:   # convex exterior edge
            continue

        raw.append({
            "fi": fi,
            "radius": float(radius),
            "axis": _normalize(np.array(axis, dtype=float)),
            # FIX: Use the geometric axis location (p) from _classify_face, 
            # NOT the bounding box center, otherwise partial cylinders (180 deg) 
            # won't cluster because their BBox center is off-axis.
            "center": center, 
        })

    if not raw:
        return []

    # Minimum hole depth (mm) = total cluster face area / (2π·r).
    # Chamfer lead-ins and other shallow artefacts are typically < 1.5 mm deep.
    MIN_DEPTH_MM = 0.5

    seen: set = set()
    holes: list = []

    for i, cyl in enumerate(raw):
        if i in seen:
            continue
        seen.add(i)
        cluster = [cyl]

        for j in range(i + 1, len(raw)):
            if j in seen:
                continue
            other = raw[j]

            # Same radius within 1.5 % (machined holes can have split faces with slight variation)
            max_r = max(cyl["radius"], other["radius"]) + 1e-9
            if abs(cyl["radius"] - other["radius"]) / max_r > 0.015:
                continue

            # Parallel axes within ~10°
            if abs(float(np.dot(cyl["axis"], other["axis"]))) < 0.985:
                continue

            # Centers colinear with cyl axis — wider tolerance for machined parts
            diff = other["center"] - cyl["center"]
            perp = diff - np.dot(diff, cyl["axis"]) * cyl["axis"]
            if float(np.linalg.norm(perp)) > cyl["radius"] * 1.0 + 1.0:
                continue

            seen.add(j)
            cluster.append(other)

        # Filter: effective depth = total_area / (2π·r)
        total_area = sum(_face_area(faces[c["fi"]]) for c in cluster)
        effective_depth = total_area / (2 * math.pi * cyl["radius"])
        if effective_depth < MIN_DEPTH_MM:
            continue

        # Filter: skip tight fillets, only real holes ≥ 270°
        MIN_ANGULAR_SPAN_DEG = 270.0
        angular_span = _compute_cluster_angular_span(
            [(faces[c["fi"]], cyl["center"]) for c in cluster],
            cyl["axis"]
        )
        if angular_span < MIN_ANGULAR_SPAN_DEG:
            continue

        all_pts = []
        for c in cluster:
            fverts, _ = _tessellate_face(faces[c["fi"]])
            if fverts.shape[0] > 0:
                all_pts.append(fverts)
        
        if all_pts:
            pts_concat = np.concatenate(all_pts, axis=0)
            proj = np.dot(pts_concat - cyl["center"], cyl["axis"])
            z_min, z_max = np.min(proj), np.max(proj)
            avg_center = cyl["center"] + ((z_min + z_max) / 2.0) * cyl["axis"]
        else:
            avg_center = np.mean([c["center"] for c in cluster], axis=0)
        diameter_mm = cyl["radius"] * 2.0

        holes.append({
            "id": f"hole_{len(holes) + 1}",
            "diameter_mm": round(diameter_mm, 4),
            "diameter_in": round(diameter_mm / 25.4, 6),
            "position": [
                round(float(avg_center[0]), 4),
                round(float(avg_center[1]), 4),
                round(float(avg_center[2]), 4),
            ],
            "axis": [
                round(float(cyl["axis"][0]), 4),
                round(float(cyl["axis"][1]), 4),
                round(float(cyl["axis"][2]), 4),
            ],
            "depth_mm": round(float(effective_depth), 4)
        })

    # Sort smallest → largest for consistent display
    holes.sort(key=lambda h: h["diameter_mm"])
    
    # ─── New Clustering: Merge multi-diameter holes (Counterbores) ───
    # If two 'holes' share the same position and axis but have different diameters,
    # it's 100% a counterbore. Merge them and keep the smallest diameter (the drill size).
    final_merged = []
    seen_merged = set()
    for i, h1 in enumerate(holes):
        if i in seen_merged: continue
        best_h = h1
        seen_merged.add(i)
        
        for j in range(i + 1, len(holes)):
            if j in seen_merged: continue
            h2 = holes[j]
            dist = np.linalg.norm(np.array(h1["position"]) - np.array(h2["position"]))
            # Cross product shows if axes are parallel
            cross = np.linalg.norm(np.cross(h1["axis"], h2["axis"]))
            
            # If centres match within 2.5mm and axes are parallel
            if dist < 2.5 and cross < 0.1:
                seen_merged.add(j)
                # Keep the smaller one
                if h2["diameter_mm"] < best_h["diameter_mm"]:
                    best_h = h2
        final_merged.append(best_h)

    for idx, h in enumerate(final_merged):
        h["id"] = f"hole_{idx + 1}"

    return _json_safe(final_merged)


def unfold_step_file(filepath: str) -> dict:
    """
    Main entry point. Loads STEP, unfolds sheet metal, returns JSON-serializable dict.

    Returns:
    {
        "flatVertices": [x,y,z, x,y,z, ...],  # flat list of triangle vertices
        "cutEdges": [x1,y1,z1, x2,y2,z2, ...],  # pairs of points for cut lines
        "bendEdges": [x1,y1,z1, x2,y2,z2, ...],  # pairs of points for bend lines
        "thickness": float,
        "bbox": {"width": float, "height": float}
    }
    """
    # 1. Load STEP
    shape = cq.importers.importStep(filepath)
    occ_shape = shape.val().wrapped

    # 2. Get all faces and classify
    faces = _get_faces(occ_shape)
    face_info = [_classify_face(f) for f in faces]
    face_areas = [_face_area(f) for f in faces]

    # 3. Build adjacency
    edge_to_faces, edge_map = _build_face_edge_adjacency(occ_shape, faces)

    # Build direct face-to-face adjacency through shared edges
    face_adj = {i: {} for i in range(len(faces))}
    for eidx, flist in edge_to_faces.items():
        if len(flist) == 2:
            a, b = flist[0], flist[1]
            face_adj[a].setdefault(b, []).append(eidx)
            face_adj[b].setdefault(a, []).append(eidx)

    # 4. Identify planar faces and cylindrical bends
    planar_faces = [i for i, info in enumerate(face_info) if info[0] == "plane"]
    cylinder_faces = [i for i, info in enumerate(face_info) if info[0] == "cylinder"]

    # Build "through-bend" adjacency: planar_face_A <-> planar_face_B via cylinder
    bend_connections = []  # (planar_a, planar_b, cylinder_face, shared_edges_a, shared_edges_b)
    major_face_area = max(face_areas[i] for i in planar_faces) if planar_faces else 0.0
    panel_area_threshold = major_face_area * 0.01
    for ci in cylinder_faces:
        connected_planar = []
        for adj_fi, edges in face_adj[ci].items():
            if face_info[adj_fi][0] == "plane":
                connected_planar.append((adj_fi, edges))
        if len(connected_planar) < 2:
            continue

        candidates = [
            (fi, edges) for fi, edges in connected_planar
            if face_areas[fi] >= panel_area_threshold
        ]
        if len(candidates) < 2:
            continue

        seen_pairs = set()
        for idx in range(len(candidates)):
            pa, ea = candidates[idx]
            for jdx in range(idx + 1, len(candidates)):
                pb, eb = candidates[jdx]
                if not _is_real_bend_pair(face_info[pa], face_info[pb]):
                    continue
                pair_key = tuple(sorted((pa, pb)))
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)
                bend_connections.append((pa, pb, ci, ea, eb))

    thickness_est = _estimate_thickness(faces, face_info, face_areas)
    physical_bends = _physical_bend_groups(
        bend_connections,
        face_info,
        faces,
        edge_map,
        thickness_est,
    )

    # Follow only the outer cylindrical skin when a valid inner/outer pair is
    # available. This makes the flattened dimensions represent the outside of
    # the manufactured part and excludes decorative fillets from bend costing.
    if physical_bends:
        active_bend_connections = [
            connection
            for bend in physical_bends
            for connection in bend["outer_connections"][:1]
        ]
        outside_faces = {
            face_id
            for bend in physical_bends
            for face_id in bend["outside_faces"]
        }
    else:
        active_bend_connections = bend_connections
        outside_faces = set()

    # 5. Build planar-face adjacency graph
    planar_adj = {i: [] for i in planar_faces}

    for pi in planar_faces:
        for adj_fi, edges in face_adj[pi].items():
            if adj_fi in planar_adj and adj_fi != pi:
                if _planes_are_coplanar(face_info[pi], face_info[adj_fi]):
                    planar_adj[pi].append({"neighbor": adj_fi, "type": "coplanar", "edges": edges})

    for pa, pb, ci, ea, eb in active_bend_connections:
        cyl_info = face_info[ci]
        bend_angle = _compute_bend_angle(face_info[pa], face_info[pb], cyl_info)
        _, cyl_axis, cyl_radius, cyl_center = cyl_info
        planar_adj[pa].append({
            "neighbor": pb, "type": "bend", "cylinder": ci,
            "edges_a": ea, "edges_b": eb,
            "angle": bend_angle, "axis": cyl_axis, "radius": cyl_radius, "center": cyl_center
        })
        planar_adj[pb].append({
            "neighbor": pa, "type": "bend", "cylinder": ci,
            "edges_a": eb, "edges_b": ea,
            "angle": bend_angle, "axis": cyl_axis, "radius": cyl_radius, "center": cyl_center
        })

    # 6. BFS unfold from largest planar face
    if not planar_faces:
        raise ValueError("No planar faces found — not a sheet metal part?")

    outside_candidates = [face_id for face_id in outside_faces if face_id in planar_faces]
    seed = max(outside_candidates or planar_faces, key=lambda i: face_areas[i])
    flat_mode = (not active_bend_connections) or thickness_est <= 1e-4

    # Tessellate all planar faces
    face_meshes = {}
    for fi in planar_faces:
        verts, tris = _tessellate_face(faces[fi])
        face_meshes[fi] = (verts.copy(), tris.copy())

    if flat_mode:
        seed_normal = _normalize(face_info[seed][1])
        align_R = _rotation_between_vectors(seed_normal, np.array([0.0, 0.0, 1.0]))
        seed_point = align_R @ face_info[seed][2]
        align_t = np.array([0.0, 0.0, -seed_point[2]])
        face_transforms = {
            fi: (align_R.copy(), align_t.copy())
            for fi in planar_faces
        }
    else:
        # BFS: accumulate rotation transforms per face
        visited = {seed}
        queue = [seed]
        face_transforms = {seed: (np.eye(3), np.zeros(3))}  # (R, t) cumulative

        while queue:
            cur = queue.pop(0)
            cur_R, cur_t = face_transforms[cur]

            for conn in planar_adj.get(cur, []):
                nb = conn["neighbor"]
                if nb in visited:
                    continue

                # Calculate candidate transform for this neighbor
                nb_R, nb_t = None, None
                _, n_nb, _ = face_info[nb]
                _, seed_normal, _ = face_info[seed]
                seed_n_unfolded = face_transforms[seed][0] @ seed_normal

                if conn["type"] == "coplanar":
                    nb_R, nb_t = cur_R.copy(), cur_t.copy()
                elif conn["type"] == "bend":
                    angle = conn["angle"]
                    bend_axis = conn["axis"]
                    shared_edges = conn.get("edges_a", [])
                    if shared_edges:
                        edge_shape = TopoDS.Edge_s(edge_map.FindKey(shared_edges[0]))
                        ep1, ep2 = _edge_endpoints(edge_shape)
                        if ep1 is not None:
                            cyl_center = conn.get("center")
                            if cyl_center is not None:
                                pivot = cur_R @ cyl_center + cur_t
                            else:
                                pivot = cur_R @ ep1 + cur_t

                            axis_dir = bend_axis if bend_axis is not None else _edge_direction(edge_shape)
                            if axis_dir is not None:
                                axis_in_unfolded = _normalize(cur_R @ axis_dir)

                                for sign in [1, -1]:
                                    R_bend, t_bend = _rotation_matrix(axis_in_unfolded, sign * angle, pivot)
                                    trial_R = R_bend @ cur_R
                                    trial_t = R_bend @ cur_t + t_bend
                                    trial_n = trial_R @ n_nb
                                    if np.dot(trial_n, seed_n_unfolded) > 0.85:
                                        if thickness_est > 0:
                                            inner_r = conn.get("radius", 0.0)
                                            ba = angle * (inner_r + K_FACTOR * thickness_est)
                                            correction = ba  # Rotate around cylinder center makes gap 0, so shift by exact ba

                                            centroid_nb = _face_centroid(faces[nb])
                                            c_unfolded = trial_R @ centroid_nb + trial_t

                                            # Direction outward from Face A boundary
                                            edge_world = cur_R @ ep1 + cur_t
                                            kdir = c_unfolded - edge_world
                                            kdir = kdir - np.dot(kdir, axis_in_unfolded) * axis_in_unfolded
                                            klen = np.linalg.norm(kdir)
                                            if klen > 1e-6:
                                                trial_t = trial_t + (correction / klen) * kdir
                                        nb_R, nb_t = trial_R, trial_t
                                        break

                if nb_R is not None:
                    final_n = nb_R @ n_nb
                    if np.dot(final_n, seed_n_unfolded) > 0.85:
                        visited.add(nb)
                        queue.append(nb)
                        face_transforms[nb] = (nb_R, nb_t)

    seed_normal = _normalize(face_transforms[seed][0] @ face_info[seed][1])
    align_R = _rotation_between_vectors(seed_normal, np.array([0.0, 0.0, 1.0]))
    seed_point = _transform_point(face_info[seed][2], face_transforms[seed][0], face_transforms[seed][1])
    aligned_seed_point = align_R @ seed_point
    align_t = np.array([0.0, 0.0, -aligned_seed_point[2]])

    # 7. Transform all candidate planar faces into a common XY-oriented frame.
    face_records = []

    for fi in planar_faces:
        if fi not in face_transforms or fi not in face_meshes:
            continue
        R, t = face_transforms[fi]
        verts, tris = face_meshes[fi]
        transformed_normal = _normalize(R @ face_info[fi][1])
        if np.dot(transformed_normal, seed_normal) > 0.85:
            # Final global alignment to XY
            final_R = align_R @ R
            final_t = align_R @ t + align_t
            
            t_verts = np.array([final_R @ v + final_t for v in verts])
            face_records.append({
                "face_id": fi,
                "vertices": t_verts,
                "triangles": tris,
                "transform": (final_R, final_t)
            })

    # 8. Extract cut edges (outer/inner loops) in unfolded coordinates
    cut_edges_3d = []
    bend_edges_3d = []
    bend_edge_ids = set()
    for _, _, _, ea, eb in active_bend_connections:
        bend_edge_ids.update(ea)
        bend_edge_ids.update(eb)

    selected_face_ids = {record["face_id"] for record in face_records}
    selected_edge_counts = {}
    for face_id in selected_face_ids:
        face_edge_map = TopTools_IndexedMapOfShape()
        TopExp.MapShapes_s(faces[face_id], TopAbs_EDGE, face_edge_map)
        for edge_index in range(1, face_edge_map.Extent() + 1):
            global_id = edge_map.FindIndex(face_edge_map.FindKey(edge_index))
            if global_id > 0:
                selected_edge_counts[global_id] = selected_edge_counts.get(global_id, 0) + 1

    for rec in face_records:
        fi = rec["face_id"]
        R, t = rec["transform"]
        fe_map = TopTools_IndexedMapOfShape()
        TopExp.MapShapes_s(faces[fi], TopAbs_EDGE, fe_map)
        for ei in range(1, fe_map.Extent() + 1):
            edge = TopoDS.Edge_s(fe_map.FindKey(ei))
            eidx_global = edge_map.FindIndex(edge)
            pts = _sample_edge_points(edge)
            if eidx_global in bend_edge_ids:
                continue
            # Coplanar seams occur twice in the selected outside skin and are
            # not part of the laser perimeter.
            if selected_edge_counts.get(eidx_global, 0) == 1:
                _append_polyline_segments(cut_edges_3d, pts, R, t)

    # Emit one line per physical bend. The previous fallback emitted every
    # sampled render segment, which made one part appear to have 52 bends.
    transforms_by_face = {
        record["face_id"]: record["transform"] for record in face_records
    }
    bend_features = []
    for index, bend in enumerate(physical_bends):
        line_points = None
        for connection in bend["outer_connections"]:
            for face_id, edge_ids in (
                (connection[0], connection[3]),
                (connection[1], connection[4]),
            ):
                transform = transforms_by_face.get(face_id)
                if transform is None or not edge_ids:
                    continue
                edge_shape = TopoDS.Edge_s(edge_map.FindKey(edge_ids[0]))
                p0, p1 = _edge_endpoints(edge_shape)
                if p0 is None or p1 is None:
                    continue
                R, t = transform
                line_points = (R @ p0 + t, R @ p1 + t)
                break
            if line_points is not None:
                break

        if line_points is not None:
            p0, p1 = line_points
            bend_edges_3d.extend([
                float(p0[0]), float(p0[1]), 0.0,
                float(p1[0]), float(p1[1]), 0.0,
            ])

        axis_points = bend.get("axis_points")
        bend_features.append({
            "id": f"bend_{index + 1}",
            "type": "bend",
            "length": round(float(bend.get("length", 0.0)), 4),
            "radius": round(float(bend.get("inner_radius", 0.0)), 4),
            "outerRadius": round(float(bend.get("outer_radius", 0.0)), 4),
            "angle": round(math.degrees(float(bend.get("angle", 0.0))), 4),
            "axis": {
                "p0": axis_points[0].tolist(),
                "p1": axis_points[1].tolist(),
            } if axis_points is not None else None,
            "source": "concentric_sheet_skin_pair",
        })

    # 9. Clean up flat vertices for JSON output
    flat_vertices = []
    for rec in face_records:
        for tri in rec["triangles"]:
            for v_idx in tri:
                v = rec["vertices"][v_idx]
                flat_vertices.extend([round(v[0], 4), round(v[1], 4), 0.0])

    all_pts = []
    for rec in face_records:
        all_pts.append(rec["vertices"])
    
    width, height = 0.0, 0.0
    if all_pts:
        all_v = np.concatenate(all_pts, axis=0)
        v_min = np.min(all_v, axis=0)
        v_max = np.max(all_v, axis=0)
        width = round(float(v_max[0] - v_min[0]), 2)
        height = round(float(v_max[1] - v_min[1]), 2)

    planar_flat_area = 0.0
    for record in face_records:
        vertices = record["vertices"]
        for triangle in record["triangles"]:
            a, b, c = (vertices[triangle[index]] for index in range(3))
            planar_flat_area += 0.5 * float(np.linalg.norm(np.cross(b - a, c - a)))
    bend_flat_area = sum(
        float(bend.get("length", 0.0))
        * abs(float(bend.get("angle", 0.0)))
        * (float(bend.get("inner_radius", 0.0)) + K_FACTOR * thickness_est)
        for bend in physical_bends
    )
    flat_area = planar_flat_area + bend_flat_area
    bounding_area = max(float(width) * float(height), 0.0)
    if bounding_area > 0:
        # Overlapping duplicate STEP faces must not inflate material area.
        flat_area = min(flat_area, bounding_area)

    total_cut_length = 0.0
    for index in range(0, len(cut_edges_3d), 6):
        if index + 5 >= len(cut_edges_3d):
            break
        p0 = np.array(cut_edges_3d[index:index + 3], dtype=float)
        p1 = np.array(cut_edges_3d[index + 3:index + 6], dtype=float)
        total_cut_length += float(np.linalg.norm(p1 - p0))

    # 10. Compute Technical Views (Projections)
    bend_ids = list(bend_edge_ids)
    top_edges = _get_projection_edges(occ_shape, "xy", edge_to_faces, edge_map, face_info, exclude_edges=bend_ids)
    front_edges = _get_projection_edges(occ_shape, "xz", edge_to_faces, edge_map, face_info, exclude_edges=bend_ids)
    side_edges = _get_projection_edges(occ_shape, "yz", edge_to_faces, edge_map, face_info, exclude_edges=bend_ids)

    # Folded bend silhouettes for Drawing View
    top_bend_raw = _get_projection_edges(occ_shape, "xy", edge_to_faces, edge_map, face_info, limit_to_edges=bend_ids)
    front_bend_raw = _get_projection_edges(occ_shape, "xz", edge_to_faces, edge_map, face_info, limit_to_edges=bend_ids)
    side_bend_raw = _get_projection_edges(occ_shape, "yz", edge_to_faces, edge_map, face_info, limit_to_edges=bend_ids)

    # GEOMETRIC DEDUPLICATION: Remove bend lines that overlap with the silhouette (High Performance)
    def chunk_lines(raw):
        return [raw[i:i+6] for i in range(0, len(raw), 6)]
    def flatten_lines(chunks):
        return [val for sub in chunks for val in sub]

    # Pre-build hash sets for silhouettes
    top_sil_hashes = {_get_line_hash(l) for l in chunk_lines(top_edges)}
    front_sil_hashes = {_get_line_hash(l) for l in chunk_lines(front_edges)}
    side_sil_hashes = {_get_line_hash(l) for l in chunk_lines(side_edges)}

    top_bend_edges = flatten_lines([l for l in chunk_lines(top_bend_raw) if _get_line_hash(l) not in top_sil_hashes])
    front_bend_edges = flatten_lines([l for l in chunk_lines(front_bend_raw) if _get_line_hash(l) not in front_sil_hashes])
    side_bend_edges = flatten_lines([l for l in chunk_lines(side_bend_raw) if _get_line_hash(l) not in side_sil_hashes])

    # 11. Final Serialization (Fixed: Convert all numpy types to standard lists)
    serializable_meshes = {}
    for fi, (verts, tris) in face_meshes.items():
        serializable_meshes[str(fi)] = {
            "vertices": [float(v) for v in np.array(verts).flatten()],
            "indices": [int(i) for i in np.array(tris).flatten()]
        }

    return _json_safe({
        "flatVertices": flat_vertices,
        "cutEdges": [float(v) for v in cut_edges_3d],
        "bendEdges": [float(v) for v in bend_edges_3d],
        "topEdges": [float(v) for v in top_edges],
        "frontEdges": [float(v) for v in front_edges],
        "sideEdges": [float(v) for v in side_edges],
        "topBendEdges": [float(v) for v in top_bend_edges],
        "frontBendEdges": [float(v) for v in front_bend_edges],
        "sideBendEdges": [float(v) for v in side_bend_edges],
        "thickness": round(float(thickness_est), 4),
        "bbox": {
            "length": float(max(width, height)),
            "width": float(min(width, height)),
            "xSpan": float(width),
            "ySpan": float(height),
            "height": round(float(thickness_est), 4),
            "source": "unfolded_outside_skin",
            "flatPatternOnly": True,
        },
        "flatPattern": {
            "length": float(max(width, height)),
            "width": float(min(width, height)),
            "area": round(float(flat_area), 4),
            "outsideSkin": True,
            "source": "unfolded_outside_skin_fallback",
        },
        "flatArea": round(float(flat_area), 4),
        "surfaceArea": round(float(sum(face_areas)), 4),
        "totalCutLength": round(float(total_cut_length), 4),
        "bends": bend_features,
        "physicalBendCount": len(bend_features),
        "analysisEngine": "legacy_outside_skin_fallback",
        "outsideSkin": True,
        "processEligibility": {
            "laser": bool(total_cut_length > 0),
            "cnc": False,
            "tubing": False,
        },
        "faceMeshes": serializable_meshes,
        "bendTree": _build_bend_tree(seed, planar_adj, face_info, faces, edge_map, active_bend_connections)
    })
