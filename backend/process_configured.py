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


def resolve_local_hole_depth_mm(hole_data, fallback_thickness_mm):
    """Return a sane local wall depth for sheet operations."""
    hole_depth_mm = parse_numeric(hole_data.get('depth_mm'))
    if hole_depth_mm is None:
        hole_depth_mm = parse_numeric(hole_data.get('depthMm'))
    if hole_depth_mm is None:
        hole_depth_mm = parse_inches_to_mm(hole_data.get('depthInches'))

    fallback = fallback_thickness_mm if (fallback_thickness_mm and fallback_thickness_mm > 0) else 2.0
    if hole_depth_mm is None or hole_depth_mm <= 0:
        return fallback

    # A depth much larger than sheet thickness usually means detection merged
    # two coaxial wall holes across empty space. Cut only through the local wall.
    suspicious_limit = max(fallback * 2.25, fallback + 1.0, 4.0)
    if hole_depth_mm > suspicious_limit:
        return fallback
    return hole_depth_mm


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


def resolve_standoff_target_diameter_mm(item_data):
    if not isinstance(item_data, dict):
        return None

    # Primary fit driver for standoffs: tooling diameter.
    tooling_mm = parse_inches_to_mm(item_data.get('tooling_diameter'))
    if tooling_mm is not None and tooling_mm > 0:
        return tooling_mm

    # Secondary fit sources.
    shank_mm = parse_inches_to_mm(item_data.get('shank'))
    if shank_mm is not None and shank_mm > 0:
        return shank_mm

    minor_mm = parse_inches_to_mm(item_data.get('minor_dia'))
    if minor_mm is not None and minor_mm > 0:
        return minor_mm

    major_mm = parse_inches_to_mm(item_data.get('major_dia'))
    if major_mm is not None and major_mm > 0:
        return major_mm

    # Last fallback from thread notation.
    size_spec = item_data.get('size_spec') or item_data.get('name')
    major_in = parse_size_spec_major_diameter_in(size_spec)
    if major_in is not None and major_in > 0:
        return major_in * 25.4

    return None


def resolve_stud_target_diameter_mm(item_data):
    if not isinstance(item_data, dict):
        return None

    # Flush stud fit is primarily driven by shank diameter.
    shank_mm = parse_inches_to_mm(item_data.get('shank'))
    if shank_mm is not None and shank_mm > 0:
        return shank_mm

    # Tooling diameter is typically aligned with stud insertion hole.
    tooling_mm = parse_inches_to_mm(item_data.get('tooling_diameter'))
    if tooling_mm is not None and tooling_mm > 0:
        return tooling_mm

    # Secondary fit sources.
    minor_mm = parse_inches_to_mm(item_data.get('minor_dia'))
    if minor_mm is not None and minor_mm > 0:
        return minor_mm

    major_mm = parse_inches_to_mm(item_data.get('major_dia'))
    if major_mm is not None and major_mm > 0:
        return major_mm

    # Last fallback from thread notation.
    size_spec = item_data.get('size_spec') or item_data.get('name')
    major_in = parse_size_spec_major_diameter_in(size_spec)
    if major_in is not None and major_in > 0:
        return major_in * 25.4

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
    safe_radius = max(float(radius), 0.01)
    safe_height = max(float(height), 0.1)

    try:
        plane = cq.Plane(origin=cq.Vector(*origin), normal=cq.Vector(*axis))
        return (
            cq.Workplane(plane)
            .workplane(offset=-(safe_height * 0.5))
            .circle(safe_radius)
            .extrude(safe_height)
            .val()
        )
    except Exception as workplane_err:
        # Live environments with incompatible multimethod builds can fail inside Workplane API calls
        # (for example: "multidispatch object has no attribute signature").
        # Fall back to OCP primitive construction so preview hole resizing still works.
        msg = str(workplane_err).lower()
        if ('multidispatch' not in msg) and ('signature' not in msg):
            raise

        from OCP.gp import gp_Ax2, gp_Pnt, gp_Dir
        from OCP.BRepPrimAPI import BRepPrimAPI_MakeCylinder

        ox, oy, oz = origin
        ax, ay, az = axis
        half = safe_height * 0.5
        base = gp_Pnt(float(ox - ax * half), float(oy - ay * half), float(oz - az * half))
        direction = gp_Dir(float(ax), float(ay), float(az))
        ax2 = gp_Ax2(base, direction)
        shape = BRepPrimAPI_MakeCylinder(ax2, safe_radius, safe_height).Shape()
        return cq.Shape.cast(shape)


