
import sys
import os
import math
import json
import importlib.util
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

UNFOLD_LIB_ENGINE_VERSION = "2026-10-12-analysis-v16"

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

def _model_min_bbox_span(shape):
    try:
        bb = shape.BoundBox
        spans = [float(bb.XLength), float(bb.YLength), float(bb.ZLength)]
        positive = [span for span in spans if span > 1e-6]
        return min(positive) if positive else 0.0
    except Exception:
        return 0.0


def _count_bend_cylinder_axes(shape):
    count = 0
    try:
        for face in shape.Faces:
            if face.Surface.TypeId == "Part::GeomCylinder":
                u_range = face.ParameterRange
                if math.degrees(u_range[1] - u_range[0]) >= 20.0:
                    count += 1
    except Exception:
        pass
    return count


def _parallel_planar_face_distance(ref_face, other_face):
    try:
        return abs(
            other_face.valueAt(0, 0).distanceToPlane(
                ref_face.Surface.Position, ref_face.Surface.Axis
            )
        )
    except Exception:
        return 0.0


def _estimate_thickness_from_face_scored(shape, selected_face, model_min_span=0.0):
    if selected_face is None:
        return None
    try:
        ref_face = shape.Faces[selected_face]
    except Exception:
        return None
    if ref_face.Surface.TypeId != "Part::GeomPlane":
        return None

    ref_area = float(ref_face.Area or 0.0)
    candidates = []
    for face in shape.Faces:
        try:
            if face.hashCode() == ref_face.hashCode():
                continue
            if face.Surface.TypeId != "Part::GeomPlane":
                continue
            if abs(float(ref_face.Surface.Axis.dot(face.Surface.Axis))) < 0.995:
                continue
            distance = _parallel_planar_face_distance(ref_face, face)
            if distance <= 1e-6:
                continue
            face_area = float(face.Area or 0.0)
            area_similarity = 1.0 - (
                abs(face_area - ref_area) / max(face_area, ref_area, 1e-6)
            )
            if model_min_span > 0:
                span_ratio = distance / model_min_span
                if span_ratio <= 0.25 or span_ratio >= 4.0:
                    plausibility = 0.15
                else:
                    plausibility = math.exp(-abs(math.log(max(span_ratio, 1e-6))))
            else:
                plausibility = 1.0 if distance <= math.sqrt(max(ref_area, 1.0)) else 0.35
            score = (area_similarity * 0.35) + (plausibility * 0.55) - (distance * 0.002)
            candidates.append((score, distance, area_similarity, plausibility))
        except Exception:
            continue

    if not candidates:
        return None

    viable = [item for item in candidates if item[0] >= 0.30 and item[3] >= 0.20]
    if not viable:
        viable = [max(candidates, key=lambda item: item[0])]

    # Among plausible parallel skins, prefer the closest pair (actual sheet gauge).
    best_score, best_distance, area_similarity, plausibility = min(
        viable, key=lambda item: (item[1], -item[0])
    )
    confidence = "high" if best_score > 0.65 and plausibility > 0.6 else "medium"
    if best_score < 0.35 or plausibility < 0.25:
        confidence = "low"
    return {
        "thickness": float(best_distance),
        "confidence": confidence,
        "method": "face_pair",
        "score": float(best_score),
        "area_similarity": float(area_similarity),
    }


def _values_are_close(a, b, rel_tol=0.12, abs_tol=0.25):
    try:
        a = float(a)
        b = float(b)
    except (TypeError, ValueError):
        return False
    if a <= 0 or b <= 0:
        return False
    return abs(a - b) <= max(abs_tol, rel_tol * max(a, b, 1e-6))


def _resolve_doubled_cylinder_thickness(candidate_thickness, reference_thickness):
    """Cylinder radius deltas often return 2x the true sheet gauge."""
    try:
        candidate = float(candidate_thickness or 0.0)
        reference = float(reference_thickness or 0.0)
    except (TypeError, ValueError):
        return candidate_thickness
    if candidate <= 0 or reference <= 0:
        return candidate_thickness
    if _values_are_close(candidate, reference * 2.0, rel_tol=0.08, abs_tol=0.4):
        return reference
    if _values_are_close(candidate * 2.0, reference, rel_tol=0.08, abs_tol=0.4):
        return candidate
    return candidate_thickness


def _estimate_tube_wall_thickness(shape):
    """Wall thickness of a hollow tube: the radial gap between two coaxial,
    near-full-circle cylinders (the outer wall and the inner bore).

    EstimateThickness.from_cylinders deliberately IGNORES full-circle concentric
    cylinders -- on a bent sheet those are hole stacks or bosses, never the
    gauge -- which leaves a plain tube with no thickness at all, because a
    tube's wall IS exactly two full-circle coaxial cylinders. This recovers that
    one case and nothing else: it looks only at NEAR-CLOSED cylinders that share
    an axis, so it can never fire on a flat or bent sheet, whose thickness the
    normal path already found before this is ever reached. Any error returns
    0.0, i.e. the current behaviour, so it can only ever add a value, never
    remove one.
    """
    try:
        full_circle_min = math.radians(350.0)
        eps_gap = 1e-4
        places = 4
        by_axis = {}
        for face in shape.Faces:
            surface = face.Surface
            if surface.TypeId != "Part::GeomCylinder":
                continue
            u_range = face.ParameterRange
            span = abs(float(u_range[1]) - float(u_range[0]))
            if span < full_circle_min:
                continue  # a partial arc is a bend -- handled by from_cylinders
            axis = surface.Axis.normalize()
            if axis.dot(Vector(0, 0, -1)) < 0:
                axis = axis.negative()
            center = surface.Center.projectToPlane(Vector(), axis)
            key = (
                round(axis.x, places), round(axis.y, places), round(axis.z, places),
                round(center.x, places), round(center.y, places), round(center.z, places),
            )
            by_axis.setdefault(key, []).append(float(surface.Radius))
        gaps = []
        for radii in by_axis.values():
            unique = sorted({round(r, 6) for r in radii})
            for i in range(len(unique)):
                for j in range(i + 1, len(unique)):
                    gap = abs(unique[j] - unique[i])
                    if gap > eps_gap:
                        gaps.append(gap)
        if not gaps:
            return 0.0
        # The tightest genuine radial gap between two full coaxial cylinders is
        # the wall; a stepped tube also pairs outer-with-outer, which are larger.
        return float(min(gaps))
    except Exception:
        return 0.0


def _thickness_surface_volume_anchor(shape):
    """Physical lower-bound thickness estimate: 2*Volume/SurfaceArea.

    For a thin sheet the total surface area is ~ 2*flat_area + perimeter*T, so
    2V/A = T / (1 + perimeter*T/(2*flat)) <= T always. It under-reads on heavily
    perforated parts (lots of edge area) but can never inflate, which makes it a
    trustworthy *lower bound* / order-of-magnitude anchor. Used only to sanity
    clamp the heuristic thickness — never as the primary value, because its
    absolute accuracy is poor for perforated or stocky parts."""
    try:
        volume = float(shape.Volume or 0.0)
        area = float(shape.Area or 0.0)
    except Exception:
        return 0.0
    if volume <= 0.0 or area <= 0.0:
        return 0.0
    return 2.0 * volume / area


def _modal_opposite_face_gap(shape, lo, hi):
    """Most common perpendicular distance between antiparallel planar faces that
    overlap in projection — i.e. the true material gauge — restricted to the
    plausible band [lo, hi]. Robust recovery value when the heuristic thickness
    is physically implausible (a fillet radius-diff or a flange gap got mistaken
    for the gauge)."""
    try:
        planar = [
            f for f in shape.Faces
            if f.Surface.TypeId == "Part::GeomPlane" and float(f.Area or 0.0) >= 5.0
        ]
    except Exception:
        return 0.0
    gaps = {}
    for i, fa in enumerate(planar):
        na = fa.Surface.Axis
        ca = fa.CenterOfMass
        span = math.sqrt(max(float(fa.Area or 1.0), 1.0))
        best = None
        for j, fb in enumerate(planar):
            if i == j:
                continue
            if abs(float(na.dot(fb.Surface.Axis))) < 0.98:
                continue
            delta = fb.CenterOfMass - ca
            dist = abs(float(delta.dot(na)))
            if dist < lo or dist > hi:
                continue
            # require projected overlap so we measure across the sheet, not to a
            # far-away parallel flange
            inplane = (delta - na.multiply(delta.dot(na))).Length
            if inplane > span:
                continue
            if best is None or dist < best:
                best = dist
        if best is not None:
            key = round(best, 2)
            gaps[key] = gaps.get(key, 0) + 1
    if not gaps:
        return 0.0
    return float(max(gaps.items(), key=lambda kv: (kv[1], -kv[0]))[0])


def _estimate_sheet_thickness(shape, selected_face, model_min_span=0.0):
    """Estimate sheet thickness, then sanity-clamp the result against the
    physical 2V/A lower bound so a mistaken fillet/counterbore radius-diff or
    flange-gap can never ship an absurd gauge (which corrupts every bend
    allowance and the flat pattern)."""
    result = _estimate_sheet_thickness_core(shape, selected_face, model_min_span)
    try:
        t_geom = _thickness_surface_volume_anchor(shape)
        t_val = float(result.get("thickness") or 0.0)
        if t_geom > 0.0 and t_val > 0.0:
            # Genuine sheet gauge sits in ~[1.0, 1.9]x the 2V/A anchor across the
            # whole test corpus; [0.55, 2.4] leaves margin on both sides and does
            # not fire for any correctly-analysed part.
            lo, hi = t_geom * 0.55, t_geom * 2.4
            if not (lo <= t_val <= hi):
                candidates = []
                gap = _modal_opposite_face_gap(shape, lo, hi)
                if gap > 0.0:
                    candidates.append(gap)
                for key in ("cylinder_thickness", "face_thickness"):
                    v = result.get(key)
                    if isinstance(v, (int, float)) and lo <= float(v) <= hi:
                        candidates.append(float(v))
                corrected = candidates[0] if candidates else (t_geom * 1.15)
                sys.stderr.write(
                    f"[Debug] Thickness {t_val:.4f} implausible vs 2V/A anchor "
                    f"{t_geom:.4f} (band [{lo:.3f},{hi:.3f}]); corrected to "
                    f"{corrected:.4f}\n"
                )
                result = dict(result)
                result["thickness"] = corrected
                result["confidence"] = "medium"
                result["method"] = f"{result.get('method') or '?'}_geom_clamped"
                result["thickness_geom_anchor"] = t_geom
                result["thickness_before_clamp"] = t_val
    except Exception as clamp_err:
        sys.stderr.write(f"[Debug] Thickness plausibility clamp skipped: {clamp_err}\n")
    return result


def _estimate_sheet_thickness_core(shape, selected_face, model_min_span=0.0):
    """Estimate sheet thickness using face-pair scoring and cylinder consensus."""
    if model_min_span <= 0:
        model_min_span = _model_min_bbox_span(shape)

    face_est = None
    try:
        if selected_face is not None:
            face_est = _estimate_thickness_from_face_scored(
                shape, selected_face, model_min_span
            )
    except Exception:
        face_est = None

    face_thickness = float(face_est["thickness"]) if face_est else 0.0

    cylinder_thickness = 0.0
    try:
        cylinder_thickness = float(EstimateThickness.from_cylinders(shape) or 0.0)
    except Exception:
        cylinder_thickness = 0.0

    if cylinder_thickness > 0 and model_min_span > 0:
        cylinder_thickness = _resolve_doubled_cylinder_thickness(
            cylinder_thickness, model_min_span
        )
    if cylinder_thickness > 0 and face_thickness > 0:
        cylinder_thickness = _resolve_doubled_cylinder_thickness(
            cylinder_thickness, face_thickness
        )

    bend_axes = _count_bend_cylinder_axes(shape)

    if face_thickness > 0 and cylinder_thickness > 0:
        rel_diff = abs(face_thickness - cylinder_thickness) / max(
            face_thickness, cylinder_thickness, 1e-6
        )
        if rel_diff <= 0.10:
            thickness = (face_thickness + cylinder_thickness) * 0.5
            return {
                "thickness": thickness,
                "confidence": "high",
                "method": "consensus",
                "face_thickness": face_thickness,
                "cylinder_thickness": cylinder_thickness,
            }
        # A formed part's smallest bounding-box span is often the distance
        # between two flanges, not its gauge. Repeated concentric bend radii are
        # the stronger signal when they are materially smaller than that span.
        if (
            bend_axes >= 2
            and model_min_span > 0
            and cylinder_thickness <= model_min_span * 0.25
            and face_thickness >= model_min_span * 0.50
        ):
            return {
                "thickness": cylinder_thickness,
                "confidence": "high",
                "method": "cylinders",
                "face_thickness": face_thickness,
                "cylinder_thickness": cylinder_thickness,
            }

        # Prefer face-pair when it matches a genuinely thin model span.
        if model_min_span > 0 and _values_are_close(face_thickness, model_min_span, rel_tol=0.12, abs_tol=0.35):
            confidence = face_est.get("confidence", "high") if face_est else "high"
            return {
                "thickness": face_thickness,
                "confidence": confidence,
                "method": "face_pair",
                "face_thickness": face_thickness,
                "cylinder_thickness": cylinder_thickness,
            }
        if bend_axes >= 3 and not (
            model_min_span > 0
            and _values_are_close(cylinder_thickness, model_min_span * 2.0, rel_tol=0.10, abs_tol=0.4)
        ):
            return {
                "thickness": cylinder_thickness,
                "confidence": "medium",
                "method": "cylinders",
                "face_thickness": face_thickness,
                "cylinder_thickness": cylinder_thickness,
            }
        confidence = face_est.get("confidence", "medium") if face_est else "medium"
        return {
            "thickness": face_thickness,
            "confidence": confidence,
            "method": "face_pair",
            "face_thickness": face_thickness,
            "cylinder_thickness": cylinder_thickness,
        }

    if cylinder_thickness > 0:
        if model_min_span > 0 and _values_are_close(cylinder_thickness, model_min_span, rel_tol=0.12, abs_tol=0.35):
            confidence = "high"
        elif model_min_span > 0 and _values_are_close(cylinder_thickness, model_min_span * 2.0, rel_tol=0.10, abs_tol=0.4):
            cylinder_thickness = model_min_span
            confidence = "medium"
        else:
            confidence = "medium" if bend_axes >= 2 else "low"
        return {
            "thickness": cylinder_thickness,
            "confidence": confidence,
            "method": "cylinders",
            "cylinder_thickness": cylinder_thickness,
        }

    if face_thickness > 0:
        confidence = face_est.get("confidence", "medium") if face_est else "medium"
        return {
            "thickness": face_thickness,
            "confidence": confidence,
            "method": "face_pair",
            "face_thickness": face_thickness,
        }

    # No parallel skins and no bend cylinders -- but a hollow tube still has a
    # real thickness in its wall. Preferred over the bbox span below, which for
    # a tube is a diameter or a length, not the gauge.
    tube_wall = _estimate_tube_wall_thickness(shape)
    if tube_wall > 0:
        return {
            "thickness": float(tube_wall),
            "confidence": "medium",
            "method": "tube_wall",
        }

    if model_min_span > 0:
        return {
            "thickness": float(model_min_span),
            "confidence": "medium",
            "method": "bbox_min_span",
        }

    user_thickness = EstimateThickness.from_user_input()
    if user_thickness:
        return {
            "thickness": float(user_thickness),
            "confidence": "high",
            "method": "user_input",
        }

    raise RuntimeError("Couldn't estimate thickness for shape!")


def _unwrap_thickness_value(thickness_result):
    if isinstance(thickness_result, dict):
        return float(thickness_result.get("thickness") or 0.0)
    try:
        return float(thickness_result or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _thickness_plausibility_penalty(thickness_value, model_min_span, thickness_result=None):
    if model_min_span <= 0 or thickness_value <= 0:
        return 0.0
    ratio = thickness_value / model_min_span
    if 0.80 <= ratio <= 1.25:
        return 0.0
    method = (thickness_result or {}).get("method") if isinstance(thickness_result, dict) else None
    if method in ("face_pair", "consensus", "bbox_min_span") and ratio <= 1.35:
        return 0.0
    if ratio > 3.0:
        return 25000.0
    return abs(ratio - 1.0) * 1500.0


def _score_root_face_candidate(shape, root_idx, model_min_span=0.0):
    try:
        thickness_result = _estimate_sheet_thickness(shape, root_idx, model_min_span)
        thickness = _unwrap_thickness_value(thickness_result)
        confidence_bonus = 500.0 if thickness_result.get("confidence") == "high" else 0.0
        penalty = _thickness_plausibility_penalty(thickness, model_min_span, thickness_result)
        return confidence_bonus - penalty, thickness_result
    except Exception:
        return -10000.0, None


def _normalize(vec):
    length = np.linalg.norm(vec)
    if length < 1e-12:
        return vec.copy()
    return vec / length

def _contour_bbox_fallback(flat_area_mm2, flat_bbox):
    length_mm = float(flat_bbox.get("length") or flat_bbox.get("xSpan") or 0.0)
    width_mm = float(flat_bbox.get("width") or flat_bbox.get("ySpan") or 0.0)
    if length_mm <= 0 or width_mm <= 0:
        return []
    outer = [
        [0.0, 0.0],
        [length_mm, 0.0],
        [length_mm, width_mm],
        [0.0, width_mm],
    ]
    return [{
        "outer": outer,
        "holes": [],
        "area_mm2": float(flat_area_mm2 or (length_mm * width_mm)),
        "contour_length_mm": 2.0 * (length_mm + width_mm),
        "source": "bbox_fallback",
        "bbox": {
            "length_mm": length_mm,
            "width_mm": width_mm,
            "rotation_deg": float(flat_bbox.get("rotation_deg") or 0.0),
        },
    }]


def _signed_polygon_area(points):
    if len(points) < 3:
        return 0.0
    return 0.5 * sum(
        (points[index][0] * points[(index + 1) % len(points)][1])
        - (points[(index + 1) % len(points)][0] * points[index][1])
        for index in range(len(points))
    )


def _point_in_polygon(point, polygon):
    if len(polygon) < 3:
        return False
    px, py = point
    inside = False
    previous = polygon[-1]
    for current in polygon:
        x1, y1 = previous
        x2, y2 = current
        crosses = (y1 > py) != (y2 > py)
        if crosses:
            x_at_y = x1 + ((py - y1) * (x2 - x1) / ((y2 - y1) or 1e-12))
            if px < x_at_y:
                inside = not inside
        previous = current
    return inside


def _simplify_contour(points, tolerance=0.02):
    compact = []
    for point in points:
        value = [float(point[0]), float(point[1])]
        if not compact or math.hypot(
            value[0] - compact[-1][0], value[1] - compact[-1][1]
        ) > tolerance:
            compact.append(value)
    if len(compact) > 1 and math.hypot(
        compact[0][0] - compact[-1][0], compact[0][1] - compact[-1][1]
    ) <= tolerance:
        compact.pop()

    if len(compact) <= 3:
        return compact

    # Douglas-Peucker. Error is measured against the ORIGINAL polyline, so the
    # simplified outline provably stays within `tolerance` of the real one.
    #
    # The previous implementation deleted near-collinear points in repeated
    # passes, judging each point only against its CURRENT neighbours. Every pass
    # therefore accepted the previous pass's drift as the new truth and the error
    # compounded without bound. At the default 0.02 mm this cascaded: a 226 mm
    # bracket collapsed from 181 points (61.7 x 226.6 mm) to 37 points
    # (61.7 x 38.1 mm), silently deleting 80% of the blank, which nesting then
    # packed and priced. No cascade is possible here.
    def _perpendicular_distance(point, start, end):
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        length_sq = dx * dx + dy * dy
        if length_sq <= 1e-18:
            return math.hypot(point[0] - start[0], point[1] - start[1])
        t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / length_sq
        t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
        return math.hypot(
            point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy)
        )

    def _douglas_peucker(chain):
        if len(chain) < 3:
            return list(chain)
        keep = [False] * len(chain)
        keep[0] = True
        keep[-1] = True
        # Iterative so a densely tessellated contour cannot blow the stack.
        stack = [(0, len(chain) - 1)]
        while stack:
            start_index, end_index = stack.pop()
            if end_index <= start_index + 1:
                continue
            worst = -1.0
            worst_index = -1
            for index in range(start_index + 1, end_index):
                distance = _perpendicular_distance(
                    chain[index], chain[start_index], chain[end_index]
                )
                if distance > worst:
                    worst = distance
                    worst_index = index
            if worst > tolerance and worst_index > start_index:
                keep[worst_index] = True
                stack.append((start_index, worst_index))
                stack.append((worst_index, end_index))
        return [point for point, keep_it in zip(chain, keep) if keep_it]

    # A ring has no endpoints, and Douglas-Peucker never removes the two it is
    # given. Anchor on the farthest-apart pair so neither anchor can distort the
    # result, then simplify the two chains between them.
    base = compact[0]
    far_index = max(
        range(1, len(compact)),
        key=lambda i: (compact[i][0] - base[0]) ** 2
        + (compact[i][1] - base[1]) ** 2,
    )
    first_chain = _douglas_peucker(compact[: far_index + 1])
    second_chain = _douglas_peucker(compact[far_index:] + [compact[0]])
    simplified = first_chain[:-1] + second_chain[:-1]
    return simplified if len(simplified) >= 3 else compact


def _bridge_dangling_endpoints(nodes, adjacency, undirected_edges, gap_tolerance):
    """Close small gaps in the flat-pattern boundary.

    Unrolled flanges frequently stop ~1 material thickness short of the
    neighbouring boundary (bend relief / mitered corners), leaving degree-1
    "dangling" nodes that break the outer loop into open paths. A valid flat
    pattern boundary is always closed, so every dangling endpoint is a defect:
    we greedily reconnect each to its nearest open neighbour within
    ``gap_tolerance`` until no small gaps remain.
    """
    if gap_tolerance <= 0:
        return

    for _ in range(len(nodes) + 1):
        dangling = [key for key in adjacency if len(adjacency.get(key, ())) == 1]
        if len(dangling) < 2:
            break
        best = None
        for i in range(len(dangling)):
            for j in range(i + 1, len(dangling)):
                a, b = dangling[i], dangling[j]
                if b in adjacency.get(a, ()):
                    continue
                pa, pb = nodes[a], nodes[b]
                gap = math.hypot(pa[0] - pb[0], pa[1] - pb[1])
                if gap <= gap_tolerance and (best is None or gap < best[0]):
                    best = (gap, a, b)
        if best is None:
            break
        _, a, b = best
        undirected_edges.add(tuple(sorted((a, b))))
        adjacency.setdefault(a, set()).add(b)
        adjacency.setdefault(b, set()).add(a)


def _stitch_cut_edge_loops(cut_edges_2d, tolerance=0.05, gap_tolerance=0.0):
    nodes = {}
    adjacency = {}
    undirected_edges = set()

    # Weld endpoints geometrically instead of snapping them onto a `tolerance`
    # grid. Two consecutive segments share an endpoint exactly, but if that
    # shared point lands on a cell boundary the two copies round to different
    # cells, the chain breaks, and the outline shatters into fragments — 19 of
    # them on a 562 mm blank, the largest holding only 5% of the true area. The
    # stitch was then rejected as incomplete and the caller fell back to the
    # mesh boundary, which bridges concave notches and produced the sheared
    # outline seen in nesting. Probing neighbouring cells makes the join
    # independent of where the grid falls.
    weld_cell = max(float(tolerance), 1e-9)
    weld_nodes = {}
    weld_buckets = {}
    next_node_id = [0]

    def node_key(x, y):
        cx = int(math.floor(x / weld_cell))
        cy = int(math.floor(y / weld_cell))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for key in weld_buckets.get((cx + dx, cy + dy), ()):
                    px, py = weld_nodes[key]
                    if abs(px - x) <= tolerance and abs(py - y) <= tolerance:
                        return key
        key = next_node_id[0]
        next_node_id[0] += 1
        weld_nodes[key] = (x, y)
        weld_buckets.setdefault((cx, cy), []).append(key)
        return key

    for index in range(0, len(cut_edges_2d) - 5, 6):
        try:
            first = (float(cut_edges_2d[index]), float(cut_edges_2d[index + 1]))
            second = (
                float(cut_edges_2d[index + 3]),
                float(cut_edges_2d[index + 4]),
            )
        except (IndexError, TypeError, ValueError):
            continue
        if math.hypot(second[0] - first[0], second[1] - first[1]) <= tolerance:
            continue
        first_key = node_key(*first)
        second_key = node_key(*second)
        if first_key == second_key:
            continue
        edge_key = tuple(sorted((first_key, second_key)))
        if edge_key in undirected_edges:
            continue
        undirected_edges.add(edge_key)
        nodes.setdefault(first_key, first)
        nodes.setdefault(second_key, second)
        adjacency.setdefault(first_key, set()).add(second_key)
        adjacency.setdefault(second_key, set()).add(first_key)

    # Bridge bend-relief gaps so the outer boundary closes into one loop.
    _bridge_dangling_endpoints(nodes, adjacency, undirected_edges, gap_tolerance)

    def choose_next(previous_key, current_key, candidates):
        if len(candidates) == 1:
            return candidates[0]
        previous = nodes[previous_key]
        current = nodes[current_key]
        incoming = (current[0] - previous[0], current[1] - previous[1])
        incoming_length = max(math.hypot(*incoming), 1e-12)

        def straightness(candidate_key):
            candidate = nodes[candidate_key]
            outgoing = (candidate[0] - current[0], candidate[1] - current[1])
            outgoing_length = max(math.hypot(*outgoing), 1e-12)
            return (
                incoming[0] * outgoing[0] + incoming[1] * outgoing[1]
            ) / (incoming_length * outgoing_length)

        return max(candidates, key=straightness)

    unused = set(undirected_edges)
    loops = []
    while unused:
        first_key, second_key = next(iter(unused))
        unused.remove(tuple(sorted((first_key, second_key))))
        path = [first_key, second_key]
        previous_key = first_key
        current_key = second_key

        for _guard in range(max(32, len(undirected_edges) + 4)):
            if current_key == first_key:
                break
            candidates = [
                candidate
                for candidate in adjacency.get(current_key, ())
                if tuple(sorted((current_key, candidate))) in unused
            ]
            if not candidates:
                break
            next_key = choose_next(previous_key, current_key, candidates)
            unused.remove(tuple(sorted((current_key, next_key))))
            path.append(next_key)
            previous_key, current_key = current_key, next_key

        if current_key != first_key or len(path) < 4:
            continue
        polygon = _simplify_contour([nodes[key] for key in path[:-1]])
        if len(polygon) >= 3 and abs(_signed_polygon_area(polygon)) > tolerance ** 2:
            loops.append(polygon)
    return loops


def _merge_touching_outer_loops(outer_loops, merge_tolerance):
    """Splice outer loops that nearly touch into a single blank outline.

    A sheet-metal blank is one connected piece. Unfolding can still leave a
    flange as its own closed loop a fraction of a millimetre from the body (bend
    relief, tangent gaps at a corner). `_bridge_dangling_endpoints` cannot join
    those - it only closes dangling ends, and a closed loop has none - so the
    loop is classified as a second outer contour and then simply dropped,
    together with real material: 24 mm of length and 6% of the area on the
    reference part, which nesting then packed and priced as if it were not there.

    Loops are spliced at their closest point pair, leaving a zero-width slit that
    costs no area and keeps the outline a single closed ring.
    """
    loops = [list(loop) for loop in outer_loops if len(loop) >= 3]
    if len(loops) < 2:
        return loops

    def closest_pair(first, second):
        best = None
        for i, p in enumerate(first):
            for j, q in enumerate(second):
                distance = math.hypot(p[0] - q[0], p[1] - q[1])
                if best is None or distance < best[0]:
                    best = (distance, i, j)
        return best

    merged = True
    while merged and len(loops) > 1:
        merged = False
        for a in range(len(loops)):
            for b in range(a + 1, len(loops)):
                distance, i, j = closest_pair(loops[a], loops[b])
                if distance > merge_tolerance:
                    continue
                first = loops[a]
                second = loops[b]
                # Traverse both the same way so the splice yields a valid ring.
                if (_signed_polygon_area(first) >= 0) != (
                    _signed_polygon_area(second) >= 0
                ):
                    second = second[::-1]
                    j = len(second) - 1 - j
                spliced = (
                    first[: i + 1]
                    + second[j:]
                    + second[: j + 1]
                    + first[i:]
                )
                loops = (
                    [spliced]
                    + [loop for index, loop in enumerate(loops) if index not in (a, b)]
                )
                sys.stderr.write(
                    f"[Debug] Spliced a detached flange loop into the blank outline "
                    f"(gap {distance:.3f} mm)\n"
                )
                merged = True
                break
            if merged:
                break
    return loops


