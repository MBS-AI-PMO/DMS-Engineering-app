import sys
sys.path.insert(0, r"d:/Frontend/DMS/backend")
import unfold_lib as u
shape = u.Part.read(r"d:/Frontend/DMS/backend/uploads/orders/1775045005846_345.STEP")
holes = u.detect_holes_fc(shape)
print("holes=", len(holes))
if holes:
    print(holes[0])
