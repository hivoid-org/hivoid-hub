#!/usr/bin/env bash
# HiVoid Hub — Manager Wrapper

INSTALL_DIR="/opt/hivoid-hub"
BACKEND_DIR="$INSTALL_DIR/backend"
PYTHON_BIN="$BACKEND_DIR/venv/bin/python3"
MANAGER_PY="$BACKEND_DIR/scripts/manager.py"

# Ensure root
[[ "$EUID" -ne 0 ]] && { echo "Please run as root (sudo hivoid-hub)"; exit 1; }

# Check for manager script
if [[ ! -f "$MANAGER_PY" ]]; then
    echo "Error: Manager script not found at $MANAGER_PY"
    exit 1
fi

# Run the Python manager
exec "$PYTHON_BIN" "$MANAGER_PY"