def make_axis_cone(origin, axis, radius_start, radius_end, height):
    """Create a cone/frustum starting at origin and extending along axis."""
    safe_radius_start = max(float(radius_start), 0.01)
    safe_radius_end = max(float(radius_end), 0.01)
    safe_height = max(float(height), 0.1)

    if abs(safe_radius_start - safe_radius_end) < 1e-6:
        # make_axis_cylinder expects center-origin; shift forward by half height.
        center_origin = (
            float(origin[0]) + float(axis[0]) * (safe_height * 0.5),
            float(origin[1]) + float(axis[1]) * (safe_height * 0.5),
            float(origin[2]) + float(axis[2]) * (safe_height * 0.5),
        )
        return make_axis_cylinder(center_origin, axis, safe_radius_start, safe_height)

    try:
        plane = cq.Plane(origin=cq.Vector(*origin), normal=cq.Vector(*axis))
        return (
            cq.Workplane(plane)
            .circle(safe_radius_start)
            .workplane(offset=safe_height)
            .circle(safe_radius_end)
            .loft(combine=True)
            .val()
        )
    except Exception as workplane_err:
        msg = str(workplane_err).lower()
        if ('multidispatch' not in msg) and ('signature' not in msg):
            raise

        from OCP.gp import gp_Ax2, gp_Pnt, gp_Dir
        from OCP.BRepPrimAPI import BRepPrimAPI_MakeCone

        ox, oy, oz = origin
        ax, ay, az = axis
        base = gp_Pnt(float(ox), float(oy), float(oz))
        direction = gp_Dir(float(ax), float(ay), float(az))
        ax2 = gp_Ax2(base, direction)
        shape = BRepPrimAPI_MakeCone(ax2, safe_radius_start, safe_radius_end, safe_height).Shape()
        return cq.Shape.cast(shape)


def _shape_of(model_obj):
    return model_obj.val() if hasattr(model_obj, 'val') else model_obj


def _apply_cut(model_obj, tool_shape, preview_mode, clean_each_step):
    base = _shape_of(model_obj)
    result = base.cut(tool_shape)
    if preview_mode:
        return result
    return maybe_clean(cq.Workplane(result), clean_each_step)


def _apply_fuse(model_obj, tool_shape, preview_mode, clean_each_step):
    base = _shape_of(model_obj)
    result = base.fuse(tool_shape)
    if preview_mode:
        return result
    return maybe_clean(cq.Workplane(result), clean_each_step)


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


def maybe_clean(workplane_obj, do_clean=True):
    if not do_clean:
        return workplane_obj
    try:
        return workplane_obj.clean()
    except Exception:
        return workplane_obj


def bore_resize_tools(hole_pos, hole_axis, original_dia_mm, target_dia_mm, local_thickness, outer_dia_mm=None):
    """The tools that make a through-hole exactly the target size.

    Too small: a pilot cuts it bigger. Too big: a plug fills it flush with the
    wall, then the pilot cuts the target hole. `outer_dia_mm` is the hole's
    widest point (an existing countersink or counterbore rim); when it is
    wider than the target, the plug fills out to it, so no old cone or step
    is left. Returns (plug or None, pilot or None, action) with action
    'unchanged', 'enlarged' or 'filled'. The hole position is mid-wall.
    """
    target_r = float(target_dia_mm) / 2.0
    original_r = (float(original_dia_mm) / 2.0) if original_dia_mm else 0.0
    outer_r = max(original_r, (float(outer_dia_mm) / 2.0) if outer_dia_mm else 0.0)
    if original_r > 0 and abs(original_r - target_r) <= 0.02 and outer_r <= original_r + 0.02:
        return None, None, 'unchanged'

    plug = None
    action = 'enlarged'
    if outer_r > target_r + 0.02:
        # Exactly the wall's thickness, centred mid-wall, so its ends lie in
        # the part's own faces and merge into them. Any extra height would
        # leave a raised disc on both faces.
        plug = make_axis_cylinder(hole_pos, hole_axis, outer_r + 0.02, max(local_thickness, 0.1))
        action = 'filled'

    pilot = make_axis_cylinder(hole_pos, hole_axis, max(target_r - 0.002, 0.01), max(local_thickness + 0.08, 0.7))
    return plug, pilot, action


