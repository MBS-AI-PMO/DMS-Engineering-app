
import sys
import os
import math
import json
import traceback
import time
import numpy as np

# 1. Add FreeCAD and lib_unfold to path
def setup_paths():
    # Detect bin directory of the current interpreter (which should be the FreeCAD one)
    interp_dir = os.path.dirname(sys.executable)
    if interp_dir not in sys.path:
        sys.path.append(interp_dir)
    
    lib_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "lib_unfold"))
    if lib_path not in sys.path:
        sys.path.insert(0, lib_path)

setup_paths()

import FreeCAD
from FreeCAD import Matrix, Vector, Rotation
import Part
import networkx as nx

# Import from the library
from unfold import (
    build_graph_of_tangent_faces, 
    EstimateThickness, 
    BendAllowanceCalculator, 
    unroll_cylinder,
    compute_unbend_transform,
    BendDirection
)

def _normalize(vec):
    length = np.linalg.norm(vec)
    if length < 1e-12:
        return vec.copy()
    return vec / length

def _json_safe(obj):
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

def _tessellate_fc_face(face, deflection=0.5):
    """Tessellate a FreeCAD face. Higher deflection = fewer polygons = faster."""
    triangulation = face.tessellate(deflection)
    if not triangulation or len(triangulation) < 2:
        return np.empty((0, 3)), np.empty((0, 3), dtype=int)
    verts = np.array(triangulation[0])
    tris = np.array(triangulation[1])
    return verts, tris

def _get_edge_points(edge, n=5):
    """Sample points from an edge for 2D drawing. Lines need 2, curves need many (or circles collapse to diamonds)."""
    try:
        curve_type = edge.Curve.TypeId
    except Exception:
        curve_type = ""
    if curve_type == "Part::GeomLine":
        sample_n = 2
    elif curve_type in ("Part::GeomCircle", "Part::GeomArcOfCircle", "Part::GeomEllipse", "Part::GeomArcOfEllipse"):
        sample_n = 24
    else:
        sample_n = max(n, 24)
    pts = edge.discretize(Number=sample_n)
    return [[p.x, p.y, p.z] for p in pts]

def _get_line_hash(p1_list, p2_list, tol=0.1):
    """Canonical hash for a line segment."""
    p1 = (round(p1_list[0]/tol)*tol, round(p1_list[1]/tol)*tol, round(p1_list[2]/tol)*tol)
    p2 = (round(p2_list[0]/tol)*tol, round(p2_list[1]/tol)*tol, round(p2_list[2]/tol)*tol)
    return tuple(sorted([p1, p2]))

