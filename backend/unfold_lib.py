
import sys
import os
import math
import json
import traceback
import time
import numpy as np

PROGRESS_PREFIX = "__PROGRESS__"

# 1. Add FreeCAD and lib_unfold to path
def setup_paths():
    # Detect bin directory of the current interpreter (which should be the FreeCAD one)
    interp_dir = os.path.dirname(sys.executable)
    if interp_dir not in sys.path:
        sys.path.append(interp_dir)

    lib_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "lib_unfold"))
    # CRITICAL: Remove the script's own directory from sys.path to prevent
    # the legacy backend/unfold.py from shadowing lib_unfold/unfold.py.
    script_dir = os.path.abspath(os.path.dirname(__file__))
    while script_dir in sys.path:
        sys.path.remove(script_dir)
    # Insert lib_unfold at the front so `from unfold import ...` finds the right module.
    if lib_path not in sys.path:
        sys.path.insert(0, lib_path)

setup_paths()

import FreeCAD
from FreeCAD import Matrix, Vector, Rotation
import Part
import networkx as nx

# Stub out GUI modules before importing unfold.py — the library does
# `import FreeCADGui`, `import Draft`, `import importDXF`, `import importSVG`
# at module level which hang on headless servers.
# Only the math/geometry functions are needed here, not the GUI parts.
import types

_gui_stub = types.ModuleType("FreeCADGui")
_gui_stub.getMainWindow = lambda: None
_gui_stub.ActiveDocument = None
_gui_stub.Selection = type("Sel", (), {
    "getCompleteSelection": staticmethod(lambda: []),
    "clearSelection": staticmethod(lambda: None),
    "addSelectionGate": staticmethod(lambda *a, **k: None),
    "addObserver": staticmethod(lambda *a: None),
    "removeSelectionGate": staticmethod(lambda: None),
    "removeObserver": staticmethod(lambda *a: None),
    "ResolveMode": type("RM", (), {"NoResolve": 0})(),
})()
_gui_stub.UiLoader = lambda: None
_gui_stub.Control = type("Ctrl", (), {"closeDialog": staticmethod(lambda: None)})()
sys.modules["FreeCADGui"] = _gui_stub
FreeCAD.Gui = _gui_stub

# Draft stub — only makeSketch is used in unfold math path
_draft_stub = types.ModuleType("Draft")
_draft_stub.makeSketch = lambda *a, **k: None
sys.modules["Draft"] = _draft_stub

for _mod_name in ("importDXF", "importSVG"):
    if _mod_name not in sys.modules:
        _stub = types.ModuleType(_mod_name)
        _stub.export = lambda *a, **k: None
        sys.modules[_mod_name] = _stub

# Import from the library
from unfold import (
    build_graph_of_tangent_faces,
    EstimateThickness,
    BendAllowanceCalculator,
    unroll_cylinder,
    compute_unbend_transform,
    BendDirection
)


def emit_progress(percent, stage):
    """Emit structured progress for parent processes that parse stderr."""
    try:
        pct = max(0.0, min(100.0, float(percent)))
        payload = {"percent": round(pct, 2), "stage": str(stage or "Processing")}
        sys.stderr.write(f"{PROGRESS_PREFIX}{json.dumps(payload)}\n")
        sys.stderr.flush()
    except Exception:
        # Progress reporting must never interrupt geometry processing.
        pass

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
        try:
            # Adaptive sampling for smoother holes/arcs in 2D without exploding point count.
            edge_len = float(edge.Length)
            sample_n = max(24, min(96, int(edge_len / 1.5)))
        except Exception:
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


def _basis_from_normal(normal_vec):
    n = _normalize(np.asarray(normal_vec, dtype=float))
    ref = np.array([1.0, 0.0, 0.0]) if abs(float(n[0])) < 0.9 else np.array([0.0, 1.0, 0.0])
    u = _normalize(np.cross(n, ref))
    v = _normalize(np.cross(n, u))
    return n, u, v


