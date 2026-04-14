import Part, json
shape = Part.read(r"d:/Frontend/DMS/backend/uploads/orders/1775045005846_345.STEP")
counts = {}
for f in shape.Faces:
    t = f.Surface.TypeId
    counts[t] = counts.get(t, 0) + 1
print(json.dumps(counts))
