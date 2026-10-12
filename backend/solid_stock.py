"""
Is this solid sheet metal, or stock (a bar, rod, pipe, ring)?

Shared by the exploder (assembly_lib.py, per leaf) and the unfolder
(unfold_lib.py, per part) so both answer the question the same way. Both run
as scripts under FreeCAD's Python with their own directory off sys.path, so
they load this file by path with load_solid_stock() rather than importing it.

Why this exists: a round bar has planar faces only at its ends, and the
unfolder would happily take one end as the root face and "unfold" the bar into
a disc the size of its cross-section. The #4 rebar in DRAFT_Cassette B (12.7mm
bar, 1.27m long) came out as a 12.8 x 12.8 sheet, 12.7 thick, and was quoted
as a laser blank. Sheet parts are planar almost everywhere, so the planar share
of the surface tells the two apart whatever the bounding box looks like.
"""

import importlib.util
import os

# Below this share of planar surface a solid is not sheet metal. Real sheet
# parts measure 0.89-1.0 (bends and hole walls are the only curved faces); the
# cassette rebars 0.004-0.005. Rolled panels are the one sheet form that is
# mostly curved; the unfolder handles them before consulting this.
SHEET_MIN_PLANAR_FRACTION = 0.15


def load_solid_stock(script_file):
    """Load this module from the directory of `script_file` (a __file__)."""
    path = os.path.join(os.path.dirname(os.path.abspath(script_file)), "solid_stock.py")
    spec = importlib.util.spec_from_file_location("solid_stock", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _is_plane(face):
    try:
        return face.Surface.TypeId == "Part::GeomPlane"
    except Exception:
        return False


def planar_area(shape):
    """Total area of the shape's planar faces."""
    total = 0.0
    try:
        faces = shape.Faces
    except Exception:
        return 0.0
    for face in faces:
        if not _is_plane(face):
            continue
        try:
            total += float(face.Area or 0.0)
        except Exception:
            continue
    return total


def planar_area_fraction(shape):
    """Share of the surface that is planar, 0..1."""
    try:
        total = float(shape.Area or 0.0)
    except Exception:
        total = 0.0
    return planar_area(shape) / total if total > 0 else 0.0


def is_sheet_metal_candidate(shape):
    return planar_area_fraction(shape) >= SHEET_MIN_PLANAR_FRACTION


def round_stock_dims(shape):
    """
    Diameter and straight length of a bar, rod or pipe, or None.

    Exactly two planar end faces of the same size whose edges are all circles
    or ellipses (a bar cut at a slight angle, as the cassette rebars are, has
    elliptical ends; a pipe's end is a ring of two circles). The radius comes
    from the lateral cylinder face when there is one, the length from
    volume / cross-section, so a bar reports its cut length rather than the
    bounding box it happens to lie in.
    """
    caps = []
    try:
        faces = shape.Faces
    except Exception:
        return None
    for face in faces:
        if not _is_plane(face):
            continue
        radii = []
        for edge in face.Edges:
            try:
                curve = edge.Curve
                if curve.TypeId == "Part::GeomCircle":
                    radii.append(float(curve.Radius))
                elif curve.TypeId == "Part::GeomEllipse":
                    radii.append(float(curve.MinorRadius))
                else:
                    return None
            except Exception:
                return None
        if not radii:
            return None
        try:
            normal = face.normalAt(0, 0)
        except Exception:
            normal = None
        caps.append({"area": float(face.Area or 0.0), "outer": max(radii), "normal": normal})
        if len(caps) > 2:
            return None
    if len(caps) != 2:
        return None
    cap_a, cap_b = caps
    if cap_a["area"] <= 0 or cap_b["area"] <= 0:
        return None
    if abs(cap_a["area"] - cap_b["area"]) / max(cap_a["area"], cap_b["area"]) > 0.02:
        return None
    if abs(cap_a["outer"] - cap_b["outer"]) / max(cap_a["outer"], cap_b["outer"], 1e-9) > 0.02:
        return None

    radius = max(cap_a["outer"], cap_b["outer"])
    cos_theta = 1.0
    cylinders = []
    for face in faces:
        try:
            if face.Surface.TypeId == "Part::GeomCylinder":
                cylinders.append(face)
        except Exception:
            continue
    if cylinders:
        lateral = max(cylinders, key=lambda f: float(f.Area or 0.0))
        try:
            lateral_radius = float(lateral.Surface.Radius)
            if abs(lateral_radius - radius) / max(radius, 1e-9) > 0.05:
                return None
            radius = lateral_radius
            if cap_a["normal"] is not None:
                cos_theta = abs(float(lateral.Surface.Axis.dot(cap_a["normal"])))
                cos_theta = min(1.0, max(cos_theta, 0.2))
        except Exception:
            pass

    try:
        volume = float(shape.Volume or 0.0)
    except Exception:
        volume = 0.0
    # An oblique cut makes the end face larger than the cross-section by 1/cos.
    cross_section = ((cap_a["area"] + cap_b["area"]) / 2.0) * cos_theta
    length = volume / cross_section if volume > 0 and cross_section > 0 else None
    return {"diameter": 2.0 * radius, "length": length}
