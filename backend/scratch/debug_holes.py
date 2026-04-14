
import sys
import os
import json
import numpy as np
import math

# Add current dir to path
sys.path.append(os.getcwd())

from unfold import detect_holes_in_step, _get_faces, _classify_face, _face_area, _compute_cluster_angular_span
import cadquery as cq

def debug_holes(filepath):
    shape = cq.importers.importStep(filepath)
    occ_shape = shape.val().wrapped
    faces = _get_faces(occ_shape)
    face_info = [_classify_face(f) for f in faces]
    
    # Run the detection
    holes = detect_holes_in_step(filepath)
    print(f"Detected {len(holes)} holes.")
    
    for h in holes:
        print(f"Hole {h['id']}: Dia {h['diameter_mm']}mm, Pos {h['position']}")

if __name__ == "__main__":
    test_file = r"d:\Frontend\DMS\backend\temp_uploads\1775124366814_22.stp"
    debug_holes(test_file)