def _build_contours_from_cut_edges(
    cut_edges_2d, flat_area_mm2, flat_bbox, thickness_mm=0.0
):
    """Build true outer and hole polygons from unfolded boundary segments."""
    if not cut_edges_2d or len(cut_edges_2d) < 6:
        return _contour_bbox_fallback(flat_area_mm2, flat_bbox)

    # Bend-relief corners leave gaps on the order of the material thickness.
    # Allow the stitcher to bridge gaps a few thicknesses wide (with a sane
    # absolute floor) so complex multi-flange parts still close their outer
    # loop, while keeping the bridge short enough not to swallow real openings.
    try:
        thickness_val = float(thickness_mm or 0.0)
    except (TypeError, ValueError):
        thickness_val = 0.0
    gap_tolerance = max(0.6, 4.0 * thickness_val)

    loops = _stitch_cut_edge_loops(cut_edges_2d, gap_tolerance=gap_tolerance)
    if not loops:
        return _contour_bbox_fallback(flat_area_mm2, flat_bbox)

    loops.sort(key=lambda polygon: abs(_signed_polygon_area(polygon)), reverse=True)
    outer_loops = []
    hole_loops = []
    for index, polygon in enumerate(loops):
        containing_count = sum(
            1
            for larger in loops[:index]
            if _point_in_polygon(polygon[0], larger)
        )
        if containing_count % 2:
            hole_loops.append(polygon)
        else:
            outer_loops.append(polygon)

    # One blank, one outline: rejoin flanges the unfold left as separate islands.
    outer_loops = _merge_touching_outer_loops(
        outer_loops, max(1.0, 1.5 * thickness_val)
    )

    # Every disconnected outline belongs to the same rigid unfolded component.
    # Normalize all regions against ONE flat-pattern origin.  Normalizing each
    # outer independently destroys the distance between islands, which makes a
    # later compound nest geometrically meaningless.
    global_min_x = min(
        (point[0] for outer in outer_loops for point in outer), default=0.0
    )
    global_min_y = min(
        (point[1] for outer in outer_loops for point in outer), default=0.0
    )

    contours = []
    for outer in outer_loops:
        holes = [hole for hole in hole_loops if _point_in_polygon(hole[0], outer)]
        normalized_outer = [
            [x - global_min_x, y - global_min_y] for x, y in outer
        ]
        normalized_holes = [
            [[x - global_min_x, y - global_min_y] for x, y in hole]
            for hole in holes
        ]
        xs = [point[0] for point in normalized_outer]
        ys = [point[1] for point in normalized_outer]
        x_span = max(xs) - min(xs)
        y_span = max(ys) - min(ys)
        outer_area = abs(_signed_polygon_area(normalized_outer))
        holes_area = sum(abs(_signed_polygon_area(hole)) for hole in normalized_holes)
        contour_length = sum(
            math.hypot(
                polygon[(point_index + 1) % len(polygon)][0] - point[0],
                polygon[(point_index + 1) % len(polygon)][1] - point[1],
            )
            for polygon in [normalized_outer] + normalized_holes
            for point_index, point in enumerate(polygon)
        )
        contours.append({
            "outer": normalized_outer,
            "holes": normalized_holes,
            "area_mm2": max(0.0, outer_area - holes_area),
            "contour_length_mm": contour_length,
            "bbox": {
                "length_mm": max(x_span, y_span),
                "width_mm": min(x_span, y_span),
                "x_span_mm": x_span,
                "y_span_mm": y_span,
                "rotation_deg": float(flat_bbox.get("rotation_deg") or 0.0),
            },
            "source": "unfolded_cut_edge_loop",
            "coordinate_frame": "flat_pattern_global",
        })

    contours.sort(key=lambda contour: contour["area_mm2"], reverse=True)
    return contours or _contour_bbox_fallback(flat_area_mm2, flat_bbox)


def _mesh_boundary_loops(flat_vertices, tolerance=0.1):
    """Recover the flat pattern's outline loops from its triangulated mesh.

    Every triangle edge that belongs to exactly one triangle lies on a boundary
    (the outer silhouette or a hole); interior edges — including the bend fold
    lines where adjacent flanges meet — are shared by two triangles and are
    skipped. The remaining boundary forms clean closed loops (each node has
    degree two), so a plain walk recovers them exactly. This yields the
    complete, watertight flat outline even when the cut-edge segment set has
    bend-relief gaps that stop it from stitching into a single loop — the reason
    bent parts previously produced only a partial contour.
    """
    if not flat_vertices or len(flat_vertices) < 9:
        return []
    triangle_count = len(flat_vertices) // 9

    # Weld duplicate triangle corners GEOMETRICALLY. Snapping each corner onto a
    # `tolerance` grid looks equivalent but is not: two copies of one vertex that
    # straddle a cell boundary get different keys, so the fold edge they share is
    # recorded as two separate edges that are each used once. Both then pass the
    # "used exactly once means boundary" test below, interior fold lines enter
    # the boundary graph, and the walk cuts across the blank — which turned a
    # full-height strip into a tapering wedge and split it into several loops.
    # Searching the neighbouring cells makes welding independent of where the
    # grid happens to fall.
    cell = max(float(tolerance), 1e-9)
    node_positions = {}
    weld_buckets = {}
    next_node_id = [0]

    def node_key(x, y):
        cx = int(math.floor(x / cell))
        cy = int(math.floor(y / cell))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for key in weld_buckets.get((cx + dx, cy + dy), ()):
                    px, py = node_positions[key]
                    if abs(px - x) <= cell and abs(py - y) <= cell:
                        return key
        key = next_node_id[0]
        next_node_id[0] += 1
        node_positions[key] = (x, y)
        weld_buckets.setdefault((cx, cy), []).append(key)
        return key

    edge_uses = {}
    edge_points = {}
    for triangle_index in range(triangle_count):
        base = triangle_index * 9
        try:
            corners = [
                (
                    float(flat_vertices[base + corner * 3]),
                    float(flat_vertices[base + corner * 3 + 1]),
                )
                for corner in range(3)
            ]
        except (IndexError, TypeError, ValueError):
            continue
        for corner in range(3):
            first = corners[corner]
            second = corners[(corner + 1) % 3]
            first_key = node_key(*first)
            second_key = node_key(*second)
            if first_key == second_key:
                continue
            edge_key = tuple(sorted((first_key, second_key)))
            edge_uses[edge_key] = edge_uses.get(edge_key, 0) + 1
            if edge_key not in edge_points:
                edge_points[edge_key] = (first, second)

    nodes = {}
    adjacency = {}
    undirected_edges = set()
    for edge_key, uses in edge_uses.items():
        if uses != 1:
            continue
        first_key, second_key = edge_key
        first, second = edge_points[edge_key]
        nodes[first_key] = first
        nodes[second_key] = second
        adjacency.setdefault(first_key, []).append(second_key)
        adjacency.setdefault(second_key, []).append(first_key)
        undirected_edges.add(edge_key)

    unused = set(undirected_edges)
    loops = []
    while unused:
        start_key, next_key = next(iter(unused))
        unused.discard((start_key, next_key))
        path = [start_key, next_key]
        current_key = next_key
        for _guard in range(len(undirected_edges) + 4):
            if current_key == start_key:
                break
            advanced = False
            for candidate in adjacency.get(current_key, ()):
                candidate_edge = tuple(sorted((current_key, candidate)))
                if candidate_edge in unused:
                    unused.discard(candidate_edge)
                    path.append(candidate)
                    current_key = candidate
                    advanced = True
                    break
            if not advanced:
                break
        if current_key != start_key or len(path) < 4:
            continue
        # Mesh boundaries are finely tessellated, so use a tight simplification
        # tolerance: the default (0.02 mm) compounds across many collinear
        # points and can shave ~15% off the true area, which would distort both
        # nesting area and the rendered shape. 0.005 mm keeps >99% of the area
        # while still collapsing genuinely redundant points.
        polygon = _simplify_contour(
            [nodes[key] for key in path[:-1]], tolerance=0.005
        )
        if len(polygon) >= 3 and abs(_signed_polygon_area(polygon)) > tolerance ** 2:
            loops.append(polygon)
    return loops


def _contours_from_mesh_boundary(flat_vertices, flat_area_mm2, flat_bbox):
    """Build outer/hole contours from the watertight flat-pattern mesh boundary."""
    loops = _mesh_boundary_loops(flat_vertices)
    if not loops:
        return []
    loops.sort(key=lambda polygon: abs(_signed_polygon_area(polygon)), reverse=True)
    outer_loops = []
    hole_loops = []
    for index, polygon in enumerate(loops):
        containing_count = sum(
            1 for larger in loops[:index] if _point_in_polygon(polygon[0], larger)
        )
        if containing_count % 2:
            hole_loops.append(polygon)
        else:
            outer_loops.append(polygon)

    global_min_x = min(
        (point[0] for outer in outer_loops for point in outer), default=0.0
    )
    global_min_y = min(
        (point[1] for outer in outer_loops for point in outer), default=0.0
    )

    contours = []
    for outer in outer_loops:
        holes = [hole for hole in hole_loops if _point_in_polygon(hole[0], outer)]
        normalized_outer = [
            [x - global_min_x, y - global_min_y] for x, y in outer
        ]
        normalized_holes = [
            [[x - global_min_x, y - global_min_y] for x, y in hole]
            for hole in holes
        ]
        xs = [point[0] for point in normalized_outer]
        ys = [point[1] for point in normalized_outer]
        x_span = max(xs) - min(xs)
        y_span = max(ys) - min(ys)
        outer_area = abs(_signed_polygon_area(normalized_outer))
        holes_area = sum(abs(_signed_polygon_area(hole)) for hole in normalized_holes)
        contour_length = sum(
            math.hypot(
                polygon[(point_index + 1) % len(polygon)][0] - point[0],
                polygon[(point_index + 1) % len(polygon)][1] - point[1],
            )
            for polygon in [normalized_outer] + normalized_holes
            for point_index, point in enumerate(polygon)
        )
        contours.append({
            "outer": normalized_outer,
            "holes": normalized_holes,
            "area_mm2": max(0.0, outer_area - holes_area),
            "contour_length_mm": contour_length,
            "bbox": {
                "length_mm": max(x_span, y_span),
                "width_mm": min(x_span, y_span),
                "x_span_mm": x_span,
                "y_span_mm": y_span,
                "rotation_deg": float(flat_bbox.get("rotation_deg") or 0.0),
            },
            "source": "flat_mesh_boundary",
            "coordinate_frame": "flat_pattern_global",
        })

    contours.sort(key=lambda contour: contour["area_mm2"], reverse=True)
    return contours


def _contours_from_flat_faces(flat_faces_2d, flat_bbox, deflection=0.05):
    """Outline the blank by merging its exact unfolded faces.

    Each flat face becomes a thin slab and the slabs are fused into one solid
    (fusing solids is far more robust than fusing bare faces, which can come
    back as a scrap); the top face of that solid is the blank, and its wires
    are the outline and every cut-out, holes still true circles. It has no
    bend-relief gaps (the cut-edge stitch's failure) and never sees a seam
    where two faces were tessellated differently (the mesh walk's failure).
    Both failures together cut a folded enclosure down to one side flange in
    the 2D view. Returns [] unless every face lies flat at one level.
    """
    faces = []
    for shape in flat_faces_2d or []:
        for face in getattr(shape, "Faces", None) or []:
            box = face.BoundBox
            if box.ZLength > 1e-3:
                return []
            moved = face.copy()
            moved.translate(Vector(0.0, 0.0, -box.ZMin))
            faces.append(moved)
    if not faces:
        return []

    t_start = time.time()
    slabs = [face.extrude(Vector(0.0, 0.0, 1.0)) for face in faces]

    def top_faces(solid):
        return [
            face for face in solid.Faces
            if abs(face.BoundBox.ZMin - 1.0) < 1e-6 and face.BoundBox.ZLength < 1e-6
        ]

    tops = []
    for fuzzy in (0.0, 0.05):
        try:
            if len(slabs) == 1:
                fused = slabs[0]
            elif fuzzy:
                fused = slabs[0].fuse(slabs[1:], fuzzy)
            else:
                fused = slabs[0].multiFuse(slabs[1:])
            fused = fused.removeSplitter()
            if fused.isValid():
                tops = top_faces(fused)
        except Exception as fuse_error:
            sys.stderr.write(f"[Warning] Flat-face outline fuse failed (fuzzy {fuzzy}): {fuse_error}\n")
            tops = []
        if tops:
            break
    if not tops:
        return []

    def wire_points(wire):
        return _simplify_contour(
            [[point.x, point.y] for point in wire.discretize(Deflection=deflection)],
            tolerance=0.005,
        )

    outer_loops = []
    for face in tops:
        outer_wire = face.OuterWire
        outer = wire_points(outer_wire)
        if len(outer) < 3:
            continue
        holes = [
            points for points in (
                wire_points(wire) for wire in face.Wires if not wire.isSame(outer_wire)
            )
            if len(points) >= 3
        ]
        outer_loops.append((outer, holes))
    if not outer_loops:
        return []

    global_min_x = min(point[0] for outer, _holes in outer_loops for point in outer)
    global_min_y = min(point[1] for outer, _holes in outer_loops for point in outer)

    contours = []
    for outer, holes in outer_loops:
        normalized_outer = [[x - global_min_x, y - global_min_y] for x, y in outer]
        normalized_holes = [
            [[x - global_min_x, y - global_min_y] for x, y in hole] for hole in holes
        ]
        xs = [point[0] for point in normalized_outer]
        ys = [point[1] for point in normalized_outer]
        x_span = max(xs) - min(xs)
        y_span = max(ys) - min(ys)
        outer_area = abs(_signed_polygon_area(normalized_outer))
        holes_area = sum(abs(_signed_polygon_area(hole)) for hole in normalized_holes)
        contour_length = sum(
            math.hypot(
                polygon[(point_index + 1) % len(polygon)][0] - point[0],
                polygon[(point_index + 1) % len(polygon)][1] - point[1],
            )
            for polygon in [normalized_outer] + normalized_holes
            for point_index, point in enumerate(polygon)
        )
        contours.append({
            "outer": normalized_outer,
            "holes": normalized_holes,
            "area_mm2": max(0.0, outer_area - holes_area),
            "contour_length_mm": contour_length,
            "bbox": {
                "length_mm": max(x_span, y_span),
                "width_mm": min(x_span, y_span),
                "x_span_mm": x_span,
                "y_span_mm": y_span,
                "rotation_deg": float(flat_bbox.get("rotation_deg") or 0.0),
            },
            "source": "flat_face_union",
            "coordinate_frame": "flat_pattern_global",
        })

    contours.sort(key=lambda contour: contour["area_mm2"], reverse=True)
    sys.stderr.write(f"[Profiling] Flat-face outline ({len(faces)} faces): {time.time() - t_start:.3f}s\n")
    return contours


def _largest_contour_area(contours):
    return max(
        (float(contour.get("area_mm2", 0.0) or 0.0) for contour in contours),
        default=0.0,
    )


def _contours_are_bbox_fallback(contours):
    return any(
        "bbox_fallback" in str(contour.get("source", "")) for contour in contours
    )


def _build_flat_contours(
    cut_edges_2d, flat_vertices, flat_area_mm2, flat_bbox, thickness_mm=0.0,
    flat_faces_2d=None,
):
    """Return the best available flat-pattern contour set.

    The cut-edge stitch produces clean, straight contours for simple parts, but
    on bent parts the outer loop can only be partially assembled (bend-relief
    gaps), leaving a contour far smaller than the real blank. When that happens
    the watertight mesh boundary is a strictly better source, so nesting, laser
    cut length, and the 2D preview all get the true shape instead of a partial
    loop or a plain bounding box.
    """
    cut_contours = _build_contours_from_cut_edges(
        cut_edges_2d, flat_area_mm2, flat_bbox, thickness_mm=thickness_mm
    )
    target_area = float(flat_area_mm2 or 0.0)
    cut_area = _largest_contour_area(cut_contours)
    cut_is_bbox = _contours_are_bbox_fallback(cut_contours)
    # Only reach for the mesh boundary when the cut-edge contour is clearly
    # incomplete; this keeps simple parts on the well-tested cut-edge path.
    if target_area <= 0 or (not cut_is_bbox and cut_area >= 0.95 * target_area):
        return cut_contours
    # Next best: merge the exact unfolded faces (true outline, true arcs).
    if flat_faces_2d:
        try:
            face_contours = _contours_from_flat_faces(flat_faces_2d, flat_bbox)
            if face_contours and _largest_contour_area(face_contours) > cut_area:
                return face_contours
        except Exception as face_error:
            sys.stderr.write(
                f"[Warning] Flat-face contour extraction failed: {face_error}\n"
            )
    try:
        mesh_contours = _contours_from_mesh_boundary(
            flat_vertices, flat_area_mm2, flat_bbox
        )
        if mesh_contours and _largest_contour_area(mesh_contours) > cut_area:
            return mesh_contours
    except Exception as mesh_error:
        sys.stderr.write(
            f"[Warning] Mesh-boundary contour extraction failed: {mesh_error}\n"
        )
    return cut_contours


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

def _adaptive_mesh_deflection(shape, override=None):
    """Chord tolerance for the 3D viewer mesh, scaled to the part's size.

    A fixed coarse value (the old 8.0mm default) turned small purchased parts —
    screws, inserts — into blocky, 12-sided lumps while barely helping large
    sheet parts. Scaling to the bounding-box span gives small parts a fine mesh
    and keeps large parts within a sane triangle budget (span*0.012, clamped to
    0.15-5.0mm: a 40mm screw -> ~0.48mm, a 600mm sheet -> 5.0mm vs the old 8.0).
    An explicit CAD_MESH_DEFLECTION still wins so it can be pinned per env.
    """
    if override not in (None, ""):
        try:
            return max(0.01, float(override))
        except (TypeError, ValueError):
            pass
    try:
        bb = shape.BoundBox
        span = max(
            float(bb.XLength or 0.0),
            float(bb.YLength or 0.0),
            float(bb.ZLength or 0.0),
            1.0,
        )
        return max(0.15, min(5.0, span * 0.012))
    except Exception:
        return 0.8


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
    try:
        pts = edge.discretize(Number=sample_n)
    except Exception:
        # Imported STEP curves occasionally refuse OCC's discretize call even
        # though valueAt remains valid. Sample the parameter range directly so
        # one malformed trim cannot discard an otherwise valid flat pattern.
        pts = []
        try:
            first = float(edge.FirstParameter)
            last = float(edge.LastParameter)
            if math.isfinite(first) and math.isfinite(last) and last > first:
                pts = [
                    edge.valueAt(first + (last - first) * index / (sample_n - 1))
                    for index in range(sample_n)
                ]
        except Exception:
            pts = []
        if len(pts) < 2:
            try:
                pts = [vertex.Point for vertex in edge.Vertexes]
            except Exception:
                pts = []
    return [[p.x, p.y, p.z] for p in pts]

def _get_line_hash(p1_list, p2_list, tol=0.05):
    """Canonical hash for a line segment using midpoint + direction."""
    p1 = np.asarray(p1_list, dtype=float)
    p2 = np.asarray(p2_list, dtype=float)
    direction = p2 - p1
    length = float(np.linalg.norm(direction))
    if length < 1e-9:
        midpoint = tuple(round(float(v) / tol) * tol for v in ((p1 + p2) * 0.5))
        return ("degenerate", midpoint)

    direction = direction / length
    if direction[0] < -1e-9 or (
        abs(direction[0]) <= 1e-9 and (
            direction[1] < -1e-9 or (
                abs(direction[1]) <= 1e-9 and direction[2] < 0
            )
        )
    ):
        direction = -direction

    midpoint = tuple(round(float(v) / tol) * tol for v in ((p1 + p2) * 0.5))
    direction_key = tuple(round(float(v), 4) for v in direction)
    return (midpoint, direction_key)


def _rigidify_matrix(matrix):
    """Re-orthonormalize the rotation block of an accumulated transform.

    The unfold traversal chains one unbend transform per bend, and each of those is
    itself composed from a general 4x4 inverse.  After a handful of bends the 3x3
    block has drifted far enough from orthonormal that OCC refuses the transform
    with ``Standard_DomainError: Moving with scaling transformation is forbidden``,
    which kills the whole analysis.  Gram-Schmidt restores rigidity; on a clean
    matrix it is a no-op to within ~1e-15.

    Returns *matrix* unchanged if the block is degenerate — the caller's fallback
    handles that case.
    """
    try:
        c0 = [float(matrix.A11), float(matrix.A21), float(matrix.A31)]
        c1 = [float(matrix.A12), float(matrix.A22), float(matrix.A32)]
        c2 = [float(matrix.A13), float(matrix.A23), float(matrix.A33)]
        tx, ty, tz = float(matrix.A14), float(matrix.A24), float(matrix.A34)
    except Exception:
        return matrix

    def norm(v):
        return math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])

    def scale(v, s):
        return [v[0] * s, v[1] * s, v[2] * s]

    def dot(a, b):
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

    def sub(a, b):
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

    def cross(a, b):
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        ]

    n0 = norm(c0)
    if n0 < 1e-9:
        return matrix
    e0 = scale(c0, 1.0 / n0)

    p1 = sub(c1, scale(e0, dot(e0, c1)))
    n1 = norm(p1)
    if n1 < 1e-9:
        return matrix
    e1 = scale(p1, 1.0 / n1)

    # Third axis follows from the first two; taking the cross product (rather
    # than orthogonalizing c2) also guarantees a right-handed frame, so no
    # residual mirror can survive.
    e2 = cross(e0, e1)
    if dot(e2, c2) < 0.0:
        e2 = scale(e2, -1.0)
        e1 = scale(e1, -1.0)

    try:
        return Matrix(
            e0[0], e1[0], e2[0], tx,
            e0[1], e1[1], e2[1], ty,
            e0[2], e1[2], e2[2], tz,
            0.0, 0.0, 0.0, 1.0,
        )
    except Exception:
        return matrix


def _safe_transformed(shape, matrix, label=""):
    """Apply *matrix* to *shape*, degrading instead of aborting the analysis.

    ``Shape.transformed`` accepts rigid transforms only.  When a matrix is still
    non-rigid after ``_rigidify_matrix`` (genuinely degenerate face frames do
    occur), fall back to ``transformGeometry``, which permits general transforms.
    Only if that also fails do we drop the face — one bad face must never take the
    whole part down.
    """
    try:
        return shape.transformed(matrix)
    except Exception as exc:
        try:
            result = shape.transformGeometry(matrix)
            sys.stderr.write(
                f"[Debug] Rigid transform rejected for {label} ({exc}); "
                f"used transformGeometry instead\n"
            )
            return result
        except Exception as exc2:
            sys.stderr.write(
                f"[Debug] Dropping {label} from flat pattern — transform failed: {exc2}\n"
            )
            return None


def _points_close(a, b, tol):
    return (
        abs(a[0] - b[0]) <= tol
        and abs(a[1] - b[1]) <= tol
        and abs(a[2] - b[2]) <= tol
    )


class _SegmentTally:
    """Counts flat-pattern segments, matching duplicates GEOMETRICALLY.

    The flat cut profile is "every segment seen exactly once": a segment shared by
    two unfolded faces is an internal seam and must cancel.  Matching by
    `_get_line_hash` cannot do that reliably — it snaps the midpoint onto a `tol`
    grid and rounds the direction to four decimals, so the two sides of one seam
    hash differently whenever they straddle a cell boundary or their directions
    disagree in the fifth decimal after independent unbend transforms.  Both sides
    then survive the count == 1 filter and get drawn, which is why bends show up as
    stacked parallel lines across the part.

    Comparing endpoints against a real distance tolerance makes cancellation
    independent of where the grid happens to fall.
    """

    def __init__(self, match_tol=0.12):
        self._match_tol = float(match_tol)
        self._cell = max(self._match_tol, 1e-6)
        self._buckets = {}
        self._entries = []

    def _cell_of(self, midpoint):
        return tuple(int(math.floor(v / self._cell)) for v in midpoint)

    def add(self, p1_list, p2_list):
        p1 = [float(p1_list[0]), float(p1_list[1]), float(p1_list[2])]
        p2 = [float(p2_list[0]), float(p2_list[1]), float(p2_list[2])]
        mid = ((p1[0] + p2[0]) * 0.5, (p1[1] + p2[1]) * 0.5, (p1[2] + p2[2]) * 0.5)
        cx, cy, cz = self._cell_of(mid)
        tol = self._match_tol
        # Cell size equals the match tolerance, so a match can only live in the
        # 27 cells around this midpoint.
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for idx in self._buckets.get((cx + dx, cy + dy, cz + dz), ()):
                        entry = self._entries[idx]
                        q1, q2 = entry[0], entry[1]
                        if (
                            _points_close(p1, q1, tol) and _points_close(p2, q2, tol)
                        ) or (
                            _points_close(p1, q2, tol) and _points_close(p2, q1, tol)
                        ):
                            entry[2] += 1
                            return
        self._entries.append([p1, p2, 1])
        self._buckets.setdefault((cx, cy, cz), []).append(len(self._entries) - 1)

    def boundary_segments(self):
        """Segments seen exactly once — the outer profile and hole boundaries."""
        return [(e[0], e[1]) for e in self._entries if e[2] == 1]


def _compute_flat_bbox_obb(xy_points):
    """Return semantic flat bbox using minimum-area bounding box in XY."""
    pts = np.asarray(xy_points, dtype=float)
    if pts.ndim != 2 or pts.shape[0] < 2 or pts.shape[1] < 2:
        return {
            "length": 0.0,
            "width": 0.0,
            "xSpan": 0.0,
            "ySpan": 0.0,
            "rotation_deg": 0.0,
        }

    xy = pts[:, :2]
    best_area = float("inf")
    best_length = 0.0
    best_width = 0.0
    best_rotation = 0.0
    best_x_span = 0.0
    best_y_span = 0.0

    for angle_deg in np.linspace(0.0, 90.0, 91):
        theta = math.radians(angle_deg)
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)
        rot = np.array([[cos_t, sin_t], [-sin_t, cos_t]], dtype=float)
        rotated = xy @ rot.T
        min_xy = np.min(rotated, axis=0)
        max_xy = np.max(rotated, axis=0)
        span_x = float(max_xy[0] - min_xy[0])
        span_y = float(max_xy[1] - min_xy[1])
        area = span_x * span_y
        if area < best_area:
            best_area = area
            best_x_span = span_x
            best_y_span = span_y
            best_length = max(span_x, span_y)
            best_width = min(span_x, span_y)
            best_rotation = float(angle_deg)

    return {
        "length": best_length,
        "width": best_width,
        "xSpan": best_x_span,
        "ySpan": best_y_span,
        "rotation_deg": best_rotation,
    }


def _outer_wire_xy_points(face, samples=24):
    points = []
    try:
        for edge in face.OuterWire.Edges:
            for point in edge.discretize(Number=samples):
                points.append([float(point.x), float(point.y)])
    except Exception:
        pass
    return points


def _flat_bbox_from_cut_edge_segments(cut_edges_2d):
    points = []
    for index in range(0, len(cut_edges_2d) - 5, 6):
        try:
            points.append([float(cut_edges_2d[index]), float(cut_edges_2d[index + 1])])
            points.append([float(cut_edges_2d[index + 3]), float(cut_edges_2d[index + 4])])
        except (IndexError, TypeError, ValueError):
            continue
    if len(points) < 2:
        return None
    return _compute_flat_bbox_obb(np.asarray(points, dtype=float))


def _snap_thickness_to_min_span(thickness, model_min_span):
    try:
        value = float(thickness or 0.0)
        span = float(model_min_span or 0.0)
    except (TypeError, ValueError):
        return thickness
    if value <= 0 or span <= 0:
        return thickness
    if _values_are_close(value, span, rel_tol=0.05, abs_tol=0.2):
        return span
    return value


def _clamp_root_to_major_skin(chosen_root, potential_roots, shape, min_area_fraction=0.25):
    if not potential_roots:
        return chosen_root
    largest = potential_roots[0]
    try:
        chosen_area = float(shape.Faces[chosen_root].Area)
        largest_area = float(largest["area"])
    except Exception:
        return chosen_root
    if largest_area > 0 and chosen_area < (largest_area * min_area_fraction):
        sys.stderr.write(
            f"[Debug] Root {chosen_root} area {chosen_area:.1f} is too small vs "
            f"largest skin {largest['index']} area {largest_area:.1f}; using largest skin\n"
        )
        return int(largest["index"])
    return chosen_root


def _blank_looks_edge_on(flat_bbox, thickness_mm=0.0, model_min_span=0.0):
    length_mm = float(flat_bbox.get("length") or flat_bbox.get("xSpan") or 0.0)
    width_mm = float(flat_bbox.get("width") or flat_bbox.get("ySpan") or 0.0)
    if length_mm <= 0 or width_mm <= 0:
        return False
    min_span = min(length_mm, width_mm)
    max_span = max(length_mm, width_mm)
    thickness = float(thickness_mm or 0.0)
    if thickness <= 0 and model_min_span > 0:
        thickness = float(model_min_span)
    if thickness <= 0:
        return max_span / max(min_span, 1e-6) > 25.0
    return min_span <= max(thickness * 2.5, 1.0) and max_span > min_span * 8.0


def _bent_unfold_looks_partial_profile(
    flat_bbox,
    flat_area_mm2,
    largest_planar_area,
    best_unfold_state,
    cut_edges_2d=None,
    flat_vertices=None,
):
    """Detect a false-positive bend unfold that only captured a narrow profile strip.

    Some extruded/profile-like parts expose a tiny bend-connected graph while
    their real 2D manufacturing profile is a larger planar skin.  Returning that
    tiny graph makes the 2D view look like a long rectangle with a bend line.
    """
    if not isinstance(best_unfold_state, dict):
        return False
    try:
        real_bends = int(best_unfold_state.get("real_bend_count") or 0)
        graph_nodes = int(best_unfold_state.get("graph_nodes") or 0)
        root_area = float(best_unfold_state.get("root_area") or 0.0)
        flat_area = float(flat_area_mm2 or 0.0)
        largest_area = float(largest_planar_area or 0.0)
    except (TypeError, ValueError):
        return False

    if real_bends <= 0 or real_bends > 1 or graph_nodes > 3:
        return False
    if flat_area <= 0 or largest_area <= 0 or root_area <= 0:
        return False
    if root_area >= largest_area * 0.75:
        return False
    if flat_area > largest_area * 1.05:
        return False

    cut_segment_count = len(cut_edges_2d or []) // 6
    flat_triangle_count = len(flat_vertices or []) // 9
    if cut_segment_count > 24 and flat_triangle_count > 24:
        return False

    try:
        length_mm = float(flat_bbox.get("length") or flat_bbox.get("xSpan") or 0.0)
        width_mm = float(flat_bbox.get("width") or flat_bbox.get("ySpan") or 0.0)
    except (TypeError, ValueError):
        return False
    if length_mm <= 0 or width_mm <= 0:
        return False
    return max(length_mm, width_mm) > min(length_mm, width_mm) * 3.0


