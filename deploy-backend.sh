#!/usr/bin/env bash
# ============================================================
# DMS Backend Deployment Script (Hardened)
# Usage: sudo ./deploy-backend.sh /path/to/backend.zip
#
# Key guarantees:
# 1) Creates a timestamped backup of current backend
# 2) Preserves existing .env, uploads/, node_modules/ in BACKEND_DIR
# 3) NEVER copies .env, uploads/, node_modules/ from zip payload
# 4) Installs Node production deps and Python requirements
# 5) Restarts PM2 Node + Python apps and verifies health
# ============================================================

set -Eeuo pipefail
IFS=$'\n\t'

# ---------------- Configuration ----------------
BACKEND_DIR="/var/www/dms-backend"
BACKUP_DIR="/home/ec2-user/backups"
PM2_APP_NAME="dms-node-api"
PM2_PYTHON_NAME="dms-python-api"
PM2_USER="ec2-user"
PYTHON_BIN="/home/ec2-user/miniconda/envs/cadquery-env/bin/python3"
CONDA_BIN="/home/ec2-user/miniconda/bin/conda"
NODE_PORT_DEFAULT="5000"
PYTHON_PORT_DEFAULT="8000"
NODE_HEALTH_URL="http://localhost:${NODE_PORT_DEFAULT}/health"
PYTHON_HEALTH_URL="http://localhost:${PYTHON_PORT_DEFAULT}/health"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# ---------------- Colors / logging ----------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "\n${BLUE}[STEP]${NC} $1"; }
print_ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_err()  { echo -e "${RED}[ERR]${NC} $1"; }

on_error() {
  print_err "Deployment failed at line $1"
  exit 1
}
trap 'on_error $LINENO' ERR

# ---------------- Helpers ----------------
require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || {
    print_err "Required command not found: $cmd"
    exit 1
  }
}

pm2_cmd() {
  local pm2_bin
  pm2_bin="$(sudo -u "$PM2_USER" -H bash -lc 'command -v pm2' 2>/dev/null || true)"
  if [ -z "$pm2_bin" ]; then
    print_err "pm2 not found for user $PM2_USER"
    exit 1
  fi
  sudo -u "$PM2_USER" -H "$pm2_bin" "$@"
}

py_cmd() {
  sudo -u "$PM2_USER" -H "$PYTHON_BIN" "$@"
}

wait_http() {
  local url="$1"
  local name="$2"
  local expected="${3:-200}"
  local attempts="${4:-45}"
  local code=""

  for ((i=1; i<=attempts; i++)); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
    if [ "$code" = "$expected" ]; then
      print_ok "$name healthy (HTTP $code)"
      return 0
    fi
    sleep 1
  done

  print_err "$name failed health check (last HTTP ${code:-N/A})"
  return 1
}

read_env_value() {
  local key="$1"
  local default_value="$2"
  local env_file="$BACKEND_DIR/.env"

  if [ -f "$env_file" ]; then
    local line
    line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$env_file" | tail -n 1 || true)"
    if [ -n "$line" ]; then
      line="${line#*=}"
      line="$(echo "$line" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
      line="${line%\"}"
      line="${line#\"}"
      line="${line%\'}"
      line="${line#\'}"
      if [ -n "$line" ]; then
        echo "$line"
        return 0
      fi
    fi
  fi

  echo "$default_value"
}

ensure_env_default() {
  local key="$1"
  local default_value="$2"
  local env_file="$BACKEND_DIR/.env"

  mkdir -p "$BACKEND_DIR"
  touch "$env_file"

  if ! grep -qE "^[[:space:]]*${key}[[:space:]]*=" "$env_file"; then
    printf "\n%s=%s\n" "$key" "$default_value" >> "$env_file"
    print_warn "Added default ${key}=${default_value} to .env"
  fi
}

