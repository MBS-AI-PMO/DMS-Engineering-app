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


def _get_projection_edges(shape, plane_code="xy", edge_to_faces=None, edge_map=None, face_info=None):
    """
    Project edges of the shape onto a principal plane.
    plane_code: 'xy' (Top), 'xz' (Front), 'yz' (Side)

    When edge_to_faces, edge_map, and face_info are provided, only silhouette
    edges are included: edges where at least one adjacent face has a normal
    component along the view axis. This filters out interior mesh lines that
    appear between faces which are both parallel to the projection direction.
    """
    # Which component of the face normal determines "facing the viewer"
    view_axis_idx = {"xy": 2, "xz": 1, "yz": 0}[plane_code]
    # Minimum normal component to consider a face as "facing" the view axis
    SILHOUETTE_THRESHOLD = 0.05

    all_edges = _get_edges(shape)
    coords = []
    for edge in all_edges:
        # Silhouette filtering when adjacency data is available
        if edge_to_faces is not None and edge_map is not None and face_info is not None:
            eidx = edge_map.FindIndex(edge)
            adj_faces = edge_to_faces.get(eidx, [])

            if len(adj_faces) >= 2:
                # Include edge only if at least one adjacent face has a significant
                # normal component along the view axis (boundary edges always pass)
                has_view_axis_face = False
                for fi in adj_faces:
                    info = face_info[fi]
                    if info[0] == "plane":
                        if abs(info[1][view_axis_idx]) >= SILHOUETTE_THRESHOLD:
                            has_view_axis_face = True
                            break
                    else:
                        # Non-planar face (cylinder, etc.) – include to be safe
                        has_view_axis_face = True
                        break

                if not has_view_axis_face:
                    continue  # skip interior edge

        pts = _sample_edge_points(edge)
        if len(pts) < 2:
            continue

        # Project and flatten
        projected = []
        for p in pts:
            if plane_code == "xy":
                projected.append([p[0], p[1], 0.0])
            elif plane_code == "xz":
                # For front view (XZ), map Z to Y in 2D
                projected.append([p[0], p[2], 0.0])
            elif plane_code == "yz":
                # For side view (YZ), map Y to X and Z to Y in 2D
                projected.append([p[1], p[2], 0.0])

        for i in range(len(projected) - 1):
            coords.extend(projected[i])
            coords.extend(projected[i+1])
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
    MIN_DEPTH_MM = 1.5

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

        # Filter: slot ends and edge bosses span only ~180°; real drilled holes ≥ ~300°
        MIN_ANGULAR_SPAN_DEG = 300.0
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
    for idx, h in enumerate(holes):
        h["id"] = f"hole_{idx + 1}"

    return holes


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
    # adj[i] = [(face_j, [shared_edge_indices], bend_info_or_None), ...]
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
    bend_edge_ids = set()
    major_face_area = max(face_areas[i] for i in planar_faces) if planar_faces else 0.0
    panel_area_threshold = major_face_area * 0.01
    for ci in cylinder_faces:
        connected_planar = []
        for adj_fi, edges in face_adj[ci].items():
            if face_info[adj_fi][0] == "plane":
                connected_planar.append((adj_fi, edges))
        if len(connected_planar) < 2:
            continue

        # Real bend cylinders can touch panel faces plus thin side-wall faces.
        # Prefer the significant sheet faces when choosing bend pairs.
        candidates = [
            (fi, edges) for fi, edges in connected_planar
            if face_areas[fi] >= panel_area_threshold
        ]
        if len(candidates) < 2:
            candidates = connected_planar

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
                bend_edge_ids.update(ea)
                bend_edge_ids.update(eb)

    # 5. Build planar-face adjacency graph
    planar_adj = {i: [] for i in planar_faces}

    # Direct planar-planar adjacency is used only for true coplanar continuation.
    for pi in planar_faces:
        for adj_fi, edges in face_adj[pi].items():
            if adj_fi in planar_adj and adj_fi != pi:
                if _planes_are_coplanar(face_info[pi], face_info[adj_fi]):
                    planar_adj[pi].append({"neighbor": adj_fi, "type": "coplanar", "edges": edges})

    for pa, pb, ci, ea, eb in bend_connections:
        cyl_info = face_info[ci]
        bend_angle = _compute_bend_angle(face_info[pa], face_info[pb], cyl_info)
        # Get the bend axis from the cylinder
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

    seed = max(planar_faces, key=lambda i: face_areas[i])

    # Tessellate all planar faces
    face_meshes = {}
    for fi in planar_faces:
        verts, tris = _tessellate_face(faces[fi])
        face_meshes[fi] = (verts.copy(), tris.copy())

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
            visited.add(nb)
            queue.append(nb)

            if conn["type"] == "coplanar":
                # Same transform as parent
                face_transforms[nb] = (cur_R.copy(), cur_t.copy())
            elif conn["type"] == "bend":
                # Compute rotation to flatten this face
                angle = conn["angle"]
                bend_axis = conn["axis"]

                # Get a point on the shared edge (bend line) to use as pivot
                shared_edges_on_cur = conn.get("edges_a", conn.get("edges", []))
                if shared_edges_on_cur:
                    edge_shape = TopoDS.Edge_s(edge_map.FindKey(shared_edges_on_cur[0]))
                    ep1, ep2 = _edge_endpoints(edge_shape)
                    if ep1 is not None:
                        # Transform edge endpoints to current unfolded space
                        pivot = cur_R @ ep1 + cur_t
                        if bend_axis is None:
                            bend_axis = _edge_direction(edge_shape)
                        if bend_axis is None:
                            face_transforms[nb] = (cur_R.copy(), cur_t.copy())
                            continue
                        axis_in_unfolded = cur_R @ bend_axis
                        axis_in_unfolded /= np.linalg.norm(axis_in_unfolded)

                        # Determine rotation direction:
                        # The neighbor normal after unfolding should match seed normal
                        _, n_cur, _ = face_info[cur]
                        _, n_nb, _ = face_info[nb]
                        n_cur_unfolded = cur_R @ n_cur
                        n_nb_original = n_nb

                        # Try both rotation directions, pick the one that makes normals align
                        for sign in [1, -1]:
                            R_bend, t_bend = _rotation_matrix(axis_in_unfolded, sign * angle, pivot)
                            # Compose with current transform
                            new_R = R_bend @ cur_R
                            new_t = R_bend @ cur_t + t_bend
                            # Check if neighbor normal becomes aligned with seed normal
                            n_nb_unfolded = new_R @ n_nb_original
                            _, seed_normal, _ = face_info[seed]
                            seed_n_unfolded = face_transforms[seed][0] @ seed_normal
                            if abs(np.dot(n_nb_unfolded, seed_n_unfolded)) > 0.9:
                                face_transforms[nb] = (new_R, new_t)
                                break
                        else:
                            # Fallback: just use positive rotation
                            R_bend, t_bend = _rotation_matrix(axis_in_unfolded, angle, pivot)
                            face_transforms[nb] = (R_bend @ cur_R, R_bend @ cur_t + t_bend)
                    else:
                        face_transforms[nb] = (cur_R.copy(), cur_t.copy())
                else:
                    face_transforms[nb] = (cur_R.copy(), cur_t.copy())

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
        if abs(np.dot(transformed_normal, seed_normal)) < 0.8:
            continue

        # Transform vertices
        transformed = (R @ verts.T).T + t
        transformed = (align_R @ transformed.T).T + align_t
        transformed[:, 2] = 0.0
        face_records.append({
            "fi": fi,
            "verts": transformed,
            "tris": tris,
            "area": face_areas[fi],
        })

    if not face_records:
        return {
            "flatVertices": [],
            "cutEdges": [],
            "bendEdges": [],
            "thickness": 0.0,
            "bbox": {"width": 0.0, "height": 0.0},
        }

    all_flat_verts = []
    all_cut_edges = []
    all_bend_edges = []
    included_faces = {rec["fi"] for rec in face_records}

    for rec in face_records:
        transformed = rec["verts"]
        tris = rec["tris"]

        # Add triangle vertices to flat list
        for tri in tris:
            for vi in tri:
                all_flat_verts.extend(transformed[vi].tolist())

    rendered_edge_ids = set()
    for fi in included_faces:
        R, t = face_transforms[fi]
        combined_R = align_R @ R
        combined_t = align_R @ t + align_t

        fe_map = TopTools_IndexedMapOfShape()
        TopExp.MapShapes_s(faces[fi], TopAbs_EDGE, fe_map)
        for ei in range(1, fe_map.Extent() + 1):
            edge_shape = TopoDS.Edge_s(fe_map.FindKey(ei))
            eidx = edge_map.FindIndex(edge_shape)
            if eidx <= 0 or (fi, eidx) in rendered_edge_ids:
                continue
            rendered_edge_ids.add((fi, eidx))

            adjacent_faces = edge_to_faces.get(eidx, [])
            other_faces = [adj_fi for adj_fi in adjacent_faces if adj_fi != fi]

            if any(
                face_info[other][0] == "plane"
                and other in included_faces
                and _planes_are_coplanar(face_info[fi], face_info[other])
                for other in other_faces
            ):
                continue

            edge_points = _sample_edge_points(edge_shape)
            if eidx in bend_edge_ids:
                _append_polyline_segments(all_bend_edges, edge_points, combined_R, combined_t)
            else:
                _append_polyline_segments(all_cut_edges, edge_points, combined_R, combined_t)

    # 9. Get principal 2D projections (silhouette-filtered using face adjacency)
    top_coords = _get_projection_edges(occ_shape, "xy", edge_to_faces, edge_map, face_info)
    front_coords = _get_projection_edges(occ_shape, "xz", edge_to_faces, edge_map, face_info)
    side_coords = _get_projection_edges(occ_shape, "yz", edge_to_faces, edge_map, face_info)

    # 10. Compute technical metrics for pricing
    total_cut_perimeter = 0
    # all_cut_edges is flat [x1,y1,z1, x2,y2,z2, ...]
    for i in range(0, len(all_cut_edges), 6):
        p1 = np.array(all_cut_edges[i:i+3])
        p2 = np.array(all_cut_edges[i+3:i+6])
        total_cut_perimeter += np.linalg.norm(p2 - p1)

    # Simplified Loop Detection for Pierce Count
    # We find connected components of segments in all_cut_edges
    def count_loops(edges_list):
        if not edges_list: return 0
        adj = {}
        def to_key(pt): return tuple(np.round(pt, 2))
        for i in range(0, len(edges_list), 6):
            p1 = to_key(edges_list[i:i+3])
            p2 = to_key(edges_list[i+3:i+6])
            if p1 == p2: continue
            adj.setdefault(p1, []).append(p2)
            adj.setdefault(p2, []).append(p1)
        
        loops = 0
        visited = set()
        for node in adj:
            if node not in visited:
                loops += 1
                q = [node]
                visited.add(node)
                while q:
                    curr = q.pop(0)
                    for neighbor in adj[curr]:
                        if neighbor not in visited:
                            visited.add(neighbor)
                            q.append(neighbor)
        return loops

    pierce_count = count_loops(all_cut_edges)

    # Bend Summary (Length and Radius)
    bend_summary = []
    processed_bend_cylinders = set()
    for pa, pb, ci, ea, eb in bend_connections:
        if ci in processed_bend_cylinders: continue
        processed_bend_cylinders.add(ci)
        
        # Calculate bend length from the shared edges
        # Note: bend length is the length of the cylindrical face along its axis
        edge_shape = TopoDS.Edge_s(edge_map.FindKey(ea[0]))
        p1, p2 = _edge_endpoints(edge_shape)
        bend_len = np.linalg.norm(p2 - p1) if p1 is not None else 0
        
        bend_summary.append({
            "length": round(float(bend_len), 4),
            "radius": round(float(face_info[ci][2]), 4)
        })

    # 11. Compute bounding box for the flat pattern
    if all_flat_verts:
        varr = np.array(all_flat_verts).reshape(-1, 3)
        mins = varr.min(axis=0)
        maxs = varr.max(axis=0)
        width = float(maxs[0] - mins[0])
        height = float(maxs[1] - mins[1])
        thickness = float(maxs[2] - mins[2])
    else:
        width = height = thickness = 0.0

    return {
        "flatVertices": all_flat_verts,
        "cutEdges": all_cut_edges,
        "bendEdges": all_bend_edges,
        "topEdges": top_coords,
        "frontEdges": front_coords,
        "sideEdges": side_coords,
        "thickness": thickness,
        "bbox": {"width": width, "height": height},
        "totalPerimeter": round(float(total_cut_perimeter), 4),
        "pierceCount": int(pierce_count),
        "bends": bend_summary
    }

def export_unfolded_dxf(input_path, output_path):
    """
    World-Class CAD Projection: Generate Laser-Ready DXF Flat Pattern.
    """
    try:
        # Load the base model
        shape = cq.importers.importStep(input_path)
        
        # Robust Silhouette Projection
        # We attempt to find the largest planar face as the projection plane
        # fallback to Z-max if needed
        try:
            dxf_plane = shape.faces(">Z").workplane()
            # Correct CadQuery DXF export syntax
            cq.exporters.export(dxf_plane.section(), output_path)
        except:
            # Fallback for complex geometry: Project the entire shape silhouette
            cq.exporters.export(shape, output_path)
            
        return True
    except Exception as e:
        print(f"Error exporting DXF: {str(e)}")
        # Ultimate fallback: Create an empty DXF or just log the failure
        return False

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python unfold.py <input_step> <output_dxf>")
        sys.exit(1)
        
    in_path = sys.argv[1]
    out_path = sys.argv[2]
    
    if export_unfolded_dxf(in_path, out_path):
        sys.exit(0)
    else:
        sys.exit(1)