def detect_holes_fc(fc_shape):
    """
    Detect holes using FreeCAD native classification.
    """
    holes = []
    cyl_faces = []

    for i, face in enumerate(fc_shape.Faces):
        if face.Surface.TypeId == "Part::GeomCylinder":
            cyl = face.Surface
            # In FreeCAD, Orientation strings are 'Forward' or 'Reversed'
            # concave internal surfaces of holes are typically 'Reversed'
            if face.Orientation == "Forward":
                continue
            
            radius = float(cyl.Radius)
            if radius < 0.5: continue # Skip fillets
            
            axis = cyl.Axis
            center = cyl.Center
            
            cyl_faces.append({
                "fi": i,
                "radius": radius,
                "axis": np.array([axis.x, axis.y, axis.z]),
                "center": np.array([center.x, center.y, center.z]),
                "area": float(face.Area)
            })

    if not cyl_faces:
        return []

    # Build edge-to-face mapping to associate holes with planar faces
    e2f = {}
    for fi, f in enumerate(fc_shape.Faces):
        for e in f.Edges:
            e2f.setdefault(e.hashCode(), []).append(fi)

    seen = set()
    clusters = []
    for i, c1 in enumerate(cyl_faces):
        if i in seen: continue
        seen.add(i)
        cluster = [c1]
        for j in range(i+1, len(cyl_faces)):
            if j in seen: continue
            c2 = cyl_faces[j]
            # Match radius (1.5% tol)
            if abs(c1["radius"] - c2["radius"]) / (c1["radius"] + 1e-9) > 0.015:
                continue
            # Match axis (parallel)
            if abs(np.dot(c1["axis"], c2["axis"])) < 0.985:
                continue
            # Collinear
            diff = c2["center"] - c1["center"]
            perp = diff - np.dot(diff, c1["axis"]) * c1["axis"]
            if np.linalg.norm(perp) > c1["radius"] + 1.0:
                continue
            
            seen.add(j)
            cluster.append(c2)
        clusters.append(cluster)

    for cluster in clusters:
        c1 = cluster[0]
        total_area = sum(c["area"] for c in cluster)
        depth = total_area / (2 * math.pi * c1["radius"])
        if depth < 0.5: continue
        
        # Diameter and position
        diam = c1["radius"] * 2.0
        # Avg position along axis
        z_coords = []
        for c in cluster:
            f = fc_shape.Faces[c["fi"]]
            for v in f.Vertexes:
                rel = np.array([v.Point.x, v.Point.y, v.Point.z]) - c1["center"]
                z_coords.append(np.dot(rel, c1["axis"]))
        
        if not z_coords: continue
        z_min, z_max = min(z_coords), max(z_coords)
        pos = c1["center"] + ((z_min + z_max) / 2.0) * c1["axis"]
        
        # Associate with a parent planar face
        face_id = None
        adj_planar = []
        for c in cluster:
            f = fc_shape.Faces[c["fi"]]
            for e in f.Edges:
                for nfi in e2f.get(e.hashCode(), []):
                    if nfi != c["fi"] and fc_shape.Faces[nfi].Surface.TypeId == "Part::GeomPlane":
                        adj_planar.append(nfi)
        if adj_planar:
            # Pick the planar face with the largest area as the parent
            best_fi = max(set(adj_planar), key=lambda fi: fc_shape.Faces[fi].Area)
            face_id = f"face_{best_fi}"

        holes.append({
            "id": f"hole_{len(holes)+1}",
            "face_id": face_id,
            "diameter_mm": round(diam, 4),
            "diameter_in": round(diam / 25.4, 6),
            "position": [round(float(p), 4) for p in pos],
            "axis": [round(float(a), 4) for a in c1["axis"]],
            "depth_mm": round(float(depth), 4)
        })
    
    # Merge counterbores
    final = []
    s_merged = set()
    for i, h1 in enumerate(holes):
        if i in s_merged: continue
        best = h1
        s_merged.add(i)
        for j in range(i+1, len(holes)):
            if j in s_merged: continue
            h2 = holes[j]
            dist = np.linalg.norm(np.array(h1["position"]) - np.array(h2["position"]))
            cross = np.linalg.norm(np.cross(h1["axis"], h2["axis"]))
            if dist < 2.5 and cross < 0.1:
                s_merged.add(j)
                if h2["diameter_mm"] < best["diameter_mm"]:
                    best = h2
        final.append(best)

    for idx, h in enumerate(final):
        h["id"] = f"hole_{idx+1}"
    return final

def get_projections(fc_shape):
    """Generate orthographic projections."""
    views = {
        "top": {"axis_idx": 2, "edges": [], "bend_edges": []},
        "front": {"axis_idx": 1, "edges": [], "bend_edges": []},
        "side": {"axis_idx": 0, "edges": [], "bend_edges": []}
    }
    
    # Pre-classify faces for visibility check
    face_normals = []
    for f in fc_shape.Faces:
        face_normals.append(f.normalAt(0,0))

    # Build adjacency
    edge_to_faces = {}
    bend_edge_hashes = set()
    for fi, face in enumerate(fc_shape.Faces):
        for edge in face.Edges:
            h = edge.hashCode()
            edge_to_faces.setdefault(h, []).append(fi)
            
    for h, flist in edge_to_faces.items():
        if len(flist) == 2:
            f1, f2 = fc_shape.Faces[flist[0]], fc_shape.Faces[flist[1]]
            s1, s2 = f1.Surface.TypeId, f2.Surface.TypeId
            if (s1 == "Part::GeomCylinder" and s2 == "Part::GeomPlane") or \
               (s2 == "Part::GeomCylinder" and s1 == "Part::GeomPlane"):
                bend_edge_hashes.add(h)

    for code, vdata in views.items():
        axis_idx = vdata["axis_idx"]
        silhouette_hashes = set()
        
        # All edges loop
        for edge in fc_shape.Edges:
            eh = edge.hashCode()
            is_bend = eh in bend_edge_hashes
            
            # Visibility check for silhouettes
            if not is_bend:
                adj = edge_to_faces.get(eh, [])
                visible = False
                for fi in adj:
                    n = face_normals[fi]
                    comp = [n.x, n.y, n.z][axis_idx]
                    if comp > 0.05:
                        visible = True
                        break
                if not visible and adj: continue
                
            pts = _get_edge_points(edge)
            flat_pts = []
            for p in pts:
                if code == "top": flat_pts.append([p[0], p[1], 0.0])
                elif code == "front": flat_pts.append([p[0], p[2], 0.0])
                elif code == "side": flat_pts.append([p[1], p[2], 0.0])
            
            for i in range(len(flat_pts)-1):
                p1, p2 = flat_pts[i], flat_pts[i+1]
                if not is_bend:
                    vdata["edges"].extend(p1 + p2)
                    silhouette_hashes.add(_get_line_hash(p1, p2))
                else:
                    # Collect potentially, filter later
                    pass
                    
        # Second pass for bends to ensure no overlap with silhouettes
        for edge in fc_shape.Edges:
            eh = edge.hashCode()
            if eh not in bend_edge_hashes: continue
            
            pts = _get_edge_points(edge)
            flat_pts = []
            for p in pts:
                if code == "top": flat_pts.append([p[0], p[1], 0.0])
                elif code == "front": flat_pts.append([p[0], p[2], 0.0])
                elif code == "side": flat_pts.append([p[1], p[2], 0.0])
                
            for i in range(len(flat_pts)-1):
                lh = _get_line_hash(flat_pts[i], flat_pts[i+1])
                if lh not in silhouette_hashes:
                    vdata["bend_edges"].extend(flat_pts[i] + flat_pts[i+1])

    return views

