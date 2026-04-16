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
import shutil
import numpy as np
import threading
import uuid
import time
from urllib.parse import urlparse, parse_qs
from unfold import unfold_step_file, detect_holes_in_step

# Global lock to prevent Out-Of-Memory by serializing heavy geometry tasks
geometry_lock = threading.Lock()
UNFOLD_PROGRESS_PREFIX = "__PROGRESS__"
UNFOLD_JOB_TTL_SECONDS = 15 * 60
GEOMETRY_LOCK_WAIT_TIMEOUT_SECONDS = int(os.getenv("GEOMETRY_LOCK_WAIT_TIMEOUT_SECONDS", "180"))
FREECAD_WORKER_TIMEOUT_SECONDS = int(os.getenv("FREECAD_WORKER_TIMEOUT_SECONDS", "420"))
unfold_jobs = {}
unfold_jobs_lock = threading.Lock()


def _set_unfold_job(job_id, **fields):
    now = time.time()
    with unfold_jobs_lock:
        job = unfold_jobs.get(job_id, {})
        job.update(fields)
        job["updated_at"] = now
        if "created_at" not in job:
            job["created_at"] = now
        unfold_jobs[job_id] = job
        return dict(job)


def _get_unfold_job(job_id):
    with unfold_jobs_lock:
        job = unfold_jobs.get(job_id)
        return dict(job) if job else None


def _cleanup_unfold_jobs():
    cutoff = time.time() - UNFOLD_JOB_TTL_SECONDS
    with unfold_jobs_lock:
        stale_ids = [job_id for job_id, job in unfold_jobs.items() if job.get("updated_at", 0) < cutoff]
        for job_id in stale_ids:
            unfold_jobs.pop(job_id, None)


