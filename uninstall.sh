#!/usr/bin/env bash
# =========================================================
# HiVoid Hub — Uninstaller
# Removes systemd service, nginx configs, and /opt/ files.
# Usage: sudo bash uninstall.sh
# =========================================================
set -e

# ── Colors ───────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓  $1${NC}"; }
info() { echo -e "\033[0;36m  →  $1${NC}"; }

echo ""
echo -e "${BOLD}${RED}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${RED}║       HiVoid Hub — System Uninstaller           ║${NC}"
echo -e "${BOLD}${RED}╚══════════════════════════════════════════════════╝${NC}"
echo ""

[[ "$EUID" -ne 0 ]] && echo "Please run as root (sudo bash uninstall.sh)" && exit 1

read -rp "  Are you sure you want to remove HiVoid Hub from this system? [y/N]: " CONFIRM
[[ ! "$CONFIRM" =~ ^[Yy]$ ]] && echo "Aborted." && exit 0

# 1. Stop and remove systemd service
info "Stopping and removing hivoid-hub.service..."
systemctl stop hivoid-hub 2>/dev/null || true
systemctl disable hivoid-hub 2>/dev/null || true
rm -f /etc/systemd/system/hivoid-hub.service
systemctl daemon-reload
ok "Service removed."

# 2. Remove Nginx configuration
info "Removing Nginx configuration..."
rm -f /etc/nginx/sites-enabled/hivoid-hub
rm -f /etc/nginx/sites-available/hivoid-hub
nginx -t 2>/dev/null && systemctl reload nginx || true
ok "Nginx site disabled."

# 3. Handle Database (Optional)
read -rp "  Do you want to drop the PostgreSQL database and user 'hivoid'? [y/N]: " DB_CONFIRM
if [[ "$DB_CONFIRM" =~ ^[Yy]$ ]]; then
    info "Dropping database 'hivoid_hub' and user 'hivoid'..."
    sudo -u postgres psql -c "DROP DATABASE hivoid_hub;" 2>/dev/null || true
    sudo -u postgres psql -c "DROP USER hivoid;" 2>/dev/null || true
    ok "Database cleaned."
fi

# 4. Remove installation files
info "Removing installation directory /opt/hivoid-hub..."
rm -rf /opt/hivoid-hub
ok "Installation files deleted."

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║   ✓  HiVoid Hub uninstalled successfully!         ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "Note: Dependencies like PostgreSQL, Redis, and Nginx are still installed on the system."
echo "Only the HiVoid Hub application and its configurations were removed."
echo ""
