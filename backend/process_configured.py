import sys
import json
import os
import math
import re
import cadquery as cq
from pathlib import Path

def hex_to_rgb(hex_str):
    """Converts #RRGGBB to (r, g, b) normalized 0.0-1.0"""
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 3:
        hex_str = ''.join([c*2 for c in hex_str])
    r, g, b = tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))
    return (r / 255.0, g / 255.0, b / 255.0)


def parse_numeric(value):
    """Parse numeric strings like '0.313\"', '82', '.25', or '1/4'."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip().lower()
    if not text:
        return None

    text = (
        text
        .replace('inches', '')
        .replace('inch', '')
        .replace('in', '')
        .replace('mm', '')
        .replace('"', '')
    ).strip()

    if not text:
        return None

    if '/' in text:
        parts = text.split('/', 1)
        try:
            num = float(parts[0].strip())
            den = float(parts[1].strip())
            if abs(den) > 1e-9:
                return num / den
        except Exception:
            pass

    try:
        return float(text)
    except Exception:
        pass

    match = re.search(r'-?\d*\.?\d+(?:/\d*\.?\d+)?', text)
    if not match:
        return None

    token = match.group(0)
    if '/' in token:
        try:
            n, d = token.split('/', 1)
            n = float(n.strip())
            d = float(d.strip())
            if abs(d) > 1e-9:
                return n / d
        except Exception:
            return None

    try:
        return float(token)
    except Exception:
        return None


def parse_inches_to_mm(value):
    parsed = parse_numeric(value)
    if parsed is None:
        return None
    return parsed * 25.4


SCREW_GAUGE_MAJOR_IN = {
    0: 0.060,
    1: 0.073,
    2: 0.086,
    3: 0.099,
    4: 0.112,
    5: 0.125,
    6: 0.138,
    8: 0.164,
    10: 0.190,
    12: 0.216,
}


def parse_size_spec_major_diameter_in(size_spec):
    if size_spec is None:
        return None

    raw = str(size_spec).strip().upper()
    if not raw:
        return None

    normalized = re.sub(r'\s+', '', raw)

    # Metric thread, e.g. M3x0.5 -> 3.0 mm major diameter.
    metric_match = re.match(r'^M(\d+(?:\.\d+)?)', normalized)
    if metric_match:
        try:
            major_mm = float(metric_match.group(1))
            if major_mm > 0:
                return major_mm / 25.4
        except Exception:
            pass

    # Fractional imperial, e.g. 1/4-20.
    frac_match = re.match(r'^(\d+)/(\d+)-\d+', normalized)
    if frac_match:
        try:
            num = float(frac_match.group(1))
            den = float(frac_match.group(2))
            if abs(den) > 1e-9:
                return num / den
        except Exception:
            pass

    # Numbered imperial, e.g. #6-32 or 6-32.
    gauge_match = re.match(r'^#?(\d+)-\d+', normalized)
    if gauge_match:
        try:
            gauge = int(gauge_match.group(1))
            return SCREW_GAUGE_MAJOR_IN.get(gauge)
        except Exception:
            pass

    return None


def resolve_nut_target_diameter_mm(item_data):
    if not isinstance(item_data, dict):
        return None

    # 1) Explicit bore fields if provided.
    for key in ('minor_dia', 'major_dia'):
        explicit_mm = parse_inches_to_mm(item_data.get(key))
        if explicit_mm is not None and explicit_mm > 0:
            return explicit_mm

    # 2) Infer from thread size spec (most reliable in this catalog).
    size_spec = item_data.get('size_spec') or item_data.get('name')
    major_in = parse_size_spec_major_diameter_in(size_spec)
    if major_in is not None and major_in > 0:
        # Slight clearance so visual/physical fit matches hardware insertion intent.
        return major_in * 25.4 * 1.02

    # 3) Optional shank only when it looks like a real inch diameter.
    shank_in = parse_numeric(item_data.get('shank'))
    if shank_in is not None and 0.04 <= shank_in <= 0.6:
        return shank_in * 25.4

    # 4) Tooling diameter is a last resort and often not the thread bore for nuts.
    tooling_in = parse_numeric(item_data.get('tooling_diameter'))
    base_width_in = parse_numeric(item_data.get('base_width'))
    if tooling_in is not None and tooling_in > 0:
        if base_width_in is None or tooling_in < (base_width_in * 0.9):
            return tooling_in * 25.4

    return None


def hole_diameter_mm(hole_data):
    """Extract hole diameter in mm from supported payload keys."""
    if not isinstance(hole_data, dict):
        return None

    dia_mm = parse_numeric(hole_data.get('diameter_mm'))
    if dia_mm is not None and dia_mm > 0:
        return dia_mm

    dia_in = parse_numeric(hole_data.get('diameter_in'))
    if dia_in is None:
        dia_in = parse_numeric(hole_data.get('diameterInches'))
    if dia_in is not None and dia_in > 0:
        return dia_in * 25.4

    return None


def make_axis_cylinder(origin, axis, radius, height):
    """Create a cylinder centered at origin and aligned to axis."""
    plane = cq.Plane(origin=cq.Vector(*origin), normal=cq.Vector(*axis))
    safe_radius = max(float(radius), 0.01)
    safe_height = max(float(height), 0.1)
    return (
        cq.Workplane(plane)
        .workplane(offset=-(safe_height * 0.5))
        .circle(safe_radius)
        .extrude(safe_height)
        .val()
    )


def parse_vector3(value):
    """Accept [x,y,z] or {x,y,z}."""
    if isinstance(value, (list, tuple)) and len(value) >= 3:
        return (float(value[0]), float(value[1]), float(value[2]))
    if isinstance(value, dict):
        return (
            float(value.get('x', 0.0)),
            float(value.get('y', 0.0)),
            float(value.get('z', 0.0)),
        )
    return None


def normalize_vector3(vec, fallback=(0.0, 0.0, 1.0)):
    if vec is None:
        vec = fallback
    x, y, z = vec
    mag = math.sqrt(x * x + y * y + z * z)
    if mag < 1e-9:
        x, y, z = fallback
        mag = math.sqrt(x * x + y * y + z * z)
        if mag < 1e-9:
            return (0.0, 0.0, 1.0)
    return (x / mag, y / mag, z / mag)

def process_configured_model(input_path, output_path, configuration_json):
    """
    Physical hole cutting (taps + hardware fit + countersinks) and high-fidelity coloring.
    """
    try:
        print(f"[CAD-KERNEL] Processing: {input_path}")
        # Load the base model
        model = cq.importers.importStep(input_path)
        
        # Robust JSON Loading
        if os.path.exists(configuration_json):
            with open(configuration_json, "r", encoding="utf-8") as f:
                config = json.load(f)
        else:
            config = json.loads(configuration_json)
            
        selected_taps = config.get('selectedTaps', {})
        selected_hardware = config.get('selectedHardware', {})
        selected_countersinks = config.get('selectedCountersinks', {})
        print(
            f"[CAD-KERNEL] Found {len(selected_taps)} tapped holes, "
            f"{len(selected_hardware)} hardware assignments and {len(selected_countersinks)} countersinks to process."
        )

        thickness_mm = parse_numeric(config.get('thickness'))
        if thickness_mm is None:
            thickness_mm = parse_numeric((config.get('dimensions') or {}).get('mm', {}).get('t'))
        if thickness_mm is None or thickness_mm <= 0:
            thickness_mm = 2.0
        
        # 1. Perform Tapping Cuts
        if selected_taps:
            for tap_id, tap_info in selected_taps.items():
                if not tap_info: continue 
                hole_data = tap_info.get('hole')
                if not hole_data: continue
                
                pos = hole_data.get('position')
                diameter = hole_data.get('diameterInches', 0) * 25.4 
                height = 200 # Extra length for through-hole
                
                if pos:
                    # Robust parsing for [x,y,z] OR {x,y,z}
                    if isinstance(pos, dict):
                        px, py, pz = pos.get('x', 0), pos.get('y', 0), pos.get('z', 0)
                    elif isinstance(pos, (list, tuple)) and len(pos) >= 3:
                        px, py, pz = pos[0], pos[1], pos[2]
                    else:
                        px, py, pz = 0, 0, 0
                    
                    print(f"[CAD-KERNEL] CUTTING HOLE: id={tap_id}, x={px:.2f}, y={py:.2f}, z={pz:.2f}, dia={diameter:.2f}mm")
                    
                    # Create cutting tool shape at the exact DESIGN coordinates
                    tool = cq.Workplane("XY").workplane(offset=pz - (height/2)).center(px, py).circle(diameter/2).extrude(height).val()
                    # Apply cut directly to the shape
                    model = cq.Workplane(model.val().cut(tool))

        # 1.5 Resize holes for nut hardware (type 3/4): shrink oversized or enlarge undersized.
        if selected_hardware and isinstance(selected_hardware, dict):
            for hw_id, hw_info in selected_hardware.items():
                if not hw_info or not isinstance(hw_info, dict):
                    continue

                hw_type = parse_numeric(hw_info.get('typeId'))
                if hw_type is None or int(hw_type) not in (3, 4):
                    continue

                hole_data = hw_info.get('hole') or {}
                item_data = hw_info.get('item') or {}

                hole_pos = parse_vector3(hole_data.get('position'))
                if hole_pos is None:
                    print(f"[CAD-KERNEL] Skip nut resize {hw_id}: missing hole position")
                    continue

                hole_axis = normalize_vector3(parse_vector3(hole_data.get('axis')), fallback=(0.0, 0.0, 1.0))
                original_hole_dia_mm = hole_diameter_mm(hole_data)

                target_dia_mm = resolve_nut_target_diameter_mm(item_data)

                if target_dia_mm is None or target_dia_mm <= 0:
                    print(f"[CAD-KERNEL] Skip nut resize {hw_id}: missing target bore diameter")
                    continue

                target_hole_r = max((target_dia_mm / 2.0) - 0.002, 0.01)

                # If source hole diameter is unknown, still enforce target by cutting to bore size.
                if original_hole_dia_mm is None or original_hole_dia_mm <= 0:
                    original_hole_dia_mm = 0.0

                original_hole_r = original_hole_dia_mm / 2.0
                resize_tol = 0.02
                radius_delta = original_hole_r - target_hole_r
                if abs(radius_delta) <= resize_tol:
                    continue

                hole_depth_mm = parse_numeric(hole_data.get('depth_mm'))
                if hole_depth_mm is None:
                    hole_depth_mm = parse_numeric(hole_data.get('depthMm'))
                if hole_depth_mm is None:
                    hole_depth_mm = parse_inches_to_mm(hole_data.get('depthInches'))
                local_thickness = hole_depth_mm if (hole_depth_mm and hole_depth_mm > 0) else thickness_mm

                try:
                    if radius_delta > 0:
                        # Hole is too large: fill then re-drill to target.
                        fill_overrun = 0.02
                        resize_depth = max(local_thickness + fill_overrun, 0.6)
                        plug_radius = original_hole_r + 0.02
                        plug = make_axis_cylinder(hole_pos, hole_axis, plug_radius, resize_depth)
                        model = cq.Workplane(model.val().fuse(plug)).clean()

                        pilot_depth = max(local_thickness + 0.08, 0.7)
                        pilot = make_axis_cylinder(hole_pos, hole_axis, target_hole_r, pilot_depth)
                        model = cq.Workplane(model.val().cut(pilot)).clean()
                        direction = "reduced"
                    else:
                        # Hole is too small (or unknown): open it directly to target.
                        pilot_depth = max(local_thickness + 0.08, 0.7)
                        pilot = make_axis_cylinder(hole_pos, hole_axis, target_hole_r, pilot_depth)
                        model = cq.Workplane(model.val().cut(pilot)).clean()
                        direction = "enlarged"

                    print(
                        f"[CAD-KERNEL] RESIZED HOLE FOR NUT(type={int(hw_type)}): id={hw_id}, "
                        f"{direction}, original={original_hole_dia_mm:.3f}mm -> target={target_dia_mm:.3f}mm"
                    )
                except Exception as hw_resize_err:
                    print(f"[CAD-KERNEL] Failed nut resize {hw_id}: {hw_resize_err}")
        
        # 2. Perform Countersink Cuts
        if selected_countersinks:
            for cs_id, cs_info in selected_countersinks.items():
                if not cs_info:
                    continue

                hole_data = cs_info.get('hole') or {}
                hole_pos = parse_vector3(hole_data.get('position'))
                if hole_pos is None:
                    print(f"[CAD-KERNEL] Skip countersink {cs_id}: missing hole position")
                    continue

                hole_axis = normalize_vector3(parse_vector3(hole_data.get('axis')), fallback=(0.0, 0.0, 1.0))
                original_hole_dia_mm = hole_diameter_mm(hole_data)

                major_dia_mm = parse_inches_to_mm(cs_info.get('major_dia'))
                minor_dia_mm = parse_inches_to_mm(cs_info.get('minor_dia'))

                if minor_dia_mm is None:
                    minor_dia_mm = original_hole_dia_mm

                if major_dia_mm is None and minor_dia_mm is not None:
                    major_dia_mm = minor_dia_mm * 1.4

                if major_dia_mm is None or minor_dia_mm is None:
                    print(f"[CAD-KERNEL] Skip countersink {cs_id}: missing diameters")
                    continue

                major_r = max(major_dia_mm, minor_dia_mm) / 2.0
                minor_r = min(major_dia_mm, minor_dia_mm) / 2.0
                if major_r <= (minor_r + 1e-5):
                    print(f"[CAD-KERNEL] Skip countersink {cs_id}: invalid radii")
                    continue

                angle_deg = parse_numeric(cs_info.get('angle'))
                if angle_deg is None or angle_deg <= 1 or angle_deg >= 179:
                    angle_deg = 82.0

                tangent = math.tan(math.radians(angle_deg / 2.0))
                if abs(tangent) < 1e-9:
                    print(f"[CAD-KERNEL] Skip countersink {cs_id}: invalid angle {angle_deg}")
                    continue

                cone_depth_mm = (major_r - minor_r) / tangent
                if cone_depth_mm <= 0:
                    print(f"[CAD-KERNEL] Skip countersink {cs_id}: non-positive cone depth")
                    continue

                hole_depth_mm = parse_numeric(hole_data.get('depth_mm'))
                if hole_depth_mm is None:
                    hole_depth_mm = parse_numeric(hole_data.get('depthMm'))
                if hole_depth_mm is None:
                    hole_depth_mm = parse_inches_to_mm(hole_data.get('depthInches'))
                local_thickness = hole_depth_mm if (hole_depth_mm and hole_depth_mm > 0) else thickness_mm

                # If the existing hole is larger than the countersink's minor diameter,
                # rebuild that bore first so the countersink fits correctly.
                original_hole_r = (original_hole_dia_mm / 2.0) if original_hole_dia_mm else None
                oversize_tol = 0.02
                if original_hole_r is not None and original_hole_r > (minor_r + oversize_tol):
                    try:
                        # Fill oversized bores almost flush to avoid any raised witness ring,
                        # then heal split faces so the patch blends like native geometry.
                        fill_overrun = 0.02
                        resize_depth = max(local_thickness + fill_overrun, 0.6)
                        plug_radius = original_hole_r + 0.02
                        plug = make_axis_cylinder(hole_pos, hole_axis, plug_radius, resize_depth)
                        model = cq.Workplane(model.val().fuse(plug)).clean()

                        target_hole_radius = max(minor_r - 0.002, 0.01)
                        pilot_depth = max(local_thickness + 0.08, 0.7)
                        pilot = make_axis_cylinder(hole_pos, hole_axis, target_hole_radius, pilot_depth)
                        model = cq.Workplane(model.val().cut(pilot)).clean()

                        print(
                            f"[CAD-KERNEL] RESIZED HOLE FOR COUNTERSINK: id={cs_id}, "
                            f"original={original_hole_dia_mm:.3f}mm -> target={minor_dia_mm:.3f}mm"
                        )
                    except Exception as resize_err:
                        print(f"[CAD-KERNEL] Failed hole resize for countersink {cs_id}: {resize_err}")

                max_depth = max(0.2, local_thickness * 0.95)
                cone_depth_mm = min(cone_depth_mm, max_depth)

                face_sign = -1.0 if str(cs_info.get('face', 'up')).lower() == 'down' else 1.0
                inward_dir = normalize_vector3(
                    (-hole_axis[0] * face_sign, -hole_axis[1] * face_sign, -hole_axis[2] * face_sign),
                    fallback=(0.0, 0.0, -1.0 if face_sign > 0 else 1.0)
                )

                surface_center = (
                    hole_pos[0] + hole_axis[0] * face_sign * (local_thickness * 0.5),
                    hole_pos[1] + hole_axis[1] * face_sign * (local_thickness * 0.5),
                    hole_pos[2] + hole_axis[2] * face_sign * (local_thickness * 0.5),
                )

                # Start very slightly outside the face to avoid tolerance leftovers.
                entry_origin = (
                    surface_center[0] - inward_dir[0] * 0.05,
                    surface_center[1] - inward_dir[1] * 0.05,
                    surface_center[2] - inward_dir[2] * 0.05,
                )
                tool_depth = cone_depth_mm + 0.08

                try:
                    cut_plane = cq.Plane(
                        origin=cq.Vector(*entry_origin),
                        normal=cq.Vector(*inward_dir)
                    )
                    tool = (
                        cq.Workplane(cut_plane)
                        .circle(max(major_r, 0.05))
                        .workplane(offset=max(tool_depth, 0.1))
                        .circle(max(minor_r, 0.01))
                        .loft(combine=True)
                        .val()
                    )

                    print(
                        f"[CAD-KERNEL] CUTTING COUNTERSINK: id={cs_id}, "
                        f"major={major_dia_mm:.3f}mm, minor={minor_dia_mm:.3f}mm, depth={cone_depth_mm:.3f}mm, "
                        f"face={'down' if face_sign < 0 else 'up'}"
                    )
                    model = cq.Workplane(model.val().cut(tool)).clean()

                    # Add a subtle opposite-face witness ring visual.
                    back_face_sign = -face_sign
                    back_inward_dir = normalize_vector3(
                        (-hole_axis[0] * back_face_sign, -hole_axis[1] * back_face_sign, -hole_axis[2] * back_face_sign),
                        fallback=(0.0, 0.0, 1.0 if face_sign > 0 else -1.0)
                    )
                    back_surface_center = (
                        hole_pos[0] + hole_axis[0] * back_face_sign * (local_thickness * 0.5),
                        hole_pos[1] + hole_axis[1] * back_face_sign * (local_thickness * 0.5),
                        hole_pos[2] + hole_axis[2] * back_face_sign * (local_thickness * 0.5),
                    )
                    back_entry_origin = (
                        back_surface_center[0] - back_inward_dir[0] * 0.03,
                        back_surface_center[1] - back_inward_dir[1] * 0.03,
                        back_surface_center[2] - back_inward_dir[2] * 0.03,
                    )

                    witness_depth = min(max(0.06, cone_depth_mm * 0.12), max(0.12, local_thickness * 0.2))
                    witness_inner_r = max(minor_r * 1.01, minor_r + 0.01)
                    witness_outer_r = min(max(witness_inner_r + 0.05, minor_r * 1.35), major_r * 0.92)

                    if witness_outer_r > witness_inner_r + 1e-4 and witness_depth > 0:
                        witness_plane = cq.Plane(
                            origin=cq.Vector(*back_entry_origin),
                            normal=cq.Vector(*back_inward_dir)
                        )
                        witness_tool = (
                            cq.Workplane(witness_plane)
                            .circle(witness_outer_r)
                            .circle(witness_inner_r)
                            .extrude(max(witness_depth, 0.02))
                            .val()
                        )
                        model = cq.Workplane(model.val().cut(witness_tool)).clean()
                except Exception as cut_err:
                    print(f"[CAD-KERNEL] Failed countersink cut {cs_id}: {cut_err}")

        # 3. Apply Visual Finishes
        anodizing_color = config.get('anodizingColor')
        if isinstance(anodizing_color, dict):
            hex_color = anodizing_color.get('color') or anodizing_color.get('hex') or '#2f2f2f'
        elif isinstance(anodizing_color, str) and anodizing_color.strip():
            hex_color = anodizing_color.strip()
        else:
            hex_color = '#2f2f2f'
        rgb = hex_to_rgb(hex_color)
        part_color = cq.Color(rgb[0], rgb[1], rgb[2], 1.0)

        # 4. Wrapping in Assembly
        assy = cq.Assembly(model, color=part_color, name="Configured_Manufacturing_Part")
                
        # Export the Final Production Asset
        path_obj = Path(output_path)
        path_obj.parent.mkdir(parents=True, exist_ok=True)
        assy.save(output_path, "STEP")
        print(f"[CAD-KERNEL] Success: Configured model saved to {output_path}")
        return True

    except Exception as e:
        print(f"[CAD-KERNEL] CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python process_configured.py <input_step> <output_step> <config_json>")
        sys.exit(1)
        
    in_path = sys.argv[1]
    out_path = sys.argv[2]
    config_file = sys.argv[3]
    
    success = process_configured_model(in_path, out_path, config_file)
    if success:
        sys.exit(0)
    else:
        sys.exit(1)
