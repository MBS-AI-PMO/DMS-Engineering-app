#!/usr/bin/env bash
# ============================================================
# DMS Frontend Deployment Script (Hardened)
# Usage: ./deploy-frontend.sh /path/to/frontend.zip
#
# Expected zip payload:
# - dist/ folder, OR
# - built frontend files with index.html at root
# ============================================================

set -Eeuo pipefail
IFS=$'\n\t'

# ---------------- Configuration ----------------
FRONTEND_DIR="/var/www/dms-frontend/dist"
FRONTEND_PARENT="/var/www/dms-frontend"
BACKUP_DIR="/home/ec2-user/backups"
FRONTEND_HEALTH_URL="http://localhost"
FRONTEND_OWNER="ec2-user"
FRONTEND_GROUP="nginx"
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

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || {
    print_err "Required command not found: $cmd"
    exit 1
  }
}

wait_http() {
  local url="$1"
  local name="$2"
  local expected="${3:-200}"
  local attempts="${4:-30}"
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

# ---------------- Validate input ----------------
if [ -z "${1:-}" ]; then
  echo -e "${RED}Usage: ./deploy-frontend.sh /path/to/frontend.zip${NC}"
  echo ""
  echo "Create zip from production build output, e.g.:"
  echo "  npm run build"
  echo "  zip -r frontend.zip dist/"
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
require_cmd nginx


echo ""
echo "============================================"
echo "   DMS Frontend Deployment (Hardened)"
echo "   $(date)"
echo "============================================"

print_step "Preparing directories"
mkdir -p "$BACKUP_DIR"
mkdir -p "$FRONTEND_DIR"
print_ok "Directories are ready"

# ---------------- Step 1: Backup ----------------
print_step "Creating frontend backup"
BACKUP_FILE="$BACKUP_DIR/frontend_backup_${TIMESTAMP}.tar.gz"
if [ -d "$FRONTEND_DIR" ]; then
  tar -czf "$BACKUP_FILE" -C "$FRONTEND_PARENT" dist/
  print_ok "Backup saved to $BACKUP_FILE"
else
  print_warn "No existing dist folder found, skipping backup"
fi

# ---------------- Step 2: Extract zip ----------------
print_step "Extracting frontend zip"
EXTRACT_DIR="$(mktemp -d)"
unzip -q -o "$ZIP_FILE" -d "$EXTRACT_DIR"

SOURCE_DIR=""
if [ -d "$EXTRACT_DIR/dist" ]; then
  SOURCE_DIR="$EXTRACT_DIR/dist"
else
  mapfile -t ROOT_ITEMS < <(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1)
  if [ "${#ROOT_ITEMS[@]}" -eq 1 ] && [ -d "${ROOT_ITEMS[0]}" ] && [ -d "${ROOT_ITEMS[0]}/dist" ]; then
    SOURCE_DIR="${ROOT_ITEMS[0]}/dist"
  elif [ "${#ROOT_ITEMS[@]}" -eq 1 ] && [ -d "${ROOT_ITEMS[0]}" ] && [ -f "${ROOT_ITEMS[0]}/index.html" ]; then
    SOURCE_DIR="${ROOT_ITEMS[0]}"
  elif [ -f "$EXTRACT_DIR/index.html" ]; then
    SOURCE_DIR="$EXTRACT_DIR"
  fi
fi

if [ -z "$SOURCE_DIR" ]; then
  rm -rf "$EXTRACT_DIR"
  print_err "Could not find dist payload or index.html in the zip"
  exit 1
fi
print_ok "Payload located at $SOURCE_DIR"

# ---------------- Step 3: Replace old files ----------------
print_step "Replacing old frontend files"
find "$FRONTEND_DIR" -mindepth 1 -delete
cp -a "$SOURCE_DIR"/. "$FRONTEND_DIR"/
rm -rf "$EXTRACT_DIR"
print_ok "Frontend files copied"

# ---------------- Step 4: Validate build output ----------------
print_step "Validating build output"
if [ ! -f "$FRONTEND_DIR/index.html" ]; then
  print_err "index.html not found after deployment"
  exit 1
fi
FILE_COUNT="$(find "$FRONTEND_DIR" -type f | wc -l | tr -d ' ')"
TOTAL_SIZE="$(du -sh "$FRONTEND_DIR" | awk '{print $1}')"
print_ok "Build looks valid: $FILE_COUNT files, $TOTAL_SIZE total"

# ---------------- Step 5: Permissions ----------------
print_step "Setting frontend permissions"
if [ "$(id -u)" -eq 0 ]; then
  chown -R "$FRONTEND_OWNER:$FRONTEND_GROUP" "$FRONTEND_DIR"
else
  sudo chown -R "$FRONTEND_OWNER:$FRONTEND_GROUP" "$FRONTEND_DIR"
fi
find "$FRONTEND_DIR" -type d -exec chmod 755 {} +
find "$FRONTEND_DIR" -type f -exec chmod 644 {} +
print_ok "Permissions applied"

# ---------------- Step 6: Nginx reload ----------------
print_step "Validating and reloading Nginx"
if [ "$(id -u)" -eq 0 ]; then
  nginx -t
  systemctl reload nginx
else
  sudo nginx -t
  sudo systemctl reload nginx
fi
print_ok "Nginx reloaded"

# ---------------- Step 7: Verify ----------------
print_step "Verifying frontend health"
wait_http "$FRONTEND_HEALTH_URL" "Frontend"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Frontend deployment complete${NC}"
echo -e "${GREEN}Backup: $BACKUP_FILE${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status nginx"
echo "  sudo tail -n 100 /var/log/nginx/error.log"