def _apply_batch(model, tools, op, preview_mode, clean_each_step, label):
    """Apply many tools in one boolean (much faster than one per hole).

    The holes never overlap, so one fuse or cut with all the tools gives the
    same part as doing them one by one. If the kernel rejects the batch, fall
    back to one by one so a single awkward hole cannot lose the others.
    """
    tools = [tool for tool in tools if tool is not None]
    if not tools:
        return model
    try:
        tool = tools[0] if len(tools) == 1 else cq.Compound.makeCompound(tools)
        model = op(model, tool, preview_mode, clean_each_step)
        print(f"[CAD-KERNEL] Batched {label}: {len(tools)} in one pass")
        return model
    except Exception as batch_err:
        print(f"[CAD-KERNEL] Batched {label} failed ({batch_err}); applying one by one")
    for index, tool in enumerate(tools):
        try:
            model = op(model, tool, preview_mode, clean_each_step)
        except Exception as one_err:
            print(f"[CAD-KERNEL] {label} #{index + 1} failed: {one_err}")
    return model


def hole_outer_diameter_mm(hole_data):
    """The widest point of a hole: its countersink/counterbore rim if any."""
    rim_mm = parse_numeric((hole_data or {}).get('rim_diameter_mm'))
    return rim_mm if rim_mm is not None and rim_mm > 0 else None


def tap_target_diameter_mm(tap_info, original_dia_mm, outer_dia_mm=None):
    """The hole a tap needs, from the admin's hole range for that thread.

    Returns (target_mm, needs_resize). A plain hole already inside the range
    is left alone; any other hole (including one with an old countersink or
    counterbore around it) is re-cut to the middle of the range.
    """
    min_mm = parse_inches_to_mm(tap_info.get('min_diameter'))
    max_mm = parse_inches_to_mm(tap_info.get('max_diameter'))
    if not min_mm or not max_mm or min_mm <= 0 or max_mm < min_mm:
        return original_dia_mm, False
    has_rim = bool(outer_dia_mm and original_dia_mm and outer_dia_mm > original_dia_mm + 0.04)
    if not has_rim and original_dia_mm and (min_mm - 0.01) <= original_dia_mm <= (max_mm + 0.01):
        return original_dia_mm, False
    return (min_mm + max_mm) / 2.0, True

