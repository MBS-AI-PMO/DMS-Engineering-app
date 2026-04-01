import sys
import json
import os
import cadquery as cq
from pathlib import Path

def hex_to_rgb(hex_str):
    """Converts #RRGGBB to (r, g, b) normalized 0.0-1.0"""
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 3:
        hex_str = ''.join([c*2 for c in hex_str])
    r, g, b = tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))
    return (r / 255.0, g / 255.0, b / 255.0)

def process_configured_model(input_path, output_path, configuration_json):
    """
    Physical hole cutting and high-fidelity coloring with coordinate logging
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
        print(f"[CAD-KERNEL] Found {len(selected_taps)} tapped holes to process.")
        
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
        
        # 2. Apply Visual Finishes
        hex_color = config.get('anodizingColor', {}).get('color', '#808080')
        rgb = hex_to_rgb(hex_color)
        part_color = cq.Color(rgb[0], rgb[1], rgb[2], 1.0)

        # 3. Wrapping in Assembly
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
