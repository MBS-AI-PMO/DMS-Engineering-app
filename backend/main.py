import os
import tempfile
import traceback
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from unfold import unfold_step_file

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/unfold")
async def unfold_step(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.step', '.stp')):
        raise HTTPException(400, "Only STEP/STP files supported")

    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = unfold_step_file(tmp_path)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Unfolding failed: {str(e)}")
    finally:
        os.unlink(tmp_path)
