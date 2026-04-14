import sys
import os

# Set up FreeCAD paths
fc_bin = r"C:\Users\User\AppData\Local\Programs\FreeCAD 1.0\bin"
if fc_bin not in sys.path:
    sys.path.append(fc_bin)
if os.path.exists(fc_bin):
    os.environ["PATH"] = fc_bin + os.pathsep + os.environ.get("PATH", "")

import Part
import FreeCAD
from FreeCAD import Vector

def debug_step(filepath):
    s = Part.Shape()
    s.read(filepath)
    print(f"Total Faces: {len(s.Faces)}")
    
    planes = {}
    for i, f in enumerate(s.Faces):
        if f.Surface.TypeId == 'Part::GeomPlane':
            # Use normal and distance from origin as key
            n = f.Surface.Axis
            p = f.Surface.Position
            dist = p.dot(n)
            # Round for tolerance
            key = (round(n.x, 3), round(n.y, 3), round(n.z, 3), round(dist, 2))
            planes.setdefault(key, []).append({
                "index": i,
                "area": f.Area
            })
    
    print("\nPlanes found:")
    for key, faces in planes.items():
        total_area = sum(f['area'] for f in faces)
        print(f"Plane {key}: Total Area {total_area:.2f}, Face Count {len(faces)}, Max Single Face {max(f['area'] for f in faces):.2f}")

if __name__ == "__main__":
    debug_step('temp_uploads/1775560749838_345.STEP')