def _empty_non_flat_features():
    return {
        "hasRaisedFeatures": False,
        "raisedFeatureFaceCount": 0,
        "parallelPlanarFaceCount": 0,
        "maxOffsetMm": 0.0,
        "reasons": [],
    }


def _detect_non_flat_features(fc_shape, root_idx, thickness):
    """
    Detect raised planar features (boss/emboss-like geometry) on otherwise flat sheet parts.
    Returns conservative metadata used by the frontend to lock laser-cut process selection.
    """
    result = _empty_non_flat_features()
    try:
        if root_idx is None or root_idx < 0 or root_idx >= len(fc_shape.Faces):
            return result

        root_face = fc_shape.Faces[root_idx]
        if root_face.Surface.TypeId != "Part::GeomPlane":
            return result

        root_n = root_face.normalAt(0, 0)
        root_normal = _normalize(np.array([float(root_n.x), float(root_n.y), float(root_n.z)], dtype=float))
        root_center = root_face.CenterOfMass
        root_point = np.array([float(root_center.x), float(root_center.y), float(root_center.z)], dtype=float)

        thickness_mm = float(thickness) if thickness and float(thickness) > 0 else 0.0
        # Keep threshold low enough to capture small square bosses (e.g., ~4x4 to ~6x6 mm)
        # while still filtering tiny numerical sliver faces.
        min_face_area = max(0.5, (thickness_mm * thickness_mm * 0.15) if thickness_mm > 0 else 0.5)

        raised_faces = 0
        raised_same_orientation = 0
        raised_opposite_orientation = 0
        parallel_faces = 0
        max_offset = 0.0

        tol_root = max(0.18, thickness_mm * 0.18) if thickness_mm > 0 else 0.40
        tol_skin = max(0.25, thickness_mm * 0.25) if thickness_mm > 0 else 0.80

        for fi, face in enumerate(fc_shape.Faces):
            if fi == root_idx:
                continue
            if face.Surface.TypeId != "Part::GeomPlane":
                continue

            try:
                face_area = float(face.Area)
            except Exception:
                face_area = 0.0
            if face_area < min_face_area:
                continue

            fn = face.normalAt(0, 0)
            face_normal = _normalize(np.array([float(fn.x), float(fn.y), float(fn.z)], dtype=float))
            alignment = float(np.dot(face_normal, root_normal))
            parallelity = abs(alignment)
            if parallelity < 0.985:
                continue

            parallel_faces += 1
            center = face.CenterOfMass
            center_np = np.array([float(center.x), float(center.y), float(center.z)], dtype=float)
            signed_offset = float(np.dot(center_np - root_point, root_normal))
            offset = abs(signed_offset)
            max_offset = max(max_offset, offset)

            if thickness_mm > 0:
                near_root_plane = offset <= tol_root
                near_opposite_skin = abs(offset - thickness_mm) <= tol_skin

                if alignment > 0:
                    # Same normal direction as root but offset away from root plane => raised boss/emboss-like feature.
                    if not near_root_plane:
                        raised_faces += 1
                        raised_same_orientation += 1
                else:
                    # Opposite-direction faces should generally sit on the opposite skin plane.
                    if not near_opposite_skin:
                        raised_faces += 1
                        raised_opposite_orientation += 1
            else:
                if alignment > 0 and offset > 0.8:
                    raised_faces += 1
                    raised_same_orientation += 1
                elif alignment < 0 and offset > 1.2:
                    raised_faces += 1
                    raised_opposite_orientation += 1

        result["parallelPlanarFaceCount"] = int(parallel_faces)
        result["raisedFeatureFaceCount"] = int(raised_faces)
        result["maxOffsetMm"] = round(float(max_offset), 4)
        result["hasRaisedFeatures"] = raised_faces > 0

        if raised_faces > 0:
            if thickness_mm > 0:
                result["reasons"].append(
                    f"Detected {raised_faces} raised planar face(s) beyond expected sheet skins for thickness {thickness_mm:.3f} mm."
                )
            else:
                result["reasons"].append(
                    f"Detected {raised_faces} raised planar face(s) offset from the base planar skin."
                )
            if raised_same_orientation > 0:
                result["reasons"].append(
                    f"{raised_same_orientation} face(s) share root-plane orientation but are offset, indicating boss/emboss geometry."
                )
            if raised_opposite_orientation > 0:
                result["reasons"].append(
                    f"{raised_opposite_orientation} opposite-orientation face(s) are outside expected opposite-skin offset."
                )

        return result
    except Exception as ex:
        result["reasons"].append(f"Non-flat feature analysis warning: {ex}")
        return result