def _collect_profile_recovery_bend_edges(
    shape,
    align_matrix,
    flat_vertices,
    cut_edges_2d,
    thickness_mm=0.0,
):
    """Project long cylinder/plane crease edges into a recovered skin profile.

    Partial-profile recovery uses the planar skin as the 2D blank.  The bend
    tree that led us there is intentionally discarded, but profile rails still
    have real long crease edges between cylindrical bends and planar legs.  Keep
    those as dashed 2D bend markers while filtering slot radii and outline
    duplicates.
    """
    points = []
    for arr in (flat_vertices or [], cut_edges_2d or []):
        for index in range(0, len(arr) - 2, 3):
            try:
                points.append((float(arr[index]), float(arr[index + 1])))
            except (TypeError, ValueError):
                continue
    if len(points) < 4:
        return []

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    x_span = max_x - min_x
    y_span = max_y - min_y
    major_span = max(x_span, y_span)
    if major_span <= 0:
        return []

    thickness = float(thickness_mm or 0.0)
    in_bounds_tol = max(thickness * 0.25, 0.15)
    hash_tol = max(thickness * 0.25, 0.15)
    min_bend_length = max(major_span * 0.35, thickness * 8.0, 10.0)

    edge_to_faces = {}
    for face_index, face in enumerate(shape.Faces):
        try:
            edges = face.Edges
        except Exception:
            continue
        for edge in edges:
            edge_to_faces.setdefault(edge.hashCode(), []).append(face_index)

    bend_edges = []
    seen = set()
    for edge in shape.Edges:
        adjacent = edge_to_faces.get(edge.hashCode(), [])
        if len(adjacent) != 2:
            continue
        try:
            surface_types = [shape.Faces[index].Surface.TypeId for index in adjacent]
        except Exception:
            continue
        if not (
            "Part::GeomCylinder" in surface_types
            and "Part::GeomPlane" in surface_types
        ):
            continue

        try:
            transformed = edge.transformed(align_matrix)
            pts = _get_edge_points(transformed)
        except Exception:
            continue

        for index in range(len(pts) - 1):
            try:
                x1, y1 = float(pts[index][0]), float(pts[index][1])
                x2, y2 = float(pts[index + 1][0]), float(pts[index + 1][1])
            except (TypeError, ValueError):
                continue
            dx = x2 - x1
            dy = y2 - y1
            length = math.hypot(dx, dy)
            if length < min_bend_length:
                continue
            if (
                min(x1, x2) < min_x - in_bounds_tol
                or max(x1, x2) > max_x + in_bounds_tol
                or min(y1, y2) < min_y - in_bounds_tol
                or max(y1, y2) > max_y + in_bounds_tol
            ):
                continue

            p1 = [x1, y1, 0.0]
            p2 = [x2, y2, 0.0]
            key = _get_line_hash(p1, p2, tol=hash_tol)
            if key in seen:
                continue
            seen.add(key)
            bend_edges.extend(p1 + p2)

    return bend_edges


