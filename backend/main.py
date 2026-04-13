import os
import platform
from dotenv import load_dotenv

# 1. Load environment variables BEFORE doing anything else
load_dotenv()

os.environ["QT_QPA_PLATFORM"] = "offscreen"
os.environ["OCP_NO_DISPLAY"] = "1"
import json
import tempfile
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn  # Added for handling multiple requests
import subprocess
import shlex
import math
import numpy as np
import threading
from unfold import unfold_step_file, detect_holes_in_step

# Global lock to prevent Out-Of-Memory by serializing heavy geometry tasks
geometry_lock = threading.Lock()

def _json_safe(obj):
    """Recursively convert NaNs, Infinites, and NumPy types for JSON compatibility."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return obj
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.float64) or isinstance(obj, np.float32):
        return float(obj)
    elif isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    elif isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    return obj

# Use Environment Variables for the Port
PORT = int(os.getenv("PYTHON_PORT", 8000))
# Add Threading support so the server doesn't freeze during heavy 3D math
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class CORSHandler(BaseHTTPRequestHandler):
    """Minimal handler with CORS support for the React frontend."""

    def _set_cors(self):
        # Change "*" to your specific frontend URL later for better security
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"status": "ok", "engine": "FreeCAD/CadQuery"})
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/unfold":
            # Use the new robust library if available
            self._process_step_file(self.unfold_with_lib_subprocess, lambda r: r)
        elif self.path == "/detect-holes":
            self._process_step_file(self.unfold_with_lib_subprocess, lambda r: {
                "holes": r.get("detectedHoles", []),
                "faceMeshes": r.get("faceMeshes", {}),
                "bendTree": r.get("bendTree", None),
                "thickness": r.get("thickness", 2.0)
            })
        else:
            self.send_response(404)
            self.end_headers()

    def _process_step_file(self, processor, wrap):
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._send_error(400, "Expected multipart/form-data")
            return

        try:
            boundary = content_type.split("boundary=")[1].strip()
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            file_content, filename = self._parse_multipart(body, boundary)
            if file_content is None:
                self._send_error(400, "No file found in upload")
                return

            ext = os.path.splitext(filename)[1].lower() if filename else ".step"
            if ext not in (".step", ".stp"):
                self._send_error(400, f"Unsupported file type: {ext}")
                return

            # Use a secure temp directory
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(file_content)
                tmp_path = tmp.name

            try:
                # Actual 3D processing happens here
                result = processor(tmp_path)
                self._send_json(200, wrap(result))
            except Exception as e:
                traceback.print_exc()
                self._send_error(500, f"Processing failed: {str(e)}")
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        except Exception as e:
            traceback.print_exc()
            self._send_error(500, f"Server error: {str(e)}")

    def _parse_multipart(self, body, boundary):
        """Simple multipart parser — extracts the first file part."""
        boundary_bytes = boundary.encode()
        parts = body.split(b"--" + boundary_bytes)
        for part in parts:
            if b"filename=" not in part:
                continue
            header_end = part.find(b"\r\n\r\n")
            if header_end < 0:
                continue
            header = part[:header_end].decode("utf-8", errors="replace")
            content = part[header_end + 4:]
            if content.endswith(b"\r\n"):
                content = content[:-2]

            filename = ""
            for line in header.split("\r\n"):
                if "filename=" in line:
                    try:
                        start = line.index('filename="') + 10
                        end = line.index('"', start)
                        filename = line[start:end]
                    except ValueError:
                        pass
                    break
            return content, filename
        return None, None

    def _send_json(self, code, data):
        payload = json.dumps(_json_safe(data)).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self._set_cors()
        self.end_headers()
        self.wfile.write(payload)

    def _send_error(self, code, message):
        self._send_json(code, {"error": message})

    def unfold_with_lib_subprocess(self, filepath):
        """Calls unfold_lib.py using the specialized FreeCAD interpreter and merges with legacy metadata."""
        
        # 2. Make the fallback path OS-aware so it doesn't crash on Linux if the .env fails
        if platform.system() == "Windows":
            default_freecad = r"C:\Users\User\AppData\Local\Programs\FreeCAD 1.0\bin\freecadcmd.exe"
        else:
            default_freecad = "/usr/bin/freecadcmd"

        freecad_path = os.getenv("FREECAD_PATH", default_freecad)
        
        # If FREECAD_PATH points to the cmd/exe, we likely want the python.exe in the same folder for subprocess
        if freecad_path.endswith("freecadcmd.exe"):
            freecad_python = freecad_path.replace("freecadcmd.exe", "python.exe")
        elif freecad_path.endswith("freecadcmd"):
            freecad_python = freecad_path # On Linux they might be the same or handled by the wrapper
        else:
            freecad_python = freecad_path

        script_path = os.getenv("UNFOLD_LIB_PATH", os.path.join(os.path.dirname(__file__), "unfold_lib.py"))
        
        cmd = [freecad_python, script_path, filepath]
        print(f"[Python-API] Executing robust unfold pass...")
        try:
            # Pass 1: Get professional flat pattern, bend tree, silhouettes, and holes
            # Apply global lock to protect server RAM during heavy FreeCAD run
            with geometry_lock:
                print(f"[Python-API] Lock acquired for model processing...")
                proc = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=90)
                result = json.loads(proc.stdout)

            # All metadata (silhouettes, holes, faceMeshes) is now integrated 
            # into the primary Pass 1 from unfold_lib.py. 
            # We no longer need to call the legacy OCC-based unfold_step_file.
            return result
        except subprocess.CalledProcessError as e:
            print(f"[Python-API] Robust unfold failed (Exit {e.returncode}). Output:")
            print(f"STDOUT: {e.stdout}")
            print(f"STDERR: {e.stderr}")
            print(f"[Python-API] Falling back to legacy engine...")
            return unfold_step_file(filepath)
        except Exception as e:
            print(f"[Python-API] Merge pass unexpected error: {str(e)}")
            traceback.print_exc()
            return unfold_step_file(filepath)

    def log_message(self, format, *args):
        # Cleaner logging for PM2 logs
        print(f"[Python-API] {args[1]} {args[0]}")


if __name__ == "__main__":
    # Ensure it listens on 0.0.0.0 to be accessible via AWS Public IP
    print(f"\n\033[92m[DMS-PYTHON] Starting Engine on Port {PORT}...\033[0m")
    server = ThreadedHTTPServer(("0.0.0.0", PORT), CORSHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()