def process_configured_model(input_path, output_path, configuration_json, mode='full', report_output_path=None):
    """
    Physical hole cutting (taps + hardware fit + countersinks) and high-fidelity coloring.
    """
    try:
        mode_key = str(mode or 'full').strip().lower()
        preview_mode = mode_key == 'preview'
        clean_each_step = not preview_mode

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
        
        # 1. Perform Tapping Cuts (all holes gathered, then applied together)
        if selected_taps:
            tap_plugs = []
            tap_pilots = []
            for tap_id, tap_info in selected_taps.items():
                if not tap_info:
                    continue

                hole_data = tap_info.get('hole') or {}
                hole_pos = parse_vector3(hole_data.get('position'))
                if hole_pos is None:
                    print(f"[CAD-KERNEL] Skip tap {tap_id}: missing hole position")
                    continue

                hole_axis = normalize_vector3(parse_vector3(hole_data.get('axis')), fallback=(0.0, 0.0, 1.0))

                target_dia_mm = hole_diameter_mm(hole_data)
                if target_dia_mm is None or target_dia_mm <= 0:
                    # Fallback for legacy tap payloads
                    target_dia_mm = parse_inches_to_mm(hole_data.get('diameterInches'))
                if target_dia_mm is None or target_dia_mm <= 0:
                    print(f"[CAD-KERNEL] Skip tap {tap_id}: missing hole diameter")
                    continue

                local_thickness = resolve_local_hole_depth_mm(hole_data, thickness_mm)

                # Any thread can go in any hole: the hole is re-cut to the
                # size that thread needs (cut bigger, or filled and re-cut).
                original_dia_mm = target_dia_mm
                outer_dia_mm = hole_outer_diameter_mm(hole_data)
                target_dia_mm, needs_resize = tap_target_diameter_mm(tap_info, original_dia_mm, outer_dia_mm)

                print(
                    f"[CAD-KERNEL] TAP HOLE: id={tap_id}, "
                    f"pos=({hole_pos[0]:.2f},{hole_pos[1]:.2f},{hole_pos[2]:.2f}), "
                    f"axis=({hole_axis[0]:.3f},{hole_axis[1]:.3f},{hole_axis[2]:.3f}), "
                    f"hole={original_dia_mm:.3f}mm -> {target_dia_mm:.3f}mm, wall={local_thickness:.3f}mm"
                )

                # A hole already in the thread's range needs no cut at all.
                if not needs_resize:
                    print(f"[CAD-KERNEL] Tap hole {tap_id} unchanged")
                    continue
                try:
                    plug, pilot, action = bore_resize_tools(
                        hole_pos, hole_axis, original_dia_mm, target_dia_mm,
                        local_thickness, outer_dia_mm=outer_dia_mm,
                    )
                    tap_plugs.append(plug)
                    tap_pilots.append(pilot)
                    print(f"[CAD-KERNEL] Tap hole {tap_id} {action}")
                except Exception as tap_cut_err:
                    print(f"[CAD-KERNEL] Failed tap tools {tap_id}: {tap_cut_err}")

            model = _apply_batch(model, tap_plugs, _apply_fuse, preview_mode, clean_each_step, 'tap fills')
            model = _apply_batch(model, tap_pilots, _apply_cut, preview_mode, clean_each_step, 'tap holes')

        hardware_resize_report = {}
        hardware_plugs = []
        hardware_pilots = []

        # 1.5 Resize holes for hardware requiring bore fit (flush studs + standoffs + nuts):
        # shrink oversized bores or enlarge undersized bores.
        if selected_hardware and isinstance(selected_hardware, dict):
            for hw_id, hw_info in selected_hardware.items():
                hw_key = str(hw_id)
                if not hw_info or not isinstance(hw_info, dict):
                    hardware_resize_report[hw_key] = {
                        'action': 'skipped',
                        'reason': 'invalid_hardware_config',
                    }
                    continue

                hw_type = parse_numeric(hw_info.get('typeId'))
                if hw_type is None:
                    hardware_resize_report[hw_key] = {
                        'action': 'skipped',
                        'reason': 'missing_type',
                    }
                    continue

                hw_type_int = int(hw_type)
                if hw_type_int not in (1, 2, 3, 4):
                    continue

                hole_data = hw_info.get('hole') or {}
                item_data = hw_info.get('item') or {}

                hole_pos = parse_vector3(hole_data.get('position'))
                if hole_pos is None:
                    print(f"[CAD-KERNEL] Skip hardware resize {hw_id}: missing hole position")
                    hardware_resize_report[hw_key] = {
                        'type': hw_type_int,
                        'action': 'skipped',
                        'reason': 'missing_hole_position',
                    }
                    continue

                hole_axis = normalize_vector3(parse_vector3(hole_data.get('axis')), fallback=(0.0, 0.0, 1.0))
                original_hole_dia_mm = hole_diameter_mm(hole_data)

                if hw_type_int in (3, 4):
                    target_dia_mm = resolve_nut_target_diameter_mm(item_data)
                elif hw_type_int == 2:
                    target_dia_mm = resolve_standoff_target_diameter_mm(item_data)
                else:
                    target_dia_mm = resolve_stud_target_diameter_mm(item_data)

                if target_dia_mm is None or target_dia_mm <= 0:
                    print(f"[CAD-KERNEL] Skip hardware resize {hw_id}: missing target bore diameter")
                    hardware_resize_report[hw_key] = {
                        'type': hw_type_int,
                        'action': 'skipped',
                        'reason': 'missing_target_diameter',
                    }
                    continue

                # If source hole diameter is unknown, still enforce target by cutting to bore size.
                if original_hole_dia_mm is None or original_hole_dia_mm <= 0:
                    original_hole_dia_mm = 0.0

                local_thickness = resolve_local_hole_depth_mm(hole_data, thickness_mm)
                outer_dia_mm = hole_outer_diameter_mm(hole_data)

                # The same re-cut as taps and countersinks: too small is cut
                # bigger; too big is filled (out to any countersink or
                # counterbore rim) and cut again at the size the part needs.
                try:
                    plug, pilot, action = bore_resize_tools(
                        hole_pos, hole_axis, original_hole_dia_mm, target_dia_mm,
                        local_thickness, outer_dia_mm=outer_dia_mm,
                    )
                except Exception as hw_resize_err:
                    print(f"[CAD-KERNEL] Failed hardware resize {hw_id}: {hw_resize_err}")
                    hardware_resize_report[hw_key] = {
                        'type': hw_type_int,
                        'action': 'failed',
                        'reason': str(hw_resize_err),
                        'original_dia_mm': round(original_hole_dia_mm, 6),
                        'target_dia_mm': round(target_dia_mm, 6),
                    }
                    continue

                if action == 'unchanged':
                    hardware_resize_report[hw_key] = {
                        'type': hw_type_int,
                        'action': 'unchanged',
                        'direction': 'none',
                        'original_dia_mm': round(original_hole_dia_mm, 6),
                        'target_dia_mm': round(target_dia_mm, 6),
                    }
                    continue

                hardware_plugs.append(plug)
                hardware_pilots.append(pilot)
                direction = 'reduced' if action == 'filled' else 'enlarged'
                print(
                    f"[CAD-KERNEL] RESIZED HOLE FOR HARDWARE(type={hw_type_int}): id={hw_id}, "
                    f"{direction}, original={original_hole_dia_mm:.3f}mm -> target={target_dia_mm:.3f}mm"
                )
                hardware_resize_report[hw_key] = {
                    'type': hw_type_int,
                    'action': 'resized',
                    'direction': direction,
                    'original_dia_mm': round(original_hole_dia_mm, 6),
                    'target_dia_mm': round(target_dia_mm, 6),
                }

            model = _apply_batch(model, hardware_plugs, _apply_fuse, preview_mode, clean_each_step, 'hardware fills')
            model = _apply_batch(model, hardware_pilots, _apply_cut, preview_mode, clean_each_step, 'hardware holes')

        # 2. Perform Countersink Cuts (all holes gathered, then applied together)
        if selected_countersinks:
            cs_plugs = []
            cs_pilots = []
            cs_cones = []
            cs_witnesses = []
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

                local_thickness = resolve_local_hole_depth_mm(hole_data, thickness_mm)

                # Any countersink can go on any hole: the through-hole becomes
                # the countersink's minor diameter first (cut bigger, or filled
                # and re-cut), then the cone is cut into it.
                try:
                    plug, pilot, action = bore_resize_tools(
                        hole_pos, hole_axis, original_hole_dia_mm, minor_r * 2.0,
                        local_thickness, outer_dia_mm=hole_outer_diameter_mm(hole_data),
                    )
                    cs_plugs.append(plug)
                    cs_pilots.append(pilot)
                    print(
                        f"[CAD-KERNEL] COUNTERSINK HOLE {cs_id}: {action}, "
                        f"{(original_hole_dia_mm or 0.0):.3f}mm -> {minor_r * 2.0:.3f}mm"
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

                # The cone, from the chosen face inward. A kernel that cannot
                # loft it gets a plain recess so the countersink still shows.
                try:
                    cone_tool = make_axis_cone(
                        entry_origin,
                        inward_dir,
                        max(major_r, 0.05),
                        max(minor_r, 0.01),
                        max(tool_depth, 0.1)
                    )
                except Exception as cone_err:
                    print(f"[CAD-KERNEL] Cone tool failed for countersink {cs_id}: {cone_err}")
                    try:
                        cone_tool = make_axis_cylinder(
                            entry_origin,
                            inward_dir,
                            max(major_r, 0.05),
                            max(tool_depth, 0.1)
                        )
                    except Exception as recess_err:
                        print(f"[CAD-KERNEL] Recess tool failed for countersink {cs_id}: {recess_err}")
                        cone_tool = None
                cs_cones.append(cone_tool)
                print(
                    f"[CAD-KERNEL] COUNTERSINK {cs_id}: "
                    f"major={major_dia_mm:.3f}mm, minor={minor_dia_mm:.3f}mm, depth={cone_depth_mm:.3f}mm, "
                    f"face={'down' if face_sign < 0 else 'up'}"
                )

                # The witness-ring detail is only needed in final manufacturing output.
                if preview_mode:
                    continue
                try:
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
                        cs_witnesses.append(
                            cq.Workplane(witness_plane)
                            .circle(witness_outer_r)
                            .circle(witness_inner_r)
                            .extrude(max(witness_depth, 0.02))
                            .val()
                        )
                except Exception as witness_err:
                    print(f"[CAD-KERNEL] Failed witness ring {cs_id}: {witness_err}")

            model = _apply_batch(model, cs_plugs, _apply_fuse, preview_mode, clean_each_step, 'countersink fills')
            model = _apply_batch(model, cs_pilots, _apply_cut, preview_mode, clean_each_step, 'countersink holes')
            model = _apply_batch(model, cs_cones, _apply_cut, preview_mode, clean_each_step, 'countersink cones')
            model = _apply_batch(model, cs_witnesses, _apply_cut, preview_mode, clean_each_step, 'countersink witness rings')

        # Export the final asset; preview mode skips expensive assembly/color wrapping.
        path_obj = Path(output_path)
        path_obj.parent.mkdir(parents=True, exist_ok=True)
        if preview_mode:
            # One tidy-up for the whole preview (full mode cleans every step):
            # each fill plug merges into the face it fills, so a filled hole's
            # old edge does not show on the part as a ring.
            shape = maybe_clean(cq.Workplane(_shape_of(model)), True).val()
            cq.exporters.export(shape, output_path)
        else:
            anodizing_color = config.get('anodizingColor')
            if isinstance(anodizing_color, dict):
                hex_color = anodizing_color.get('color') or anodizing_color.get('hex') or '#2f2f2f'
            elif isinstance(anodizing_color, str) and anodizing_color.strip():
                hex_color = anodizing_color.strip()
            else:
                hex_color = '#2f2f2f'
            rgb = hex_to_rgb(hex_color)
            part_color = cq.Color(rgb[0], rgb[1], rgb[2], 1.0)
            assy = cq.Assembly(model, color=part_color, name="Configured_Manufacturing_Part")
            assy.save(output_path, "STEP")

        if report_output_path:
            try:
                report_obj = {
                    'hardwareResize': hardware_resize_report,
                }
                report_path_obj = Path(report_output_path)
                report_path_obj.parent.mkdir(parents=True, exist_ok=True)
                report_path_obj.write_text(json.dumps(report_obj), encoding='utf-8')
            except Exception as report_err:
                print(f"[CAD-KERNEL] Failed writing report JSON: {report_err}")

        print(f"[CAD-KERNEL] Success: Configured model saved to {output_path}")
        return True

    except Exception as e:
        print(f"[CAD-KERNEL] CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python process_configured.py <input_step> <output_step> <config_json> [--mode=full|preview] [--report-json=<path>]")
        sys.exit(1)
        
    in_path = sys.argv[1]
    out_path = sys.argv[2]
    config_file = sys.argv[3]
    mode = 'full'
    report_json_path = None
    for arg in sys.argv[4:]:
        if isinstance(arg, str) and arg.startswith('--mode='):
            mode = arg.split('=', 1)[1].strip() or 'full'
        elif isinstance(arg, str) and arg.startswith('--report-json='):
            report_json_path = arg.split('=', 1)[1].strip() or None
    
    success = process_configured_model(in_path, out_path, config_file, mode=mode, report_output_path=report_json_path)
    if success:
        sys.exit(0)
    else:
        sys.exit(1)
