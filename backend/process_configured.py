import sys
import json
import os
import cadquery as cq

def process_configured_model(input_path, output_path, configuration_json):
    """
    Physical hole cutting into a STEP file based on configuration metadata.
    """
    try:
        # Load the base model
        model = cq.importer.importStep(input_path)
        
        config = json.loads(configuration_json)
        selected_taps = config.get('selectedTaps', {})
        
        if not selected_taps:
            # Just copy the file if no modifications needed
            model.exportStep(output_path)
            return True

        # Perform the cuts
        # active_model = model
        
        # We collect all "hole tools" and cut them at once
        cutting_tools = []
        
        for tap_id, tap_info in selected_taps.items():
            hole_data = tap_info.get('hole')
            if not hole_data:
                continue
                
            pos = hole_data.get('position') # {x, y, z}
            diameter = hole_data.get('diameterInches', 0) * 25.4 # convert to mm
            # We use a slightly longer cylinder to ensure a clean cut
            height = 100 
            
            if pos:
                # Create a cylinder tool at the hole position
                # Note: OpenCASCADE/CadQuery coordinates might need alignment with Three.js
                tool = cq.Workplane("XY").center(pos['x'], pos['y']).cboreHole(diameter, diameter, height)
                # For simplicity in this specialized script, we use a basic cylinder
                # In a production environment, we'd align the normal vector of the face
                tool = cq.Workplane("XY").workplane(offset=pos['z'] - (height/2)).center(pos['x'], pos['y']).circle(diameter/2).extrude(height)
                cutting_tools.append(tool)

        if cutting_tools:
            # Union all tools and cut from base
            for tool in cutting_tools:
                model = model.cut(tool)
        
        # Export the modified geometry
        model.exportStep(output_path)
        return True

    except Exception as e:
        print(f"Error processing configured model: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python process_configured.py <input_step> <output_step> <config_json>")
        sys.exit(1)
        
    in_path = sys.argv[1]
    out_path = sys.argv[2]
    config_str = sys.argv[3]
    
    success = process_configured_model(in_path, out_path, config_str)
    if success:
        sys.exit(0)
    else:
        sys.exit(1)
