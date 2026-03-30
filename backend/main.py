
import os
os.environ["QT_QPA_PLATFORM"] = "offscreen"
os.environ["OCP_NO_DISPLAY"] = "1"
import json
import tempfile
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn  # Added for handling multiple requests
from unfold import unfold_step_file, detect_holes_in_step

# 1. Use Environment Variables for the Port
PORT = int(os.getenv("PORT", 8000))

# 2. Add Threading support so the server doesn't freeze during heavy 3D math
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
            self._process_step_file(unfold_step_file, lambda r: r)
        elif self.path == "/detect-holes":
            self._process_step_file(detect_holes_in_step, lambda r: {"holes": r})
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
        payload = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self._set_cors()
        self.end_headers()
        self.wfile.write(payload)

    def _send_error(self, code, message):
        self._send_json(code, {"error": message})

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