def _detect_holes_from_planar_loops(fc_shape):
    """
    Fallback hole detector for models where holes are not represented as
    cylindrical faces (e.g. conical/countersunk-only or non-analytic exports).
    """
    candidates = []

    for fi, face in enumerate(fc_shape.Faces):
        if face.Surface.TypeId != "Part::GeomPlane":
            continue

        try:
            n_obj = face.normalAt(0, 0)
            normal = np.array([float(n_obj.x), float(n_obj.y), float(n_obj.z)], dtype=float)
        except Exception:
            try:
                n_obj = face.Surface.Axis
                normal = np.array([float(n_obj.x), float(n_obj.y), float(n_obj.z)], dtype=float)
            except Exception:
                continue

        if np.linalg.norm(normal) < 1e-9:
            continue

        normal, u_vec, v_vec = _basis_from_normal(normal)

        outer_hash = None
        try:
            outer_hash = face.OuterWire.hashCode()
        except Exception:
            outer_hash = None

        for wire in face.Wires:
            try:
                if outer_hash is not None and wire.hashCode() == outer_hash:
                    continue
            except Exception:
                pass

            wire_points = []
            for edge in wire.Edges:
                try:
                    pts = edge.discretize(Number=32)
                except Exception:
                    pts = [v.Point for v in edge.Vertexes]

                if not pts or len(pts) < 2:
                    continue

                edge_pts = [
                    np.array([float(p.x), float(p.y), float(p.z)], dtype=float)
                    for p in pts
                ]

                if wire_points:
                    if np.linalg.norm(edge_pts[0] - wire_points[-1]) <= 1e-6:
                        wire_points.extend(edge_pts[1:])
                    else:
                        wire_points.extend(edge_pts)
                else:
                    wire_points.extend(edge_pts)

            if len(wire_points) < 4:
                continue

            if np.linalg.norm(wire_points[0] - wire_points[-1]) > 1e-5:
                wire_points.append(wire_points[0].copy())

            pts3 = np.asarray(wire_points, dtype=float)
            if pts3.shape[0] < 4:
                continue

            local = pts3 - pts3[0]
            x = local @ u_vec
            y = local @ v_vec
            pts2 = np.column_stack((x, y))

            seg = pts2[1:] - pts2[:-1]
            perimeter = float(np.sum(np.linalg.norm(seg, axis=1)))
            if perimeter < 1e-6:
                continue

            area = 0.5 * abs(float(np.sum(
                pts2[:-1, 0] * pts2[1:, 1] - pts2[1:, 0] * pts2[:-1, 1]
            )))
            if area < 1e-6:
                continue

            roundness = (4.0 * math.pi * area) / (perimeter * perimeter + 1e-9)
            diameter_mm = 2.0 * math.sqrt(area / math.pi)

            # Keep near-circular inner loops that look like drilled/punched holes.
            if diameter_mm < 1.0:
                continue
            if roundness < 0.80:
                continue

            center = np.mean(pts3[:-1], axis=0)
            candidates.append({
                "face_index": fi,
                "face_id": f"face_{fi}",
                "diameter_mm": float(diameter_mm),
                "center": center,
                "axis": normal,
            })

    if not candidates:
        return []

    used = set()
    holes = []

    for i, c1 in enumerate(candidates):
        if i in used:
            continue

        best_j = None
        best_score = None
        for j in range(i + 1, len(candidates)):
            if j in used:
                continue
            c2 = candidates[j]

            max_d = max(c1["diameter_mm"], c2["diameter_mm"], 1e-9)
            if abs(c1["diameter_mm"] - c2["diameter_mm"]) / max_d > 0.08:
                continue

            dot_n = float(np.dot(c1["axis"], c2["axis"]))
            if dot_n > -0.85:
                continue

            delta = c2["center"] - c1["center"]
            axial = abs(float(np.dot(delta, c1["axis"])))
            radial_vec = delta - np.dot(delta, c1["axis"]) * c1["axis"]
            radial = float(np.linalg.norm(radial_vec))

            if axial < 0.15:
                continue
            if radial > max(0.4, c1["diameter_mm"] * 0.2):
                continue

            score = radial + abs(c1["diameter_mm"] - c2["diameter_mm"])
            if best_score is None or score < best_score:
                best_score = score
                best_j = j

        if best_j is not None:
            used.add(i)
            used.add(best_j)
            c2 = candidates[best_j]

            pos = (c1["center"] + c2["center"]) * 0.5
            axis = _normalize(c1["axis"] - c2["axis"])
            if np.linalg.norm(axis) < 1e-9:
                axis = _normalize(c1["axis"])
            depth_mm = float(np.linalg.norm(c2["center"] - c1["center"]))
            diameter_mm = min(c1["diameter_mm"], c2["diameter_mm"])
            face_id = c1["face_id"]
        else:
            used.add(i)
            pos = c1["center"]
            axis = _normalize(c1["axis"])
            depth_mm = max(0.5, c1["diameter_mm"] * 0.3)
            diameter_mm = c1["diameter_mm"]
            face_id = c1["face_id"]

        holes.append({
            "id": f"hole_{len(holes) + 1}",
            "face_id": face_id,
            "diameter_mm": round(float(diameter_mm), 4),
            "diameter_in": round(float(diameter_mm) / 25.4, 6),
            "position": [round(float(v), 4) for v in pos],
            "axis": [round(float(v), 4) for v in axis],
            "depth_mm": round(float(depth_mm), 4),
        })

    holes.sort(key=lambda h: h["diameter_mm"])
    for idx, h in enumerate(holes):
        h["id"] = f"hole_{idx + 1}"
    return holes

