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
    Physical hole cutting (taps + countersinks) and high-fidelity coloring.
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
        selected_countersinks = config.get('selectedCountersinks', {})
        print(f"[CAD-KERNEL] Found {len(selected_taps)} tapped holes and {len(selected_countersinks)} countersinks to process.")

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

                major_dia_mm = parse_inches_to_mm(cs_info.get('major_dia'))
                minor_dia_mm = parse_inches_to_mm(cs_info.get('minor_dia'))

                if minor_dia_mm is None:
                    minor_dia_mm = parse_numeric(hole_data.get('diameter_mm'))
                if minor_dia_mm is None:
                    hole_dia_in = parse_numeric(hole_data.get('diameter_in'))
                    if hole_dia_in is None:
                        hole_dia_in = parse_numeric(hole_data.get('diameterInches'))
                    if hole_dia_in is not None:
                        minor_dia_mm = hole_dia_in * 25.4

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
                    model = cq.Workplane(model.val().cut(tool))
                except Exception as cut_err:
                    print(f"[CAD-KERNEL] Failed countersink cut {cs_id}: {cut_err}")

        # 3. Apply Visual Finishes
        hex_color = config.get('anodizingColor', {}).get('color', '#808080')
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
