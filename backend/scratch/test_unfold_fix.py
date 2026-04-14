import sys
import os
import json

# Add backend to path
sys.path.append(os.getcwd())

from unfold_lib import unfold_with_lib

def test_unfold():
    test_files = [
        # Put some test step file paths here if available
    ]
    
    for f in test_files:
        if os.path.exists(f):
            print(f"Testing {f}...")
            try:
                result = unfold_with_lib(f)
                print(f"Success! BBox: {result['bbox']}")
            except Exception as e:
                print(f"Failed: {e}")

if __name__ == "__main__":
    # If I had a sample file, I would run it. 
    # Since I don't, I'll just check if the module imports correctly.
    print("Checking unfold_lib import...")
    import unfold_lib
    print("Import successful.")
