"""
Simple HTTP backend for STEP file processing and sheet metal unfolding.
Uses cadquery (OpenCASCADE) for precise B-Rep geometry handling.
Zero extra dependencies beyond cadquery — uses Python's built-in http.server.
"""
import os
import json
import tempfile
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from unfold import unfold_step_file

PORT = 8000


class CORSHandler(BaseHTTPRequestHandler):
    """Minimal handler with CORS support for the React frontend."""

    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._set_cors()
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok"}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path != "/unfold":
            self.send_response(404)
            self.end_headers()
            return

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

            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(file_content)
                tmp_path = tmp.name

            try:
                result = unfold_step_file(tmp_path)
                self._send_json(200, result)
            except Exception as e:
                traceback.print_exc()
                self._send_error(500, f"Unfolding failed: {str(e)}")
            finally:
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
                    start = line.index('filename="') + 10
                    end = line.index('"', start)
                    filename = line[start:end]
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
        print(f"[unfold-backend] {args[0]}")


if __name__ == "__main__":
    print(f"\033[47m\033[30m [PYTHON] Starting unfold backend on http://localhost:{PORT} \033[0m")
    print("Press Ctrl+C to stop")
    server = HTTPServer(("0.0.0.0", PORT), CORSHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()
