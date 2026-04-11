#!/usr/bin/env bash
# HiVoid Hub — CLI Manager Installer
# Run this to install/update the CLI manager on your system.

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

[[ "$EUID" -ne 0 ]] && { echo -e "${RED}Please run as root (sudo bash install-manager.sh)${NC}"; exit 1; }

INSTALL_DIR="/opt/hivoid-hub"

if [[ ! -d "$INSTALL_DIR" ]]; then
    echo -e "${RED}HiVoid Hub is not installed in $INSTALL_DIR.${NC}"
    exit 1
fi

echo "Installing/Updating HiVoid CLI Manager..."

# 1. Update Python dependencies for the manager
if [[ -f "$INSTALL_DIR/backend/venv/bin/pip" ]]; then
    echo "Updating dependencies (rich, psutil)..."
    "$INSTALL_DIR/backend/venv/bin/pip" install -q rich psutil
fi

# 2. Set permissions
chmod +x "$INSTALL_DIR/backend/scripts/hub-manager.sh"
chmod +x "$INSTALL_DIR/backend/scripts/manager.py"

# 3. Create symbolic links
ln -sf "$INSTALL_DIR/backend/scripts/hub-manager.sh" /usr/local/bin/hivoid-hub
ln -sf "$INSTALL_DIR/backend/scripts/hub-manager.sh" /usr/local/bin/HiVoid-hub
ln -sf "$INSTALL_DIR/backend/scripts/hub-manager.sh" /usr/local/bin/hihub

echo -e "${GREEN}SUCCESS: CLI Manager installed!${NC}"
echo -e "You can now use: ${YELLOW}hivoid-hub${NC}, ${YELLOW}HiVoid-hub${NC}, or ${YELLOW}hihub${NC}"