def _resolve_freecad_executable():
    """Resolve the best available FreeCAD command for unfold worker subprocesses."""
    env_path = str(os.getenv("FREECAD_PATH", "")).strip()
    if env_path and os.path.exists(env_path):
        return env_path

    candidates = []
    if platform.system() == "Windows":
        candidates.extend([
            r"C:\Users\User\AppData\Local\Programs\FreeCAD 1.0\bin\freecadcmd.exe",
        ])
    else:
        candidates.extend([
            "/home/ec2-user/miniconda/envs/cadquery-env/bin/freecadcmd",
            "/usr/local/bin/freecadcmd",
            "/usr/bin/freecadcmd",
        ])

    for path in candidates:
        if os.path.exists(path):
            return path

    which_path = shutil.which("freecadcmd")
    if which_path:
        return which_path

    return env_path or candidates[-1]

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
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json(200, {"status": "ok", "engine": "FreeCAD/CadQuery"})
        elif parsed.path == "/unfold-job/status":
            self._handle_unfold_job_status(parsed)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        post_path = self.path.split("?", 1)[0]
        if post_path == "/unfold":
            # Use the new robust library if available
            self._process_step_file(
                lambda fp: self.unfold_with_lib_subprocess(fp, profile="fast2d"),
                lambda r: r
            )
        elif post_path == "/detect-holes":
            self._process_step_file(
                lambda fp: self.unfold_with_lib_subprocess(fp, profile="holes_fast"),
                lambda r: {
                "holes": r.get("detectedHoles", []),
                "faceMeshes": r.get("faceMeshes", {}),
                "bendTree": r.get("bendTree", None),
                "thickness": r.get("thickness", 2.0)
                }
            )
        elif post_path == "/unfold-job/start":
            self._start_unfold_job()
        else:
            self.send_response(404)
            self.end_headers()

    def _save_uploaded_step_file(self):
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._send_error(400, "Expected multipart/form-data")
            return None, None

        try:
            boundary = content_type.split("boundary=")[1].strip()
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            file_content, filename = self._parse_multipart(body, boundary)
            if file_content is None:
                self._send_error(400, "No file found in upload")
                return None, None

            ext = os.path.splitext(filename)[1].lower() if filename else ".step"
            if ext not in (".step", ".stp"):
                self._send_error(400, f"Unsupported file type: {ext}")
                return None, None

            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(file_content)
                return tmp.name, filename
        except Exception as e:
            traceback.print_exc()
            self._send_error(500, f"Server error: {str(e)}")
            return None, None

    def _process_step_file(self, processor, wrap):
        tmp_path, _filename = self._save_uploaded_step_file()
        if not tmp_path:
            return

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

    def _start_unfold_job(self):
        tmp_path, _filename = self._save_uploaded_step_file()
        if not tmp_path:
            return

        job_id = uuid.uuid4().hex
        _set_unfold_job(
            job_id,
            status="queued",
            percent=0.0,
            stage="Queued",
            result=None,
            error=None,
        )

        worker = threading.Thread(
            target=self._run_unfold_job,
            args=(job_id, tmp_path),
            daemon=True,
        )
        worker.start()
        self._send_json(200, {"success": True, "jobId": job_id})

    def _run_unfold_job(self, job_id, tmp_path):
        def on_progress(percent, stage):
            _set_unfold_job(
                job_id,
                status="running",
                percent=max(0.0, min(100.0, float(percent))),
                stage=str(stage or "Processing"),
            )

        try:
            on_progress(2, "Preparing CAD engine")
            result = self.unfold_with_lib_subprocess(
                tmp_path,
                profile="fast2d",
                progress_callback=on_progress,
            )
            _set_unfold_job(
                job_id,
                status="completed",
                percent=100.0,
                stage="Completed",
                result=result,
                error=None,
            )
        except Exception as e:
            traceback.print_exc()
            _set_unfold_job(
                job_id,
                status="failed",
                percent=100.0,
                stage="Failed",
                error=str(e),
            )
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def _handle_unfold_job_status(self, parsed):
        _cleanup_unfold_jobs()
        params = parse_qs(parsed.query)
        job_id = (params.get("jobId") or [None])[0]
        if not job_id:
            self._send_error(400, "jobId is required")
            return

        job = _get_unfold_job(job_id)
        if not job:
            self._send_error(404, "Job not found")
            return

        payload = {
            "success": True,
            "jobId": job_id,
            "status": job.get("status", "queued"),
            "percent": job.get("percent", 0.0),
            "stage": job.get("stage", "Queued"),
        }
        if job.get("status") == "completed":
            payload["result"] = job.get("result")
        if job.get("status") == "failed":
            payload["error"] = job.get("error") or "Unfold job failed"

        self._send_json(200, payload)

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

    def unfold_with_lib_subprocess(self, filepath, profile="full", progress_callback=None):
        """Calls unfold_lib.py using the specialized FreeCAD interpreter and merges with legacy metadata."""

        freecad_path = _resolve_freecad_executable()

        # If FREECAD_PATH points to the cmd/exe, we likely want the python.exe in the same folder for subprocess
        if freecad_path.endswith("freecadcmd.exe"):
            freecad_python = freecad_path.replace("freecadcmd.exe", "python.exe")
        elif freecad_path.endswith("freecadcmd"):
            freecad_python = freecad_path # On Linux they might be the same or handled by the wrapper
        else:
            freecad_python = freecad_path

        script_path = os.getenv("UNFOLD_LIB_PATH", os.path.join(os.path.dirname(__file__), "unfold_lib.py"))

        cmd = [freecad_python, script_path, filepath, f"--profile={profile}"]
        print(f"[Python-API] Executing robust unfold pass...")
        print(f"[Python-API] CAD worker binary: {freecad_python}")

        def _report_progress(percent, stage):
            if not progress_callback:
                return
            try:
                progress_callback(float(percent), stage)
            except Exception:
                pass

        def _consume_stderr_line(raw_line):
            line = raw_line.rstrip("\r\n")
            if line.startswith(UNFOLD_PROGRESS_PREFIX):
                payload_text = line[len(UNFOLD_PROGRESS_PREFIX):]
                try:
                    payload = json.loads(payload_text)
                    _report_progress(payload.get("percent", 0.0), payload.get("stage", "Processing"))
                except Exception:
                    print(f"[Python-API] Progress parse warning: {payload_text}")
            elif line:
                print(f"[Python-API] {line}")

        try:
            # Pass 1: Get professional flat pattern, bend tree, silhouettes, and holes
            # Apply global lock to protect server RAM during heavy FreeCAD run.
            # Do not wait forever: if lock is blocked too long, fail clearly.
            lock_wait_started = time.time()
            while not geometry_lock.acquire(timeout=1):
                waited = int(time.time() - lock_wait_started)
                _report_progress(2, f"Queued: waiting for CAD worker ({waited}s)")
                if waited >= GEOMETRY_LOCK_WAIT_TIMEOUT_SECONDS:
                    raise TimeoutError(
                        f"Timed out waiting for CAD worker lock after {GEOMETRY_LOCK_WAIT_TIMEOUT_SECONDS}s"
                    )

            try:
                print(f"[Python-API] Lock acquired for model processing...")
                _report_progress(4, "Starting FreeCAD worker")
                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                )

                stdout_chunks = []
                stderr_chunks = []

                def _read_stdout():
                    try:
                        for out_line in proc.stdout:
                            stdout_chunks.append(out_line)
                    except Exception:
                        pass

                def _read_stderr():
                    try:
                        for err_line in proc.stderr:
                            stderr_chunks.append(err_line)
                            _consume_stderr_line(err_line)
                    except Exception:
                        pass

                stdout_thread = threading.Thread(target=_read_stdout, daemon=True)
                stderr_thread = threading.Thread(target=_read_stderr, daemon=True)
                stdout_thread.start()
                stderr_thread.start()

                timed_out = False
                return_code = 1
                try:
                    return_code = proc.wait(timeout=FREECAD_WORKER_TIMEOUT_SECONDS)
                except subprocess.TimeoutExpired:
                    timed_out = True
                    try:
                        proc.kill()
                    except Exception:
                        pass
                    try:
                        proc.wait(timeout=5)
                    except Exception:
                        pass

                stdout_thread.join(timeout=2)
                stderr_thread.join(timeout=2)

                stdout_text = "".join(stdout_chunks).strip()
                stderr_text = "".join(stderr_chunks).strip()

                if timed_out:
                    raise RuntimeError(
                        f"FreeCAD worker timed out after {FREECAD_WORKER_TIMEOUT_SECONDS}s"
                    )

                if return_code != 0:
                    raise subprocess.CalledProcessError(
                        return_code,
                        cmd,
                        output=stdout_text,
                        stderr=stderr_text,
                    )

                if not stdout_text:
                    raise RuntimeError("Unfold subprocess returned empty output")

                result_line = stdout_text.splitlines()[-1]
                result = json.loads(result_line)
                _report_progress(100, "Completed")
            finally:
                geometry_lock.release()

            # All metadata (silhouettes, holes, faceMeshes) is now integrated 
            # into the primary Pass 1 from unfold_lib.py. 
            # We no longer need to call the legacy OCC-based unfold_step_file.
            return result
        except subprocess.CalledProcessError as e:
            print(f"[Python-API] Robust unfold failed (Exit {e.returncode}). Output:")
            print(f"STDOUT: {e.stdout}")
            print(f"STDERR: {e.stderr}")
            print(f"[Python-API] Falling back to legacy engine...")
            _report_progress(92, "Using fallback CAD engine")
            return unfold_step_file(filepath)
        except Exception as e:
            print(f"[Python-API] Merge pass unexpected error: {str(e)}")
            traceback.print_exc()
            _report_progress(92, "Using fallback CAD engine")
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