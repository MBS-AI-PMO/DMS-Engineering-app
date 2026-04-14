import json
try:
    with open('scratch/345_unfold_result_v2.json', 'r') as f:
        data = json.load(f)
        print(f"Vertices: {len(data.get('flatVertices', []))}")
        print(f"Edges: {len(data.get('cutEdges', []))}")
        print(f"BBox: {data.get('bbox')}")
        print(f"Thickness: {data.get('thickness')}")
except Exception as e:
    print(f"Error: {e}")
