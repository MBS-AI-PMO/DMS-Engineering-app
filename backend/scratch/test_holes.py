
import sys
import os
import json
import traceback

# Add current dir to path
sys.path.append(os.getcwd())

from unfold import detect_holes_in_step

if __name__ == "__main__":
    test_file = r"d:\Frontend\DMS\backend\temp_uploads\1775124366814_22.stp"
    try:
        print(f"Testing detect_holes_in_step for {test_file}...")
        holes = detect_holes_in_step(test_file)
        print(f"Holes found: {len(holes)}")
        print(json.dumps(holes, indent=2))
    except Exception as e:
        traceback.print_exc()
