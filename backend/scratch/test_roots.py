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
from FreeCAD import Vector, Matrix
import networkx as nx

# Import the local libraries
sys.path.append('.')
from unfold_lib import unfold_with_lib
from lib_unfold.unfold import build_graph_of_tangent_faces

def test_roots(filepath):
    s = Part.Shape()
    s.read(filepath)
    
    potential_roots = []
    for i, face in enumerate(s.Faces):
        if face.Surface.TypeId == "Part::GeomPlane":
            potential_roots.append({"index": i, "area": face.Area, "normal": face.Surface.Axis})
    
    potential_roots.sort(key=lambda x: -x["area"])
    
    print(f"Top 10 potential roots:")
    for i, p in enumerate(potential_roots[:10]):
        idx = p['index']
        normal = p['normal']
        print(f"Candidate {i}: Index {idx}, Area {p['area']:.1f}, Normal {normal}")
        
        try:
            graph = build_graph_of_tangent_faces(s, idx)
            edges = graph.number_of_edges()
            nodes = graph.number_of_nodes()
            print(f"  Graph: {nodes} nodes, {edges} edges")
        except Exception as e:
            print(f"  Graph Build Failed: {e}")

if __name__ == "__main__":
    test_roots('temp_uploads/1775560749838_345.STEP')
