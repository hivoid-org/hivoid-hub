#!/usr/bin/env bash
# =========================================================
# HiVoid Hub — Build Script (Optimized)
# =========================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_DIR="$SCRIPT_DIR/backend"
OUTPUT="$SCRIPT_DIR/dist/hivoid-hub-release.zip"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         HiVoid Hub — Build Script        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Step 1: Frontend deps ────────────────────────────────
cd "$FRONTEND_DIR"
if [ "$1" == "--install" ]; then
    echo "[1/4] Installing frontend dependencies..."
    npm install --silent --legacy-peer-deps
else
    echo "[1/4] Skipping dependency check (direct build mode)."
fi

# ── Step 2: Build frontend (Smart Skip via git hash) ─────
echo "[2/4] Checking for frontend changes..."
SKIP_VITE=false
HASH_FILE=".last_frontend_hash"

if [ -d "dist" ] && [ "$1" != "--force-frontend" ] && [ "$1" != "--install" ]; then
    # Hash all files in src/ — much faster and more reliable than find -newer
    CURRENT_HASH=$(find src -type f | sort | xargs md5sum 2>/dev/null | md5sum | cut -d' ' -f1)
    LAST_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")
    if [ "$CURRENT_HASH" = "$LAST_HASH" ]; then
        SKIP_VITE=true
    fi
fi

if [ "$SKIP_VITE" = true ]; then
    echo "      ✓ No changes detected. Skipping Vite build."
else
    echo "[2/4] Building frontend (Vite)..."
    npm run build
    find src -type f | sort | xargs md5sum 2>/dev/null | md5sum | cut -d' ' -f1 > "$HASH_FILE"
    echo "      ✓ Frontend built → frontend/dist/"
fi

# ── Step 3: Copy dist into backend (rsync = only changed) ─
echo "[3/4] Syncing frontend dist into backend/static/..."
mkdir -p "$BACKEND_DIR/static"
rsync -a --delete "$FRONTEND_DIR/dist/" "$BACKEND_DIR/static/"
echo "      ✓ Synced."

# ── Step 4: Package (parallel compression) ───────────────
echo "[4/4] Creating release zip..."
cd "$SCRIPT_DIR"
rm -f "$OUTPUT"

# Use zip -9 only if speed matters less than size; default -6 is faster
zip -r6 "$OUTPUT" backend/ \
  --exclude "backend/**/__pycache__/*" \
  --exclude "backend/**/*.pyc" \
  --exclude "backend/.env" \
  --exclude "backend/venv/*" \
  --exclude "backend/venv/**"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✓ Build complete!                       ║"
printf   "║  Output: %-32s║\n" "hivoid-hub-release.zip"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Upload hivoid-hub-release.zip to your server"
echo "  then run:  bash install.sh hivoid-hub-release.zip"
echo ""