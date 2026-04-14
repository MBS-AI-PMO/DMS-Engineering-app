import sys
import os
import json

# Set up FreeCAD paths
fc_bin = r"C:\Users\User\AppData\Local\Programs\FreeCAD 1.0\bin"
if fc_bin not in sys.path:
    sys.path.append(fc_bin)
if os.path.exists(fc_bin):
    os.environ["PATH"] = fc_bin + os.pathsep + os.environ.get("PATH", "")

import Part
import FreeCAD

# Import libraries from current directory
sys.path.append('.')
from unfold_lib import unfold_with_lib

def find_successful_root(filepath):
    # This is a modified version of unfold_with_lib that prints debug info
    fc_shape = Part.Shape()
    fc_shape.read(filepath)
    
    potential_roots = []
    for i, face in enumerate(fc_shape.Faces):
        if face.Surface.TypeId == "Part::GeomPlane":
            potential_roots.append({"index": i, "area": face.Area})
    
    potential_roots.sort(key=lambda x: -x["area"])
    
    print(f"Total potential roots: {len(potential_roots)}")
    
    for i, p in enumerate(potential_roots[:20]):
        root_idx = p['index']
        print(f"Testing Root {i}: Index {root_idx}, Area {p['area']:.2f}")
        try:
            res = unfold_with_lib(filepath) # This runs the whole thing
            # We can't easily see which root it used unless we modify unfold_lib.py
            # But we can check the bbox of the result
            print(f"  Result BBox: {res.get('bbox')}")
            break
        except Exception as e:
            print(f"  FAILED: {e}")

if __name__ == "__main__":
    find_successful_root('temp_uploads/1775560749838_345.STEP')