copy_payload_without_protected_items() {
  local src="$1"

  shopt -s dotglob nullglob
  for item in "$src"/*; do
    [ -e "$item" ] || continue
    local base
    base="$(basename "$item")"

    case "$base" in
      .|..|.env|uploads|node_modules)
        print_warn "Skipped payload item: $base"
        continue
        ;;
    esac

    cp -a "$item" "$BACKEND_DIR/"
  done
  shopt -u dotglob nullglob
}

repair_cadquery_with_conda() {
  local py_env_name
  local min_free_mb="4096"
  local free_mb
  local min_mem_plus_swap_mb="2048"
  local mem_available_mb
  local swap_free_mb
  local mem_plus_swap_mb
  py_env_name="$(basename "$(dirname "$(dirname "$PYTHON_BIN")")")"

  free_mb="$(df -Pm / | awk 'NR==2 {print $4}')"
  if [ -z "$free_mb" ] || [ "$free_mb" -lt "$min_free_mb" ]; then
    print_err "Insufficient disk space for conda repair. Free: ${free_mb:-unknown}MB, Required: ${min_free_mb}MB"
    print_err "Free space and rerun deploy. Suggested cleanup: conda cache, old backups, temp_uploads, pm2 logs."
    return 1
  fi

  mem_available_mb="$(awk '/MemAvailable:/ { printf "%d", $2/1024 }' /proc/meminfo 2>/dev/null || echo 0)"
  swap_free_mb="$(awk '/SwapFree:/ { printf "%d", $2/1024 }' /proc/meminfo 2>/dev/null || echo 0)"
  mem_plus_swap_mb="$((mem_available_mb + swap_free_mb))"
  if [ "$mem_plus_swap_mb" -lt "$min_mem_plus_swap_mb" ]; then
    print_err "Insufficient RAM+swap for conda repair. Available: ${mem_plus_swap_mb}MB, Required: ${min_mem_plus_swap_mb}MB"
    print_err "Add swap or stop memory-heavy processes, then rerun deploy."
    return 1
  fi

  if [ ! -x "$CONDA_BIN" ]; then
    print_err "Conda binary not found at $CONDA_BIN"
    return 1
  fi

  print_warn "Attempting conda-based cadquery stack repair in env: $py_env_name"
  sudo -u "$PM2_USER" -H "$CONDA_BIN" install -y -n "$py_env_name" -c conda-forge "multimethod=1.9.1" "cadquery=2.4.*"
}

cleanup_broken_multimethod() {
  local site_packages
  site_packages="$(py_cmd - <<'PY'
import site
paths = [p for p in site.getsitepackages() if p.endswith('site-packages')]
print(paths[0] if paths else '')
PY
)"

  if [ -z "$site_packages" ]; then
    print_warn "Could not resolve site-packages path for multimethod cleanup"
    return 0
  fi

  rm -rf "$site_packages"/multimethod "$site_packages"/multimethod-*.dist-info "$site_packages"/~ultimethod* "$site_packages"/-ultimethod* 2>/dev/null || true
  print_warn "Removed stale multimethod artifacts in $site_packages"
}

hotfix_multimethod_runtime_patch() {
  local site_packages
  local sc_file

  site_packages="$(py_cmd - <<'PY'
import site
paths = [p for p in site.getsitepackages() if p.endswith('site-packages')]
print(paths[0] if paths else '')
PY
)"

  if [ -z "$site_packages" ]; then
    print_warn "Could not resolve site-packages path for multimethod hotfix"
    return 1
  fi

    sc_file="$site_packages/sitecustomize.py"
    print_warn "Writing multimethod runtime hotfix to $sc_file"
    SC_FILE="$sc_file" py_cmd - <<'PY'
from pathlib import Path
import os
import textwrap

p = Path(os.environ["SC_FILE"])
content = textwrap.dedent("""\
try:
  import multimethod as _mm

  def _wrap_setitem(_orig):
    def _patched(self, types, func):
      if not hasattr(self, "pending"):
        self.pending = set()
      if not hasattr(self, "generics"):
        self.generics = []
      if not hasattr(self, "type_checkers"):
        self.type_checkers = []
      return _orig(self, types, func)
    return _patched

  for _name in ("multimethod", "multidispatch"):
    _cls = getattr(_mm, _name, None)
    _orig = getattr(_cls, "__setitem__", None) if _cls is not None else None
    if _orig is not None:
      setattr(_cls, "__setitem__", _wrap_setitem(_orig))
except Exception:
  pass
""")
p.write_text(content, encoding="utf-8")
print(f"multimethod runtime hotfix written: {p}")
PY
}

# ---------------- Validate input ----------------
if [ -z "${1:-}" ]; then
  echo -e "${RED}Usage: sudo ./deploy-backend.sh /path/to/backend.zip${NC}"
  echo ""
  echo "Zip your backend folder EXCLUDING node_modules, .env, uploads."
  exit 1
fi

ZIP_FILE="$1"
if [ ! -f "$ZIP_FILE" ]; then
  print_err "File not found: $ZIP_FILE"
  exit 1
fi

require_cmd unzip
require_cmd curl
require_cmd tar
require_cmd npm
require_cmd find

if [ ! -x "$PYTHON_BIN" ]; then
  print_err "Python binary not executable: $PYTHON_BIN"
  exit 1
fi

echo ""
echo "============================================"
echo "   DMS Backend Deployment (Hardened)"
echo "   $(date)"
echo "============================================"

print_step "Preparing directories"
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKEND_DIR"
print_ok "Directories are ready"

# ---------------- Step 1: Backup ----------------
print_step "Creating backup of current backend"
BACKUP_FILE="$BACKUP_DIR/backend_backup_${TIMESTAMP}.tar.gz"
if [ -d "$BACKEND_DIR" ]; then
  tar -czf "$BACKUP_FILE" -C "$(dirname "$BACKEND_DIR")" "$(basename "$BACKEND_DIR")"
  print_ok "Backup saved to $BACKUP_FILE"
else
  print_warn "Backend directory not found before deploy, skipping backup"
fi

# ---------------- Step 2: Stop PM2 ----------------
print_step "Stopping PM2 processes"
pm2_cmd stop "$PM2_APP_NAME" 2>/dev/null || print_warn "Node PM2 process not running"
pm2_cmd stop "$PM2_PYTHON_NAME" 2>/dev/null || print_warn "Python PM2 process not running"
print_ok "PM2 stop phase complete"

# ---------------- Step 3: Clear old code ----------------
print_step "Clearing old code (preserving .env, uploads, node_modules)"
find "$BACKEND_DIR" -mindepth 1 -maxdepth 1 \
  ! -name '.env' \
  ! -name 'uploads' \
  ! -name 'node_modules' \
  -exec rm -rf {} +
print_ok "Old code cleared safely"

# ---------------- Step 4: Extract and copy ----------------
print_step "Extracting new backend zip"
EXTRACT_DIR="$(mktemp -d)"
unzip -q -o "$ZIP_FILE" -d "$EXTRACT_DIR"

SOURCE_DIR="$EXTRACT_DIR"
mapfile -t ROOT_ITEMS < <(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1)
if [ "${#ROOT_ITEMS[@]}" -eq 1 ] && [ -d "${ROOT_ITEMS[0]}" ]; then
  SOURCE_DIR="${ROOT_ITEMS[0]}"
fi

# Hard safety: remove protected items from payload if present.
rm -rf "$SOURCE_DIR/.env" "$SOURCE_DIR/uploads" "$SOURCE_DIR/node_modules"

# Copy everything except protected items.
copy_payload_without_protected_items "$SOURCE_DIR"
rm -rf "$EXTRACT_DIR"
print_ok "New code extracted"

# ---------------- Step 5: Dependencies ----------------
print_step "Installing Node dependencies (production only)"
cd "$BACKEND_DIR"
export NODE_ENV=production
if [ -f package-lock.json ]; then
  npm ci --omit=dev --no-audit --prefer-offline
else
  npm install --omit=dev --no-audit --prefer-offline
fi
print_ok "Node dependencies installed"

print_step "Installing Python requirements"
if [ -f requirements.txt ]; then
  # IMPORTANT:
  # This server uses a pre-provisioned conda CAD environment.
  # Reinstalling cadquery/vtk via pip can conflict with conda-managed packages.
  # By default, we only install lightweight missing modules via pip and validate CAD imports.
  # Set FORCE_FULL_PY_DEPS=1 if you explicitly want pip to process the full requirements file.

  if [ "${FORCE_FULL_PY_DEPS:-0}" = "1" ]; then
    py_cmd -m pip install -r requirements.txt --disable-pip-version-check
    print_ok "Python requirements installed using full requirements file"
  else
    print_step "Checking Python module availability"
    MISSING_PKG_LIST="$(py_cmd - <<'PY'
import importlib.util

checks = {
    "cadquery": "cadquery",
    "numpy": "numpy",
    "python-dotenv": "dotenv",
    "networkx": "networkx",
}

missing = [pkg for pkg, mod in checks.items() if importlib.util.find_spec(mod) is None]
print(" ".join(missing))
PY
)"

    if [ -n "$MISSING_PKG_LIST" ]; then
      print_warn "Missing Python packages detected: $MISSING_PKG_LIST"

      SAFE_PIP_PKGS=()
      CAD_STACK_MISSING=0
      for pkg in $MISSING_PKG_LIST; do
        case "$pkg" in
          cadquery|numpy)
            CAD_STACK_MISSING=1
            ;;
          *)
            SAFE_PIP_PKGS+=("$pkg")
            ;;
        esac
      done

      if [ "${#SAFE_PIP_PKGS[@]}" -gt 0 ]; then
        py_cmd -m pip install --disable-pip-version-check "${SAFE_PIP_PKGS[@]}"
        print_ok "Installed lightweight Python packages: ${SAFE_PIP_PKGS[*]}"
      fi

      if [ "$CAD_STACK_MISSING" -eq 1 ]; then
        print_err "cadquery/numpy missing in $PYTHON_BIN environment."
        print_err "Provision the conda CAD environment first, then rerun deploy."
        exit 1
      fi
    else
      print_ok "Required Python packages are already available"
    fi

    # Final runtime validation: module presence + actual cadquery import.
    # Temporarily disable ERR trap here so we can handle non-zero status explicitly.
    VALIDATION_OUTPUT_FILE="$(mktemp)"
    set +e
    trap - ERR
    py_cmd - <<'PY' >"$VALIDATION_OUTPUT_FILE" 2>&1
import importlib.util
import sys

required = ["cadquery", "numpy", "dotenv", "networkx"]
missing = [m for m in required if importlib.util.find_spec(m) is None]
if missing:
    print("MISSING_MODULES::" + ",".join(missing))
    sys.exit(2)

try:
    import cadquery as cq  # noqa: F401
except Exception as exc:
    print("CADQUERY_IMPORT_ERROR::" + repr(exc))
    sys.exit(3)

print("Python runtime validation passed")
PY
    VALIDATION_STATUS=$?
    trap 'on_error $LINENO' ERR
    set -e

    VALIDATION_OUTPUT="$(cat "$VALIDATION_OUTPUT_FILE")"
    rm -f "$VALIDATION_OUTPUT_FILE"

    echo "$VALIDATION_OUTPUT"

    if [ "$VALIDATION_STATUS" -eq 3 ]; then
      # Known production issue: cadquery can fail when multimethod is not pinned to 1.9.1.
      print_warn "cadquery import failed; applying multimethod compatibility repair"
      cleanup_broken_multimethod
      py_cmd -m pip install --disable-pip-version-check --no-deps --force-reinstall "multimethod==1.9.1"

      set +e
      trap - ERR
      REPAIR_OUTPUT_FILE="$(mktemp)"
      py_cmd - <<'PY' >"$REPAIR_OUTPUT_FILE" 2>&1
import cadquery as cq  # noqa: F401
print("cadquery import OK after multimethod repair")
PY
      REPAIR_STATUS=$?
      trap 'on_error $LINENO' ERR
      set -e

      REPAIR_OUTPUT="$(cat "$REPAIR_OUTPUT_FILE")"
      rm -f "$REPAIR_OUTPUT_FILE"
      echo "$REPAIR_OUTPUT"

      if [ "$REPAIR_STATUS" -ne 0 ]; then
        print_warn "pip multimethod repair did not fix cadquery import"

        if hotfix_multimethod_runtime_patch; then
          set +e
          trap - ERR
          HOTFIX_OUTPUT_FILE="$(mktemp)"
          py_cmd - <<'PY' >"$HOTFIX_OUTPUT_FILE" 2>&1
import cadquery as cq  # noqa: F401
print("cadquery import OK after multimethod hotfix")
PY
          HOTFIX_STATUS=$?
          trap 'on_error $LINENO' ERR
          set -e

          HOTFIX_OUTPUT="$(cat "$HOTFIX_OUTPUT_FILE")"
          rm -f "$HOTFIX_OUTPUT_FILE"
          echo "$HOTFIX_OUTPUT"

          if [ "$HOTFIX_STATUS" -eq 0 ]; then
            print_ok "Python environment repaired via multimethod hotfix"
            REPAIR_STATUS=0
          fi
        fi

      fi

      if [ "$REPAIR_STATUS" -ne 0 ]; then
        if repair_cadquery_with_conda; then
          py_cmd - <<'PY'
import cadquery as cq  # noqa: F401
print("cadquery import OK after conda repair")
PY
          print_ok "Python environment repaired via conda"
        else
          print_err "Conda repair failed; cannot continue deployment"
          exit 1
        fi
      else
        print_ok "Python environment repaired and validated"
      fi
    elif [ "$VALIDATION_STATUS" -ne 0 ]; then
      print_err "Python runtime validation failed"
      exit 1
    else
      print_ok "Python environment validated"
    fi
  fi
else
  print_warn "requirements.txt not found, skipping Python dependency install"
fi

# ---------------- Step 6: Runtime prep ----------------
print_step "Ensuring required upload directories"
mkdir -p "$BACKEND_DIR/uploads/hardware"
print_ok "uploads/hardware exists"

print_step "Ensuring CAD runtime timeout defaults in .env"
ensure_env_default "FREECAD_WORKER_TIMEOUT_SECONDS" "420"
ensure_env_default "GEOMETRY_LOCK_WAIT_TIMEOUT_SECONDS" "300"
print_ok "CAD runtime defaults ensured"

if ! grep -q "FREECAD_WORKER_TIMEOUT_SECONDS" "$BACKEND_DIR/main.py"; then
  print_warn "main.py appears to be an older build without CAD timeout hardening"
fi

# ---------------- Step 7: Restart PM2 ----------------
print_step "Restarting PM2 processes"
pm2_cmd restart "$PM2_APP_NAME" --update-env 2>/dev/null || pm2_cmd start "$BACKEND_DIR/server.js" --name "$PM2_APP_NAME" --cwd "$BACKEND_DIR"
print_ok "Node API process started/restarted"

if pm2_cmd describe "$PM2_PYTHON_NAME" >/dev/null 2>&1; then
  pm2_cmd delete "$PM2_PYTHON_NAME" 2>/dev/null || true
fi

pm2_cmd start "$PYTHON_BIN" --name "$PM2_PYTHON_NAME" --cwd "$BACKEND_DIR" -- main.py
print_ok "Python API process started with configured interpreter"

pm2_cmd save
print_ok "PM2 state saved"

# ---------------- Step 8: Verify ----------------
print_step "Verifying service health"
NODE_PORT="$(read_env_value PORT "$NODE_PORT_DEFAULT")"
PYTHON_PORT="$(read_env_value PYTHON_PORT "$PYTHON_PORT_DEFAULT")"
NODE_HEALTH_URL="http://localhost:${NODE_PORT}/health"
PYTHON_HEALTH_URL="http://localhost:${PYTHON_PORT}/health"

print_ok "Node health URL: $NODE_HEALTH_URL"
print_ok "Python health URL: $PYTHON_HEALTH_URL"

if ! wait_http "$PYTHON_HEALTH_URL" "Python API"; then
  print_warn "Recent PM2 logs for $PM2_PYTHON_NAME"
  pm2_cmd logs "$PM2_PYTHON_NAME" --lines 100 --nostream || true
  exit 1
fi

if ! wait_http "$NODE_HEALTH_URL" "Node API"; then
  print_warn "Recent PM2 logs for $PM2_APP_NAME"
  pm2_cmd logs "$PM2_APP_NAME" --lines 100 --nostream || true
  exit 1
fi

# Optional integration smoke check if temp STEP files exist.
SAMPLE_STEP="$(find "$BACKEND_DIR/temp_uploads" -maxdepth 1 -type f \( -iname '*.step' -o -iname '*.stp' \) | head -n 1 || true)"
if [ -n "$SAMPLE_STEP" ]; then
  TEMP_NAME="$(basename "$SAMPLE_STEP")"
  PAYLOAD="{\"tempPath\":\"temp_uploads/${TEMP_NAME}\"}"
  CODE="$(curl -s -o /tmp/dms_detect_holes_resp.json -w '%{http_code}' -H 'Content-Type: application/json' -d "$PAYLOAD" "http://localhost:${NODE_PORT}/api/detect-holes-by-temp" || true)"
  if [ "$CODE" = "200" ]; then
    print_ok "CAD integration smoke check passed (/api/detect-holes-by-temp)"
  else
    print_warn "CAD integration smoke check returned HTTP $CODE (check pm2 logs if needed)"
  fi
else
  print_warn "No STEP files found in temp_uploads for integration smoke check"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Backend deployment complete${NC}"
echo -e "${GREEN}Backup: $BACKUP_FILE${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Useful commands:"
echo "  sudo -u $PM2_USER pm2 status"
echo "  sudo -u $PM2_USER pm2 logs $PM2_APP_NAME"
echo "  sudo -u $PM2_USER pm2 logs $PM2_PYTHON_NAME"