def _merge_collinear_bend_edges(bend_edges_2d, thickness_mm=0.0, preserve_pairs=False):
    """Turn fragmented bend ticks into readable full crease lines.

    Perforated parts often unfold correctly but report bend markers as many
    short tangent fragments around holes/slots.  The 2D viewer then shows cyan
    ticks instead of a bend line.  Cluster fragments that lie on the same line
    and replace each cluster with its full extent; keep genuine single long
    bends as-is and discard isolated tiny tangent noise.

    Also collapses the classic double-line case: each real bend contributes the
    inner and outer cylinder/plane crease (~thickness apart).  Without merging
    those pairs, a 4-bend bracket draws 8 cyan lines.
    """
    if not bend_edges_2d or len(bend_edges_2d) < 6:
        return bend_edges_2d or []

    thickness = float(thickness_mm or 0.0)
    # Inner/outer bend creases sit about one sheet thickness apart in 2D.
    offset_tol = max(thickness * 1.6, 2.5)
    min_single_length = max(thickness * 1.2, 3.0)
    direction_dot_tol = 0.995
    # Two pieces on one line are one crease only if they overlap or all but
    # touch. A cluster used to be replaced by its full extent whatever lay
    # between its pieces, which fused two bends that share a line into one
    # crease drawn across the free edge between them.
    gap_tol = max(thickness * 4.0, 6.0)

    clusters = []
    for index in range(0, len(bend_edges_2d) - 5, 6):
        try:
            x1 = float(bend_edges_2d[index])
            y1 = float(bend_edges_2d[index + 1])
            x2 = float(bend_edges_2d[index + 3])
            y2 = float(bend_edges_2d[index + 4])
        except (TypeError, ValueError):
            continue

        dx = x2 - x1
        dy = y2 - y1
        length = math.hypot(dx, dy)
        if length < 1e-6:
            continue

        ux = dx / length
        uy = dy / length
        if ux < -1e-9 or (abs(ux) <= 1e-9 and uy < 0):
            ux, uy = -ux, -uy
            x1, y1, x2, y2 = x2, y2, x1, y1

        nx = -uy
        ny = ux
        offset = x1 * nx + y1 * ny
        t1 = x1 * ux + y1 * uy
        t2 = x2 * ux + y2 * uy
        t_min = min(t1, t2)
        t_max = max(t1, t2)

        segment = {
            "p1": [x1, y1, 0.0],
            "p2": [x2, y2, 0.0],
            "ux": ux,
            "uy": uy,
            "offset": offset,
            "t_min": t_min,
            "t_max": t_max,
            "length": length,
        }

        placed = False
        for cluster in clusters:
            dot = abs(ux * cluster["ux"] + uy * cluster["uy"])
            if dot < direction_dot_tol:
                continue
            if abs(offset - cluster["offset"]) > offset_tol:
                continue
            cluster["segments"].append(segment)
            cluster["offsets"].append(offset)
            cluster["t_min"] = min(cluster["t_min"], t_min)
            cluster["t_max"] = max(cluster["t_max"], t_max)
            cluster["total_length"] += length
            cluster["max_length"] = max(cluster["max_length"], length)
            placed = True
            break

        if not placed:
            clusters.append({
                "ux": ux,
                "uy": uy,
                "offset": offset,
                "offsets": [offset],
                "t_min": t_min,
                "t_max": t_max,
                "total_length": length,
                "max_length": length,
                "segments": [segment],
            })

    merged = []
    seen = set()
    for cluster in clusters:
        # Split the cluster into runs of pieces that overlap or nearly touch
        # along the line. Each run is one crease; a gap wider than gap_tol is
        # a free edge, and the pieces either side of it are separate bends.
        ordered = sorted(cluster["segments"], key=lambda item: item["t_min"])
        runs = []
        for segment in ordered:
            if runs and segment["t_min"] <= runs[-1]["t_max"] + gap_tol:
                run = runs[-1]
                run["segments"].append(segment)
                run["offsets"].append(segment["offset"])
                run["t_min"] = min(run["t_min"], segment["t_min"])
                run["t_max"] = max(run["t_max"], segment["t_max"])
            else:
                runs.append({
                    "segments": [segment],
                    "offsets": [segment["offset"]],
                    "t_min": segment["t_min"],
                    "t_max": segment["t_max"],
                })

        for run in runs:
            segments = run["segments"]
            count = len(segments)
            span = run["t_max"] - run["t_min"]
            # Merge pairs (inner+outer crease) and fragmented multi-tick bends.
            # Tray-style parts with many perimeter bends keep inner/outer pairs so
            # each folded face shows two dashed creases (12 lines for 6 bends).
            should_merge = count >= 3
            if count == 2 and not preserve_pairs:
                should_merge = True

            if should_merge:
                ux = float(cluster["ux"])
                uy = float(cluster["uy"])
                nx = -uy
                ny = ux
                offset = sorted(run["offsets"])[len(run["offsets"]) // 2]
                p1 = [
                    ux * run["t_min"] + nx * offset,
                    uy * run["t_min"] + ny * offset,
                    0.0,
                ]
                p2 = [
                    ux * run["t_max"] + nx * offset,
                    uy * run["t_max"] + ny * offset,
                    0.0,
                ]
                key = _get_line_hash(p1, p2, tol=0.25)
                if key not in seen and span >= min_single_length:
                    seen.add(key)
                    merged.extend(p1 + p2)
                continue

            for segment in segments:
                if segment["length"] < min_single_length:
                    continue
                key = _get_line_hash(segment["p1"], segment["p2"], tol=0.25)
                if key in seen:
                    continue
                seen.add(key)
                merged.extend(segment["p1"] + segment["p2"])

    return merged


def _parse_bend_edge_segments(bend_edges_2d):
    segments = []
    for index in range(0, len(bend_edges_2d or []) - 5, 6):
        try:
            x1 = float(bend_edges_2d[index])
            y1 = float(bend_edges_2d[index + 1])
            x2 = float(bend_edges_2d[index + 3])
            y2 = float(bend_edges_2d[index + 4])
        except (TypeError, ValueError):
            continue
        length = math.hypot(x2 - x1, y2 - y1)
        if length < 1e-6:
            continue
        ux = (x2 - x1) / length
        uy = (y2 - y1) / length
        if ux < -1e-9 or (abs(ux) <= 1e-9 and uy < 0):
            ux, uy = -ux, -uy
            x1, y1, x2, y2 = x2, y2, x1, y1
        nx, ny = -uy, ux
        offset = x1 * nx + y1 * ny
        segments.append({
            "coords": [x1, y1, 0.0, x2, y2, 0.0],
            "length": length,
            "ux": ux,
            "uy": uy,
            "offset": offset,
        })
    return segments


def _line_overlap_length(seg_a, seg_b):
    ux = float(seg_a["ux"])
    uy = float(seg_a["uy"])

    def _projection(seg):
        x1, y1, x2, y2 = seg["coords"][0], seg["coords"][1], seg["coords"][3], seg["coords"][4]
        t1 = x1 * ux + y1 * uy
        t2 = x2 * ux + y2 * uy
        return min(t1, t2), max(t1, t2)

    a0, a1 = _projection(seg_a)
    b0, b1 = _projection(seg_b)
    return max(0.0, min(a1, b1) - max(a0, b0))


def _estimate_bend_face_spacing(segments):
    if not segments:
        return 0.0
    span = max((segment["length"] for segment in segments), default=1.0)
    min_spacing = max(span * 0.006, 1.5)
    max_spacing = max(span * 0.12, min_spacing * 2.0)
    candidates = []
    for index, seg_a in enumerate(segments):
        for seg_b in segments[index + 1:]:
            dot = abs(seg_a["ux"] * seg_b["ux"] + seg_a["uy"] * seg_b["uy"])
            if dot < 0.996:
                continue
            overlap = _line_overlap_length(seg_a, seg_b)
            if overlap < min(seg_a["length"], seg_b["length"]) * 0.35:
                continue
            gap = abs(seg_a["offset"] - seg_b["offset"])
            if min_spacing <= gap <= max_spacing:
                candidates.append(gap)
    if not candidates:
        return 0.0
    candidates.sort()
    return candidates[len(candidates) // 2]


def _segments_interior_point(segments):
    if not segments:
        return (0.0, 0.0)
    mids_x = []
    mids_y = []
    for segment in segments:
        coords = segment["coords"]
        mids_x.append((coords[0] + coords[3]) * 0.5)
        mids_y.append((coords[1] + coords[4]) * 0.5)
    return (sum(mids_x) / len(mids_x), sum(mids_y) / len(mids_y))


def _ensure_bend_crease_pairs(bend_edges_2d, thickness_mm=0.0, interior_point=None):
    """Add a parallel offset mate for any single crease line (inner/outer pair)."""
    segments = _parse_bend_edge_segments(bend_edges_2d)
    if not segments:
        return bend_edges_2d or []

    thickness = max(float(thickness_mm or 0.0), 0.5)
    pair_gap = _estimate_bend_face_spacing(segments)
    if pair_gap <= 0:
        pair_gap = max(thickness * 8.0, 5.0)
    gap_lo = pair_gap * 0.65
    gap_hi = pair_gap * 1.35
    direction_dot_tol = 0.995
    duplicate_tol = max(pair_gap * 0.25, 1.0)
    if interior_point is None:
        interior_point = _segments_interior_point(segments)
    interior_x, interior_y = interior_point

    def _has_partner(segment):
        for other in segments:
            if other is segment:
                continue
            dot = abs(segment["ux"] * other["ux"] + segment["uy"] * other["uy"])
            if dot < direction_dot_tol:
                continue
            gap = abs(segment["offset"] - other["offset"])
            if gap < gap_lo or gap > gap_hi:
                continue
            overlap = _line_overlap_length(segment, other)
            if overlap < min(segment["length"], other["length"]) * 0.35:
                continue
            return True
        return False

    def _coords_duplicate(coords):
        x1, y1, x2, y2 = coords[0], coords[1], coords[3], coords[4]
        length = math.hypot(x2 - x1, y2 - y1)
        if length < 1e-6:
            return True
        ux = (x2 - x1) / length
        uy = (y2 - y1) / length
        nx, ny = -uy, ux
        offset = x1 * nx + y1 * ny
        for other in segments:
            dot = abs(ux * other["ux"] + uy * other["uy"])
            if dot < direction_dot_tol:
                continue
            if abs(offset - other["offset"]) <= duplicate_tol:
                return True
        return False

    out = list(bend_edges_2d or [])
    for segment in segments:
        if _has_partner(segment):
            continue
        nx, ny = -segment["uy"], segment["ux"]
        x1, y1, z1, x2, y2, z2 = segment["coords"]
        mid_x = (x1 + x2) * 0.5
        mid_y = (y1 + y2) * 0.5
        toward_interior = (
            (interior_x - mid_x) * nx + (interior_y - mid_y) * ny
        )
        direction = 1.0 if toward_interior >= 0.0 else -1.0
        coords = [
            x1 + nx * pair_gap * direction,
            y1 + ny * pair_gap * direction,
            z1,
            x2 + nx * pair_gap * direction,
            y2 + ny * pair_gap * direction,
            z2,
        ]
        if _coords_duplicate(coords):
            continue
        out.extend(coords)
        segments.append({
            "coords": coords,
            "length": segment["length"],
            "ux": segment["ux"],
            "uy": segment["uy"],
            "offset": coords[0] * nx + coords[1] * ny,
        })
    return out


def _limit_bend_edges_to_real_bends(bend_edges_2d, real_bend_count, thickness_mm=0.0):
    """Keep at most one drawn crease per detected real bend.

    After collinear merge, leftover near-duplicates or flange noise can still
    outnumber the unfold graph's real bend count. Prefer the longest creases and
    drop extras that are parallel and close to an already-kept line.
    """
    try:
        target = int(real_bend_count or 0)
    except (TypeError, ValueError):
        target = 0
    if target <= 0 or not bend_edges_2d or len(bend_edges_2d) < 6:
        return bend_edges_2d or []

    thickness = float(thickness_mm or 0.0)
    offset_tol = max(thickness * 1.6, 2.5)
    direction_dot_tol = 0.995

    segments = []
    for index in range(0, len(bend_edges_2d) - 5, 6):
        try:
            x1 = float(bend_edges_2d[index])
            y1 = float(bend_edges_2d[index + 1])
            x2 = float(bend_edges_2d[index + 3])
            y2 = float(bend_edges_2d[index + 4])
        except (TypeError, ValueError):
            continue
        length = math.hypot(x2 - x1, y2 - y1)
        if length < 1e-6:
            continue
        ux = (x2 - x1) / length
        uy = (y2 - y1) / length
        if ux < -1e-9 or (abs(ux) <= 1e-9 and uy < 0):
            ux, uy = -ux, -uy
            x1, y1, x2, y2 = x2, y2, x1, y1
        nx, ny = -uy, ux
        offset = x1 * nx + y1 * ny
        segments.append({
            "coords": [x1, y1, 0.0, x2, y2, 0.0],
            "length": length,
            "ux": ux,
            "uy": uy,
            "offset": offset,
        })

    if len(segments) <= target:
        return bend_edges_2d

    segments.sort(key=lambda item: item["length"], reverse=True)
    kept = []
    for segment in segments:
        if len(kept) >= target:
            break
        duplicate = False
        for other in kept:
            dot = abs(segment["ux"] * other["ux"] + segment["uy"] * other["uy"])
            if dot < direction_dot_tol:
                continue
            if abs(segment["offset"] - other["offset"]) <= offset_tol:
                duplicate = True
                break
        if duplicate:
            continue
        kept.append(segment)

    if not kept:
        return bend_edges_2d

    out = []
    for segment in kept:
        out.extend(segment["coords"])
    return out


def _develop_partial_profile_blank(
    shape,
    cut_edges_2d,
    bend_edges_2d,
    flat_vertices,
    flat_bbox,
    thickness_mm=0.0,
):
    """Expand a recovered profile projection into a simple developed blank.

    Constant-section rails can defeat the graph unfolder.  The profile recovery
    gives a clean top skin, but a projection hides the material beyond the last
    bend.  Use the long x-axis strip faces to estimate wall and lip widths, then
    remap the profile's cross-width so the outer flange material is visible.
    """
    if not cut_edges_2d or len(cut_edges_2d) < 6 or len(bend_edges_2d or []) < 24:
        return None

    try:
        thickness = float(thickness_mm or 0.0)
    except (TypeError, ValueError):
        thickness = 0.0

    length_hint = float(flat_bbox.get("length") or flat_bbox.get("xSpan") or 0.0)
    if length_hint <= 0:
        return None

    y_values = []
    for index in range(0, len(bend_edges_2d) - 5, 6):
        try:
            x1 = float(bend_edges_2d[index])
            y1 = float(bend_edges_2d[index + 1])
            x2 = float(bend_edges_2d[index + 3])
            y2 = float(bend_edges_2d[index + 4])
        except (TypeError, ValueError):
            continue
        if math.hypot(x2 - x1, y2 - y1) < max(length_hint * 0.5, 10.0):
            continue
        if abs(y2 - y1) > max(abs(x2 - x1) * 0.05, 0.25):
            continue
        y_values.append(abs((y1 + y2) * 0.5))

    unique_abs = []
    for value in sorted(y_values):
        if not unique_abs or abs(value - unique_abs[-1]) > max(thickness * 0.4, 0.25):
            unique_abs.append(value)
    if len(unique_abs) < 2:
        return None

    inner_abs = unique_abs[0]
    outer_abs = unique_abs[-1]
    projected_wall = outer_abs - inner_abs
    if inner_abs <= 0 or projected_wall <= 0:
        return None

    vertical_widths = []
    flange_widths = []
    for face in shape.Faces:
        try:
            if face.Surface.TypeId != "Part::GeomPlane":
                continue
            bb = face.BoundBox
            if float(bb.XLength) < length_hint * 0.7:
                continue
            y_span = abs(float(bb.YLength))
            z_span = abs(float(bb.ZLength))
            if y_span <= max(thickness * 0.25, 0.15) and z_span > max(thickness, 0.5):
                vertical_widths.append(z_span)
            if z_span <= max(thickness * 0.25, 0.15) and y_span > max(thickness, 0.5):
                if y_span <= max(inner_abs * 0.9, projected_wall * 2.0):
                    flange_widths.append(y_span)
        except Exception:
            continue

    developed_wall = max(
        projected_wall,
        (max(vertical_widths) - thickness) if vertical_widths else 0.0,
    )
    flange_width = max(flange_widths) if flange_widths else max(thickness, projected_wall)
    desired_outer_abs = inner_abs + developed_wall
    desired_boundary_abs = desired_outer_abs + flange_width
    if desired_boundary_abs <= outer_abs + max(thickness * 0.5, 0.25):
        return None

    boundary_tol = max(thickness * 0.35, 0.2)

    def map_y(value, *, bend=False):
        sign = -1.0 if value < 0 else 1.0
        magnitude = abs(float(value))
        if magnitude >= outer_abs - boundary_tol:
            return sign * (desired_outer_abs if bend else desired_boundary_abs)
        if magnitude > inner_abs + boundary_tol and projected_wall > 1e-6:
            ratio = min(1.0, max(0.0, (magnitude - inner_abs) / projected_wall))
            return sign * (inner_abs + ratio * developed_wall)
        return value

    def transform_positions(values, *, bend=False):
        transformed = list(values or [])
        for index in range(1, len(transformed), 3):
            try:
                transformed[index] = map_y(float(transformed[index]), bend=bend)
            except (TypeError, ValueError):
                continue
        return transformed

    next_cut_edges = transform_positions(cut_edges_2d, bend=False)
    next_bend_edges = transform_positions(bend_edges_2d, bend=True)
    next_flat_vertices = transform_positions(flat_vertices, bend=False)

    next_bbox = None
    try:
        next_bbox = _flat_bbox_from_cut_edge_segments(next_cut_edges)
        if not next_bbox and next_flat_vertices:
            pts = np.array(next_flat_vertices, dtype=float).reshape(-1, 3)
            next_bbox = _compute_flat_bbox_obb(pts)
    except Exception:
        next_bbox = None

    if not next_bbox:
        next_bbox = {
            **(flat_bbox or {}),
            "width": desired_boundary_abs * 2.0,
            "ySpan": desired_boundary_abs * 2.0,
        }

    sys.stderr.write(
        f"[Debug] Developed recovered profile width {outer_abs * 2.0:.3f} -> "
        f"{desired_boundary_abs * 2.0:.3f} mm "
        f"(wall={developed_wall:.3f}, flange={flange_width:.3f})\n"
    )
    return {
        "cut_edges_2d": next_cut_edges,
        "bend_edges_2d": next_bend_edges,
        "flat_vertices": next_flat_vertices,
        "flat_bbox": next_bbox,
    }


def _pick_best_no_bend_skin(potential_roots, shape, thin_axis_idx, model_min_span, exclude_idx=None):
    best = None
    best_score = -1.0
    for entry in potential_roots[:16]:
        idx = int(entry["index"])
        if exclude_idx is not None and idx == int(exclude_idx):
            continue
        try:
            face = shape.Faces[idx]
            bb = face.BoundBox
            spans = sorted(
                [
                    float(bb.XLength),
                    float(bb.YLength),
                    float(bb.ZLength),
                ]
            )
            min_span, mid_span, max_span = spans[0], spans[1], spans[2]
            if model_min_span > 0 and min_span > model_min_span * 3.0:
                continue
            normal = entry["normal"]
            if thin_axis_idx is not None:
                comps = [
                    abs(float(normal.x)),
                    abs(float(normal.y)),
                    abs(float(normal.z)),
                ]
                if comps[thin_axis_idx] < 0.85:
                    continue
            area = float(entry["area"])
            # Aspect ratio must be judged on the two IN-PLANE extents of the skin
            # face, not the 3D bbox: a large skin lying in a coordinate plane has a
            # ~0 span along its normal, which made every axis-aligned web look like
            # an infinite-aspect sliver and get rejected — so the fallback then
            # picked a tiny angled leg instead of the real plate (PRT-04871: 1738
            # vs the 17343 web). Use mid/max spans, which are the face's own width
            # and length.
            aspect = max_span / max(mid_span, 1e-6)
            if aspect > 35.0:
                continue
            score = area * (1.0 / max(aspect, 1.0))
            if score > best_score:
                best_score = score
                best = idx
        except Exception:
            continue
    return best


def _resolve_primary_skin_root(
    potential_roots, thin_axis_idx, fallback_idx, shape=None, model_min_span=0.0
):
    if shape is not None:
        picked = _pick_best_no_bend_skin(
            potential_roots, shape, thin_axis_idx, model_min_span
        )
        if picked is not None:
            return int(picked)
    if thin_axis_idx is not None:
        for entry in potential_roots:
            normal = entry["normal"]
            comps = [abs(float(normal.x)), abs(float(normal.y)), abs(float(normal.z))]
            if comps[thin_axis_idx] >= 0.85:
                return int(entry["index"])
    if potential_roots:
        return int(potential_roots[0]["index"])
    return int(fallback_idx)


def _build_global_align_for_face(face):
    normal = face.normalAt(0, 0)
    center = face.CenterOfMass
    align_m = Matrix()
    align_m.move(center * -1.0)
    rot = Rotation(normal, Vector(0, 0, 1))
    align_m = rot.toMatrix().multiply(align_m)
    return align_m


def _collect_thin_axis_skin_entries(shape, potential_roots, thin_axis_idx, root_idx, min_area):
    root_face = shape.Faces[root_idx]
    reference_normal = root_face.normalAt(0, 0)
    ref_normal_np = _face_normal_np(root_face)
    ref_center_np = _vector_to_np(root_face.CenterOfMass)
    entries = []
    # in-plane centroid + area of already-accepted faces, to reject coincident
    # duplicates (see below)
    accepted_signatures = []
    for entry in potential_roots:
        if float(entry["area"]) < min_area:
            continue
        normal = entry["normal"]
        comps = [abs(float(normal.x)), abs(float(normal.y)), abs(float(normal.z))]
        if thin_axis_idx is not None and comps[thin_axis_idx] < 0.85:
            continue
        if abs(float(normal.dot(reference_normal))) < 0.95:
            continue
        # Keep only faces coplanar with the root skin (same side of the sheet).
        # The opposite skin projects to the same XY rectangle, which would
        # cancel the shared outline as an internal seam and double the holes.
        try:
            face_center = _vector_to_np(shape.Faces[entry["index"]].CenterOfMass)
            offset = abs(float(np.dot(face_center - ref_center_np, ref_normal_np)))
        except Exception:
            face_center = None
            offset = 0.0
        if offset > 0.75:
            continue
        # Reject coincident duplicate skins. Some STEP exporters emit the same
        # skin face twice (identical plane, outline and area); both pass the
        # coplanarity test above and their areas would then be summed, doubling
        # the flat pattern (a 985x127 plate reported 2x its real area). A genuine
        # split skin sits side-by-side (different centroid), so match on the
        # in-plane centroid AND area — that only fires on true overlaps.
        area_val = float(entry["area"])
        if face_center is not None:
            inplane_c = face_center - ref_normal_np * float(
                np.dot(face_center - ref_center_np, ref_normal_np)
            )
            duplicate = False
            for prev_c, prev_a in accepted_signatures:
                if (
                    abs(area_val - prev_a) <= max(1.0, prev_a * 0.02)
                    and float(np.linalg.norm(inplane_c - prev_c)) <= 1.0
                ):
                    duplicate = True
                    break
            if duplicate:
                continue
            accepted_signatures.append((inplane_c, area_val))
        entries.append(entry)
    return entries


def _build_flat_pattern_from_thin_axis_skins(shape, potential_roots, thin_axis_idx, skin_root_idx):
    root_face = shape.Faces[skin_root_idx]
    global_align_m = _build_global_align_for_face(root_face)

    ref_area = max(float(root_face.Area or 0.0), 1.0)
    min_area = max(50.0, ref_area * 0.02)
    skin_entries = _collect_thin_axis_skin_entries(
        shape, potential_roots, thin_axis_idx, skin_root_idx, min_area
    )
    if not skin_entries:
        skin_entries = [entry for entry in potential_roots if entry["index"] == skin_root_idx]

    flat_vertices = []
    seg_tally = _SegmentTally()
    flat_faces_2d = []
    flat_area_mm2 = 0.0

    for entry in skin_entries:
        try:
            aligned = shape.Faces[entry["index"]].transformed(global_align_m)
            flat_faces_2d.append(aligned)
            flat_area_mm2 += float(getattr(aligned, "Area", 0.0) or 0.0)
            fv, ft = _tessellate_fc_face(aligned, deflection=1.0)
            for tri in ft:
                for v_idx in tri:
                    flat_vertices.extend(fv[v_idx])
            for edge in aligned.Edges:
                pts = _get_edge_points(edge)
                for i in range(len(pts) - 1):
                    seg_tally.add(pts[i], pts[i + 1])
        except Exception:
            continue

    cut_edges_2d = []
    for p1, p2 in seg_tally.boundary_segments():
        cut_edges_2d.extend(p1 + p2)

    return {
        "flat_vertices": flat_vertices,
        "cut_edges_2d": cut_edges_2d,
        "flat_faces_2d": flat_faces_2d,
        "flat_area_mm2": flat_area_mm2,
        "global_align_m": global_align_m,
        "skin_face_count": len(skin_entries),
    }


def _make_flat_bend_tree_node(shape, node_id, parent_id=None):
    face = shape.Faces[node_id]
    normal = face.normalAt(0, 0)
    return {
        "id": f"face_{node_id}",
        "parentId": f"face_{parent_id}" if parent_id is not None else None,
        "children": [],
        "initialNormal": [normal.x, normal.y, normal.z],
        "isCoplanar": parent_id is not None,
        "extraFaceIds": [],
        "initialAngle": 90.0,
        "radius": 0,
        "is_real_bend": False,
    }


def _iter_parallel_planar_faces(shape, root_idx, min_area_fraction=0.05, exclude_indices=None):
    exclude_indices = exclude_indices or set()
    root_face = shape.Faces[root_idx]
    root_normal = _face_normal_np(root_face)
    root_area = max(float(root_face.Area or 0.0), 1e-6)
    min_area = root_area * min_area_fraction
    for index, face in enumerate(shape.Faces):
        if index in exclude_indices:
            continue
        if face.Surface.TypeId != "Part::GeomPlane":
            continue
        if float(face.Area or 0.0) < min_area:
            continue
        normal = _face_normal_np(face)
        if abs(float(np.dot(normal, root_normal))) < 0.95:
            continue
        yield index, face


def _collect_aligned_parallel_faces(
    shape, root_idx, align_matrix, min_area_fraction=0.05, exclude_indices=None
):
    aligned_faces = []
    for _, face in _iter_parallel_planar_faces(
        shape, root_idx, min_area_fraction, exclude_indices=exclude_indices
    ):
        try:
            aligned_faces.append(face.transformed(align_matrix))
        except Exception:
            continue
    return aligned_faces


def _compute_flat_bbox_from_parallel_faces(
    shape, root_idx, align_matrix, exclude_indices=None
):
    points = []
    for _, face in _iter_parallel_planar_faces(
        shape, root_idx, min_area_fraction=0.05, exclude_indices=exclude_indices
    ):
        try:
            aligned = face.transformed(align_matrix)
            for edge in aligned.OuterWire.Edges:
                for point in _get_edge_points(edge, n=8):
                    points.append(point)
        except Exception:
            continue
    if len(points) < 4:
        return None
    return _compute_flat_bbox_obb(np.asarray(points, dtype=float))


def _append_parallel_face_cut_edges(
    shape, root_idx, align_matrix, seg_tally, exclude_indices=None
):
    for _, face in _iter_parallel_planar_faces(
        shape, root_idx, min_area_fraction=0.05, exclude_indices=exclude_indices
    ):
        try:
            aligned = face.transformed(align_matrix)
            for edge in aligned.Edges:
                pts = _get_edge_points(edge)
                for i in range(len(pts) - 1):
                    seg_tally.add(pts[i], pts[i + 1])
        except Exception:
            continue


def _hole_axis_vec(hole):
    value = hole.get("axis")
    if not isinstance(value, (list, tuple)) or len(value) < 3:
        return None
    try:
        axis = np.array([float(value[0]), float(value[1]), float(value[2])], dtype=float)
    except (TypeError, ValueError):
        return None
    if np.linalg.norm(axis) < 1e-9:
        return None
    return _normalize(axis)


def _hole_position_vec(hole):
    value = hole.get("position")
    if not isinstance(value, (list, tuple)) or len(value) < 3:
        return None
    try:
        return np.array([float(value[0]), float(value[1]), float(value[2])], dtype=float)
    except (TypeError, ValueError):
        return None


def _canonical_axis_vec(axis):
    """The axis as a unit vector pointing the one agreed way (a line has two)."""
    arr = _normalize(np.asarray(axis, dtype=float))
    if arr[0] < -1e-9 or (
        abs(arr[0]) <= 1e-9 and (
            arr[1] < -1e-9 or (abs(arr[1]) <= 1e-9 and arr[2] < 0)
        )
    ):
        arr = -arr
    return arr


def _canonical_axis_key(axis):
    return tuple(round(float(v), 2) for v in _canonical_axis_vec(axis))


def _bore_key(hole, diameter_decimals=1, axial_decimals=1):
    axis = _hole_axis_vec(hole)
    position = _hole_position_vec(hole)
    diameter = float(hole.get("diameter_mm") or 0.0)
    if axis is None or position is None or diameter <= 0:
        return None
    # Measure along the agreed direction. Two holes on facing walls of a box
    # see their axes point opposite ways, so measured along their own axes
    # both read +half the box width: they got one key and were merged into
    # one hole running through the whole box (drawn as a rod across it, and
    # cut in mid-air). Same-wall sightings still merge in _holes_are_same_bore.
    axis = _canonical_axis_vec(axis)
    axial_pos = round(float(np.dot(position, axis)), axial_decimals)
    # Where the axis line sits on the face. Without it every same-size hole
    # on one face shares a key, and a row of identical holes collapses into one.
    across = position - float(np.dot(position, axis)) * axis
    return (
        _canonical_axis_key(axis),
        axial_pos,
        tuple(round(float(v), axial_decimals) for v in across),
        round(diameter, diameter_decimals),
    )


def _holes_are_same_bore(h1, h2, material_thickness_mm=None, model_min_span_mm=None):
    key1 = _bore_key(h1)
    key2 = _bore_key(h2)
    if key1 is not None and key2 is not None and key1 == key2:
        return True

    p1 = _hole_position_vec(h1)
    p2 = _hole_position_vec(h2)
    a1 = _hole_axis_vec(h1)
    a2 = _hole_axis_vec(h2)
    d1 = float(h1.get("diameter_mm") or 0.0)
    d2 = float(h2.get("diameter_mm") or 0.0)
    if p1 is None or p2 is None or a1 is None or a2 is None or d1 <= 0 or d2 <= 0:
        return False

    max_d = max(d1, d2, 1e-9)
    if abs(d1 - d2) / max_d > 0.12 and abs(d1 - d2) > 0.6:
        # Two sizes on one axis line, within one wall of each other: a
        # countersink or counterbore rim and the bore it opens into. That is
        # one hole. Two holes side by side on a face can never pass this:
        # their centres sit at least the sum of both radii apart.
        if abs(float(np.dot(a1, a2))) < 0.985:
            return False
        delta = p2 - p1
        axial_signed = float(np.dot(delta, a1))
        radial = float(np.linalg.norm(delta - axial_signed * a1))
        if radial > max(0.5, min(d1, d2) * 0.25):
            return False
        return abs(axial_signed) <= _hole_pair_depth_limit(
            material_thickness_mm, model_min_span_mm
        )
    if abs(float(np.dot(a1, a2))) < 0.85:
        return False

    delta = p2 - p1
    center_dist = float(np.linalg.norm(delta))
    axial_signed = float(np.dot(delta, a1))
    axial = abs(axial_signed)
    radial_vec = delta - axial_signed * a1
    radial = float(np.linalg.norm(radial_vec))
    max_pair_depth_mm = _hole_pair_depth_limit(material_thickness_mm, model_min_span_mm)
    coincident_same_bore = center_dist <= max(0.75, max_d * 0.20)
    if coincident_same_bore:
        return radial <= max(0.75, max_d * 0.25)
    if axial < 0.15 or axial > max_pair_depth_mm:
        return False
    return radial <= max(1.25, max_d * 0.60)


def _settle_merged_bore(hole, sightings):
    """Make one merged hole cover every sighting it absorbed.

    A countersunk hole is seen as a short cylinder between two wider rims, one
    on each face. The kept record is the narrow bore, so stretch its depth over
    the span the sightings cover (that is what makes it a through hole) and
    note the widest rim.
    """
    axis = _hole_axis_vec(hole)
    position = _hole_position_vec(hole)
    if axis is not None and position is not None:
        stations = [
            float(np.dot(p, axis))
            for p in (_hole_position_vec(s) for s in sightings)
            if p is not None
        ]
        if len(stations) >= 2:
            span = max(stations) - min(stations)
            if span > float(hole.get("depth_mm") or 0.0) + 1e-6:
                middle = (max(stations) + min(stations)) * 0.5
                moved = position + (middle - float(np.dot(position, axis))) * axis
                hole["position"] = [round(float(v), 4) for v in moved]
                hole["depth_mm"] = round(span, 4)
                hole.pop("_on_face", None)

    bore = float(hole.get("diameter_mm") or 0.0)
    widest = max(
        max(float(s.get("diameter_mm") or 0.0), float(s.get("rim_diameter_mm") or 0.0))
        for s in sightings
    )
    if bore > 0 and widest > bore * 1.05 and widest - bore > 0.2:
        hole["rim_diameter_mm"] = round(widest, 4)


def _holes_to_mid_wall(holes):
    """Put every hole's position in the middle of its wall.

    Everything that uses a hole (3D markers, the cut kernel that fills and
    re-cuts it) centres its work on the position. A hole seen on one face
    only sits on that face; its axis is that face's outward normal, so the
    middle is half its depth back along the axis.
    """
    for hole in holes or []:
        if not hole.pop("_on_face", False):
            continue
        axis = _hole_axis_vec(hole)
        position = _hole_position_vec(hole)
        depth = float(hole.get("depth_mm") or 0.0)
        if axis is None or position is None or depth <= 0:
            continue
        moved = position - axis * (depth * 0.5)
        hole["position"] = [round(float(v), 4) for v in moved]
    return holes


def _merge_holes_by_bore_key(holes, material_thickness_mm=None, model_min_span_mm=None):
    merged = []
    sightings = []
    for hole in holes or []:
        if not isinstance(hole, dict):
            continue
        placed = False
        for index, existing in enumerate(merged):
            if _holes_are_same_bore(
                existing, hole, material_thickness_mm, model_min_span_mm
            ):
                d_new = float(hole.get("diameter_mm") or 0.0)
                d_old = float(existing.get("diameter_mm") or 0.0)
                best = dict(existing)
                if 0 < d_new < d_old or d_old <= 0:
                    best.update(hole)
                    # The position now comes from this sighting, so its
                    # on-face mark must come from it too.
                    if not hole.get("_on_face"):
                        best.pop("_on_face", None)
                elif hole.get("source") == "flat_pattern_2d":
                    best.update({k: v for k, v in hole.items() if k not in best or best[k] in (None, 0, "")})
                merged[index] = best
                sightings[index].append(hole)
                placed = True
                break
        if not placed:
            merged.append(dict(hole))
            sightings.append([hole])

    for hole, seen in zip(merged, sightings):
        if len(seen) > 1:
            _settle_merged_bore(hole, seen)

    thickness_value = _unwrap_thickness_value(material_thickness_mm)
    if thickness_value <= 0:
        thickness_value = float(model_min_span_mm or 0.0)

    for index, hole in enumerate(merged):
        depth = float(hole.get("depth_mm") or 0.0)
        if thickness_value > 0 and depth >= thickness_value * 0.75:
            hole["kind"] = "through"
        elif depth > 0:
            hole["kind"] = "blind"
        else:
            hole["kind"] = hole.get("kind") or "through"
        hole["id"] = f"hole_{index + 1}"

    sys.stderr.write(
        f"[Hole Detection] Bore-key merge reduced {len(holes or [])} to {len(merged)} holes\n"
    )
    return merged


def _transform_point_with_matrix(matrix, point):
    try:
        vec = Vector(float(point[0]), float(point[1]), float(point[2]))
        out = matrix.multiply(vec)
        return [float(out.x), float(out.y), float(out.z)]
    except Exception:
        return [float(point[0]), float(point[1]), float(point[2])]


def _transform_axis_with_matrix(matrix, axis):
    try:
        vec = Vector(float(axis[0]), float(axis[1]), float(axis[2]))
        out = matrix.multiply(vec)
        length = math.sqrt(float(out.x) ** 2 + float(out.y) ** 2 + float(out.z) ** 2)
        if length < 1e-9:
            return [float(axis[0]), float(axis[1]), float(axis[2])]
        return [float(out.x) / length, float(out.y) / length, float(out.z) / length]
    except Exception:
        return [float(axis[0]), float(axis[1]), float(axis[2])]


def _hole_flat_xy(hole):
    pos = hole.get("position") or [0.0, 0.0, 0.0]
    return (float(pos[0]), float(pos[1]))


def _holes_match_flat_xy(h1, h2):
    d1 = float(h1.get("diameter_mm") or 0.0)
    d2 = float(h2.get("diameter_mm") or 0.0)
    if d1 <= 0 or d2 <= 0:
        return False
    max_d = max(d1, d2, 1e-9)
    if abs(d1 - d2) / max_d > 0.15 and abs(d1 - d2) > 0.8:
        return False
    x1, y1 = _hole_flat_xy(h1)
    x2, y2 = _hole_flat_xy(h2)
    dist = math.hypot(x1 - x2, y1 - y2)
    return dist <= max(1.5, max_d * 0.40)


def _dedupe_holes_flat_xy(holes):
    merged = []
    for hole in holes or []:
        if not isinstance(hole, dict):
            continue
        placed = False
        for index, existing in enumerate(merged):
            if _holes_match_flat_xy(existing, hole):
                d_new = float(hole.get("diameter_mm") or 0.0)
                d_old = float(existing.get("diameter_mm") or 0.0)
                best = dict(existing)
                if 0 < d_new < d_old or d_old <= 0:
                    best.update(hole)
                elif hole.get("source") == "flat_pattern_2d":
                    best.update({
                        k: v for k, v in hole.items()
                        if k not in best or best[k] in (None, 0, "")
                    })
                merged[index] = best
                placed = True
                break
        if not placed:
            merged.append(dict(hole))

    for index, hole in enumerate(merged):
        hole["id"] = f"hole_{index + 1}"
        hole["kind"] = hole.get("kind") or "through"
    return merged


def _hole_sizes(hole):
    sizes = []
    for key in ("diameter_mm", "rim_diameter_mm"):
        try:
            value = float(hole.get(key) or 0.0)
        except (TypeError, ValueError):
            value = 0.0
        if value > 0:
            sizes.append(value)
    return sizes


def _hole_3d_matches_flat(hole_3d, flat_hole, by_position=True):
    """Is this 3D hole the same hole as one on the flat pattern?

    The flat cut is taken on the outside skin, so for a countersunk or
    counterbored hole it shows the rim, not the bore: either size counts.
    """
    try:
        flat_d = float(flat_hole.get("diameter_mm") or 0.0)
    except (TypeError, ValueError):
        return False
    if flat_d <= 0:
        return False
    sizes = _hole_sizes(hole_3d)
    if not any(
        abs(d - flat_d) / max(d, flat_d) <= 0.15 or abs(d - flat_d) <= 0.8
        for d in sizes
    ):
        return False
    if not by_position:
        return True
    x1, y1 = _hole_flat_xy(hole_3d)
    x2, y2 = _hole_flat_xy(flat_hole)
    return math.hypot(x1 - x2, y1 - y2) <= max(1.5, max([flat_d] + sizes) * 0.40)


def _align_holes_to_flat_pattern(holes, align_matrix):
    aligned = []
    for hole in holes or []:
        item = dict(hole)
        pos = item.get("position")
        axis = item.get("axis")
        if isinstance(pos, (list, tuple)) and len(pos) >= 3:
            item["position"] = _transform_point_with_matrix(align_matrix, pos)
        if isinstance(axis, (list, tuple)) and len(axis) >= 3:
            item["axis"] = _transform_axis_with_matrix(align_matrix, axis)
        aligned.append(item)
    return aligned


def _merge_flat_pattern_pierces(flat_holes, holes_3d, align_matrix, material_thickness_mm=None, model_min_span_mm=None):
    """Use unfolded flat-pattern round holes as authoritative pierce count for laser."""
    holes_3d_merged = _filter_round_pierces_only(
        _merge_holes_by_bore_key(
            holes_3d, material_thickness_mm, model_min_span_mm
        )
    )
    holes_3d_aligned = _align_holes_to_flat_pattern(holes_3d_merged, align_matrix)
    flat_deduped = _filter_round_pierces_only(_dedupe_holes_flat_xy(flat_holes or []))

    if flat_deduped:
        # Each 3D hole accounts for one flat hole at most: the nearest free one
        # at its position. Same-size holes sit close together on many parts,
        # and letting one 3D hole claim several flat holes loses a hole.
        claimed = set()
        unplaced = []
        for hole_3d in holes_3d_aligned:
            x3, y3 = _hole_flat_xy(hole_3d)
            hits = [
                index for index, flat_hole in enumerate(flat_deduped)
                if index not in claimed and _hole_3d_matches_flat(hole_3d, flat_hole)
            ]
            if hits:
                claimed.add(min(
                    hits,
                    key=lambda index: math.hypot(
                        x3 - _hole_flat_xy(flat_deduped[index])[0],
                        y3 - _hole_flat_xy(flat_deduped[index])[1],
                    ),
                ))
                continue
            unplaced.append(hole_3d)
        # On a bent part a flange hole lands somewhere new once unfolded, so
        # its 3D sighting matches no flat position. Pair it with a flat hole of
        # the same size that nothing has claimed yet; only a 3D hole left with
        # no partner is one the flat pattern really missed.
        supplemental = []
        for hole_3d in unplaced:
            partner = next(
                (
                    index for index, flat_hole in enumerate(flat_deduped)
                    if index not in claimed
                    and _hole_3d_matches_flat(hole_3d, flat_hole, by_position=False)
                ),
                None,
            )
            if partner is not None:
                claimed.add(partner)
                continue
            supplemental.append(hole_3d)
        # No position check against the flat holes here: an unpaired 3D hole
        # can land on a flat hole's spot and still be a different hole, such
        # as its twin on the far wall of a channel.
        result = _filter_round_pierces_only(flat_deduped + supplemental)
        for index, hole in enumerate(result):
            hole["id"] = f"hole_{index + 1}"
            hole["kind"] = hole.get("kind") or "through"
        sys.stderr.write(
            f"[Hole Detection] Flat-pattern pierce merge: flat={len(flat_deduped)} "
            f"3d={len(holes_3d_merged)} supplemental={len(supplemental)} final={len(result)}\n"
        )
        return result

    return holes_3d_aligned


def _dedupe_planar_loop_candidates(candidates):
    deduped = []
    for candidate in candidates:
        duplicate = False
        for existing in deduped:
            max_d = max(
                float(candidate["diameter_mm"]),
                float(existing["diameter_mm"]),
                1e-9,
            )
            if abs(candidate["diameter_mm"] - existing["diameter_mm"]) / max_d > 0.08:
                continue
            center_dist = float(np.linalg.norm(candidate["center"] - existing["center"]))
            if center_dist <= max(0.5, max_d * 0.15):
                duplicate = True
                break
        if not duplicate:
            deduped.append(candidate)
    return deduped


def _basis_from_normal(normal_vec):
    n = _normalize(np.asarray(normal_vec, dtype=float))
    ref = np.array([1.0, 0.0, 0.0]) if abs(float(n[0])) < 0.9 else np.array([0.0, 1.0, 0.0])
    u = _normalize(np.cross(n, ref))
    v = _normalize(np.cross(n, u))
    return n, u, v


def _vector_to_np(vec_obj):
    return np.array([float(vec_obj.x), float(vec_obj.y), float(vec_obj.z)], dtype=float)


def _face_normal_np(face):
    try:
        return _normalize(_vector_to_np(face.normalAt(0, 0)))
    except Exception:
        try:
            return _normalize(_vector_to_np(face.Surface.Axis))
        except Exception:
            return np.array([0.0, 0.0, 0.0], dtype=float)


def _normal_group_key(normal, decimals=2, ignore_sign=False):
    arr = np.asarray(normal, dtype=float)
    if arr.shape[0] != 3:
        return (0.0, 0.0, 0.0)
    if ignore_sign:
        arr = np.abs(arr)
    rounded = np.round(arr, decimals=decimals)
    return (float(rounded[0]), float(rounded[1]), float(rounded[2]))


def _wire_profile_on_plane(wire, plane_normal):
    try:
        normal, u_vec, v_vec = _basis_from_normal(plane_normal)
    except Exception:
        return None

    wire_points = []
    for edge in getattr(wire, "Edges", []):
        try:
            pts = edge.discretize(Number=40)
        except Exception:
            pts = [v.Point for v in edge.Vertexes]

        if not pts or len(pts) < 2:
            continue

        edge_pts = [_vector_to_np(p) for p in pts]
        if wire_points:
            if np.linalg.norm(edge_pts[0] - wire_points[-1]) <= 1e-6:
                wire_points.extend(edge_pts[1:])
            else:
                wire_points.extend(edge_pts)
        else:
            wire_points.extend(edge_pts)

    if len(wire_points) < 4:
        return None

    if np.linalg.norm(wire_points[0] - wire_points[-1]) > 1e-5:
        wire_points.append(wire_points[0].copy())

    pts3 = np.asarray(wire_points, dtype=float)
    if pts3.shape[0] < 4:
        return None

    local = pts3 - pts3[0]
    x = local @ u_vec
    y = local @ v_vec
    pts2 = np.column_stack((x, y))
    seg = pts2[1:] - pts2[:-1]
    perimeter = float(np.sum(np.linalg.norm(seg, axis=1)))
    if perimeter < 1e-6:
        return None

    area = 0.5 * abs(float(np.sum(
        pts2[:-1, 0] * pts2[1:, 1] - pts2[1:, 0] * pts2[:-1, 1]
    )))
    if area < 1e-6:
        return None

    min_xy = np.min(pts2[:-1], axis=0)
    max_xy = np.max(pts2[:-1], axis=0)
    span = np.maximum(max_xy - min_xy, 1e-6)
    width = float(max(span[0], span[1]))
    height = float(min(span[0], span[1]))
    aspect_ratio = width / max(height, 1e-6)
    roundness = (4.0 * math.pi * area) / (perimeter * perimeter + 1e-9)

    return {
        "area_mm2": float(area),
        "perimeter_mm": float(perimeter),
        "width_mm": width,
        "height_mm": height,
        "aspect_ratio": float(aspect_ratio),
        "roundness": float(roundness),
        "center": np.mean(pts3[:-1], axis=0),
        "normal": normal,
    }


def _empty_non_flat_features():
    return {
        "hasRaisedFeatures": False,
        "raisedFeatureFaceCount": 0,
        "parallelPlanarFaceCount": 0,
        "ignoredSheetFaceCount": 0,
        "maxOffsetMm": 0.0,
        "reasons": [],
    }


def _build_process_eligibility(non_flat_features=None, bend_count=0):
    """
    Process suitability summary consumed by the pricing UI.

    Business rule:
    - Laser is allowed for plain sheet profiles and sheet-metal parts with bends.
    - Laser is blocked only when the model contains non-sheet 3D features
      such as raised bosses, embosses, pockets, or other geometry that is not
      part of the unfoldable sheet body.
    - CNC remains the fallback for complex 3D geometry.
    """
    info = non_flat_features if isinstance(non_flat_features, dict) else _empty_non_flat_features()
    bend_count_int = int(bend_count or 0)
    reasons = [str(r) for r in (info.get("reasons") or []) if r]
    raised_count = int(info.get("raisedFeatureFaceCount") or 0)

    # IMPORTANT:
    # The raw raised-planar diagnostic compares every planar face against one
    # chosen root face. On normal bent sheet-metal parts (U-channel, Z-bend,
    # multi-flange parts), another flange can be parallel to the root face but
    # far away in 3D space. That is NOT a boss/pocket; it is still a laser-cut
    # flat profile + bending job. So when a valid bend graph exists, do not let
    # these offset parallel planar faces lock Laser.
    raised_planar_offset_only = bool(info.get("hasRaisedFeatures")) and raised_count > 0
    ignore_raised_offsets_for_bent_sheet = bend_count_int > 0 and raised_planar_offset_only

    has_3d_features = bool(info.get("hasRaisedFeatures")) and not ignore_raised_offsets_for_bent_sheet
    primary_reason = reasons[0] if reasons else "Detected non-sheet 3D features. Laser supports only sheet profiles and bends."

    if ignore_raised_offsets_for_bent_sheet:
        allowed_reasons = [
            "Valid sheet-metal bends detected. Offset parallel planar faces were treated as flanges, not CNC-only raised features.",
            "Laser supports cutting the flat profile; bending is handled separately as a forming operation."
        ]
    else:
        allowed_reasons = [
            "Laser supports plain sheet profiles and sheet-metal bends; bends do not lock Laser."
        ]

    return {
        "laser": {
            "allowed": not has_3d_features,
            "blocked": has_3d_features,
            "supportsBends": True,
            "bendCount": bend_count_int,
            "bendCountIgnoredForLock": bend_count_int,
            "ignoredRaisedPlanarOffsetsForBentSheet": bool(ignore_raised_offsets_for_bent_sheet),
            "lockReason": primary_reason if has_3d_features else "",
            "reasons": reasons if has_3d_features else allowed_reasons,
        },
        "cnc": {
            "allowed": True,
            "blocked": False,
            "recommended": has_3d_features,
            "reasons": ["CNC is recommended for complex 3D features."] if has_3d_features else [],
        },
    }

def _empty_cnc_features():
    return {
        "planarFaceCount": 0,
        "cylindricalFaceCount": 0,
        "conicalFaceCount": 0,
        "sphericalFaceCount": 0,
        "toroidalFaceCount": 0,
        "otherFaceCount": 0,
        "innerLoopCount": 0,
        "pocketCount": 0,
        "slotCount": 0,
        "recessedFaceCount": 0,
        "deepPocketCount": 0,
        "pocketDepthMmMax": 0.0,
        "verticalWallFaceCount": 0,
        "throughHoleCount": 0,
        "blindHoleCount": 0,
        "machiningDirectionCount": 0,
        "setupCountEstimate": 1,
        "cylindricalAreaRatio": 0.0,
        "rotationalCandidate": False,
        "reasons": [],
    }


def _detect_non_flat_features(fc_shape, root_idx, thickness, sheet_face_indices=None):
    """
    Detect raised planar features (boss/emboss-like geometry) on otherwise flat sheet parts.
    Returns conservative metadata used by the frontend to lock laser-cut process selection.
    """
    result = _empty_non_flat_features()
    try:
        sheet_face_set = set()
        if sheet_face_indices:
            try:
                sheet_face_set = {int(i) for i in sheet_face_indices}
            except Exception:
                sheet_face_set = set()
        result["ignoredSheetFaceCount"] = len(sheet_face_set)

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
        # Keep threshold low enough for small boss tops while filtering tiny numeric slivers.
        # Root-area scaling avoids over-filtering on large plates; thickness scaling avoids noise
        # on very thin parts.
        root_area = max(1.0, float(root_face.Area))
        min_face_area = max(
            0.1,
            min(
                root_area * 0.0002,
                (thickness_mm * thickness_mm * 0.08) if thickness_mm > 0 else 0.6,
            ),
        )

        raised_faces = 0
        raised_same_orientation = 0
        raised_opposite_orientation = 0
        parallel_faces = 0
        max_offset = 0.0

        # Tightened tolerances to detect low-height emboss/boss geometry (sub-mm to ~1 mm)
        # that should still lock laser process selection.
        tol_root = max(0.08, thickness_mm * 0.08) if thickness_mm > 0 else 0.25
        tol_skin = max(0.12, thickness_mm * 0.12) if thickness_mm > 0 else 0.45

        for fi, face in enumerate(fc_shape.Faces):
            if fi == root_idx:
                continue
            # Faces that belong to the unfoldable sheet graph are allowed for Laser.
            # This is important for U/Z-channel parts where valid flanges may be
            # parallel to the root face and offset by more than material thickness.
            if fi in sheet_face_set:
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
            if parallelity < 0.97:
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
                if alignment > 0 and offset > 0.45:
                    raised_faces += 1
                    raised_same_orientation += 1
                elif alignment < 0 and offset > 0.65:
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


def _detect_cnc_features(fc_shape, thickness, root_idx=None, holes_data=None, non_flat_features=None):
    result = _empty_cnc_features()
    try:
        faces = list(getattr(fc_shape, "Faces", []) or [])
        if not faces:
            return result

        thickness_mm = float(thickness) if thickness and float(thickness) > 0 else 0.0
        total_area = 0.0
        cylindrical_area = 0.0
        inner_loop_count = 0
        pocket_count = 0
        slot_count = 0
        vertical_wall_faces = 0
        oriented_planar_groups = {}
        absolute_direction_groups = set()
        root_normal = None

        if root_idx is not None and 0 <= int(root_idx) < len(faces):
            try:
                root_normal = _face_normal_np(faces[int(root_idx)])
            except Exception:
                root_normal = None

        for face in faces:
            surface_type = str(getattr(face.Surface, "TypeId", ""))
            face_area = float(getattr(face, "Area", 0.0) or 0.0)
            total_area += max(0.0, face_area)

            if surface_type == "Part::GeomPlane":
                result["planarFaceCount"] += 1
                normal = _face_normal_np(face)
                if np.linalg.norm(normal) > 1e-9:
                    absolute_direction_groups.add(_normal_group_key(normal, ignore_sign=True))
                    center = _vector_to_np(face.CenterOfMass)
                    projection = float(np.dot(center, normal))
                    oriented_planar_groups.setdefault(_normal_group_key(normal), []).append({
                        "projection": projection,
                        "area": max(0.0, face_area),
                    })

                    if root_normal is not None:
                        alignment = abs(float(np.dot(normal, root_normal)))
                        if alignment < 0.35:
                            vertical_wall_faces += 1

                outer_hash = None
                try:
                    outer_hash = face.OuterWire.hashCode()
                except Exception:
                    outer_hash = None

                for wire in getattr(face, "Wires", []):
                    try:
                        if outer_hash is not None and wire.hashCode() == outer_hash:
                            continue
                    except Exception:
                        pass

                    inner_loop_count += 1
                    profile = _wire_profile_on_plane(
                        wire,
                        normal if np.linalg.norm(normal) > 1e-9 else np.array([0.0, 0.0, 1.0], dtype=float)
                    )
                    if not profile:
                        continue

                    area_mm2 = float(profile["area_mm2"])
                    aspect_ratio = float(profile["aspect_ratio"])
                    roundness = float(profile["roundness"])
                    is_hole_like = roundness >= 0.8 and aspect_ratio <= 1.35
                    is_slot_like = aspect_ratio >= 2.0 and roundness >= 0.42
                    is_pocket_like = area_mm2 >= 4.0 and not is_hole_like

                    if is_pocket_like:
                        pocket_count += 1
                    if is_slot_like:
                        slot_count += 1

            elif surface_type == "Part::GeomCylinder":
                result["cylindricalFaceCount"] += 1
                cylindrical_area += max(0.0, face_area)
            elif surface_type == "Part::GeomCone":
                result["conicalFaceCount"] += 1
            elif surface_type == "Part::GeomSphere":
                result["sphericalFaceCount"] += 1
            elif surface_type == "Part::GeomToroid":
                result["toroidalFaceCount"] += 1
            else:
                result["otherFaceCount"] += 1

        min_recess_depth = max(0.4, thickness_mm * 0.35) if thickness_mm > 0 else 0.6
        deep_pocket_threshold = max(3.0, thickness_mm * 1.5) if thickness_mm > 0 else 4.0
        recessed_face_count = 0
        deep_pocket_count = 0
        max_pocket_depth = 0.0

        for faces_in_group in oriented_planar_groups.values():
            if len(faces_in_group) < 2:
                continue
            extreme_projection = max(item["projection"] for item in faces_in_group)
            max_group_area = max(item["area"] for item in faces_in_group)

            for item in faces_in_group:
                depth_mm = extreme_projection - item["projection"]
                if depth_mm <= min_recess_depth:
                    continue
                if item["area"] >= max_group_area * 0.98:
                    continue
                recessed_face_count += 1
                max_pocket_depth = max(max_pocket_depth, depth_mm)
                if depth_mm >= deep_pocket_threshold:
                    deep_pocket_count += 1

        holes = list(holes_data or [])
        through_hole_count = 0
        blind_hole_count = 0
        for hole in holes:
            depth_mm = float(hole.get("depth_mm") or 0.0)
            if thickness_mm > 0 and depth_mm >= (thickness_mm * 0.8):
                through_hole_count += 1
            else:
                blind_hole_count += 1

        machining_direction_count = max(0, len(absolute_direction_groups))
        setup_count_estimate = max(1, min(5, machining_direction_count or 1))
        if deep_pocket_count > 0 and setup_count_estimate < 5:
            setup_count_estimate += 1
        if pocket_count > 3 and setup_count_estimate < 5:
            setup_count_estimate += 1

        cylindrical_area_ratio = (cylindrical_area / total_area) if total_area > 1e-6 else 0.0
        rotational_candidate = bool(
            result["cylindricalFaceCount"] >= 2
            and cylindrical_area_ratio >= 0.35
            and machining_direction_count <= 3
        )

        result.update({
            "innerLoopCount": int(inner_loop_count),
            "pocketCount": int(pocket_count),
            "slotCount": int(slot_count),
            "recessedFaceCount": int(recessed_face_count),
            "deepPocketCount": int(deep_pocket_count),
            "pocketDepthMmMax": round(float(max_pocket_depth), 4),
            "verticalWallFaceCount": int(vertical_wall_faces),
            "throughHoleCount": int(through_hole_count),
            "blindHoleCount": int(blind_hole_count),
            "machiningDirectionCount": int(machining_direction_count),
            "setupCountEstimate": int(setup_count_estimate),
            "cylindricalAreaRatio": round(float(cylindrical_area_ratio), 4),
            "rotationalCandidate": rotational_candidate,
        })

        if rotational_candidate:
            result["reasons"].append(
                f"Cylindrical faces cover {cylindrical_area_ratio:.2%} of surface area across {result['cylindricalFaceCount']} faces."
            )
        if recessed_face_count > 0:
            result["reasons"].append(
                f"Detected {recessed_face_count} recessed planar face(s) with max pocket depth {max_pocket_depth:.2f} mm."
            )
        if slot_count > 0:
            result["reasons"].append(f"Detected {slot_count} slot-like internal profile(s).")
        if pocket_count > 0:
            result["reasons"].append(f"Detected {pocket_count} non-circular internal pocket opening(s).")
        if machining_direction_count > 0:
            result["reasons"].append(
                f"Detected {machining_direction_count} machining direction group(s) and estimated {setup_count_estimate} setup(s)."
            )
        if non_flat_features and non_flat_features.get("hasRaisedFeatures"):
            result["reasons"].append("Raised/non-flat features are present and may require extra setups.")

        return result
    except Exception as ex:
        result["reasons"].append(f"CNC feature analysis warning: {ex}")
        return result


def _hole_pair_depth_limit(material_thickness_mm, model_min_span_mm=None):
    try:
        t = _unwrap_thickness_value(material_thickness_mm)
    except (TypeError, ValueError):
        t = 0.0
    if t <= 0:
        try:
            t = float(model_min_span_mm or 0.0)
        except (TypeError, ValueError):
            t = 0.0
    if t <= 0:
        return 6.0
    # Opposing loops on the same sheet wall should be roughly one material
    # thickness apart. Distant coaxial holes on opposite walls are separate holes.
    return max(t * 2.25, t + 1.0, 4.0)


def _detect_holes_from_planar_loops(fc_shape, material_thickness_mm=None, model_min_span_mm=None):
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

            try:
                corner = wire.Vertexes[0].Point
                origin = np.array([float(corner.x), float(corner.y), float(corner.z)], dtype=float)
            except Exception:
                continue

            # The same full-circle test the flat pattern uses, worked out in
            # this face's own plane. Slots, obrounds, rectangles and notches
            # are cut-outs, not holes.
            pierce = _wire_is_round_pierce(wire, plane=(origin, u_vec, v_vec))
            if not pierce:
                continue

            diameter_mm = 2.0 * float(pierce["radius"])
            if diameter_mm < 1.0:
                continue

            center = (
                origin
                + float(pierce["center"][0]) * u_vec
                + float(pierce["center"][1]) * v_vec
            )
            candidates.append({
                "face_index": fi,
                "face_id": f"face_{fi}",
                "diameter_mm": float(diameter_mm),
                "center": center,
                "axis": normal,
            })

    if not candidates:
        return []

    candidates = _dedupe_planar_loop_candidates(candidates)

    max_pair_depth_mm = _hole_pair_depth_limit(material_thickness_mm, model_min_span_mm)
    try:
        thickness_value = _unwrap_thickness_value(material_thickness_mm)
    except (TypeError, ValueError):
        thickness_value = 0.0
    if thickness_value <= 0:
        try:
            thickness_value = float(model_min_span_mm or 0.0)
        except (TypeError, ValueError):
            thickness_value = 0.0
    fallback_depth_mm = thickness_value if thickness_value > 0 else None
    used = set()
    holes = []

    for i, c1 in enumerate(candidates):
        if i in used:
            continue

        best_j = None
        best_score = None
        best_coincident = False
        for j in range(i + 1, len(candidates)):
            if j in used:
                continue
            c2 = candidates[j]

            max_d = max(c1["diameter_mm"], c2["diameter_mm"], 1e-9)
            if abs(c1["diameter_mm"] - c2["diameter_mm"]) / max_d > 0.08:
                continue

            dot_n = float(np.dot(c1["axis"], c2["axis"]))
            if abs(dot_n) < 0.85:
                continue

            delta = c2["center"] - c1["center"]
            axial = abs(float(np.dot(delta, c1["axis"])))
            radial_vec = delta - np.dot(delta, c1["axis"]) * c1["axis"]
            radial = float(np.linalg.norm(radial_vec))
            pair_max_d = max(c1["diameter_mm"], c2["diameter_mm"], 1e-9)
            coincident_same_bore = axial < 0.15 and radial <= max(0.75, pair_max_d * 0.25)

            if not coincident_same_bore:
                if axial < 0.15:
                    continue
                if axial > max_pair_depth_mm:
                    continue
                if radial > max(0.4, c1["diameter_mm"] * 0.2):
                    continue

            score = radial + abs(c1["diameter_mm"] - c2["diameter_mm"])
            if best_score is None or score < best_score:
                best_score = score
                best_j = j
                best_coincident = coincident_same_bore

        if best_j is not None:
            used.add(i)
            used.add(best_j)
            c2 = candidates[best_j]

            pos = (c1["center"] + c2["center"]) * 0.5
            delta = c2["center"] - c1["center"]
            n1 = _normalize(c1["axis"])
            if abs(float(np.dot(n1, _normalize(c2["axis"])))) >= 0.985:
                # Both circles lie on parallel faces, so the hole runs square
                # to them: take the face's own normal. The line between the
                # two fitted centres is no axis on thin sheet -- a tenth of a
                # millimetre of fitting error across a 1.2 mm wall tilted it
                # 3 to 5 degrees, and every part drawn on the hole (a stud
                # head, a standoff's hex) sank into the face at a slant.
                axis = n1 if float(np.dot(delta, n1)) >= 0.0 else -n1
            else:
                axis = _normalize(delta)
                if np.linalg.norm(axis) < 1e-9:
                    axis = _normalize(c1["axis"] - c2["axis"])
                if np.linalg.norm(axis) < 1e-9:
                    axis = n1
            if best_coincident:
                depth_mm = thickness_value if thickness_value > 0 else max(0.5, c1["diameter_mm"] * 0.3)
            else:
                depth_mm = abs(float(np.dot(delta, axis)))
            diameter_mm = min(c1["diameter_mm"], c2["diameter_mm"])
            face_id = c1["face_id"]
            hole_kind = "through"
            on_face = best_coincident
        else:
            used.add(i)
            pos = c1["center"]
            axis = _normalize(c1["axis"])
            depth_mm = fallback_depth_mm or max(0.5, c1["diameter_mm"] * 0.3)
            diameter_mm = c1["diameter_mm"]
            face_id = c1["face_id"]
            hole_kind = "blind"
            on_face = True

        hole = {
            "id": f"hole_{len(holes) + 1}",
            "face_id": face_id,
            "diameter_mm": round(float(diameter_mm), 4),
            "diameter_in": round(float(diameter_mm) / 25.4, 6),
            "position": [round(float(v), 4) for v in pos],
            "axis": [round(float(v), 4) for v in axis],
            "depth_mm": round(float(depth_mm), 4),
            "kind": hole_kind,
            "shape": "round",
            "source": "planar_loop",
        }
        if on_face:
            # Seen on one face only, so this position sits on that face. It
            # is moved to mid-wall once merging is done (_holes_to_mid_wall).
            hole["_on_face"] = True
        holes.append(hole)

    holes.sort(key=lambda h: h["diameter_mm"])
    for idx, h in enumerate(holes):
        h["id"] = f"hole_{idx + 1}"
    return holes


def _merge_same_bore_holes(holes, material_thickness_mm=None):
    if len(holes or []) < 2:
        return list(holes or [])

    max_pair_depth_mm = _hole_pair_depth_limit(material_thickness_mm)
    if max_pair_depth_mm is None:
        max_pair_depth_mm = 6.0

    def _vec(hole, key):
        value = hole.get(key)
        if not isinstance(value, (list, tuple)) or len(value) < 3:
            return None
        try:
            arr = np.array([float(value[0]), float(value[1]), float(value[2])], dtype=float)
        except (TypeError, ValueError):
            return None
        if np.linalg.norm(arr) < 1e-9 and key == "axis":
            return None
        return arr

    used = set()
    merged = []

    for i, h1 in enumerate(holes):
        if i in used:
            continue

        best = dict(h1)
        used.add(i)

        p1 = _vec(h1, "position")
        a1 = _vec(h1, "axis")
        d1 = float(h1.get("diameter_mm") or 0.0)
        if p1 is None or a1 is None or d1 <= 0:
            merged.append(best)
            continue

        a1 = _normalize(a1)
        paired_positions = [p1]
        paired_depths = [float(h1.get("depth_mm") or 0.0)]

        for j in range(i + 1, len(holes)):
            if j in used:
                continue

            h2 = holes[j]
            p2 = _vec(h2, "position")
            a2 = _vec(h2, "axis")
            d2 = float(h2.get("diameter_mm") or 0.0)
            if p2 is None or a2 is None or d2 <= 0:
                continue

            max_d = max(d1, d2, 1e-9)
            dia_delta = abs(d1 - d2)
            if dia_delta / max_d > 0.12 and dia_delta > 0.6:
                continue

            a2 = _normalize(a2)
            if abs(float(np.dot(a1, a2))) < 0.85:
                continue

            delta = p2 - p1
            center_dist = float(np.linalg.norm(delta))
            axial_signed = float(np.dot(delta, a1))
            axial = abs(axial_signed)

            radial_vec = delta - axial_signed * a1
            radial = float(np.linalg.norm(radial_vec))

            # Some STEP exporters report the two faces/loops of one through-bore
            # with almost identical computed centers. Treat those as duplicate
            # observations of the same physical hole instead of requiring depth.
            coincident_same_bore = center_dist <= max(0.75, max_d * 0.20)
            if not coincident_same_bore:
                if axial < 0.15 or axial > max_pair_depth_mm:
                    continue
                if radial > max(1.25, max_d * 0.60):
                    continue
            elif radial > max(0.75, max_d * 0.25):
                continue

            used.add(j)
            paired_positions.append(p2)
            paired_depths.append(float(h2.get("depth_mm") or 0.0))
            if d2 < float(best.get("diameter_mm") or d1):
                best = dict(h2)

        if len(paired_positions) > 1:
            midpoint = np.mean(np.asarray(paired_positions, dtype=float), axis=0)
            max_span = 0.0
            for p_a in paired_positions:
                for p_b in paired_positions:
                    max_span = max(max_span, float(np.linalg.norm(p_b - p_a)))
            best["position"] = [round(float(v), 4) for v in midpoint]
            best["axis"] = [round(float(v), 4) for v in a1]
            best["depth_mm"] = round(max(max_span, *paired_depths), 4)

        merged.append(best)

    sys.stderr.write(
        f"[Hole Detection] Same-bore merge reduced {len(holes)} to {len(merged)} holes\n"
    )
    return merged


def detect_holes_fc(fc_shape, material_thickness_mm=None, model_min_span_mm=None):
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
            if radius > 15.0: continue # Large cylinders are collar/bore walls, not holes — planar-loop catches them
            
            axis = cyl.Axis
            center = cyl.Center
            
            cyl_faces.append({
                "fi": i,
                "radius": radius,
                "axis": np.array([axis.x, axis.y, axis.z]),
                "center": np.array([center.x, center.y, center.z]),
                "area": float(face.Area)
            })

    sys.stderr.write(
        f"[Hole Detection] Found {len(cyl_faces)} cylindrical faces "
        f"(radii: {[round(c['radius'],2) for c in cyl_faces]})\n"
    )

    if not cyl_faces:
        sys.stderr.write("[Hole Detection] No cylindrical faces; trying planar-loop fallback\n")

    # Build edge-to-face mapping to associate holes with planar faces
    e2f = {}
    for fi, f in enumerate(fc_shape.Faces):
        for e in f.Edges:
            e2f.setdefault(e.hashCode(), []).append(fi)

    max_cluster_span_mm = _hole_pair_depth_limit(material_thickness_mm, model_min_span_mm)
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
            axial = abs(float(np.dot(diff, c1["axis"])))
            if max_cluster_span_mm is not None and axial > max_cluster_span_mm:
                continue
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

        # ── Collar / formed-feature filter ──────────────────────────
        # A collar cylinder is surrounded mostly by OTHER cylinders
        # (forming a ring).  Real drilled holes connect primarily to
        # planar faces (top/bottom of the plate).  Count adjacent face
        # types across the whole cluster.
        adj_cyl_count = 0
        adj_plane_count = 0
        for c in cluster:
            f = fc_shape.Faces[c["fi"]]
            for e in f.Edges:
                for nfi in e2f.get(e.hashCode(), []):
                    if nfi == c["fi"]:
                        continue
                    nf_type = fc_shape.Faces[nfi].Surface.TypeId
                    if nf_type == "Part::GeomCylinder":
                        adj_cyl_count += 1
                    elif nf_type == "Part::GeomPlane":
                        adj_plane_count += 1
        # If a cylinder cluster touches 2+ other cylindrical faces AND
        # has more cylinder neighbors than planar ones, it's part of a
        # collar ring / formed feature, not a drilled hole.
        if adj_cyl_count > adj_plane_count and adj_cyl_count >= 2:
            sys.stderr.write(
                f"[Hole Detection] Collar filter rejected cluster "
                f"(r={c1['radius']:.2f}, adj_cyl={adj_cyl_count}, adj_plane={adj_plane_count})\n"
            )
            continue

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

        thickness_value = _unwrap_thickness_value(material_thickness_mm)
        hole_kind = (
            "through"
            if thickness_value <= 0 or depth >= thickness_value * 0.75
            else "blind"
        )
        holes.append({
            "id": f"hole_{len(holes)+1}",
            "face_id": face_id,
            "diameter_mm": round(diam, 4),
            "diameter_in": round(diam / 25.4, 6),
            "position": [round(float(p), 4) for p in pos],
            "axis": [round(float(a), 4) for a in c1["axis"]],
            "depth_mm": round(float(depth), 4),
            "kind": hole_kind,
            "shape": "round",
            "source": "cylindrical",
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
            # Scale merge distance with diameter — large bores have wider
            # cylinder segment offsets than small holes.
            max_d = max(h1["diameter_mm"], h2["diameter_mm"])
            merge_dist = max(2.5, max_d * 0.5)
            if dist < merge_dist and cross < 0.1:
                s_merged.add(j)
                if h2["diameter_mm"] < best["diameter_mm"]:
                    best = h2
        final.append(best)

    cyl_count = len(final)
    sys.stderr.write(
        f"[Hole Detection] Cylindrical method found {cyl_count} holes "
        f"(diameters: {[round(h['diameter_mm'],2) for h in final]})\n"
    )
    for idx, h in enumerate(final):
        h["id"] = f"hole_{idx+1}"
    loop_holes = _detect_holes_from_planar_loops(
        fc_shape, material_thickness_mm, model_min_span_mm
    )
    loop_count = len(loop_holes)
    sys.stderr.write(
        f"[Hole Detection] Planar-loop method found {loop_count} holes "
        f"(diameters: {[round(h['diameter_mm'],2) for h in loop_holes]})\n"
    )

    combined = list(final)
    for lh in loop_holes:
        combined.append(lh)

    pre_merge_count = len(combined)
    final = _merge_holes_by_bore_key(
        combined, material_thickness_mm, model_min_span_mm
    )
    sys.stderr.write(
        f"[Hole Detection] Combined pre-merge={pre_merge_count} "
        f"(cyl={cyl_count}, loop={loop_count}) "
        f"post-merge={len(final)}\n"
    )

    # ── Size-based filter ─────────────────────────────────────────
    # Real drilled / punched holes are never a large fraction of the
    # part.  Collar openings, cutouts, and formed-feature bores are.
    # Filter out any "hole" whose diameter exceeds 25% of the part's
    # smallest bounding-box dimension.
    try:
        bb = fc_shape.BoundBox
        min_dim = min(bb.XLength, bb.YLength, bb.ZLength)
        max_dim = max(bb.XLength, bb.YLength, bb.ZLength)
        # Use the mid-range dimension (not the thickness, not the longest)
        dims_sorted = sorted([bb.XLength, bb.YLength, bb.ZLength])
        ref_dim = dims_sorted[1] if len(dims_sorted) > 1 else max_dim
        max_hole_dia = ref_dim * 0.55
        if max_hole_dia > 5.0:  # Only apply if the threshold is reasonable
            before_count = len(final)
            final = [h for h in final if h["diameter_mm"] <= max_hole_dia]
            if len(final) < before_count:
                sys.stderr.write(
                    f"[Hole Detection] Size filter removed {before_count - len(final)} "
                    f"oversized holes (max_dia={max_hole_dia:.1f}mm, "
                    f"ref_dim={ref_dim:.1f}mm)\n"
                )
    except Exception:
        pass  # BoundBox may not be available on degenerate shapes

    _holes_to_mid_wall(final)

    # Re-index
    for idx, h in enumerate(final):
        h["id"] = f"hole_{idx + 1}"

    return final

def _points_form_round_pierce(
    pts_arr,
    roundness_min=0.88,
    radial_tolerance=0.08,
    min_radius_mm=0.25,
):
    """Return pierce metadata when sampled XY points form a closed round hole."""
    if pts_arr is None or len(pts_arr) < 8:
        return None

    pts_arr = np.asarray(pts_arr, dtype=float)
    cx = float(np.mean(pts_arr[:, 0]))
    cy = float(np.mean(pts_arr[:, 1]))
    distances = np.sqrt((pts_arr[:, 0] - cx) ** 2 + (pts_arr[:, 1] - cy) ** 2)
    avg_radius = float(np.mean(distances))
    if avg_radius < min_radius_mm:
        return None

    radial_cv = float(np.std(distances) / max(avg_radius, 1e-9))
    if radial_cv > radial_tolerance:
        return None

    x = pts_arr[:, 0]
    y = pts_arr[:, 1]
    area = 0.5 * abs(float(np.sum(x[:-1] * y[1:] - x[1:] * y[:-1])))
    seg = pts_arr[1:] - pts_arr[:-1]
    perimeter = float(np.sum(np.linalg.norm(seg, axis=1)))
    if perimeter < 1e-6 or area < 1e-6:
        return None

    roundness = (4.0 * math.pi * area) / (perimeter * perimeter + 1e-9)
    if roundness < roundness_min:
        return None

    return {
        "center": np.array([cx, cy], dtype=float),
        "radius": avg_radius,
        "roundness": roundness,
    }


def _wire_is_closed(wire, tol=0.15):
    # Ask the wire itself. Comparing its first and last vertex is wrong for
    # a circle cut into two arcs: it has two vertices half a turn apart, and
    # would read as open.
    try:
        return bool(wire.isClosed())
    except Exception:
        pass
    try:
        verts = wire.Vertexes
        if len(verts) >= 2:
            v0 = verts[0].Point
            v1 = verts[-1].Point
            return math.sqrt((v0.x - v1.x) ** 2 + (v0.y - v1.y) ** 2) <= tol
    except Exception:
        pass
    return True


_STRAIGHT_CURVE_TYPES = ("Part::GeomLine", "Part::GeomLineSegment")
_CIRCLE_CURVE_TYPES = ("Part::GeomCircle", "Part::GeomArcOfCircle")


def _wire_points_2d(wire, edges, to_2d):
    """Points spread evenly along the whole loop, in loop order.

    Even spacing keeps the average point on the true centre. Giving every
    edge the same number of points would pull it toward the shortest arc.
    """
    try:
        count = max(48, min(256, int(float(wire.Length) / 0.5)))
        points = wire.discretize(Number=count)
        if len(points) >= 8:
            return [to_2d(p.x, p.y, p.z) for p in points]
    except Exception:
        pass
    pts = []
    for edge in edges:
        for point in _get_edge_points(edge, n=16):
            pts.append(to_2d(point[0], point[1], point[2]))
    return pts


def _wire_is_round_pierce(wire, plane=None):
    """
    Laser pierce = a closed, full round through-hole.
    Excludes slots, obrounds, partial arcs, and rounded edge cutouts.

    ``plane`` is (origin, u, v) when the loop lies on a face of the 3D model:
    the loop is then judged in that face's own 2D frame. Without it the loop
    is taken to lie in XY, as on the unfolded flat pattern.
    """
    if plane is None:
        def to_2d(x, y, z):
            return [float(x), float(y)]
    else:
        origin, u_vec, v_vec = plane

        def to_2d(x, y, z):
            offset = np.array([float(x), float(y), float(z)], dtype=float) - origin
            return [float(np.dot(offset, u_vec)), float(np.dot(offset, v_vec))]

    edges = list(getattr(wire, "Edges", []) or [])
    if not edges or not _wire_is_closed(wire):
        return None

    curve_types = []
    for edge in edges:
        try:
            curve_types.append(edge.Curve.TypeId)
        except Exception:
            return None
    # Any straight side makes it a slot, rectangle or notch.
    if any(curve_type in _STRAIGHT_CURVE_TYPES for curve_type in curve_types):
        return None
    if not all(curve_type in _CIRCLE_CURVE_TYPES for curve_type in curve_types):
        # Spline edges: some exporters write circles that way. Only the shape
        # of the points can tell, so hold them to a much closer fit.
        return _points_form_round_pierce(
            np.array(_wire_points_2d(wire, edges, to_2d), dtype=float),
            roundness_min=0.97,
            radial_tolerance=0.02,
        )

    eps = 1e-4

    if len(edges) == 1:
        edge = edges[0]
        try:
            if edge.Curve.TypeId == "Part::GeomCircle":
                radius = float(edge.Curve.Radius)
                if radius < 0.25:
                    return None
                if abs(float(edge.Length) - 2.0 * math.pi * radius) < max(
                    eps, radius * 0.02
                ):
                    center = edge.Curve.Center
                    return {
                        "center": np.array(to_2d(center.x, center.y, center.z), dtype=float),
                        "radius": radius,
                        "roundness": 1.0,
                    }
        except Exception:
            return None
        return None

    circle_centers = []
    circle_radii = []
    arc_span = 0.0

    for edge in edges:
        try:
            center = edge.Curve.Center
            radius = float(edge.Curve.Radius)
            circle_centers.append(np.array(to_2d(center.x, center.y, center.z), dtype=float))
            circle_radii.append(radius)
            arc_span += float(edge.Length) / max(radius, 1e-9)
        except Exception:
            return None

    pts = _wire_points_2d(wire, edges, to_2d)
    if len(pts) < 8 or not circle_centers:
        return None

    avg_center = np.mean(circle_centers, axis=0)
    avg_radius = float(np.mean(circle_radii))
    if avg_radius < 0.25:
        return None

    for center in circle_centers:
        if np.linalg.norm(center - avg_center) > max(0.25, avg_radius * 0.12):
            return None
    for radius in circle_radii:
        if abs(radius - avg_radius) / max(avg_radius, 1e-9) > 0.08:
            return None

    if arc_span < 2.0 * math.pi * 0.95:
        return None

    return _points_form_round_pierce(np.array(pts, dtype=float))


def _hole_counts_as_pierce(hole):
    if not isinstance(hole, dict):
        return False
    if hole.get("shape") == "contour":
        return False
    if hole.get("shape") == "round":
        return True
    source = hole.get("source") or ""
    if source in ("cylindrical", "planar_loop"):
        return True
    if source == "flat_pattern_2d":
        return hole.get("shape") == "round"
    return False


def _filter_round_pierces_only(holes):
    return [hole for hole in (holes or []) if _hole_counts_as_pierce(hole)]


def _count_contour_pierces(contours):
    """Every closed loop the laser cuts starts with a pierce: each outer
    profile plus each cut-out inside it, round or not. None when there is no
    flat pattern to count from."""
    if not contours:
        return None
    total = 0
    for contour in contours:
        if not isinstance(contour, dict):
            continue
        total += 1 + len(contour.get("holes") or [])
    return total


def detect_holes_from_2d_pattern(flat_faces):
    """Detect round pierce holes from inner wires on the unfolded flat pattern.

    Only closed, full-circle inner loops count as laser pierces. Slots,
    obrounds, partial arcs, and rounded edge cutouts are excluded.
    """
    holes = []
    seen = []  # (cx, cy, radius) for dedup

    for flat_face in flat_faces:
        try:
            wires = flat_face.Wires
        except Exception:
            continue

        if len(wires) <= 1:
            continue

        for wire in wires[1:]:
            pierce = _wire_is_round_pierce(wire)
            if not pierce:
                continue

            cx = float(pierce["center"][0])
            cy = float(pierce["center"][1])
            avg_radius = float(pierce["radius"])

            is_dup = False
            for seen_center in seen:
                if (
                    abs(cx - seen_center[0]) < 2.0
                    and abs(cy - seen_center[1]) < 2.0
                    and abs(avg_radius - seen_center[2]) < 0.5
                ):
                    is_dup = True
                    break

            if is_dup:
                continue

            seen.append((cx, cy, avg_radius))
            diam = avg_radius * 2.0
            holes.append({
                "id": f"hole_{len(holes) + 1}",
                "diameter_mm": round(diam, 4),
                "diameter_in": round(diam / 25.4, 6),
                "position": [round(cx, 4), round(cy, 4), 0.0],
                "axis": [0.0, 0.0, 1.0],
                "depth_mm": 0.0,
                "kind": "through",
                "shape": "round",
                "roundness": round(float(pierce.get("roundness", 1.0)), 4),
                "source": "flat_pattern_2d",
            })

    final = []
    merged = set()
    for i, h1 in enumerate(holes):
        if i in merged:
            continue
        best = h1
        merged.add(i)
        for j in range(i + 1, len(holes)):
            if j in merged:
                continue
            h2 = holes[j]
            dist = math.sqrt(
                (h1["position"][0] - h2["position"][0]) ** 2
                + (h1["position"][1] - h2["position"][1]) ** 2
            )
            if dist < 2.5:
                merged.add(j)
                if h2["diameter_mm"] < best["diameter_mm"]:
                    best = h2
        final.append(best)

    for idx, hole in enumerate(final):
        hole["id"] = f"hole_{idx + 1}"

    sys.stderr.write(
        f"[Hole Detection] Flat-pattern round pierces: {len(final)} "
        f"(diameters: {[round(h['diameter_mm'], 2) for h in final]})\n"
    )
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

def _model_holes_for(fc_shape, thickness, model_min_span):
    """Round holes where they sit on the 3D model (the STEP's own frame).

    For results whose own hole list is empty or in the unfolded frame, so the
    page can still place taps and countersinks on the model.
    """
    try:
        holes = _filter_round_pierces_only(
            detect_holes_fc(fc_shape, thickness, model_min_span)
        )
        return _json_safe([dict(hole) for hole in holes])
    except Exception as hole_error:
        sys.stderr.write(f"[Warning] Model hole detection failed: {hole_error}\n")
        return []


def _flat_profile_fallback(fc_shape, model_min_span, last_error=None):
    """Last-resort flat projection when no bend-unfold root works.

    Simple plates, engraved blanks, and thin odd solids can defeat the bend
    solver even though their 2D profile is trivial: project the largest planar
    face onto XY and emit a flat-pattern-only analysis. Only reached where the
    solver previously hard-failed, so it adds coverage without changing any
    part the unfolder already handles.
    """
    planar_faces = [
        (index, face)
        for index, face in enumerate(fc_shape.Faces)
        if face.Surface.TypeId == "Part::GeomPlane"
    ]
    if not planar_faces:
        raise RuntimeError(
            "Could not find a valid root face for unfolding and the shape has "
            f"no planar face for the flat-profile fallback. Last error: {last_error}"
        )
    _root_idx, root_face = max(
        planar_faces, key=lambda item: float(item[1].Area or 0.0)
    )

    normal = root_face.normalAt(0, 0)
    align = FreeCAD.Placement(Vector(0, 0, 0), Rotation(normal, Vector(0, 0, 1))).toMatrix()
    aligned = root_face.transformed(align)
    bb = aligned.BoundBox
    shift = FreeCAD.Placement(
        Vector(-bb.XMin, -bb.YMin, -bb.ZMin), Rotation()
    ).toMatrix()
    aligned = aligned.transformed(shift)
    bb = aligned.BoundBox

    fv, ft = _tessellate_fc_face(aligned, deflection=1.0)
    flat_vertices = []
    for tri in ft:
        for v_idx in tri:
            flat_vertices.extend([float(c) for c in fv[v_idx]])
    mesh_vertices = []
    for vertex in fv:
        mesh_vertices.extend([float(c) for c in vertex])
    mesh_indices = [int(i) for tri in ft for i in tri]

    cut_edges = []
    for edge in aligned.Edges:
        pts = _get_edge_points(edge)
        for i in range(len(pts) - 1):
            cut_edges.extend([float(c) for c in (list(pts[i]) + list(pts[i + 1]))])

    flat_area = float(aligned.Area or 0.0)
    x_span = float(bb.XLength)
    y_span = float(bb.YLength)
    flat_length = max(x_span, y_span)
    flat_width = min(x_span, y_span)
    flat_bbox = {"xSpan": x_span, "ySpan": y_span, "rotation_deg": 0.0}

    # For a plate the smallest overall bbox span IS the material thickness.
    thickness = model_min_span if 0 < model_min_span <= 25.4 else None
    thickness_method = "bbox_min_span" if thickness else None

    # A hollow tube has no plate span to read: its thickness is the wall -- the
    # radial gap between the outer and inner cylinder. from_cylinders ignores
    # those (full circles read as hole stacks on a sheet), so recover it here
    # rather than reporting no thickness at all for a tube.
    if not thickness:
        tube_wall = _estimate_tube_wall_thickness(fc_shape)
        if tube_wall > 0:
            thickness = tube_wall
            thickness_method = "tube_wall"

    contours = []
    try:
        contours = _build_flat_contours(
            cut_edges,
            flat_vertices,
            flat_area,
            flat_bbox,
            thickness_mm=thickness or 0.0,
        )
    except Exception as contour_error:
        sys.stderr.write(
            f"[Warning] Fallback contour extraction failed: {contour_error}\n"
        )

    total_cut_length = 0.0
    for contour in contours or []:
        try:
            total_cut_length += float(contour.get("contour_length_mm") or 0.0)
        except (TypeError, ValueError):
            continue

    short_error = " ".join(str(last_error or "").split())[:200]
    return _json_safe({
        "success": True,
        "engineVersion": UNFOLD_LIB_ENGINE_VERSION,
        "analysisEngine": "flat_profile_fallback",
        "outsideSkin": False,
        "flatVertices": flat_vertices,
        "cutEdges": cut_edges,
        "contours": contours,
        "pierceCount": _count_contour_pierces(contours),
        "totalCutLength": round(total_cut_length, 4),
        "bendEdges": [],
        "thickness": round(float(thickness), 4) if thickness else None,
        "sheetThickness": round(float(thickness), 4) if thickness else None,
        "thicknessConfidence": "low",
        "thicknessMethod": thickness_method,
        "nonFlatFeatures": _empty_non_flat_features(),
        "processEligibility": _build_process_eligibility(
            _empty_non_flat_features(), bend_count=0
        ),
        "bendTree": None,
        "faceMeshes": {"face_0": {"vertices": mesh_vertices, "indices": mesh_indices}},
        "bends": [],
        "bbox": {
            "length": round(flat_length, 4),
            "width": round(flat_width, 4),
            "blankWidth": round(flat_width, 4),
            "thickness": round(float(thickness), 4) if thickness else None,
            "xSpan": round(x_span, 4),
            "ySpan": round(y_span, 4),
            "rotation_deg": 0.0,
            "source": "flat_profile_fallback",
            "flatPatternOnly": True,
        },
        "flatPattern": {
            "length": round(flat_length, 4),
            "width": round(flat_width, 4),
            "area": round(flat_area, 4),
            "source": "flat_profile_fallback",
        },
        "flatArea": round(flat_area, 4),
        "surfaceArea": round(flat_area, 4),
        "topEdges": [],
        "frontEdges": [],
        "sideEdges": [],
        "topBendEdges": [],
        "frontBendEdges": [],
        "sideBendEdges": [],
        "detectedHoles": [],
        "fallbackWarning": (
            "Bend unfolding failed; produced a flat profile from the largest "
            f"planar face instead. ({short_error})"
        ),
    })


def _detect_rolled_panel(fc_shape, thickness_hint=0.0):
    """Detect a single-curvature *rolled* panel (a sheet rolled into a large-radius
    arc, e.g. a curved floor/kickplate) as opposed to a flat/bent sheet.

    Such a part has no small bend-between-two-planes to unfold — its body IS the
    curve. The bend-graph engine finds zero bends and falls back to projecting a
    skin face, which collapses the arc to a thin sliver. Returns the roll axis
    (FreeCAD.Vector) when the part qualifies, else None.

    Qualifies when cylindrical faces sharing ONE axis dominate the surface and
    their radius is far larger than the sheet gauge (a genuine roll, not a bend).
    """
    try:
        total_area = float(fc_shape.Area or 0.0)
    except Exception:
        total_area = 0.0
    if total_area <= 0.0:
        return None
    axis_area = {}
    axis_maxr = {}
    axis_vec = {}
    for face in fc_shape.Faces:
        if face.Surface.TypeId != "Part::GeomCylinder":
            continue
        ax = face.Surface.Axis
        axn = _normalize(np.array([float(ax.x), float(ax.y), float(ax.z)]))
        if axn[2] < 0 or (abs(axn[2]) < 1e-9 and axn[1] < 0):
            axn = -axn
        key = (round(float(axn[0]), 2), round(float(axn[1]), 2), round(float(axn[2]), 2))
        area = float(face.Area or 0.0)
        radius = float(face.Surface.Radius or 0.0)
        axis_area[key] = axis_area.get(key, 0.0) + area
        axis_maxr[key] = max(axis_maxr.get(key, 0.0), radius)
        axis_vec[key] = axn
    if not axis_area:
        return None
    dom = max(axis_area, key=lambda k: axis_area[k])
    dom_fraction = axis_area[dom] / total_area
    dom_maxr = axis_maxr[dom]
    # Use the 2V/A anchor as the gauge — NOT the bbox min span, which for a
    # rolled part is the arc height (huge), not the sheet thickness.
    gauge = _thickness_surface_volume_anchor(fc_shape)
    if gauge <= 0.0:
        gauge = float(thickness_hint) if thickness_hint and thickness_hint > 0 else 1.0
    # Majority of the surface is one-axis curvature, and that curvature is a true
    # roll (radius >> gauge) — a press-brake bend is only ~1-3x the gauge and
    # occupies a small fraction of the surface, so this never fires on bent sheet.
    if dom_fraction >= 0.45 and dom_maxr >= max(10.0, gauge * 8.0):
        vec = axis_vec[dom]
        return FreeCAD.Vector(float(vec[0]), float(vec[1]), float(vec[2]))
    return None


def _unroll_rolled_panel(fc_shape, thickness, axis, model_min_span=0.0):
    """Develop a single-curvature rolled panel to its true flat pattern.

    The outer skin is a set of coaxial cylinder patches (plus their hole edges).
    Every point on that skin has an angular coordinate theta about the roll axis
    and an axial coordinate y; the developed flat is (s = R_neutral * theta, y).
    Mapping the skin's boundary edges through that transform yields the real
    outline and every hole in the correct developed position — no sliver."""
    A = _normalize(np.array([float(axis.x), float(axis.y), float(axis.z)]))
    cyl_faces = []
    for face in fc_shape.Faces:
        if face.Surface.TypeId != "Part::GeomCylinder":
            continue
        ax = face.Surface.Axis
        axn = _normalize(np.array([float(ax.x), float(ax.y), float(ax.z)]))
        if abs(abs(float(np.dot(axn, A))) - 1.0) > 0.02:
            continue
        cyl_faces.append((face, float(face.Surface.Radius or 0.0)))
    if not cyl_faces:
        return None
    r_out = max(r for _, r in cyl_faces)
    # Outer skin = the outermost coaxial cylinder patches (within ~half a gauge of
    # the max radius). Develop at the neutral radius so the developed length is
    # correct (matches volume/gauge), not the outer-fibre length.
    cyl_outer = [f for f, r in cyl_faces if (r_out - r) <= max(0.6 * thickness, 0.1)]
    if not cyl_outer:
        cyl_outer = [f for f, r in cyl_faces if r == r_out]
    r_neutral = max(r_out - 0.5 * float(thickness), 0.1)

    # Axis origin on the roll axis, and an in-plane basis. Aim e1 at the mean
    # radial direction of the skin so theta stays within (-pi/2, pi/2) for arcs
    # under 180 deg — no branch-cut wrap across the panel.
    origin = _vector_to_np(cyl_outer[0].Surface.Center)
    mean_radial = np.zeros(3)
    for f in cyl_outer:
        rel = _vector_to_np(f.CenterOfMass) - origin
        rel = rel - np.dot(rel, A) * A
        n = np.linalg.norm(rel)
        if n > 1e-9:
            mean_radial += rel / n
    if np.linalg.norm(mean_radial) < 1e-9:
        # fallback basis
        seed = np.array([1.0, 0.0, 0.0]) if abs(A[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
        mean_radial = seed - np.dot(seed, A) * A
    e1 = _normalize(mean_radial)
    e2 = _normalize(np.cross(A, e1))

    def to_flat(pt):
        rel = np.array([float(pt[0]), float(pt[1]), float(pt[2])]) - origin
        y = float(np.dot(rel, A))
        radial = rel - y * A
        theta = math.atan2(float(np.dot(radial, e2)), float(np.dot(radial, e1)))
        return (r_neutral * theta, y)

    # A geometric edge key that is identical from both faces sharing an edge, so
    # we can look up an edge's neighbouring faces. Shared by flange detection and
    # the cut-line classifier below.
    def _edge_key(edge):
        verts = edge.Vertexes
        if verts:
            ends = sorted(
                (round(float(v.X), 2), round(float(v.Y), 2), round(float(v.Z), 2))
                for v in (verts[0], verts[-1])
            )
        else:
            ends = []
        com = edge.CenterOfMass
        mid = (round(float(com.x), 2), round(float(com.y), 2), round(float(com.z), 2))
        return (tuple(ends), mid, round(float(edge.Length or 0.0), 1))

    edge_faces = {}
    for f in fc_shape.Faces:
        for e in f.Edges:
            edge_faces.setdefault(_edge_key(e), []).append(f)

    def _is_coaxial_curved(face):
        """True for the roll cylinder, its coaxial inner skin, or a bend fillet
        (cylinder/toroid whose axis runs parallel to the roll axis)."""
        tid = face.Surface.TypeId
        if tid not in ("Part::GeomCylinder", "Part::GeomToroid"):
            return False
        try:
            ax = face.Surface.Axis
        except Exception:
            return False
        axn = _normalize(np.array([float(ax.x), float(ax.y), float(ax.z)]))
        return abs(abs(float(np.dot(axn, A))) - 1.0) <= 0.05

    # Flat side-wall RAILS that continue the roll: planar sheet walls bent off
    # the roll's long edges (a rolled floor/kickplate is a curved top with flat
    # walls hanging off it; developing only the cylinder drops them).
    #
    # A rail is rarely ONE flap. On a rolled tray the sheet leaves the roll
    # through a bend, runs out as a web, bends again and comes back as a lip.
    # Placing each wall at s = R_neutral * theta_of_its_own_crease puts it where
    # the wall SITS around the roll axis, which is not how far along the SHEET it
    # lies: the second wall then lands on top of the first and the blank comes
    # out ~20% narrow. Walk the outer skin outwards instead, accumulating each
    # bend's allowance and each wall's width, so every segment is placed at its
    # true developed position. Following the outer skin topologically also picks
    # exactly one skin per wall by construction — the inner skin is only
    # reachable through the roll's inner face, which is not in the chain, so the
    # old "same theta bucket" de-duplication (which silently developed a wall
    # twice whenever its two skins rounded to different buckets) is not needed.
    def _cross_section(pt):
        rel = np.array([float(pt[0]), float(pt[1]), float(pt[2])]) - origin
        return rel - float(np.dot(rel, A)) * A

    def _theta_of(cs_vec):
        return math.atan2(float(np.dot(cs_vec, e2)), float(np.dot(cs_vec, e1)))

    roll_hashes = {f.hashCode() for f in cyl_outer}

    def _is_bend_face(face):
        """Fillet cylinder coaxial with the roll — a bend, not the roll skin."""
        if face.Surface.TypeId != "Part::GeomCylinder":
            return False
        if face.hashCode() in roll_hashes:
            return False
        if not _is_coaxial_curved(face):
            return False
        radius = float(face.Surface.Radius or 0.0)
        return 0.0 < radius <= max(0.25 * r_out, 4.0 * float(thickness))

    def _is_structural_wall(face):
        """Planar sheet wall bent off the roll — not a gable, not a cut edge."""
        if face.Surface.TypeId != "Part::GeomPlane":
            return False
        if float(face.Area or 0.0) < 20.0:
            return False
        n = _face_normal_np(face)
        if abs(float(np.dot(n, A))) > 0.15:
            return False  # axial-facing (gable) wall — handled separately below
        # Reject the sheet's OWN cut-edge faces — the flat band seen edge-on at
        # the panel's ends (e.g. BLUE BEACON's 508 x 6.35 sides). Those are one
        # gauge wide; a real wall is many gauges across.
        verts_np = [np.array([float(v.X), float(v.Y), float(v.Z)]) - origin
                    for v in face.Vertexes]
        if len(verts_np) < 2:
            return False
        u_axis = A - float(np.dot(A, n)) * n
        if np.linalg.norm(u_axis) < 1e-9:
            return False
        u_axis = _normalize(u_axis)
        w_axis = _normalize(np.cross(n, u_axis))
        us = [float(np.dot(p, u_axis)) for p in verts_np]
        ws = [float(np.dot(p, w_axis)) for p in verts_np]
        return min(max(us) - min(us), max(ws) - min(ws)) > max(
            2.0 * float(thickness), 4.0
        )

    def _touches(face, others):
        """The first edge of `face` shared with any face in `others`."""
        hashes = {f.hashCode() for f in others}
        for edge in face.Edges:
            for neighbour in edge_faces.get(_edge_key(edge), []):
                if neighbour.hashCode() in hashes:
                    return edge
        return None

    # Both skins of one bend share an axis, so group on that axis position: the
    # pair identifies itself and the neutral fibre is simply their mean radius.
    bend_groups = {}
    for face in fc_shape.Faces:
        if not _is_bend_face(face):
            continue
        centre = _cross_section(
            (face.Surface.Center.x, face.Surface.Center.y, face.Surface.Center.z)
        )
        key = (round(float(np.dot(centre, e1)), 1), round(float(np.dot(centre, e2)), 1))
        bend_groups.setdefault(key, []).append(face)

    wall_faces_all = [f for f in fc_shape.Faces if _is_structural_wall(f)]

    roll_thetas = [
        _theta_of(_cross_section((v.X, v.Y, v.Z)))
        for f in cyl_outer
        for v in f.Vertexes
    ]
    roll_s_lo = r_neutral * min(roll_thetas) if roll_thetas else 0.0
    roll_s_hi = r_neutral * max(roll_thetas) if roll_thetas else 0.0

    flange_info = {}
    bend_info = {}
    bend_bands = []
    chain_hashes = set(roll_hashes)
    side_tol = max(4.0 * float(thickness), 2.0)

    for k in (1.0, -1.0):
        frontier = list(cyl_outer)
        edge_s = roll_s_hi if k > 0 else roll_s_lo
        on_roll = True
        for _segment in range(6):
            # The bend the sheet leaves the current segment through. Nothing is
            # committed until a wall is found on the far side of it: a small
            # coaxial fillet that leads nowhere is an edge break on a cut edge,
            # not a bend, and claiming it would both invent a flap of blank and
            # silence the real outline edge that runs along it.
            skin = []
            bend_arc = 0.0
            pending_bend = None
            for group in bend_groups.values():
                if any(f.hashCode() in chain_hashes for f in group):
                    continue
                touching = [f for f in group if _touches(f, frontier) is not None]
                if not touching:
                    continue
                if on_roll:
                    # A bend touches each end of the roll; keep this side's.
                    centre = _cross_section(
                        (group[0].Surface.Center.x, group[0].Surface.Center.y,
                         group[0].Surface.Center.z)
                    )
                    if (r_neutral * _theta_of(centre) - edge_s) * k < -side_tol:
                        continue
                # Keep only the skin we arrived on: a bend split by slots has
                # several patches at that radius, and its other skin is the
                # inner surface, which belongs to the chain we are not walking.
                r_face = float(touching[0].Surface.Radius or 0.0)
                gauge_tol = 0.25 * float(thickness)
                skin = [f for f in group
                        if abs(float(f.Surface.Radius or 0.0) - r_face) <= gauge_tol]
                twins = [float(f.Surface.Radius or 0.0) for f in group
                         if abs(float(f.Surface.Radius or 0.0) - r_face) > gauge_tol]
                centre_cs = _cross_section(
                    (skin[0].Surface.Center.x, skin[0].Surface.Center.y,
                     skin[0].Surface.Center.z)
                )
                # Neutral fibre of the bend sits midway between its two skins;
                # with only one skin visible, offset half a gauge inward.
                r_bend = (
                    (r_face + min(twins, key=lambda r: abs(r - r_face))) / 2.0
                    if twins
                    else max(r_face - 0.5 * float(thickness), 0.05)
                )
                tangent = _touches(touching[0], frontier)
                ref = _cross_section(
                    (tangent.CenterOfMass.x, tangent.CenterOfMass.y,
                     tangent.CenterOfMass.z)
                ) - centre_cs
                if np.linalg.norm(ref) < 1e-9:
                    skin = []
                    break
                ref = _normalize(ref)
                perp = _normalize(np.cross(A, ref))
                # Swept angle measured from the tangent line we arrived on, so a
                # fillet interrupted by slots still reports its full extent.
                sweep = 0.0
                for face in skin:
                    for v in face.Vertexes:
                        rel = _cross_section((v.X, v.Y, v.Z)) - centre_cs
                        sweep = max(sweep, abs(math.atan2(
                            float(np.dot(rel, perp)), float(np.dot(rel, ref)))))
                bend_arc = sweep * r_bend
                ys_bend = [
                    float(np.dot(
                        np.array([float(v.X), float(v.Y), float(v.Z)]) - origin, A))
                    for f in skin for v in f.Vertexes
                ]
                pending_bend = (r_bend, centre_cs, ref, perp, min(ys_bend), max(ys_bend))
                break

            # The wall on the far side of that bend — or, when the wall meets the
            # roll sharply with no fillet at all (KICKPLATE), off the roll itself.
            attach = skin or frontier
            wall = next(
                (f for f in wall_faces_all
                 if f.hashCode() not in chain_hashes and _touches(f, attach) is not None),
                None,
            )
            if wall is not None and not skin and on_roll:
                crease_edge = _touches(wall, frontier)
                theta_c = _theta_of(_cross_section(
                    (crease_edge.CenterOfMass.x, crease_edge.CenterOfMass.y,
                     crease_edge.CenterOfMass.z)))
                if (r_neutral * theta_c - edge_s) * k < -side_tol:
                    wall = None
            if wall is None:
                break

            crease_edge = _touches(wall, attach)
            crease_pt_cs = _cross_section(
                (crease_edge.CenterOfMass.x, crease_edge.CenterOfMass.y,
                 crease_edge.CenterOfMass.z)
            )
            n_wall = _face_normal_np(wall)
            t_dir = np.cross(A, n_wall)
            if np.linalg.norm(t_dir) < 1e-9:
                break
            t_dir = _normalize(t_dir)
            verts_np = [np.array([float(v.X), float(v.Y), float(v.Z)]) - origin
                        for v in wall.Vertexes]
            offsets = [float(np.dot((p - float(np.dot(p, A)) * A) - crease_pt_cs, t_dir))
                       for p in verts_np]
            # Point t_dir away from the crease so the wall develops outwards.
            if max(offsets) < -min(offsets):
                t_dir = -t_dir
                offsets = [-value for value in offsets]
            base_s = edge_s + k * bend_arc
            ys_face = [float(np.dot(p, A)) for p in verts_np]
            if pending_bend is not None:
                r_bend, centre_cs, ref, perp, y_lo_b, y_hi_b = pending_bend
                for face in skin:
                    bend_info[face.hashCode()] = (edge_s, k, r_bend, centre_cs, ref, perp)
                    chain_hashes.add(face.hashCode())
                bend_bands.append((edge_s, base_s, y_lo_b, y_hi_b))
            flange_info[wall.hashCode()] = (
                base_s, crease_pt_cs, t_dir, k, min(ys_face), max(ys_face)
            )
            chain_hashes.add(wall.hashCode())
            edge_s = base_s + k * max(offsets)
            frontier = [wall]
            on_roll = False

    # Gable END walls close a roll at an axial end; their normal runs ALONG the
    # roll axis and they crease to the roll's curved end arc. That arc develops
    # to a straight line across the top/bottom of the flat — a real bend, but the
    # gable itself is not a developable flat flap, so we only record which ends
    # are capped and draw the crease as a bend line. Open rolls (BLUE BEACON,
    # 07A98AB) have no gable and get nothing here.
    roof_ys = []
    for f in cyl_outer:
        for v in f.Vertexes:
            roof_ys.append(float(np.dot(
                np.array([float(v.X), float(v.Y), float(v.Z)]) - origin, A)))
    capped_end_ys = []
    if roof_ys:
        y_lo, y_hi = min(roof_ys), max(roof_ys)
        end_tol = max(5.0 * float(thickness), 8.0)
        for face in fc_shape.Faces:
            if face.Surface.TypeId != "Part::GeomPlane":
                continue
            if float(face.Area or 0.0) < max(200.0, 20.0 * float(thickness)):
                continue
            n = _face_normal_np(face)
            if abs(float(np.dot(n, A))) < 0.85:
                continue  # not axial-facing
            fp = [np.array([float(v.X), float(v.Y), float(v.Z)]) - origin
                  for v in face.Vertexes]
            frs = [float(np.linalg.norm(p - float(np.dot(p, A)) * A)) for p in fp]
            if (max(frs) - min(frs)) < 3.0 * float(thickness):
                continue  # thin end-cap (the sheet's cut edge), not a gable wall
            ymean = sum(float(np.dot(p, A)) for p in fp) / len(fp)
            if abs(ymean - y_hi) <= end_tol and y_hi not in capped_end_ys:
                capped_end_ys.append(y_hi)
            elif abs(ymean - y_lo) <= end_tol and y_lo not in capped_end_ys:
                capped_end_ys.append(y_lo)

    flange_faces = [f for f in fc_shape.Faces if f.hashCode() in flange_info]
    bend_faces = [f for f in fc_shape.Faces if f.hashCode() in bend_info]
    outer_faces = list(cyl_outer) + flange_faces + bend_faces

    def _make_mapper(face):
        info = flange_info.get(face.hashCode())
        if info is not None:
            base_s, crease_pt_cs, t_dir, k = info[0], info[1], info[2], info[3]

            def _flange_map(pt):
                rel = np.array([float(pt[0]), float(pt[1]), float(pt[2])]) - origin
                y = float(np.dot(rel, A))
                p_cs = rel - y * A
                dist = float(np.dot(p_cs - crease_pt_cs, t_dir))
                return (base_s + k * dist, y)

            return _flange_map

        bend = bend_info.get(face.hashCode())
        if bend is not None:
            # The bend band is real material: it develops to its arc length at
            # the neutral fibre, measured from the tangent line the sheet
            # entered on. Skipping it leaves a gap between roll and wall.
            start_s, k, r_bend, centre_cs, ref, perp = bend

            def _bend_map(pt):
                rel = np.array([float(pt[0]), float(pt[1]), float(pt[2])]) - origin
                y = float(np.dot(rel, A))
                v = (rel - y * A) - centre_cs
                angle = abs(math.atan2(float(np.dot(v, perp)), float(np.dot(v, ref))))
                return (start_s + k * angle * r_bend, y)

            return _bend_map

        return to_flat

    # Develop the outer skin by tessellating each patch in 3D and mapping every
    # vertex through the unroll. Shared tessellation vertices at the patch seams
    # map to the SAME 2D point, so the triangles stay stitched into one connected
    # panel with holes preserved — which is exactly what the 2D viewer fills.
    # (Boundary-loop stitching shattered the perimeter of multi-patch skins into
    # a dozen disconnected arcs; a mapped triangle mesh cannot fragment that way.)
    flat_vertices = []
    for face in outer_faces:
        try:
            verts, tris = _tessellate_fc_face(face, deflection=0.75)
        except Exception:
            continue
        mapper = _make_mapper(face)
        mapped = [mapper((float(v[0]), float(v[1]), float(v[2]))) for v in verts]
        for tri in tris:
            for v_idx in tri:
                mx, my = mapped[v_idx]
                flat_vertices.append(mx)
                flat_vertices.append(my)
                flat_vertices.append(0.0)
    if len(flat_vertices) < 9:
        return None

    # --- Crisp line work straight from the model edges ----------------------
    # The developed silhouette, every hole, the flange creases and the engraved
    # graphic (logo) are all REAL edges of the solid. Discretising each edge and
    # mapping it through the same unroll keeps every curve continuous. Deriving
    # the lines from the coarse developed triangle mesh instead shatters thin
    # engraving grooves into floating arcs (the "fragmented logo"). Each skin
    # edge is classified by how many CHAIN faces (roll skin, bend, wall) share
    # it — a purely topological test, which is exactly what distinguishes the
    # two cases:
    #   shared by two chain faces  -> internal seam or bend tangent (draw nothing)
    #   shared by one chain face   -> cut / hole / etched graphic
    # A slot cutting across a bend still borders only ONE chain face (the bend)
    # plus its own side walls, so it survives; the roll-to-bend tangent line
    # borders two and is dropped in favour of the dashed bend line.
    def _discretise_edge(edge):
        try:
            length = float(edge.Length or 0.0)
        except Exception:
            length = 0.0
        count = int(max(2, min(240, math.ceil(length / 1.5) + 1)))
        try:
            pts = edge.discretize(Number=count)
            return [(float(p.x), float(p.y), float(p.z)) for p in pts]
        except Exception:
            return [(float(v.X), float(v.Y), float(v.Z)) for v in edge.Vertexes]

    edge_map = {}
    for face in fc_shape.Faces:
        if face.hashCode() not in chain_hashes:
            continue
        for edge in face.Edges:
            key = _edge_key(edge)
            rec = edge_map.get(key)
            if rec is None:
                rec = {"edge": edge, "faces": {}}
                edge_map[key] = rec
            rec["faces"].setdefault(face.hashCode(), face)

    cut_edges = []
    for rec in edge_map.values():
        chain_neighbours = list(rec["faces"].values())
        if len(chain_neighbours) != 1:
            continue  # internal seam / bend tangent — the bend line covers it
        mapper = _make_mapper(chain_neighbours[0])
        mapped = [mapper(p) for p in _discretise_edge(rec["edge"])]
        for i in range(len(mapped) - 1):
            x1, y1 = mapped[i]
            x2, y2 = mapped[i + 1]
            cut_edges.extend([x1, y1, 0.0, x2, y2, 0.0])

    # One dashed bend line per bend, down the middle of its developed band and
    # spanning the bend's axial extent. Drawing it at the band centre rather
    # than at a tangent line keeps it where a brake operator would read it.
    bend_edges = []
    for s_start, s_end, y_min_b, y_max_b in bend_bands:
        s_mid = 0.5 * (s_start + s_end)
        bend_edges.extend([s_mid, y_min_b, 0.0, s_mid, y_max_b, 0.0])

    # normalise the fill and the line work together to the +x,+y quadrant
    xs = flat_vertices[0::3]
    ys = flat_vertices[1::3]
    min_x, min_y = min(xs), min(ys)
    for i in range(0, len(flat_vertices), 3):
        flat_vertices[i] -= min_x
        flat_vertices[i + 1] -= min_y
    for arr in (cut_edges, bend_edges):
        for i in range(0, len(arr), 3):
            arr[i] -= min_x
            arr[i + 1] -= min_y

    xs = flat_vertices[0::3]
    ys = flat_vertices[1::3]
    x_span = max(xs) - min(xs)
    y_span = max(ys) - min(ys)
    flat_length = max(x_span, y_span)
    flat_width = min(x_span, y_span)
    flat_bbox = {"xSpan": x_span, "ySpan": y_span, "rotation_deg": 0.0}

    # Area/DXF contours still come from the watertight developed mesh boundary
    # (robust closed loops); the crisp edges above are what the 2D view draws.
    # Developed area straight from the mapped triangles. It owes nothing to
    # either contour builder, which is what lets it arbitrate between them.
    mesh_area = 0.0
    for i in range(0, len(flat_vertices) - 8, 9):
        ax, ay = flat_vertices[i], flat_vertices[i + 1]
        bx, by = flat_vertices[i + 3], flat_vertices[i + 4]
        cx, cy = flat_vertices[i + 6], flat_vertices[i + 7]
        mesh_area += abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) * 0.5

    def _drop_noise_loops(candidate):
        """One connected sheet, so every extra outer loop is stitching noise —
        typically a lone boundary triangle a few mm2 across. Left in, it sits
        INSIDE the real outline and the exact-geometry canonicaliser rejects the
        whole part with "rings overlap or touch"."""
        if not candidate:
            return []
        largest = max(float(c.get("area_mm2") or 0.0) for c in candidate)
        if largest <= 0.0:
            return candidate
        return [c for c in candidate
                if float(c.get("area_mm2") or 0.0) >= largest * 0.005]

    contour_candidates = []
    try:
        from_edges = _build_contours_from_cut_edges(
            cut_edges, mesh_area, flat_bbox, thickness_mm=float(thickness or 0.0)
        )
        if not _contours_are_bbox_fallback(from_edges):
            contour_candidates.append(_drop_noise_loops(from_edges))
    except Exception as contour_error:
        sys.stderr.write(
            f"[Warning] Rolled-panel cut-edge contours failed: {contour_error}\n")
    try:
        contour_candidates.append(_drop_noise_loops(
            _contours_from_mesh_boundary(flat_vertices, mesh_area, flat_bbox)))
    except Exception as contour_error:
        sys.stderr.write(
            f"[Warning] Rolled-panel contour extraction failed: {contour_error}\n")

    # Keep whichever reproduces the developed mesh area most closely. The
    # cut-edge stitch is exact where it closes and is the only one that can
    # follow a slotted rail, but on a plain rolled plate it can read the panel
    # ends as holes; the mesh walk never invents an opening, but its patches are
    # tessellated independently so it sees a boundary edge at every seam and can
    # stitch the outline into a self-crossing tangle (a slotted rectangle came
    # out as a 7-point figure-of-eight, which the canonicaliser then rejects).
    contours = []
    best_error = None
    for candidate in contour_candidates:
        if not candidate:
            continue
        total = sum(float(c.get("area_mm2") or 0.0) for c in candidate)
        error = abs(total - mesh_area)
        if best_error is None or error < best_error:
            best_error = error
            contours = candidate

    flat_area = sum(float(c.get("area_mm2") or 0.0) for c in contours or [])
    if flat_area <= 0.0:
        flat_area = mesh_area
    if flat_area <= 0.0:
        flat_area = x_span * y_span

    total_cut_length = 0.0
    for contour in contours or []:
        try:
            total_cut_length += float(contour.get("contour_length_mm") or 0.0)
        except (TypeError, ValueError):
            continue

    # Tessellate the ORIGINAL 3D faces so the viewer's 3D tab can render the
    # curved part (the flat pattern above is 2D-only; without this the 3D view
    # shows "3D mesh not available").
    face_meshes = {}
    mesh_deflection = _adaptive_mesh_deflection(
        fc_shape, os.environ.get("CAD_MESH_DEFLECTION")
    )
    min_mesh_area = float(os.environ.get("CAD_MESH_MIN_AREA", "2.0") or 2.0)
    for i, face in enumerate(fc_shape.Faces):
        try:
            if float(face.Area or 0.0) < min_mesh_area:
                continue
            verts, tris = _tessellate_fc_face(face, deflection=mesh_deflection)
            if verts.shape[0] > 0 and tris.shape[0] > 0:
                face_meshes[f"face_{i}"] = {
                    "vertices": np.round(verts.flatten(), 3).tolist(),
                    "indices": tris.flatten().astype(np.int32).tolist(),
                }
        except Exception:
            pass

    sys.stderr.write(
        f"[Debug] Rolled-panel unroll: R_out={r_out:.2f} R_neutral={r_neutral:.2f} "
        f"dev {flat_length:.1f} x {flat_width:.1f}, area={flat_area:.0f}, "
        f"faces_meshed={len(face_meshes)}\n"
    )

    return _json_safe({
        "success": True,
        "engineVersion": UNFOLD_LIB_ENGINE_VERSION,
        "analysisEngine": "rolled_panel_unroll",
        "outsideSkin": True,
        "flatVertices": flat_vertices,
        "cutEdges": cut_edges,
        "contours": contours,
        "pierceCount": _count_contour_pierces(contours),
        "totalCutLength": round(total_cut_length, 4),
        "bendEdges": bend_edges,
        "thickness": round(float(thickness), 4) if thickness else None,
        "sheetThickness": round(float(thickness), 4) if thickness else None,
        "thicknessConfidence": "medium",
        "thicknessMethod": "rolled_panel",
        "nonFlatFeatures": _empty_non_flat_features(),
        "processEligibility": _build_process_eligibility(
            _empty_non_flat_features(), bend_count=0
        ),
        "bendTree": None,
        "faceMeshes": face_meshes,
        "bends": [],
        "bbox": {
            "length": round(flat_length, 4),
            "width": round(flat_width, 4),
            "blankWidth": round(flat_width, 4),
            "thickness": round(float(thickness), 4) if thickness else None,
            "xSpan": round(x_span, 4),
            "ySpan": round(y_span, 4),
            "rotation_deg": 0.0,
            "source": "rolled_panel_unroll",
            "flatPatternOnly": True,
        },
        "flatPattern": {
            "length": round(flat_length, 4),
            "width": round(flat_width, 4),
            "area": round(flat_area, 4),
            "source": "rolled_panel_unroll",
        },
        "flatArea": round(flat_area, 4),
        "surfaceArea": round(float(fc_shape.Area or flat_area), 4),
        "topEdges": [],
        "frontEdges": [],
        "sideEdges": [],
        "topBendEdges": [],
        "frontBendEdges": [],
        "sideBendEdges": [],
        "detectedHoles": [],
        "rolledPanel": True,
    })


# Sheet-metal-or-stock decision, shared with the exploder (solid_stock.py).
# Loaded by path because this script keeps its own directory off sys.path.
_solid_stock = importlib.util.module_from_spec(
    importlib.util.spec_from_file_location(
        "solid_stock", os.path.join(os.path.dirname(os.path.abspath(__file__)), "solid_stock.py")
    )
)
_solid_stock.__spec__.loader.exec_module(_solid_stock)
SHEET_MIN_PLANAR_FRACTION = _solid_stock.SHEET_MIN_PLANAR_FRACTION
_planar_area_fraction = _solid_stock.planar_area_fraction
_round_stock_dims = _solid_stock.round_stock_dims


def _solid_only_result(fc_shape, planar_fraction, include_face_meshes=True):
    """
    The analysis for a solid that is not sheet metal: bounding-box dimensions
    (round stock also gets diameter and straight length), volume, surface area
    and the 3D mesh, with no flat pattern and Laser blocked. Same shape the API
    writes for an exploded assembly leaf (assemblyIngest.buildSolidAnalysis),
    so the parts page shows it as "Solid model" rather than a sheet.
    """
    bb = fc_shape.BoundBox
    x = round(float(bb.XLength or 0.0), 3)
    y = round(float(bb.YLength or 0.0), 3)
    z = round(float(bb.ZLength or 0.0), 3)
    sorted_spans = sorted([x, y, z], reverse=True)
    long_dim, mid_dim, short_dim = sorted_spans

    round_stock = _round_stock_dims(fc_shape)
    diameter = round(round_stock["diameter"], 3) if round_stock else None
    height = (
        round(round_stock["length"], 3)
        if round_stock and round_stock.get("length")
        else (long_dim or None)
    )

    face_meshes = {}
    if include_face_meshes:
        # Chord tolerance from the SMALLEST span, not the longest: a metre of
        # 12.7mm bar meshed at span*0.012 = 5mm becomes a four-sided stick.
        mesh_deflection = _adaptive_mesh_deflection(
            fc_shape, os.environ.get("CAD_MESH_DEFLECTION")
        )
        thin_span = min(span for span in (x, y, z) if span > 1e-6) if any(s > 1e-6 for s in (x, y, z)) else 0.0
        if round_stock and round_stock.get("diameter"):
            thin_span = float(round_stock["diameter"])
        if thin_span > 0 and os.environ.get("CAD_MESH_DEFLECTION") in (None, ""):
            mesh_deflection = max(0.05, min(mesh_deflection, thin_span * 0.06))
        min_mesh_area = float(os.environ.get("CAD_MESH_MIN_AREA", "2.0") or 2.0)
        for i, face in enumerate(fc_shape.Faces):
            try:
                if float(face.Area or 0.0) < min_mesh_area:
                    continue
                verts, tris = _tessellate_fc_face(face, deflection=mesh_deflection)
                if verts.shape[0] > 0 and tris.shape[0] > 0:
                    face_meshes[f"face_{i}"] = {
                        "vertices": np.round(verts.flatten(), 3).tolist(),
                        "indices": tris.flatten().astype(np.int32).tolist(),
                    }
            except Exception:
                pass

    reason = (
        f"Not sheet metal: planar faces cover {planar_fraction * 100:.1f}% of the surface"
        + (" (round stock)" if round_stock else "")
        + "."
    )
    non_flat = _empty_non_flat_features()
    non_flat["hasRaisedFeatures"] = True
    non_flat["raisedFeatureFaceCount"] = 1
    non_flat["reasons"] = [reason]

    try:
        volume = round(float(fc_shape.Volume or 0.0), 3)
    except Exception:
        volume = None
    try:
        surface_area = round(float(fc_shape.Area or 0.0), 4)
    except Exception:
        surface_area = None

    return _json_safe({
        "success": True,
        "engineVersion": UNFOLD_LIB_ENGINE_VERSION,
        "analysisEngine": "unfold_solid_only",
        "solidOnly": True,
        "sheetMetal": False,
        "notSheetReason": reason,
        "planarAreaFraction": round(float(planar_fraction), 4),
        "flatVertices": [],
        "cutEdges": [],
        "bendEdges": [],
        "bends": [],
        "bendTree": None,
        "thickness": None,
        "sheetThickness": None,
        "thicknessConfidence": None,
        "thicknessMethod": None,
        "thicknessWarning": None,
        "nonFlatFeatures": non_flat,
        "processEligibility": _build_process_eligibility(non_flat, bend_count=0),
        "faceMeshes": face_meshes,
        "volume": volume,
        "surfaceArea": surface_area,
        "diameter": diameter,
        "height": height,
        "bbox": {
            "source": "solid_bbox",
            "flatPatternOnly": False,
            "diameter": diameter,
            "height": height,
            "dimensions": {
                "x": x,
                "y": y,
                "z": z,
                "length": long_dim or None,
                "width": mid_dim or None,
                "height": height,
                "depth": short_dim or None,
                "diameter": diameter,
            },
        },
        "topEdges": [],
        "frontEdges": [],
        "sideEdges": [],
        "topBendEdges": [],
        "frontBendEdges": [],
        "sideBendEdges": [],
        "detectedHoles": [],
    })


def unfold_with_lib(filepath, profile="full"):
    profile_key = str(profile or "full").strip().lower()
    include_unfold = profile_key in ("full", "fast2d", "2d", "unfold")
    include_face_meshes = profile_key == "full"
    include_projections = profile_key == "full"
    include_holes = profile_key in ("full", "holes", "holes_fast")
    estimate_thickness = True

    t0 = time.time()
    emit_progress(4, "Loading STEP model")
    # 1. Load STEP directly using FreeCAD Part
    fc_shape = Part.Shape()
    fc_shape.read(filepath)
    sys.stderr.write(f"[Profiling] Load STEP: {time.time() - t0:.3f}s\n")
    # An export with nothing in it opens as a null shape. Every later step
    # would quietly describe that nothing -- 0% planar, 0 x 0 x 0 -- and the
    # part would sit in the library as "ready". Say what is wrong instead.
    if fc_shape.isNull() or not fc_shape.Faces:
        raise ValueError(
            "This STEP file is empty: it has a header but no model inside. "
            "Export the part again from CAD with the body selected."
        )

    if not include_unfold:
        thickness_result = None
        thickness = None
        thickness_confidence = "low"
        thickness_method = None
        thickness_warning = None
        root_idx = None
        non_flat_features = _empty_non_flat_features()
        model_min_span = _model_min_bbox_span(fc_shape)
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
                    thickness_result = _estimate_sheet_thickness(
                        fc_shape, root_idx, model_min_span
                    )
                    thickness = _unwrap_thickness_value(thickness_result)
                    thickness_confidence = thickness_result.get("confidence", "medium")
                    thickness_method = thickness_result.get("method")
            except Exception as ex:
                thickness_warning = f"Thickness estimate failed: {ex}"

        if root_idx is not None and thickness:
            non_flat_features = _detect_non_flat_features(fc_shape, root_idx, thickness)

        holes_data = []
        if include_holes:
            emit_progress(58 if estimate_thickness else 42, "Detecting holes")
            holes_data = detect_holes_fc(
                fc_shape,
                thickness,
                model_min_span,
            )

        emit_progress(96, "Finalizing analysis")
        return _json_safe({
            "success": True,
            "engineVersion": UNFOLD_LIB_ENGINE_VERSION,
            "flatVertices": [],
            "cutEdges": [],
            "bendEdges": [],
            "thickness": round(float(thickness), 4) if thickness else None,
            "thicknessConfidence": thickness_confidence,
            "thicknessMethod": thickness_method,
            "thicknessWarning": thickness_warning,
            "nonFlatFeatures": non_flat_features,
            "processEligibility": _build_process_eligibility(non_flat_features, bend_count=0),
            "bendTree": None,
            "faceMeshes": {},
            "bends": [],
            "bbox": {
                "width": 0.0,
                "height": 0.0,
                "length": 0.0,
                "xSpan": 0.0,
                "ySpan": 0.0,
                "rotation_deg": 0.0,
            },
            "topEdges": [],
            "frontEdges": [],
            "sideEdges": [],
            "topBendEdges": [],
            "frontBendEdges": [],
            "sideBendEdges": [],
            "surfaceArea": round(float(sum(float(f.Area or 0.0) for f in fc_shape.Faces)), 4),
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
        # A sphere, a torus, a blob: no planar face means no sheet skin to
        # unfold, not a broken file. Report it as a solid model.
        sys.stderr.write("[Debug] Not sheet metal: no planar faces\n")
        return _solid_only_result(fc_shape, 0.0, include_face_meshes)

    # Sort by area descending
    potential_roots.sort(key=lambda x: -x["area"])
    largest_planar_area = float(potential_roots[0]["area"]) if potential_roots else 0.0
    
    chosen_root = potential_roots[0]["index"] # Fallback to largest

    # Prefer the parallel skin pair aligned to the model's thinnest axis.
    # Very thick/bent solids can have larger side faces than their true top/bottom
    # skins; choosing only by area makes the 2D flat view unfold the wrong surface.
    thin_axis_idx = None
    model_min_span = 0.0
    try:
        bb = fc_shape.BoundBox
        spans = [float(bb.XLength), float(bb.YLength), float(bb.ZLength)]
        model_min_span = min(span for span in spans if span > 1e-6)
        thin_axis_idx = int(np.argmin(np.asarray(spans, dtype=float)))
    except Exception:
        thin_axis_idx = None
        model_min_span = 0.0

    # Rolled single-curvature panels (curved floors/kickplates) have no bend to
    # unfold — the sheet body IS the curve. The bend-graph search below would
    # find zero bends and project a skin face, collapsing the arc to a sliver.
    # Detect and develop them by arc length instead.
    try:
        roll_axis = _detect_rolled_panel(fc_shape, model_min_span)
        if roll_axis is not None:
            emit_progress(30, "Estimating sheet thickness")
            roll_root = potential_roots[0]["index"] if potential_roots else None
            roll_thickness_result = _estimate_sheet_thickness(
                fc_shape, roll_root, model_min_span
            )
            roll_thickness = _unwrap_thickness_value(roll_thickness_result)
            if roll_thickness and roll_thickness > 0:
                emit_progress(55, "Unrolling curved panel")
                rolled = _unroll_rolled_panel(
                    fc_shape, roll_thickness, roll_axis, model_min_span
                )
                if rolled is not None:
                    sys.stderr.write(
                        "[Debug] Handled as rolled single-curvature panel "
                        f"(thickness={roll_thickness:.3f})\n"
                    )
                    if include_holes:
                        rolled["modelHoles"] = _model_holes_for(fc_shape, roll_thickness, model_min_span)
                    return rolled
    except Exception as roll_err:
        sys.stderr.write(f"[Debug] Rolled-panel path skipped: {roll_err}\n")

    # Not everything that reaches here is sheet metal. A round bar, rod or pipe
    # has planar faces only at its ends, and the unfold below still "succeeds"
    # on it by taking an end cap as the root: the flat pattern comes out as a
    # disc the size of the cross-section and the part is quoted as a 12.8 x
    # 12.8 laser blank (the #4 rebar in DRAFT_Cassette B). The planar share of
    # the surface tells the two apart before any root face is chosen.
    planar_fraction = _planar_area_fraction(fc_shape)
    if planar_fraction < SHEET_MIN_PLANAR_FRACTION:
        sys.stderr.write(
            f"[Debug] Not sheet metal: planar faces cover {planar_fraction:.1%} of the surface\n"
        )
        return _solid_only_result(fc_shape, planar_fraction, include_face_meshes)

    best_thin_axis_pair = None
    best_thin_axis_score = -1.0
    best_area_pair = None
    best_area_score = -1.0

    # Try to find a pair of anti-parallel faces with similar areas
    for i in range(min(20, len(potential_roots))):
        f1 = potential_roots[i]
        for j in range(i + 1, min(30, len(potential_roots))):
            f2 = potential_roots[j]
            # If they are parallel/anti-parallel and have similar areas
            if abs(f1["normal"].dot(f2["normal"])) > 0.99:
                if abs(f1["area"] - f2["area"]) / max(f1["area"], f2["area"]) < 0.2:
                    area_score = min(float(f1["area"]), float(f2["area"]))
                    if area_score > best_area_score:
                        best_area_score = area_score
                        best_area_pair = f1

                    if thin_axis_idx is not None:
                        n = f1["normal"]
                        comps = [abs(float(n.x)), abs(float(n.y)), abs(float(n.z))]
                        axis_score = comps[thin_axis_idx]
                        if axis_score > 0.85 and area_score > best_thin_axis_score:
                            best_thin_axis_score = area_score
                            best_thin_axis_pair = f1

    thin_axis_root = best_thin_axis_pair["index"] if best_thin_axis_pair is not None else None
    area_root = best_area_pair["index"] if best_area_pair is not None else None
    if thin_axis_root is not None and area_root is not None and thin_axis_root != area_root:
        thin_score, _ = _score_root_face_candidate(fc_shape, thin_axis_root, model_min_span)
        area_score_root, _ = _score_root_face_candidate(fc_shape, area_root, model_min_span)
        chosen_root = thin_axis_root if thin_score >= area_score_root else area_root
    elif thin_axis_root is not None:
        chosen_root = thin_axis_root
    elif area_root is not None:
        chosen_root = area_root

    chosen_root = _clamp_root_to_major_skin(
        chosen_root, potential_roots, fc_shape, min_area_fraction=0.25
    )
    
    success = False
    last_error = None
    best_unfold_state = None
    best_unfold_score = -1
    
    # Try multiple planar faces as potential roots.  Do not accept the first
    # non-crashing root blindly: for formed parts, a projected skin face can
    # return a valid but useless "flat" with zero bends while a later root
    # unfolds the real bend chain.
    largest_root_idx = int(potential_roots[0]["index"])
    min_candidate_area = max(50.0, largest_planar_area * 0.02)
    root_candidates = []
    for idx in [largest_root_idx, chosen_root]:
        if idx not in root_candidates:
            root_candidates.append(idx)
    for entry in potential_roots:
        if float(entry.get("area") or 0.0) < min_candidate_area:
            continue
        if entry["index"] not in root_candidates:
            root_candidates.append(entry["index"])
    # Prefer a few large skins; tiny roots only waste time before the area reject.
    root_candidates = root_candidates[:5]

    for candidate_idx, root_idx in enumerate(root_candidates):
        try:
            emit_progress(20 + (candidate_idx * 8), f"Evaluating unfold root {root_idx}")
            root_area_probe = float(fc_shape.Faces[root_idx].Area or 0.0)
            if root_area_probe < min_candidate_area:
                print(
                    f"[Debug] Skipping root {root_idx}: area {root_area_probe:.1f} "
                    f"< candidate floor {min_candidate_area:.1f}",
                    file=sys.stderr,
                )
                continue
            # Adjacency and Thickness
            print(f"[Debug] Testing root {root_idx} (area {fc_shape.Faces[root_idx].Area:.2f})", file=sys.stderr)
            root_face = fc_shape.Faces[root_idx]
            root_normal = root_face.Surface.Axis
            print(f"[Debug] Root Normal: {root_normal}", file=sys.stderr)
            graph = build_graph_of_tangent_faces(fc_shape, root_idx)
            print(f"[Debug] Graph built with {graph.number_of_nodes()} nodes and {graph.number_of_edges()} edges", file=sys.stderr)
            thickness_result = _estimate_sheet_thickness(fc_shape, root_idx, model_min_span)
            thickness = _unwrap_thickness_value(thickness_result)
            print(f"[Debug] Detected thickness: {thickness} ({thickness_result.get('method')})", file=sys.stderr)
            min_plausible_thickness = 0.05
            if thickness <= min_plausible_thickness:
                print(
                    f"[Debug] Root {root_idx} rejected: detected thickness {thickness:.6f} "
                    f"is below plausible sheet thickness {min_plausible_thickness:.3f}",
                    file=sys.stderr,
                )
                continue
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

            # ── Formed-feature / collar detection ─────────────────────────
            # Detect cylindrical subtrees that represent drawn collars or
            # formed features (e.g. a round collar around a cutout) rather
            # than true sheet-metal bends.  These are pruned from the graph
            # so they don't appear in the flat pattern.
            root_area = float(fc_shape.Faces[root_idx].Area)
            root_center_np = _vector_to_np(root_face.CenterOfMass)
            root_normal_np = _face_normal_np(root_face)
            _, root_u_vec, root_v_vec = _basis_from_normal(root_normal_np)

            def _root_outer_uv_bounds():
                """Return an approximate UV envelope for the root face outline."""
                samples = []
                try:
                    for edge in root_face.OuterWire.Edges:
                        for p in edge.discretize(Number=16):
                            rel = _vector_to_np(p) - root_center_np
                            samples.append([
                                float(np.dot(rel, root_u_vec)),
                                float(np.dot(rel, root_v_vec)),
                            ])
                except Exception:
                    samples = []

                if not samples:
                    try:
                        bb = root_face.BoundBox
                        corners = [
                            (bb.XMin, bb.YMin, bb.ZMin),
                            (bb.XMin, bb.YMin, bb.ZMax),
                            (bb.XMin, bb.YMax, bb.ZMin),
                            (bb.XMin, bb.YMax, bb.ZMax),
                            (bb.XMax, bb.YMin, bb.ZMin),
                            (bb.XMax, bb.YMin, bb.ZMax),
                            (bb.XMax, bb.YMax, bb.ZMin),
                            (bb.XMax, bb.YMax, bb.ZMax),
                        ]
                        for x, y, z in corners:
                            rel = np.array([float(x), float(y), float(z)], dtype=float) - root_center_np
                            samples.append([
                                float(np.dot(rel, root_u_vec)),
                                float(np.dot(rel, root_v_vec)),
                            ])
                    except Exception:
                        return None

                arr = np.asarray(samples, dtype=float)
                return np.min(arr, axis=0), np.max(arr, axis=0)

            root_uv_bounds = _root_outer_uv_bounds()

            def _node_center_uv(node_id):
                rel = _vector_to_np(fc_shape.Faces[node_id].CenterOfMass) - root_center_np
                return np.array([
                    float(np.dot(rel, root_u_vec)),
                    float(np.dot(rel, root_v_vec)),
                ], dtype=float)

            def _is_subtree_interior_to_root(node_ids):
                """True when every face center sits safely inside the root plate footprint."""
                if root_uv_bounds is None or not node_ids:
                    return False

                min_uv, max_uv = root_uv_bounds
                span_uv = np.maximum(max_uv - min_uv, 1e-6)
                thickness_value = float(thickness) if thickness else 0.0
                margin = max(1.0, thickness_value * 1.5)
                margin = min(margin, float(np.min(span_uv)) * 0.12)
                safe_min = min_uv + margin
                safe_max = max_uv - margin

                if np.any(safe_min >= safe_max):
                    return False

                for node_id in node_ids:
                    uv = _node_center_uv(node_id)
                    if not (np.all(uv > safe_min) and np.all(uv < safe_max)):
                        return False
                return True

            def _shares_flange_with_sibling(cyl_node):
                """True if this cylinder opens onto a flange that the spanning
                tree handed to a sibling bend.

                The unfold tree gives every flange exactly one parent, so when
                two identical bends lead into the same face -- the end tab on
                2022-36 is reached from face 6 and face 55 alike -- the one that
                loses the race is left with no children. It is still a real bend.
                Treating it as a dead end both pruned it as a drawn collar and
                kept its crease out of the flat pattern, so both of those checks
                ask this instead of trusting the tree.
                """
                if cyl_node not in graph:
                    return False
                parents = set(dg.predecessors(cyl_node))
                flange_threshold = max(20.0, root_area * 0.02)
                for neighbour in graph.neighbors(cyl_node):
                    if neighbour == cyl_node or neighbour in parents:
                        continue
                    if neighbour not in dg:
                        continue
                    neighbour_face = fc_shape.Faces[neighbour]
                    if neighbour_face.Surface.TypeId != "Part::GeomPlane":
                        continue
                    if float(neighbour_face.Area) > flange_threshold:
                        return True
                return False

            def _subtree_nodes(node):
                """Collect all descendants of *node* in the directed graph."""
                collected = []
                for child in dg.successors(node):
                    collected.append(child)
                    collected.extend(_subtree_nodes(child))
                return collected

            def _is_formed_feature_subtree(cyl_node):
                """Return True if *cyl_node* (a cylinder) is the root of a
                formed-feature collar rather than a genuine bend flange.

                A collar/drawn feature is characterised by:
                - No descendant planar face is large relative to the root
                  (real bend flanges are comparable in size to the root plate).
                - The total area of the entire subtree is small relative to
                  the root (collars wrap around cutouts — they're compact).

                We intentionally do NOT limit subtree depth because
                rounded-rectangle collars can have chains of 8+ faces
                (4 corner cylinders + 4 flat wall segments).
                """
                cyl_face = fc_shape.Faces[cyl_node]
                if cyl_face.Surface.TypeId != "Part::GeomCylinder":
                    return False

                descendants = _subtree_nodes(cyl_node)
                subtree_nodes = [cyl_node] + descendants

                if not descendants:
                    # "No children" means no children in the SPANNING TREE, which
                    # is not the same as no children in the part. Two identical
                    # bends can lead into one shared flange -- on 2022-36 the end
                    # tab is reached from face 6 and face 55 alike -- and a tree
                    # can only give that flange one parent. The sibling that loses
                    # the race is left childless and was then deleted here as a
                    # drawn collar, taking the tab out of the flat pattern with it.
                    # Consult the full adjacency graph before believing the leaf.
                    if _shares_flange_with_sibling(cyl_node):
                        print(
                            f"[Debug] Collar check: terminal cylinder face {cyl_node} "
                            f"shares its flange with a sibling bend - keeping as real bend",
                            file=sys.stderr,
                        )
                        return False
                    # Genuine dead-end cylinder — could be a drawn lip or collar
                    # rim.  Prune it if its arc is wide enough.
                    u_range = cyl_face.ParameterRange
                    span_deg = math.degrees(u_range[1] - u_range[0])
                    if span_deg < 30:
                        return False
                    if span_deg < 80:
                        print(
                            f"[Debug] Collar check: terminal cylinder face {cyl_node} "
                            f"has shallow arc {span_deg:.0f}deg - pruning as internal formed feature",
                            file=sys.stderr,
                        )
                        return True
                    if _is_subtree_interior_to_root([cyl_node]):
                        print(
                            f"[Debug] Collar check: terminal cylinder face {cyl_node} "
                            f"is inside root footprint - pruning as internal formed feature",
                            file=sys.stderr,
                        )
                        return True
                    print(
                        f"[Debug] Collar check: terminal cylinder face {cyl_node} "
                        f"is on/near the blank boundary - keeping as bend material",
                        file=sys.stderr,
                    )
                    return False

                # A formed feature (collar, louver, dimple) is by definition COMPACT.
                # Sitting inside the root footprint is therefore necessary but not
                # sufficient: a real flange that folds back over the plate also
                # projects inside it, and pruning on interiority alone deleted the
                # bend and everything past it, leaving just the bare root plate as
                # the "flat pattern".  Gate the prune on subtree size as well.
                subtree_area = float(cyl_face.Area) + sum(
                    float(fc_shape.Faces[d].Area) for d in descendants
                )
                compact_threshold = max(50.0, root_area * 0.03)
                if _is_subtree_interior_to_root(subtree_nodes):
                    if subtree_area <= compact_threshold:
                        print(
                            f"[Debug] Collar check: subtree rooted at face {cyl_node} is inside "
                            f"root footprint and compact (area {subtree_area:.1f} <= "
                            f"{compact_threshold:.1f}) - pruning as internal formed feature",
                            file=sys.stderr,
                        )
                        return True
                    print(
                        f"[Debug] Collar check: subtree rooted at face {cyl_node} is inside root "
                        f"footprint but too large (area {subtree_area:.1f} > {compact_threshold:.1f}) "
                        f"— treating as a real flange folded over the plate",
                        file=sys.stderr,
                    )
                else:
                    # A formed feature -- collar, louver, dimple, emboss -- is
                    # pressed INTO the sheet, so it can only ever sit inside
                    # the plate's outline. A subtree that reaches outside that
                    # outline is added material: a flange, however small. The
                    # size tests below exist to tell a collar from a flange
                    # among subtrees that are inside; applied to one that is
                    # not, they deleted the four mounting tabs and a return
                    # lip on 22.stp (each a 90-degree bend plus one flat face
                    # parallel to the plate, under 2% of its area) and drew
                    # the part without them. The same rule the terminal-
                    # cylinder branch above already applies.
                    print(
                        f"[Debug] Collar check: subtree rooted at face {cyl_node} reaches outside "
                        f"the root footprint (area {subtree_area:.1f}) - keeping as bend material",
                        file=sys.stderr,
                    )
                    return False

                # Check if ANY descendant planar face is large (a real flange)
                # Reduced threshold from 0.20 to 0.02 to avoid pruning real flanges on very long parts.
                single_face_threshold = max(20.0, root_area * 0.02)
                total_subtree_area = float(cyl_face.Area)

                for desc in descendants:
                    desc_face = fc_shape.Faces[desc]
                    desc_area = float(desc_face.Area)
                    total_subtree_area += desc_area
                    if desc_face.Surface.TypeId == "Part::GeomPlane":
                        # If the face is perpendicular or angled relative to the root, it's very likely a flange
                        dn = desc_face.normalAt(0, 0)
                        desc_normal = _normalize(np.array([float(dn.x), float(dn.y), float(dn.z)]))
                        alignment = abs(float(np.dot(desc_normal, root_normal_np)))
                        
                        # If not parallel (alignment < 0.95), keep it as a real bend
                        if alignment < 0.95:
                            print(
                                f"[Debug] Collar check: face {desc} is non-parallel (alignment={alignment:.3f}) "
                                f"— keeping as real bend",
                                file=sys.stderr,
                            )
                            return False

                        if desc_area > single_face_threshold:
                            print(
                                f"[Debug] Collar check: face {desc} is planar with area "
                                f"{desc_area:.1f} > threshold {single_face_threshold:.1f} "
                                f"— keeping as real bend",
                                file=sys.stderr,
                            )
                            return False  # large flange child → real bend

                # Also check total subtree area — if the whole subtree is
                # more than 5% of the root (reduced from 40%), it's likely a substantial flange
                # structure rather than a small collar.
                if total_subtree_area > max(50.0, root_area * 0.05):
                    print(
                        f"[Debug] Collar check: subtree total area {total_subtree_area:.1f} "
                        f"> threshold — keeping as real bend",
                        file=sys.stderr,
                    )
                    return False

                return True

            # Identify and remove formed-feature subtrees
            formed_feature_nodes = set()
            # Only check cylinder children of the root (direct bend candidates)
            for u, v in list(dg.edges()):
                if v in formed_feature_nodes:
                    continue
                cyl_face = fc_shape.Faces[v]
                if cyl_face.Surface.TypeId != "Part::GeomCylinder":
                    continue
                if _is_formed_feature_subtree(v):
                    subtree = [v] + _subtree_nodes(v)
                    formed_feature_nodes.update(subtree)
                    u_range = cyl_face.ParameterRange
                    print(
                        f"[Debug] Pruning formed-feature subtree rooted at face {v} "
                        f"({len(subtree)} faces, arc={math.degrees(u_range[1] - u_range[0]):.0f}°)",
                        file=sys.stderr,
                    )

            if formed_feature_nodes:
                dg.remove_nodes_from(formed_feature_nodes)
                print(
                    f"[Debug] Removed {len(formed_feature_nodes)} formed-feature faces "
                    f"from unfold graph (root_area={root_area:.1f})",
                    file=sys.stderr,
                )
            else:
                # Diagnostic: dump the graph structure for debugging
                print(
                    f"[Debug] No formed features detected. Graph has {dg.number_of_nodes()} nodes, "
                    f"{dg.number_of_edges()} edges, root_area={root_area:.1f}",
                    file=sys.stderr,
                )
                for u, v in dg.edges():
                    vf = fc_shape.Faces[v]
                    vtype = vf.Surface.TypeId.split("::")[-1]
                    varea = float(vf.Area)
                    extra = ""
                    if vtype == "GeomCylinder":
                        ur = vf.ParameterRange
                        extra = f" arc={math.degrees(ur[1]-ur[0]):.0f}°"
                    print(
                        f"[Debug]   edge {u}->{v}: {vtype} area={varea:.1f}{extra}",
                        file=sys.stderr,
                    )

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
                    # A bend that lost its flange to a sibling in the spanning
                    # tree still has a child in the part, so ask the adjacency
                    # graph the same way the collar check above does. Without
                    # this the loser fails `terminal_bend` too -- its own area is
                    # nowhere near 10% of the root -- and its crease is dropped.
                    has_children = (
                        len(list(dg.successors(v))) > 0
                        or _shares_flange_with_sibling(v)
                    )

                    # A bend can also TERMINATE the part — a curved lip, or a
                    # plate that simply curves away and ends. There is no face
                    # after it, but the curve is still sheet material that has to
                    # be unrolled into the flat pattern. Requiring a child face
                    # discarded the whole curved region, so the flat came out as
                    # just the root plate with no bend line at all.
                    # A hole or fillet wall is also a childless cylinder, so
                    # separate them by area: a bend spans the part, a hole wall
                    # is a sliver (931 mm^2 vs 42 mm^2 on the reference part).
                    terminal_bend = not has_children and float(
                        bend_face.Area
                    ) >= max(20.0, float(root_area) * 0.10)

                    if span_deg < 350 and (has_children or terminal_bend):
                        dg.nodes[v]["is_real_bend"] = True
                        if terminal_bend:
                            print(
                                f"[Debug] Face {v} is a terminal bend "
                                f"(arc={span_deg:.0f}°, area={float(bend_face.Area):.1f}, "
                                f"no child face) — unrolling into the flat pattern",
                                file=sys.stderr,
                            )
                else:
                    dg.nodes[v]["unbend_transform"] = Matrix()
            sys.stderr.write(f"[Profiling] Unfold traversal: {time.time() - t_unfold_start:.3f}s\n")
            emit_progress(62, "Generating flat pattern geometry")
            
            real_bend_count = sum(
                1 for node_id in dg.nodes
                if dg.nodes[node_id].get("is_real_bend", False)
            )
            min_bend_root_area = max(50.0, largest_planar_area * 0.02)
            if real_bend_count > 0 and root_area < min_bend_root_area:
                sys.stderr.write(
                    f"[Debug] Root {root_idx} rejected: bend root area {root_area:.1f} "
                    f"is too small for primary sheet root threshold {min_bend_root_area:.1f}\n"
                )
                continue

            root_area = float(root_face.Area or 0.0)
            thickness_penalty = _thickness_plausibility_penalty(
                thickness, model_min_span, thickness_result
            )
            confidence_bonus = 500 if thickness_result.get("confidence") == "high" else 0
            if real_bend_count == 0:
                unfold_score = root_area + confidence_bonus - thickness_penalty
            else:
                unfold_score = (
                    (real_bend_count * 10000)
                    + dg.number_of_nodes()
                    + confidence_bonus
                    - thickness_penalty
                )
            if unfold_score > best_unfold_score:
                best_unfold_score = unfold_score
                best_unfold_state = {
                    "root_idx": root_idx,
                    "dg": dg,
                    "thickness": thickness,
                    "thickness_result": thickness_result,
                    "real_bend_count": real_bend_count,
                    "graph_nodes": dg.number_of_nodes(),
                    "root_area": root_area,
                }

            if real_bend_count > 0:
                sys.stderr.write(
                    f"[Debug] Selected root {root_idx}: "
                    f"{real_bend_count} real bend(s), {dg.number_of_nodes()} graph node(s)\n"
                )
                break

            sys.stderr.write(
                f"[Debug] Root {root_idx} produced no real bends; "
                f"continuing root search\n"
            )
        except Exception as e:
            last_error = f"{str(e)}\n{traceback.format_exc()}"
            sys.stderr.write(f"[Debug] Root {root_idx} failed: {last_error}\n")
            continue
            
    if best_unfold_state is None:
        sys.stderr.write(
            f"[Debug] No unfold root worked; attempting flat-profile fallback. Last error: {last_error}\n"
        )
        emit_progress(80, "Falling back to flat profile")
        fallback = _flat_profile_fallback(fc_shape, model_min_span, last_error=last_error)
        if include_holes:
            fallback["modelHoles"] = _model_holes_for(fc_shape, fallback.get("thickness"), model_min_span)
        return fallback

    chosen_root = best_unfold_state["root_idx"]
    dg = best_unfold_state["dg"]
    thickness = best_unfold_state["thickness"]
    thickness = _snap_thickness_to_min_span(thickness, model_min_span)
    thickness_result = best_unfold_state.get("thickness_result") or {}
    thickness_confidence = thickness_result.get("confidence", "medium")
    thickness_method = thickness_result.get("method")
    success = True
    no_bends = best_unfold_state.get("real_bend_count", 0) == 0
    if no_bends:
        sys.stderr.write(
            f"[Debug] Falling back to best non-bend root {chosen_root}: "
            f"{best_unfold_state['graph_nodes']} graph node(s)\n"
        )

    use_skin_flat_pattern = no_bends
    partial_unfold_recovered = False
    if use_skin_flat_pattern:
        primary_skin_root = _resolve_primary_skin_root(
            potential_roots,
            thin_axis_idx,
            chosen_root,
            shape=fc_shape,
            model_min_span=model_min_span,
        )
        if primary_skin_root != chosen_root:
            sys.stderr.write(
                f"[Debug] No-bend override: root {chosen_root} -> primary skin {primary_skin_root}\n"
            )
        chosen_root = primary_skin_root
        dg = nx.DiGraph()
        dg.add_node(chosen_root)

    # 4. Calulate Global Alignment (to ensure the root face is parallel to XY plane)
    root_face = fc_shape.Faces[chosen_root]
    root_normal = root_face.normalAt(0,0)
    root_center = root_face.CenterOfMass

    # Ignore all faces that are part of the valid unfoldable sheet graph.
    # Bends and flanges are sheet-metal geometry, not CNC-only 3D features.
    sheet_face_indices = set(dg.nodes)
    non_flat_features = _detect_non_flat_features(
        fc_shape,
        chosen_root,
        thickness,
        sheet_face_indices=sheet_face_indices,
    )

    flat_vertices = []
    cut_edges_2d = []
    bend_edges_2d = []
    flat_faces_2d = []
    flat_area_mm2 = 0.0
    global_align_m = Matrix()

    if use_skin_flat_pattern:
        emit_progress(70, "Building flat pattern from sheet skins")
        skin_pattern = _build_flat_pattern_from_thin_axis_skins(
            fc_shape,
            potential_roots,
            thin_axis_idx,
            chosen_root,
        )
        global_align_m = skin_pattern["global_align_m"]
        flat_vertices = skin_pattern["flat_vertices"]
        cut_edges_2d = skin_pattern["cut_edges_2d"]
        flat_faces_2d = skin_pattern["flat_faces_2d"]
        flat_area_mm2 = skin_pattern["flat_area_mm2"]
        root_node = _make_flat_bend_tree_node(fc_shape, chosen_root)
        sys.stderr.write(
            f"[Debug] Built no-bend flat pattern from {skin_pattern['skin_face_count']} "
            f"thin-axis skin face(s) on root {chosen_root}\n"
        )
    else:
        global_align_m = Matrix()
        # 1. Move to origin
        global_align_m.move(root_center * -1.0)
        # 2. Rotate normal to [0,0,1]
        rot = Rotation(root_normal, Vector(0,0,1))
        global_align_m = rot.toMatrix().multiply(global_align_m)

        # 5. Generate Output Data using chosen_root
        seg_tally = _SegmentTally()
        emit_progress(70, "Building bend hierarchy")

        tree_visited = set()

        def build_frontend_tree(node_id, parent_id=None, accumulated_m=None):
            """O(n) traversal: accumulated_m is the product of unbend transforms from root to
            this node's parent, eliminating the per-node nx.shortest_path O(n²) call.

            `tree_visited` guards against cycles / diamonds in the bend graph: without it a
            node reachable by two paths recurses forever (RecursionError kills the whole
            analysis) and its face is tessellated and area-counted twice."""
            nonlocal flat_area_mm2
            tree_visited.add(node_id)
            if accumulated_m is None:
                accumulated_m = Matrix()

            node_data = dg.nodes[node_id]
            face = fc_shape.Faces[node_id]
            # Drift in the accumulated product is what makes OCC reject the
            # transform outright ("Moving with scaling transformation is
            # forbidden"), so square it up before every use.
            final_m = _rigidify_matrix(accumulated_m)

            # Flattened Geometry
            source_shape = node_data.get("unbent_shape", face)
            flat_face = _safe_transformed(source_shape, final_m, f"face {node_id}")
            if flat_face is not None:
                # Apply global alignment to sit on XY plane (for 2D view)
                flat_face = _safe_transformed(
                    flat_face, global_align_m, f"face {node_id} (align)"
                )

            if flat_face is not None:
                flat_faces_2d.append(flat_face)
                try:
                    flat_area_mm2 += float(getattr(flat_face, "Area", 0.0) or 0.0)
                except Exception:
                    pass

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
                        seg_tally.add(pts[i], pts[i + 1])

            # Bend Lines — only real bends (skip hole walls / filtered cylinders
            # that still carry an unrolled bend_line shape).
            if "bend_line" in node_data and node_data.get("is_real_bend", False):
                bl = _safe_transformed(
                    node_data["bend_line"], final_m, f"bend line {node_id}"
                )
                if bl is not None:
                    bl = _safe_transformed(
                        bl, global_align_m, f"bend line {node_id} (align)"
                    )
                if bl is not None:
                    # Unrolled cylinder outlines can tessellate into many short
                    # ticks (including ends perpendicular to the crease). Keep
                    # only the longest segment so one real bend → one dashed line.
                    candidate_segs = []
                    for e in bl.Edges:
                        pts = _get_edge_points(e)
                        for i in range(len(pts) - 1):
                            p0 = pts[i]
                            p1 = pts[i + 1]
                            try:
                                length = math.hypot(
                                    float(p1[0]) - float(p0[0]),
                                    float(p1[1]) - float(p0[1]),
                                )
                            except (TypeError, ValueError, IndexError):
                                continue
                            if length < 1e-6:
                                continue
                            candidate_segs.append((length, p0 + p1))
                    if candidate_segs:
                        candidate_segs.sort(key=lambda item: item[0], reverse=True)
                        # The longest segment IS the crease. Keep it, plus any
                        # other segment lying on the same line: a bend that
                        # crosses a cutout gets clipped into several collinear
                        # pieces (2022-36 has 13 cutouts sitting on bend
                        # cylinders), and taking only the longest drew the crease
                        # up to the hole and stopped there. Segments running
                        # across the crease -- the end ticks this longest-only
                        # pick was really guarding against -- are still dropped.
                        base_len = candidate_segs[0][0]
                        base = candidate_segs[0][1]
                        base_ux = (float(base[3]) - float(base[0])) / base_len
                        base_uy = (float(base[4]) - float(base[1])) / base_len
                        base_off = float(base[0]) * -base_uy + float(base[1]) * base_ux
                        # The pieces are joined HERE, per bend, into one crease
                        # from the first piece to the last: this bend's own
                        # cutouts are bridged, and nothing else is. Joining was
                        # left to the collinear merge downstream, which cannot
                        # tell one bend's pieces from two bends that happen to
                        # share a line -- the two corner tabs on 22.stp fold
                        # off the same wall edge 90 mm apart, and it drew them
                        # as a single crease across the free edge between.
                        t_lo = None
                        t_hi = None
                        for seg_len, coords in candidate_segs:
                            seg_ux = (float(coords[3]) - float(coords[0])) / seg_len
                            seg_uy = (float(coords[4]) - float(coords[1])) / seg_len
                            if abs(seg_ux * base_ux + seg_uy * base_uy) < 0.999:
                                continue
                            seg_off = (
                                float(coords[0]) * -base_uy + float(coords[1]) * base_ux
                            )
                            if abs(seg_off - base_off) > 1e-3:
                                continue
                            for px, py in ((coords[0], coords[1]), (coords[3], coords[4])):
                                t_val = float(px) * base_ux + float(py) * base_uy
                                t_lo = t_val if t_lo is None else min(t_lo, t_val)
                                t_hi = t_val if t_hi is None else max(t_hi, t_val)
                        if t_lo is not None and t_hi is not None and t_hi - t_lo > 1e-6:
                            bend_edges_2d.extend([
                                base_ux * t_lo + -base_uy * base_off,
                                base_uy * t_lo + base_ux * base_off,
                                0.0,
                                base_ux * t_hi + -base_uy * base_off,
                                base_uy * t_hi + base_ux * base_off,
                                0.0,
                            ])

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
                if neighbor in tree_visited:
                    continue
                tree_node["children"].append(build_frontend_tree(neighbor, node_id, next_m))

            return tree_node

        root_node = build_frontend_tree(chosen_root)

        # Keep only boundary segments in the flat cut profile.
        # Shared segments are internal seams between unfolded faces and should not be shown as cut lines.
        # A seam whose two sides don't land within the hash tolerance after unbending survives
        # as TWO near-coincident "boundary" segments, drawing solid lines across every bend —
        # so also drop anything lying along a bend line.
        _bend_segments = []
        for _i in range(0, len(bend_edges_2d) - 5, 6):
            _bend_segments.append(
                (
                    (bend_edges_2d[_i], bend_edges_2d[_i + 1]),
                    (bend_edges_2d[_i + 3], bend_edges_2d[_i + 4]),
                )
            )

        def _on_bend_line(p0, p1, tol=0.35):
            """True when segment p0-p1 lies along any bend segment (collinear + overlapping)."""
            for b0, b1 in _bend_segments:
                bx, by = b1[0] - b0[0], b1[1] - b0[1]
                blen = math.hypot(bx, by)
                if blen < 1e-9:
                    continue
                ux, uy = bx / blen, by / blen
                ok = True
                for px, py in (p0, p1):
                    dx, dy = px - b0[0], py - b0[1]
                    # Perpendicular distance to the bend line.
                    if abs(dx * -uy + dy * ux) > tol:
                        ok = False
                        break
                    # Projection must fall within the bend segment (with slack).
                    t = dx * ux + dy * uy
                    if t < -tol or t > blen + tol:
                        ok = False
                        break
                if ok:
                    return True
            return False

        for p1, p2 in seg_tally.boundary_segments():
            if _bend_segments and _on_bend_line(
                (p1[0], p1[1]), (p2[0], p2[1])
            ):
                continue
            cut_edges_2d.extend(p1 + p2)

        degenerate_unfold = (
            dg.number_of_nodes() <= 1
            or best_unfold_state.get("real_bend_count", 0) == 0
        )
        if degenerate_unfold:
            exclude_face_indices = set(dg.nodes)
            extra_faces = _collect_aligned_parallel_faces(
                fc_shape,
                chosen_root,
                global_align_m,
                min_area_fraction=0.05,
                exclude_indices=exclude_face_indices,
            )
            for aligned_face in extra_faces:
                flat_faces_2d.append(aligned_face)
                try:
                    flat_area_mm2 += float(getattr(aligned_face, "Area", 0.0) or 0.0)
                except Exception:
                    pass
            _append_parallel_face_cut_edges(
                fc_shape,
                chosen_root,
                global_align_m,
                seg_tally,
                exclude_indices=exclude_face_indices,
            )
            cut_edges_2d = []
            for p1, p2 in seg_tally.boundary_segments():
                cut_edges_2d.extend(p1 + p2)
            sys.stderr.write(
                f"[Debug] Degenerate unfold: merged {len(extra_faces)} parallel skin face(s) "
                f"into flat pattern for bbox/hole detection\n"
            )

    face_meshes = {}
    if include_face_meshes:
        emit_progress(80, "Preparing 3D face meshes")
        # Higher deflection + skip micro faces keeps viewer usable while cutting
        # JSON/DB write time dramatically (this is what felt "stuck at 92%").
        mesh_deflection = _adaptive_mesh_deflection(
            fc_shape, os.environ.get("CAD_MESH_DEFLECTION")
        )
        min_mesh_area = float(os.environ.get("CAD_MESH_MIN_AREA", "2.0") or 2.0)
        for i, face in enumerate(fc_shape.Faces):
            try:
                if float(face.Area or 0.0) < min_mesh_area:
                    continue
                verts, tris = _tessellate_fc_face(face, deflection=mesh_deflection)
                if verts.shape[0] > 0 and tris.shape[0] > 0:
                    face_meshes[f"face_{i}"] = {
                        "vertices": np.round(verts.flatten(), 3).tolist(),
                        "indices": tris.flatten().astype(np.int32).tolist(),
                    }
            except Exception:
                pass

    # Calculate bounding box for 2D layout centering (prefer cut edges, OBB)
    flat_bbox = {
        "length": 0.0,
        "width": 0.0,
        "xSpan": 0.0,
        "ySpan": 0.0,
        "rotation_deg": 0.0,
    }
    try:
        if cut_edges_2d and len(cut_edges_2d) >= 6:
            segment_bbox = _flat_bbox_from_cut_edge_segments(cut_edges_2d)
            if segment_bbox:
                flat_bbox = segment_bbox
            else:
                pts = np.array(cut_edges_2d, dtype=float).reshape(-1, 3)
                flat_bbox = _compute_flat_bbox_obb(pts)
    except Exception:
        flat_bbox = {
            "length": 0.0,
            "width": 0.0,
            "xSpan": 0.0,
            "ySpan": 0.0,
            "rotation_deg": 0.0,
        }

    blank_width = float(flat_bbox.get("width") or 0.0)

    if (flat_bbox["length"] <= 0 or flat_bbox["width"] <= 0) and flat_vertices:
        pts = np.array(flat_vertices, dtype=float).reshape(-1, 3)
        flat_bbox = _compute_flat_bbox_obb(pts)
        blank_width = float(flat_bbox.get("width") or blank_width)

    parallel_bbox = _compute_flat_bbox_from_parallel_faces(
        fc_shape,
        chosen_root,
        global_align_m,
        exclude_indices=set(),
    )
    cut_edge_bbox_valid = (
        float(flat_bbox.get("length") or 0.0) > 0
        and float(flat_bbox.get("width") or 0.0) > 0
    )
    if parallel_bbox and not cut_edge_bbox_valid:
        sys.stderr.write(
            "[Debug] Using parallel-skin bbox fallback because cut-edge bbox was unavailable\n"
        )
        flat_bbox = parallel_bbox
        blank_width = float(flat_bbox.get("width") or blank_width)

    if not use_skin_flat_pattern and _bent_unfold_looks_partial_profile(
        flat_bbox,
        flat_area_mm2,
        largest_planar_area,
        best_unfold_state,
        cut_edges_2d,
        flat_vertices,
    ):
        recovery_root = _resolve_primary_skin_root(
            potential_roots,
            thin_axis_idx,
            chosen_root,
            shape=fc_shape,
            model_min_span=model_min_span,
        )
        sys.stderr.write(
            f"[Debug] Bent unfold from root {chosen_root} only covered "
            f"{best_unfold_state.get('graph_nodes', 0)} face(s) / "
            f"{best_unfold_state.get('real_bend_count', 0)} bend(s); "
            f"recovering flat profile from primary skin {recovery_root}\n"
        )
        emit_progress(86, "Recovering flat profile")
        chosen_root = int(recovery_root)
        skin_pattern = _build_flat_pattern_from_thin_axis_skins(
            fc_shape,
            potential_roots,
            thin_axis_idx,
            chosen_root,
        )
        global_align_m = skin_pattern["global_align_m"]
        flat_vertices = skin_pattern["flat_vertices"]
        cut_edges_2d = skin_pattern["cut_edges_2d"]
        flat_faces_2d = skin_pattern["flat_faces_2d"]
        flat_area_mm2 = skin_pattern["flat_area_mm2"]
        bend_edges_2d = _collect_profile_recovery_bend_edges(
            fc_shape,
            global_align_m,
            flat_vertices,
            cut_edges_2d,
            thickness,
        )
        root_node = _make_flat_bend_tree_node(fc_shape, chosen_root)
        use_skin_flat_pattern = True
        partial_unfold_recovered = True
        best_unfold_state = {
            **best_unfold_state,
            "root_idx": chosen_root,
            "real_bend_count": 0,
            "graph_nodes": skin_pattern.get("skin_face_count", 1),
            "partial_unfold_recovered": True,
        }
        try:
            if cut_edges_2d and len(cut_edges_2d) >= 6:
                segment_bbox = _flat_bbox_from_cut_edge_segments(cut_edges_2d)
                if segment_bbox:
                    flat_bbox = segment_bbox
                else:
                    pts = np.array(cut_edges_2d, dtype=float).reshape(-1, 3)
                    flat_bbox = _compute_flat_bbox_obb(pts)
            elif flat_vertices:
                pts = np.array(flat_vertices, dtype=float).reshape(-1, 3)
                flat_bbox = _compute_flat_bbox_obb(pts)
            blank_width = float(flat_bbox.get("width") or 0.0)
        except Exception as recovery_bbox_error:
            sys.stderr.write(
                f"[Warning] Partial-unfold recovery bbox failed: {recovery_bbox_error}\n"
            )

    root_face_width = 0.0
    has_bends = best_unfold_state.get("real_bend_count", 0) > 0
    if has_bends and flat_faces_2d:
        try:
            root_points = _outer_wire_xy_points(flat_faces_2d[0])
            if len(root_points) >= 2:
                root_bbox = _compute_flat_bbox_obb(np.asarray(root_points, dtype=float))
                root_face_width = float(root_bbox.get("width") or 0.0)
                if root_face_width > 0 and root_face_width < blank_width:
                    sys.stderr.write(
                        f"[Debug] Root-face width {root_face_width:.3f} mm is narrower than "
                        f"outside-skin blank width {blank_width:.3f} mm; keeping outside-skin width\n"
                    )
        except Exception as root_bbox_error:
            sys.stderr.write(
                f"[Warning] Root-face width diagnostic failed: {root_bbox_error}\n"
            )

    flat_length = float(flat_bbox.get("length") or 0.0)
    flat_width = float(flat_bbox.get("width") or 0.0)
    if not use_skin_flat_pattern and _blank_looks_edge_on(
        flat_bbox, thickness, model_min_span
    ):
        # Rounded-corner plates masquerade as bent channels: the four side
        # walls joined by corner radii score as a 4-bend root, and the
        # "unfold" is the side wall unrolled (perimeter x thickness). A flat
        # pattern only a couple thicknesses wide is that band, never a real
        # blank — recover the true face instead of returning the sliver.
        sys.stderr.write(
            f"[Debug] Unfolded flat {flat_length:.1f}x{flat_width:.1f} mm is a "
            f"side-wall band (thickness {float(thickness or 0.0):.2f}); "
            "using flat-profile fallback\n"
        )
        emit_progress(90, "Recovering flat profile")
        fallback = _flat_profile_fallback(
            fc_shape,
            model_min_span,
            last_error=(
                f"unfolded flat pattern {flat_length:.1f}x{flat_width:.1f} mm "
                "is a side-wall band"
            ),
        )
        if include_holes:
            fallback["modelHoles"] = _model_holes_for(fc_shape, fallback.get("thickness"), model_min_span)
        return fallback
    if use_skin_flat_pattern and _blank_looks_edge_on(
        flat_bbox, thickness, model_min_span
    ):
        alternate_root = _pick_best_no_bend_skin(
            potential_roots,
            fc_shape,
            thin_axis_idx,
            model_min_span,
            exclude_idx=chosen_root,
        )
        if alternate_root is not None and alternate_root != chosen_root:
            sys.stderr.write(
                f"[Debug] Edge-on flat bbox {flat_length:.1f}x{flat_width:.1f} mm; "
                f"retrying primary skin {alternate_root}\n"
            )
            chosen_root = int(alternate_root)
            skin_pattern = _build_flat_pattern_from_thin_axis_skins(
                fc_shape,
                potential_roots,
                thin_axis_idx,
                chosen_root,
            )
            global_align_m = skin_pattern["global_align_m"]
            flat_vertices = skin_pattern["flat_vertices"]
            cut_edges_2d = skin_pattern["cut_edges_2d"]
            flat_faces_2d = skin_pattern["flat_faces_2d"]
            flat_area_mm2 = skin_pattern["flat_area_mm2"]
            try:
                if cut_edges_2d and len(cut_edges_2d) >= 6:
                    segment_bbox = _flat_bbox_from_cut_edge_segments(cut_edges_2d)
                    if segment_bbox:
                        flat_bbox = segment_bbox
                elif flat_vertices:
                    pts = np.array(flat_vertices, dtype=float).reshape(-1, 3)
                    flat_bbox = _compute_flat_bbox_obb(pts)
                flat_length = float(flat_bbox.get("length") or 0.0)
                flat_width = float(flat_bbox.get("width") or 0.0)
            except Exception:
                pass
    if blank_width <= 0:
        blank_width = flat_width

    # One drawn crease per real bend, for every part. This used to branch on
    # `real_bend_count >= 6`, which treated any 6+ bend part as a tray: it kept
    # BOTH the inner and outer crease of each bend and then synthesised a mate
    # for any crease that lacked one, so a 6-bend plate drew 12 lines. The
    # synthesiser sized those mates from _estimate_bend_face_spacing, whose
    # floor -- max(span * 0.006, 1.5) -- sits ABOVE a thin sheet's real
    # inner/outer gap (2.088 mm vs 1.897 mm on 14 ga over a 350 mm crease), so
    # it never measured the true pair and instead cloned every line by the
    # distance between two unrelated creases. Parts under 6 bends never took
    # that branch and drew correctly; both counts now follow the same path.
    bend_edges_2d = _merge_collinear_bend_edges(bend_edges_2d, thickness)
    bend_edges_2d = _limit_bend_edges_to_real_bends(
        bend_edges_2d,
        best_unfold_state.get("real_bend_count", 0),
        thickness,
    )
    if partial_unfold_recovered:
        developed_profile = _develop_partial_profile_blank(
            fc_shape,
            cut_edges_2d,
            bend_edges_2d,
            flat_vertices,
            flat_bbox,
            thickness,
        )
        if developed_profile:
            cut_edges_2d = developed_profile["cut_edges_2d"]
            bend_edges_2d = developed_profile["bend_edges_2d"]
            flat_vertices = developed_profile["flat_vertices"]
            flat_bbox = developed_profile["flat_bbox"]
            flat_length = float(flat_bbox.get("length") or 0.0)
            flat_width = float(flat_bbox.get("width") or 0.0)
            blank_width = flat_width

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
    model_holes = []
    if include_holes:
        t_holes = time.time()
        emit_progress(92, "Detecting holes")
        flat_pattern_holes = detect_holes_from_2d_pattern(flat_faces_2d)
        holes_3d = detect_holes_fc(
            fc_shape,
            thickness,
            model_min_span,
        )
        # The same holes where they sit on the 3D model (the STEP's own
        # frame). detectedHoles below is in the unfolded frame, right for
        # counting but wrong for placing taps or countersinks on the model.
        model_holes = [dict(hole) for hole in _filter_round_pierces_only(holes_3d)]
        holes_data = _merge_flat_pattern_pierces(
            flat_pattern_holes,
            holes_3d,
            global_align_m,
            thickness,
            model_min_span,
        )
        sys.stderr.write(f"[Profiling] Hole Detection: {time.time() - t_holes:.3f}s\n")

    try:
        surface_area_mm2 = float(sum(float(f.Area or 0.0) for f in fc_shape.Faces))
    except Exception:
        surface_area_mm2 = 0.0

    sys.stderr.write(f"[Profiling] Total unfold_with_lib: {time.time() - t_start:.3f}s\n")
    emit_progress(98, "Finalizing response")

    contours = []
    try:
        contours = _build_flat_contours(
            cut_edges_2d,
            flat_vertices,
            flat_area_mm2,
            flat_bbox,
            thickness_mm=thickness,
            flat_faces_2d=flat_faces_2d,
        )
    except Exception as contour_error:
        sys.stderr.write(
            f"[Warning] Contour extraction failed; continuing without contours: {contour_error}\n"
        )

    if contours:
        try:
            flat_area_mm2 = max(
                float(contour.get("area_mm2") or 0.0)
                for contour in contours
            )
        except Exception:
            pass

    total_cut_length_mm = 0.0
    for contour in contours or []:
        try:
            total_cut_length_mm += float(contour.get("contour_length_mm") or 0.0)
        except (TypeError, ValueError):
            continue

    bend_line_count = len(bend_edges_2d) // 6
    if bend_line_count <= 0:
        bend_line_count = len(bends_data)
    # Simple channel brackets (<=4 bends): one brake op per crease.
    # Tray / enclosure perimeters (6+ bends): two ops per folded face.
    # Cap at six primary bent faces so corner transition cylinders do not
    # inflate quoting on trays like SOLID.step (8 graph bends -> 12 ops).
    bend_operation_multiplier = 2 if bend_line_count >= 6 else 1
    if bend_line_count >= 6:
        reported_bend_count = min(bend_line_count, 6) * bend_operation_multiplier
    else:
        reported_bend_count = bend_line_count

    return _json_safe({
        "success": True,
        "engineVersion": UNFOLD_LIB_ENGINE_VERSION,
        "analysisEngine": (
            "partial_unfold_profile_recovery"
            if partial_unfold_recovered
            else "robust_outside_skin_unfold"
        ),
        "outsideSkin": True,
        "flatVertices": flat_vertices,
        "cutEdges": cut_edges_2d,
        "contours": contours,
        "pierceCount": _count_contour_pierces(contours),
        "totalCutLength": round(float(total_cut_length_mm), 4),
        "bendEdges": bend_edges_2d,
        "bendLineCount": bend_line_count,
        "displayBendCount": bend_line_count,
        "bendOperationMultiplier": bend_operation_multiplier,
        "thickness": round(float(thickness), 4),
        "sheetThickness": round(float(thickness), 4),
        "surfaceArea": round(surface_area_mm2, 4),
        "thicknessConfidence": thickness_confidence,
        "thicknessMethod": thickness_method,
        "nonFlatFeatures": non_flat_features,
        "physicalBendCount": reported_bend_count,
        "bendCount": reported_bend_count,
        "processEligibility": _build_process_eligibility(
            non_flat_features,
            bend_count=reported_bend_count,
        ),
        "bendTree": root_node,
        "faceMeshes": face_meshes,
        "bends": bends_data,
        "bbox": {
            "length": flat_length,
            "width": flat_width,
            "blankWidth": blank_width if blank_width > flat_width else flat_width,
            "rootFaceWidth": round(float(root_face_width), 4) if root_face_width > 0 else None,
            "thickness": round(float(thickness), 4),
            "height": round(float(thickness), 4),
            "sheetThickness": round(float(thickness), 4),
            "xSpan": float(flat_bbox.get("xSpan") or 0.0),
            "ySpan": float(flat_bbox.get("ySpan") or 0.0),
            "rotation_deg": float(flat_bbox.get("rotation_deg") or 0.0),
            "source": (
                "partial_unfold_profile_recovery"
                if partial_unfold_recovered
                else "unfolded_outside_skin"
            ),
            "flatPatternOnly": True,
        },
        "flatPattern": {
            "length": flat_length,
            "width": flat_width,
            "area": round(float(flat_area_mm2), 4),
            "outsideSkin": True,
            "source": (
                "partial_unfold_profile_recovery"
                if partial_unfold_recovered
                else "unfolded_outside_skin"
            ),
        },
        "flatArea": round(float(flat_area_mm2), 4),
        "topEdges": views["top"]["edges"],
        "frontEdges": views["front"]["edges"],
        "sideEdges": views["side"]["edges"],
        "topBendEdges": views["top"]["bend_edges"],
        "frontBendEdges": views["front"]["bend_edges"],
        "sideBendEdges": views["side"]["bend_edges"],
        "detectedHoles": holes_data,
        "modelHoles": model_holes,
        **({
            "fallbackWarning": (
                "Recovered the 2D profile after the bend unfolder only produced "
                "a partial strip."
            )
        } if partial_unfold_recovered else {}),
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
    # A failure leaves as one JSON line too, so the reason reaches the part
    # page instead of being buried in a traceback behind "exit status 1".
    try:
        print(json.dumps(unfold_with_lib(input_file, profile=cli_profile)))
    except Exception as error:  # noqa: BLE001 - the reason is the payload
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"success": False, "error": str(error) or type(error).__name__}))
        sys.exit(1)