def detect_holes_fc(fc_shape):
    """
    Detect holes using FreeCAD native classification.
    """
    holes = []
    cyl_faces = []

    for i, face in enumerate(fc_shape.Faces):
        if face.Surface.TypeId == "Part::GeomCylinder":
            cyl = face.Surface
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

    def _basis_from_axis(axis_vec):
        a = _normalize(axis_vec)
        ref = np.array([1.0, 0.0, 0.0]) if abs(a[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
        u = _normalize(np.cross(a, ref))
        v = _normalize(np.cross(a, u))
        return a, u, v

    def _angular_coverage(points, center, axis):
        if len(points) < 3:
            return 0.0
        a, u, v = _basis_from_axis(axis)
        angles = []
        for p in points:
            rel = p - center
            radial = rel - np.dot(rel, a) * a
            rlen = np.linalg.norm(radial)
            if rlen < 1e-6:
                continue
            ang = math.atan2(np.dot(radial, v), np.dot(radial, u))
            if ang < 0:
                ang += 2.0 * math.pi
            angles.append(ang)
        if len(angles) < 3:
            return 0.0
        angles.sort()
        max_gap = 0.0
        for i in range(len(angles)):
            nxt = angles[(i + 1) % len(angles)]
            gap = nxt - angles[i] if i < len(angles) - 1 else (nxt + 2.0 * math.pi - angles[i])
            if gap > max_gap:
                max_gap = gap
        return 2.0 * math.pi - max_gap

    for cluster in clusters:
        c1 = cluster[0]
        total_area = sum(c["area"] for c in cluster)
        depth = total_area / (2 * math.pi * c1["radius"])
        if depth < 0.5: continue

        # Keep only near full cylinders so bend arcs / partial rolls are excluded.
        cluster_points = []
        for c in cluster:
            f = fc_shape.Faces[c["fi"]]
            for e in f.Edges:
                pts = [v.Point for v in e.Vertexes]
                if len(pts) < 2:
                    try:
                        pts = e.discretize(Number=8)
                    except Exception:
                        pts = [v.Point for v in e.Vertexes]
                for p in pts:
                    cluster_points.append(np.array([p.x, p.y, p.z]))
        coverage = _angular_coverage(cluster_points, c1["center"], c1["axis"])
        if coverage < math.radians(270.0):
            continue

        # Real holes usually connect to at least one non-cylindrical boundary face
        # (planar or conical); this avoids promoting long standalone cylinders.
        adj_non_cyl = set()
        for c in cluster:
            f = fc_shape.Faces[c["fi"]]
            for e in f.Edges:
                for nfi in e2f.get(e.hashCode(), []):
                    if nfi != c["fi"] and fc_shape.Faces[nfi].Surface.TypeId != "Part::GeomCylinder":
                        adj_non_cyl.add(nfi)
        if len(adj_non_cyl) < 1:
            continue
        
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
    if final:
        return final

    # Fallback for non-cylindrical hole topology exports.
    return _detect_holes_from_planar_loops(fc_shape)

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

def unfold_with_lib(filepath, profile="full"):
    profile_key = str(profile or "full").strip().lower()
    include_unfold = profile_key in ("full", "fast2d", "2d", "unfold")
    include_face_meshes = profile_key == "full"
    include_projections = profile_key == "full"
    include_holes = profile_key in ("full", "holes", "holes_fast")
    estimate_thickness = profile_key != "holes_fast"

    t0 = time.time()
    emit_progress(4, "Loading STEP model")
    # 1. Load STEP directly using FreeCAD Part
    fc_shape = Part.Shape()
    fc_shape.read(filepath)
    sys.stderr.write(f"[Profiling] Load STEP: {time.time() - t0:.3f}s\n")

    if not include_unfold:
        thickness = 2.0
        root_idx = None
        non_flat_features = _empty_non_flat_features()
        if estimate_thickness:
            emit_progress(28, "Estimating sheet thickness")
            try:
                planar_faces = [
                    (i, float(face.Area))
                    for i, face in enumerate(fc_shape.Faces)
                    if face.Surface.TypeId == "Part::GeomPlane"
                ]
                if planar_faces:
                    root_idx = max(planar_faces, key=lambda x: x[1])[0]
                    thickness = float(EstimateThickness.using_best_method(fc_shape, root_idx))
            except Exception:
                # Keep robust fallback thickness for downstream UI flows.
                thickness = 2.0

        if root_idx is not None:
            non_flat_features = _detect_non_flat_features(fc_shape, root_idx, thickness)

        holes_data = []
        if include_holes:
            emit_progress(58 if estimate_thickness else 42, "Detecting holes")
            holes_data = detect_holes_fc(fc_shape)

        emit_progress(96, "Finalizing analysis")
        return _json_safe({
            "success": True,
            "flatVertices": [],
            "cutEdges": [],
            "bendEdges": [],
            "thickness": round(float(thickness), 4),
            "nonFlatFeatures": non_flat_features,
            "bendTree": None,
            "faceMeshes": {},
            "bends": [],
            "bbox": {"width": 0.0, "height": 0.0},
            "topEdges": [],
            "frontEdges": [],
            "sideEdges": [],
            "topBendEdges": [],
            "frontBendEdges": [],
            "sideBendEdges": [],
            "detectedHoles": holes_data,
        })
    
    t_start = time.time()
    emit_progress(12, "Scanning model faces")
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
            emit_progress(20 + (root_candidates.index(root_idx) * 4), f"Evaluating unfold root {root_idx}")
            # Adjacency and Thickness
            print(f"[Debug] Testing root {root_idx} (area {fc_shape.Faces[root_idx].Area:.2f})", file=sys.stderr)
            root_face = fc_shape.Faces[root_idx]
            root_normal = root_face.Surface.Axis
            print(f"[Debug] Root Normal: {root_normal}", file=sys.stderr)
            graph = build_graph_of_tangent_faces(fc_shape, root_idx)
            print(f"[Debug] Graph built with {graph.number_of_nodes()} nodes and {graph.number_of_edges()} edges", file=sys.stderr)
            thickness = EstimateThickness.using_best_method(fc_shape, root_idx)
            print(f"[Debug] Detected thickness: {thickness}", file=sys.stderr)
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
            emit_progress(38, "Unfolding bends")
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
            emit_progress(62, "Generating flat pattern geometry")
            
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

    non_flat_features = _detect_non_flat_features(fc_shape, chosen_root, thickness)
    
    # 1. Move to origin
    global_align_m.move(root_center * -1.0)
    # 2. Rotate normal to [0,0,1]
    rot = Rotation(root_normal, Vector(0,0,1))
    global_align_m = rot.toMatrix().multiply(global_align_m)

    # 5. Generate Output Data using chosen_root
    flat_vertices = []
    cut_edges_2d = []
    bend_edges_2d = []
    cut_seg_counts = {}
    cut_seg_points = {}
    emit_progress(70, "Building bend hierarchy")
    
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
                p1, p2 = pts[i], pts[i + 1]
                seg_hash = _get_line_hash(p1, p2, tol=0.05)
                cut_seg_counts[seg_hash] = cut_seg_counts.get(seg_hash, 0) + 1
                if seg_hash not in cut_seg_points:
                    cut_seg_points[seg_hash] = p1 + p2

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

    # Keep only boundary segments in the flat cut profile.
    # Shared segments are internal seams between unfolded faces and should not be shown as cut lines.
    for seg_hash, count in cut_seg_counts.items():
        if count == 1:
            cut_edges_2d.extend(cut_seg_points[seg_hash])

    face_meshes = {}
    if include_face_meshes:
        emit_progress(80, "Preparing 3D face meshes")
        # Tessellate all faces for HierarchicalProjectViewer.
        # deflection=5.0 provides a major reduction in triangle count for faster loading.
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
    views = {
        "top": {"edges": [], "bend_edges": []},
        "front": {"edges": [], "bend_edges": []},
        "side": {"edges": [], "bend_edges": []},
    }
    if include_projections:
        t_views = time.time()
        emit_progress(88, "Generating orthographic projections")
        views = get_projections(fc_shape)
        sys.stderr.write(f"[Profiling] Projections: {time.time() - t_views:.3f}s\n")

    holes_data = []
    if include_holes:
        t_holes = time.time()
        emit_progress(92, "Detecting holes")
        holes_data = detect_holes_fc(fc_shape)
        sys.stderr.write(f"[Profiling] Hole Detection: {time.time() - t_holes:.3f}s\n")

    sys.stderr.write(f"[Profiling] Total unfold_with_lib: {time.time() - t_start:.3f}s\n")
    emit_progress(98, "Finalizing response")

    return _json_safe({
        "success": True,
        "flatVertices": flat_vertices,
        "cutEdges": cut_edges_2d,
        "bendEdges": bend_edges_2d,
        "thickness": round(float(thickness), 4),
        "nonFlatFeatures": non_flat_features,
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
    # Accept input file and profile from env vars (preferred — avoids FreeCAD
    # intercepting CLI args) or fall back to positional args for manual use.
    input_file = os.environ.get("UNFOLD_INPUT_FILE") or (sys.argv[1] if len(sys.argv) > 1 else None)
    cli_profile = os.environ.get("UNFOLD_PROFILE") or "full"
    if not input_file:
        print(json.dumps({"error": "No input file specified"}))
        sys.exit(1)
    if len(sys.argv) > 2 and not os.environ.get("UNFOLD_INPUT_FILE"):
        for arg in sys.argv[2:]:
            if arg.startswith("--profile=") or arg.startswith("profile="):
                cli_profile = arg.split("=", 1)[1].strip() or "full"
    print(json.dumps(unfold_with_lib(input_file, profile=cli_profile)))