def unfold_with_lib(filepath):
    t0 = time.time()
    # 1. Load STEP directly using FreeCAD Part
    fc_shape = Part.Shape()
    fc_shape.read(filepath)
    sys.stderr.write(f"[Profiling] Load STEP: {time.time() - t0:.3f}s\n")
    
    t_start = time.time()
    # Robust root face selection: Look for the largest pair of parallel faces (top/bottom)
    # to avoid picking a narrow edge face as the root.
    potential_roots = []
    for i, face in enumerate(fc_shape.Faces):
        if face.Surface.TypeId == "Part::GeomPlane":
            potential_roots.append({
                "index": i,
                "area": float(face.Area),
                "normal": face.normalAt(0,0)
            })
    
    if not potential_roots:
        raise ValueError("Solid must have at least one planar face.")
    
    # Sort by area descending
    potential_roots.sort(key=lambda x: -x["area"])
    
    chosen_root = potential_roots[0]["index"] # Fallback to largest
    
    # Try to find a pair of anti-parallel faces with similar large areas
    for i in range(min(5, len(potential_roots))):
        f1 = potential_roots[i]
        for j in range(i + 1, min(10, len(potential_roots))):
            f2 = potential_roots[j]
            # If they are parallel/anti-parallel and have similar areas
            if abs(f1["normal"].dot(f2["normal"])) > 0.99:
                if abs(f1["area"] - f2["area"]) / max(f1["area"], f2["area"]) < 0.2:
                    # We found the top/bottom skin pair
                    chosen_root = f1["index"]
                    break
        else: continue
        break
    
    success = False
    last_error = None
    
    # Try multiple planar faces as potential roots if the first one fails (cap at 5)
    root_candidates = [chosen_root] + [p["index"] for p in potential_roots if p["index"] != chosen_root]
    
    for root_idx in root_candidates[:5]:
        try:
            # Adjacency and Thickness
            graph = build_graph_of_tangent_faces(fc_shape, root_idx)
            thickness = EstimateThickness.using_best_method(fc_shape, root_idx)
            bac = BendAllowanceCalculator.from_single_value(0.44) # Standard K-factor
            
            # Spanning Tree
            spanning_tree = nx.minimum_spanning_tree(graph, weight="label")
            dg = nx.DiGraph()
            for node in spanning_tree: dg.add_node(node)
            
            lengths = nx.all_pairs_shortest_path_length(spanning_tree)
            dist_map = {k: kv for k, kv in lengths}
            if root_idx not in dist_map:
                continue
            
            dist = dist_map[root_idx]
            
            for f1, f2, data in spanning_tree.edges(data=True):
                if dist[f1] <= dist[f2]:
                    dg.add_edge(f1, f2, label=data["label"])
                else:
                    dg.add_edge(f2, f1, label=data["label"])

            # 3. Perform Unfolding traversal
            t_unfold_start = time.time()
            for u, v in dg.edges():
                bend_face = fc_shape.Faces[v]
                edge_idx = dg.get_edge_data(u, v)["label"]
                edge = fc_shape.Edges[edge_idx]
                
                if bend_face.Surface.TypeId == "Part::GeomCylinder":
                    align_m, over_m, uvref = compute_unbend_transform(bend_face, edge, thickness, bac)
                    dg.nodes[v]["unbend_transform"] = over_m
                    flat_face, bend_line = unroll_cylinder(bend_face, uvref, bac, thickness)
                    dg.nodes[v]["unbent_shape"] = flat_face.transformed(align_m)
                    dg.nodes[v]["bend_line"] = bend_line.transformed(align_m)
                    
                    # FINAL FILTER: A real bend is not a full circle (holes are 360)
                    # and most importantly, a bend connects to a child face in the unfolding sequence.
                    u_range = bend_face.ParameterRange
                    u_min, u_max = u_range[0], u_range[1]
                    span_deg = math.degrees(u_max - u_min)
                    has_children = len(list(dg.successors(v))) > 0
                    
                    if span_deg < 350 and has_children:
                        dg.nodes[v]["is_real_bend"] = True
                else:
                    dg.nodes[v]["unbend_transform"] = Matrix()
            sys.stderr.write(f"[Profiling] Unfold traversal: {time.time() - t_unfold_start:.3f}s\n")
            
            # If we reach here without exception, this root worked!
            chosen_root = root_idx
            success = True
            break
        except Exception as e:
            last_error = f"{str(e)}\n{traceback.format_exc()}"
            sys.stderr.write(f"[Debug] Root {root_idx} failed: {last_error}\n")
            continue
            
    if not success:
        raise RuntimeError(f"Could not find a valid root face for unfolding. Last error: {last_error}")

    # 4. Calulate Global Alignment (to ensure the root face is parallel to XY plane)
    global_align_m = Matrix()
    root_face = fc_shape.Faces[chosen_root]
    root_normal = root_face.normalAt(0,0)
    root_center = root_face.CenterOfMass
    
    # 1. Move to origin
    global_align_m.move(root_center * -1.0)
    # 2. Rotate normal to [0,0,1]
    rot = Rotation(root_normal, Vector(0,0,1))
    global_align_m = rot.toMatrix().multiply(global_align_m)

    # 5. Generate Output Data using chosen_root
    flat_vertices = []
    cut_edges_2d = []
    bend_edges_2d = []
    
    def build_frontend_tree(node_id, parent_id=None, accumulated_m=None):
        """O(n) traversal: accumulated_m is the product of unbend transforms from root to
        this node's parent, eliminating the per-node nx.shortest_path O(n²) call."""
        if accumulated_m is None:
            accumulated_m = Matrix()

        node_data = dg.nodes[node_id]
        face = fc_shape.Faces[node_id]
        final_m = accumulated_m

        # Flattened Geometry
        if "unbent_shape" in node_data:
            flat_face = node_data["unbent_shape"].transformed(final_m)
        else:
            flat_face = face.transformed(final_m)

        # Apply global alignment to sit on XY plane (for 2D view)
        flat_face = flat_face.transformed(global_align_m)

        # Tessellate for 2D View (deflection=1.0 — adequate for flat pattern display and reduced RAM)
        fv, ft = _tessellate_fc_face(flat_face, deflection=1.0)
        for tri in ft:
            for v_idx in tri:
                v = fv[v_idx]
                flat_vertices.extend(v)

        # Edges for 2D Drawing
        for e in flat_face.Edges:
            pts = _get_edge_points(e)
            for i in range(len(pts) - 1):
                cut_edges_2d.extend(pts[i] + pts[i + 1])

        # Bend Lines
        if "bend_line" in node_data:
            bl = node_data["bend_line"].transformed(final_m).transformed(global_align_m)
            for e in bl.Edges:
                pts = _get_edge_points(e)
                for i in range(len(pts) - 1):
                    bend_edges_2d.extend(pts[i] + pts[i + 1])

        # Build tree node
        is_bend = node_data.get("is_real_bend", False)
        angle = 90.0
        if is_bend:
            u_range = face.ParameterRange
            angle = math.degrees(u_range[1] - u_range[0])

        normal = face.normalAt(0, 0)
        tree_node = {
            "id": f"face_{node_id}",
            "parentId": f"face_{parent_id}" if parent_id is not None else None,
            "children": [],
            "initialNormal": [normal.x, normal.y, normal.z],
            "isCoplanar": not is_bend and parent_id is not None,
            "extraFaceIds": [f"face_{node_id}"] if face.Surface.TypeId == "Part::GeomCylinder" else [],
            "initialAngle": angle,
            "radius": round(float(face.Surface.Radius), 3) if face.Surface.TypeId == "Part::GeomCylinder" else 0,
            "is_real_bend": is_bend
        }

        if is_bend:
            p0_coords = p1_coords = None
            length = 10.0
            if parent_id is not None:
                edge_data = dg.get_edge_data(parent_id, node_id)
                if edge_data is not None:
                    try:
                        edge = fc_shape.Edges[edge_data["label"]]
                        if len(edge.Vertexes) >= 2:
                            ep0 = edge.Vertexes[0].Point
                            ep1 = edge.Vertexes[-1].Point
                            p0_coords = [ep0.x, ep0.y, ep0.z]
                            p1_coords = [ep1.x, ep1.y, ep1.z]
                            length = round(float(edge.Length), 4)
                    except Exception:
                        pass
            if p0_coords is None:
                cyl = face.Surface
                axis = cyl.Axis
                center = cyl.Center
                p0_coords = [center.x, center.y, center.z]
                p1_coords = [center.x + axis.x * 10.0, center.y + axis.y * 10.0, center.z + axis.z * 10.0]
            tree_node["bendAxis"] = {"p0": p0_coords, "p1": p1_coords, "length": length}

        # Pass accumulated transform to children: include this node's unbend if present
        next_m = final_m
        if "unbend_transform" in node_data:
            next_m = final_m.multiply(node_data["unbend_transform"])

        for neighbor in dg.successors(node_id):
            tree_node["children"].append(build_frontend_tree(neighbor, node_id, next_m))

        return tree_node

    root_node = build_frontend_tree(root_idx)

    # Tessellate all faces for HierarchicalProjectViewer.
    # deflection=5.0 provides a major reduction in triangle count for faster loading.
    face_meshes = {}
    for i, face in enumerate(fc_shape.Faces):
        try:
            verts, tris = _tessellate_fc_face(face, deflection=5.0)
            if verts.shape[0] > 0 and tris.shape[0] > 0:
                face_meshes[f"face_{i}"] = {
                    "vertices": verts.flatten().tolist(),
                    "indices": tris.flatten().tolist(),
                }
        except Exception:
            pass

    # Calculate bounding box for 2D layout centering
    width, height = 0, 0
    if flat_vertices:
        pts = np.array(flat_vertices).reshape(-1, 3)
        v_min, v_max = np.min(pts, axis=0), np.max(pts, axis=0)
        width = float(v_max[0] - v_min[0])
        height = float(v_max[1] - v_min[1])

    # 5. Extract Detailed Bend Info for Pricing
    bends_data = []
    def traverse_bends(node):
        # Strictly only count nodes that the unfolding engine marked as a REAL bend
        if node.get("is_real_bend"):
            bends_data.append({
                "length": node["bendAxis"]["length"],
                "radius": node.get("radius", 0),
                "angle": node["initialAngle"]
            })
        for child in node["children"]:
            traverse_bends(child)
    
    traverse_bends(root_node)

    # 6. Technical views only — holes are detected separately by /api/detect-holes
    t_views = time.time()
    views = get_projections(fc_shape)
    sys.stderr.write(f"[Profiling] Projections: {time.time() - t_views:.3f}s\n")

    t_holes = time.time()
    holes_data = detect_holes_fc(fc_shape)
    sys.stderr.write(f"[Profiling] Hole Detection: {time.time() - t_holes:.3f}s\n")

    sys.stderr.write(f"[Profiling] Total unfold_with_lib: {time.time() - t_start:.3f}s\n")

    return _json_safe({
        "success": True,
        "flatVertices": flat_vertices,
        "cutEdges": cut_edges_2d,
        "bendEdges": bend_edges_2d,
        "thickness": round(float(thickness), 4),
        "bendTree": root_node,
        "faceMeshes": face_meshes,
        "bends": bends_data,
        "bbox": {"width": width, "height": height},
        "topEdges": views["top"]["edges"],
        "frontEdges": views["front"]["edges"],
        "sideEdges": views["side"]["edges"],
        "topBendEdges": views["top"]["bend_edges"],
        "frontBendEdges": views["front"]["bend_edges"],
        "sideBendEdges": views["side"]["bend_edges"],
        "detectedHoles": holes_data
    })

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(json.dumps(unfold_with_lib(sys.argv[1])))
