#!/usr/bin/env bash
# =========================================================
# HiVoid Hub — Interactive Installer
# Usage: bash install.sh [path/to/hivoid-hub-release.zip]
# =========================================================
set -e
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

# ── Colors & Styles ───────────────────────────────────────
RED=$'\033[0;31m';    GREEN=$'\033[0;32m';   YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m';   BLUE=$'\033[0;34m';    MAGENTA=$'\033[0;35m'
WHITE=$'\033[1;37m';  DIM=$'\033[2m';        BOLD=$'\033[1m'
BG_BLUE=$'\033[44m';  NC=$'\033[0m'

# ── Terminal width ────────────────────────────────────────
TERM_WIDTH=$(tput cols 2>/dev/null || echo 70)
[[ $TERM_WIDTH -gt 80 ]] && TERM_WIDTH=80

# ── Box drawing helpers ───────────────────────────────────
repeat_char() {
  local char="$1" count="$2" out=""
  for (( i=0; i<count; i++ )); do out+="$char"; done
  printf '%s' "$out"
}

hline()  { echo -e "${DIM}$(repeat_char '─' "$TERM_WIDTH")${NC}"; }
hline_b(){ echo -e "${BLUE}$(repeat_char '━' "$TERM_WIDTH")${NC}"; }

center_text() {
  local text="$1" color="${2:-$NC}"
  local visible="${text//$'\033'[*m/}"
  local pad=$(( (TERM_WIDTH - ${#visible}) / 2 ))
  printf "%${pad}s" ""
  echo -e "${color}${text}${NC}"
}

box_line() {
  local text="$1" color="${2:-$WHITE}"
  local visible_len=${#text}
  local inner=$(( TERM_WIDTH - 4 ))
  local pad=$(( inner - visible_len ))
  echo -e "${BLUE}║${NC} ${color}${text}${NC}$(printf "%${pad}s")${BLUE} ║${NC}"
}

box_top()    { echo -e "${BLUE}╔$(repeat_char '═' $(( TERM_WIDTH - 2 )))╗${NC}"; }
box_bottom() { echo -e "${BLUE}╚$(repeat_char '═' $(( TERM_WIDTH - 2 )))╝${NC}"; }
box_sep()    { echo -e "${BLUE}╠$(repeat_char '═' $(( TERM_WIDTH - 2 )))╣${NC}"; }

thin_top()    { echo -e "${DIM}┌$(repeat_char '─' $(( TERM_WIDTH - 2 )))┐${NC}"; }
thin_bottom() { echo -e "${DIM}└$(repeat_char '─' $(( TERM_WIDTH - 2 )))┘${NC}"; }
thin_line() {
  local text="$1" color="${2:-$NC}"
  local visible_len=${#text}
  local inner=$(( TERM_WIDTH - 4 ))
  local pad=$(( inner - visible_len ))
  echo -e "${DIM}│${NC} ${color}${text}${NC}$(printf "%${pad}s")${DIM} │${NC}"
}

# ── Status messages ───────────────────────────────────────
ok()    { echo -e "  ${GREEN}✔${NC}  $1"; }
info()  { echo -e "  ${CYAN}›${NC}  $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC}  ${YELLOW}$1${NC}"; }
err()   { echo -e "\n  ${RED}✖  $1${NC}\n"; exit 1; }
label() { echo -e "  ${DIM}$1${NC}"; }

# ── Spinner ───────────────────────────────────────────────
SPINNER_PID=""
_spin() {
  local msg="$1"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0
  tput civis 2>/dev/null || true
  while true; do
    printf "\r  ${CYAN}${frames[$i]}${NC}  %s " "$msg"
    i=$(( (i + 1) % ${#frames[@]} ))
    sleep 0.08
  done
}
spin_start() {
  _spin "$1" &
  SPINNER_PID=$!
}
spin_stop() {
  if [[ -n "$SPINNER_PID" ]]; then
    kill "$SPINNER_PID" 2>/dev/null
    wait "$SPINNER_PID" 2>/dev/null || true
    SPINNER_PID=""
    printf "\r\033[2K"
    tput cnorm 2>/dev/null || true
  fi
}

# ── Step header ───────────────────────────────────────────
TOTAL_STEPS=7
step_header() {
  local n="$1" title="$2"
  echo ""
  hline_b
  echo -e "  ${BOLD}${WHITE}Step ${n}/${TOTAL_STEPS}  —  ${title}${NC}"
  hline_b
  echo ""
}

# ── Prompt helpers ────────────────────────────────────────
prompt()  { printf "  ${CYAN}?${NC}  $1 "; read -r "$2" < /dev/tty || true; }
promptS() { printf "  ${CYAN}?${NC}  $1 "; read -rs "$2" < /dev/tty || true; echo; }

choice_row() {
  echo -e "    ${DIM}[${NC}${CYAN}${1}${NC}${DIM}]${NC}  $2"
}

# ══════════════════════════════════════════════════════════
# BANNER
# ══════════════════════════════════════════════════════════
clear
echo ""
box_top
box_line ""
box_line "  HiVoid Hub — Production Installer" "${BOLD}${CYAN}"
box_line "  hivoid-org/hivoid-hub" "${DIM}"
box_line ""
box_sep
box_line ""
box_line "  This wizard will configure and install HiVoid Hub" "${WHITE}"
box_line "  including Nginx, PostgreSQL, Redis, and Certbot." "${DIM}"
box_line ""
box_bottom
echo ""

# ── Root check ────────────────────────────────────────────
[[ "$EUID" -ne 0 ]] && err "Please run as root:  sudo bash install.sh"

INSTALL_DIR="/opt/hivoid-hub"

# ── Zip argument ──────────────────────────────────────────
if [[ -n "$1" ]]; then
  ZIP_FILE="$1"
  [[ ! -f "$ZIP_FILE" ]] && err "Release archive not found: ${BOLD}$ZIP_FILE"
  info "Using local archive : ${BOLD}$ZIP_FILE${NC}"
elif [[ -f "hivoid-hub-release.zip" ]]; then
  ZIP_FILE="hivoid-hub-release.zip"
  info "Using local archive : ${BOLD}$ZIP_FILE${NC}"
else
  info "No local zip found. Fetching latest release from GitHub..."
  ZIP_FILE="/tmp/hivoid-hub-release.zip"
  rm -f "$ZIP_FILE"
  
  spin_start "Fetching release information..."
  # Gets the first 'browser_download_url' from the latest GitHub release
  DOWNLOAD_URL=$(curl -s "https://api.github.com/repos/hivoid-org/hivoid-hub/releases/latest" | grep -m 1 '"browser_download_url":' | cut -d '"' -f 4)
  spin_stop
  
  if [[ -z "$DOWNLOAD_URL" ]]; then
    err "No release asset found on GitHub. Provide the zip file manually."
  fi
  
  spin_start "Downloading release package..."
  if ! curl -sL "$DOWNLOAD_URL" -o "$ZIP_FILE"; then
    spin_stop
    err "Failed to download the release."
  fi
  spin_stop; ok "Downloaded latest release to ${BOLD}$ZIP_FILE${NC}"
fi

# ══════════════════════════════════════════════════════════
# STEP 1 — Prerequisites
# ══════════════════════════════════════════════════════════
step_header 1 "Installing System Prerequisites"

spin_start "Updating package lists..."
apt-get update -qq > /dev/null 2>&1
spin_stop; ok "Package lists updated"

spin_start "Installing packages (python3, postgresql, redis, nginx, certbot)..."
apt-get install -y -qq \
  python3 python3-pip python3-venv \
  postgresql postgresql-contrib \
  redis-server \
  nginx \
  unzip curl certbot python3-certbot-nginx > /dev/null 2>&1
spin_stop; ok "System packages installed"

spin_start "Enabling services..."
systemctl enable --now postgresql redis-server nginx > /dev/null 2>&1
spin_stop; ok "postgresql, redis-server, nginx — started & enabled"

# ══════════════════════════════════════════════════════════
# STEP 2 — Extract
# ══════════════════════════════════════════════════════════
step_header 2 "Extracting Release Package"

spin_start "Extracting to $INSTALL_DIR..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
unzip -q "$ZIP_FILE" -d "$INSTALL_DIR"
spin_stop; ok "Extracted to ${BOLD}$INSTALL_DIR${NC}"

# ══════════════════════════════════════════════════════════
# STEP 3 — Configuration
# ══════════════════════════════════════════════════════════
step_header 3 "Deployment Configuration"

# ── Deploy target ─────────────────────────────────────────
thin_top
thin_line "Where are you deploying?" "${BOLD}${WHITE}"
thin_line ""
thin_line "  [1]  Domain name   (e.g. hub.example.com)" "${CYAN}"
thin_line "  [2]  IP address    (e.g. 1.2.3.4)" "${CYAN}"
thin_bottom
prompt "Your choice [1/2]:" DEPLOY_MODE

if [[ "$DEPLOY_MODE" == "1" ]]; then
  prompt "Domain (without https://):" HOST
  HOST=$(echo "$HOST" | xargs | sed 's|/*$||')
  USE_DOMAIN=true
else
  info "Enter the server's IP address:"
  prompt "IP address:" HOST
  while [[ -z "$HOST" ]]; do
    warn "IP address cannot be empty."
    prompt "IP address:" HOST
  done
  HOST=$(echo "$HOST" | xargs)
  USE_DOMAIN=false
fi
ok "Host set to ${BOLD}$HOST${NC}"
echo ""

# ── Protocol ──────────────────────────────────────────────
SSL_CERT_PATH=""
SSL_KEY_PATH=""
CERT_MODE=""   # "letsencrypt" | "manual"

if $USE_DOMAIN; then
  thin_top
  thin_line "Protocol" "${BOLD}${WHITE}"
  thin_line ""
  thin_line "  [1]  HTTPS  (recommended — requires valid DNS)" "${CYAN}"
  thin_line "  [2]  HTTP   only" "${CYAN}"
  thin_bottom
  prompt "Your choice [1/2]:" PROTO_CHOICE

  if [[ "$PROTO_CHOICE" == "1" ]]; then
    USE_HTTPS=true
    echo ""

    # ── Ask whether user already has a certificate ──────────
    thin_top
    thin_line "SSL Certificate Source" "${BOLD}${WHITE}"
    thin_line ""
    thin_line "  [1]  Obtain automatically via Let's Encrypt" "${CYAN}"
    thin_line "  [2]  I already have a certificate (provide paths)" "${CYAN}"
    thin_bottom
    prompt "Your choice [1/2]:" CERT_SOURCE

    if [[ "$CERT_SOURCE" == "2" ]]; then
      CERT_MODE="manual"
      echo ""
      info "Please provide the full paths to your existing certificate files."
      echo ""

      # ── Certificate file (.crt / .pem) ───────────────────
      while true; do
        prompt "Full path to certificate file (.crt or .pem):" SSL_CERT_PATH
        SSL_CERT_PATH=$(echo "$SSL_CERT_PATH" | xargs)
        if [[ -z "$SSL_CERT_PATH" ]]; then
          warn "Certificate path cannot be empty."
        elif [[ ! -f "$SSL_CERT_PATH" ]]; then
          warn "File not found: ${BOLD}$SSL_CERT_PATH${NC}"
          warn "Please check the path and try again."
        else
          ok "Certificate file found: ${BOLD}$SSL_CERT_PATH${NC}"
          break
        fi
      done

      # ── Private key file (.key / .pem) ───────────────────
      while true; do
        prompt "Full path to private key file (.key or .pem):" SSL_KEY_PATH
        SSL_KEY_PATH=$(echo "$SSL_KEY_PATH" | xargs)
        if [[ -z "$SSL_KEY_PATH" ]]; then
          warn "Key path cannot be empty."
        elif [[ ! -f "$SSL_KEY_PATH" ]]; then
          warn "File not found: ${BOLD}$SSL_KEY_PATH${NC}"
          warn "Please check the path and try again."
        else
          ok "Private key file found: ${BOLD}$SSL_KEY_PATH${NC}"
          break
        fi
      done

      # ── Copy certs to a safe location ────────────────────
      SSL_DIR="/etc/ssl/hivoid-hub"
      mkdir -p "$SSL_DIR"
      cp "$SSL_CERT_PATH" "$SSL_DIR/cert.pem"
      cp "$SSL_KEY_PATH"  "$SSL_DIR/key.pem"
      chmod 600 "$SSL_DIR/key.pem"
      SSL_CERT_PATH="$SSL_DIR/cert.pem"
      SSL_KEY_PATH="$SSL_DIR/key.pem"
      ok "Certificates copied to ${BOLD}$SSL_DIR${NC}"

    else
      CERT_MODE="letsencrypt"
      ok "Let's Encrypt will be used to obtain a certificate"
    fi

    ok "HTTPS / TLS enabled"
  else
    USE_HTTPS=false
    ok "HTTP only selected"
  fi
else
  USE_HTTPS=false
  warn "IP-only deployments use HTTP."
fi
echo ""

# ── Backend port ──────────────────────────────────────────
prompt "Backend port [default: 8000]:" BACKEND_PORT
BACKEND_PORT="${BACKEND_PORT:-8000}"
ok "Backend port: ${BOLD}$BACKEND_PORT${NC}"
echo ""

# ── Admin credentials ─────────────────────────────────────
thin_top
thin_line "Create Admin Account" "${BOLD}${WHITE}"
thin_bottom
prompt "Username:" ADMIN_USER
while [[ -z "$ADMIN_USER" ]]; do
  warn "Username cannot be empty."
  prompt "Username:" ADMIN_USER
done

while true; do
  promptS "Password:" ADMIN_PASS
  promptS "Confirm password:" ADMIN_PASS2
  [[ "$ADMIN_PASS" == "$ADMIN_PASS2" && -n "$ADMIN_PASS" ]] && break
  warn "Passwords do not match or are empty. Try again."
done
ok "Admin account: ${BOLD}$ADMIN_USER${NC}"
echo ""

# ── Config summary ────────────────────────────────────────
$USE_HTTPS && PROTOCOL="https" || PROTOCOL="http"
echo ""
thin_top
thin_line "  Configuration Summary" "${BOLD}${WHITE}"
thin_line ""
thin_line "  Host         :  $HOST" "${CYAN}"
thin_line "  Protocol     :  $PROTOCOL" "${CYAN}"
if $USE_HTTPS; then
  if [[ "$CERT_MODE" == "manual" ]]; then
    thin_line "  Cert source  :  Manual (existing certificate)" "${CYAN}"
    thin_line "  Cert file    :  $SSL_CERT_PATH" "${DIM}"
    thin_line "  Key file     :  $SSL_KEY_PATH" "${DIM}"
  else
    thin_line "  Cert source  :  Let's Encrypt (auto)" "${CYAN}"
  fi
fi
thin_line "  Backend port :  $BACKEND_PORT" "${CYAN}"
thin_line "  Admin user   :  $ADMIN_USER" "${CYAN}"
thin_bottom
echo ""

# ══════════════════════════════════════════════════════════
# STEP 4 — PostgreSQL
# ══════════════════════════════════════════════════════════
step_header 4 "Setting Up PostgreSQL Database"

DB_PASS=$(openssl rand -hex 16)
DB_NAME="hivoid_hub"
DB_USER="hivoid"

spin_start "Provisioning database user and schema..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" > /dev/null 2>&1 || true
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" > /dev/null 2>&1 || true
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" > /dev/null 2>&1 || true
spin_stop

ok "Database ${BOLD}$DB_NAME${NC} created"
ok "User ${BOLD}$DB_USER${NC} provisioned with public schema access"

# ══════════════════════════════════════════════════════════
# STEP 5 — Python & App Config
# ══════════════════════════════════════════════════════════
step_header 5 "Python Environment & Application Config"

cd "$INSTALL_DIR/backend"

spin_start "Creating virtual environment..."
python3 -m venv venv > /dev/null 2>&1
spin_stop; ok "Virtual environment created"

source venv/bin/activate

spin_start "Installing Python dependencies..."
pip install -q --upgrade pip > /dev/null 2>&1
pip install -q -r requirements.txt > /dev/null 2>&1
spin_stop; ok "Dependencies installed"

JWT_SECRET=$(openssl rand -hex 32)
HUB_TOKEN=$(openssl rand -hex 24)

# Write .env
cat > "$INSTALL_DIR/backend/.env" <<EOF
PROJECT_NAME="HiVoid Subscription Hub"
HUB_MASTER_TOKEN=$HUB_TOKEN
SECRET_KEY=$JWT_SECRET
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REDIS_URL=redis://localhost:6379/0
SQLALCHEMY_DATABASE_URI=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
EOF
ok ".env written to ${BOLD}$INSTALL_DIR/backend/.env${NC}"

# Write config.py
cat > "$INSTALL_DIR/backend/app/core/config.py" <<EOF
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "HiVoid Subscription Hub"
    API_V1_STR: str = "/api/v1"
    HUB_MASTER_TOKEN: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REDIS_URL: str = "redis://localhost:6379/0"
    SQLALCHEMY_DATABASE_URI: str

    class Config:
        env_file = "/opt/hivoid-hub/backend/.env"
        case_sensitive = True

settings = Settings()
EOF
ok "config.py updated"

spin_start "Running database migrations..."
python3 -c "from app.core.database import engine, Base; from app.models.base import User, Node, AdminUser; Base.metadata.create_all(bind=engine)" > /dev/null 2>&1
spin_stop; ok "Database tables created"

info "Starting backend temporarily to create admin account..."
"$INSTALL_DIR/backend/venv/bin/uvicorn" app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" &
UVICORN_PID=$!

spin_start "Waiting for backend to become ready..."
for i in $(seq 1 15); do
  curl -sf "http://127.0.0.1:$BACKEND_PORT/" > /dev/null 2>&1 && break || sleep 1
done
spin_stop; ok "Backend is up"

curl -sf -X POST "http://127.0.0.1:$BACKEND_PORT/api/v1/auth/setup" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" > /dev/null \
  && ok "Admin account created: ${BOLD}$ADMIN_USER${NC}" \
  || warn "Admin setup request failed — run /api/v1/auth/setup manually."

kill $UVICORN_PID 2>/dev/null; wait $UVICORN_PID 2>/dev/null || true
deactivate

# ══════════════════════════════════════════════════════════
# STEP 6 — Systemd
# ══════════════════════════════════════════════════════════
step_header 6 "Creating Systemd Service"

cat > /etc/systemd/system/hivoid-hub.service <<EOF
[Unit]
Description=HiVoid Subscription Hub Backend
After=network.target postgresql.service redis.service

[Service]
User=root
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$INSTALL_DIR/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port $BACKEND_PORT --workers 2
EnvironmentFile=$INSTALL_DIR/backend/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

spin_start "Enabling and starting hivoid-hub.service..."
systemctl daemon-reload > /dev/null 2>&1
systemctl enable --now hivoid-hub > /dev/null 2>&1
spin_stop; ok "hivoid-hub.service active on port ${BOLD}$BACKEND_PORT${NC}"

# ══════════════════════════════════════════════════════════
# STEP 7 — Nginx
# ══════════════════════════════════════════════════════════
step_header 7 "Configuring Nginx Reverse Proxy"

NGINX_CONF="/etc/nginx/sites-available/hivoid-hub"

if $USE_HTTPS && [[ "$CERT_MODE" == "manual" ]]; then
  # ── Nginx config with manual SSL certificates ──────────
  cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $HOST;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $HOST;
    client_max_body_size 512m;

    ssl_certificate     $SSL_CERT_PATH;
    ssl_certificate_key $SSL_KEY_PATH;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root $INSTALL_DIR/backend/static;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        client_max_body_size 512m;
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

else
  # ── Nginx config for HTTP or Let's Encrypt (HTTP first) ─
  cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $HOST;
    client_max_body_size 512m;

    root $INSTALL_DIR/backend/static;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        client_max_body_size 512m;
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
fi

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/hivoid-hub
rm -f /etc/nginx/sites-enabled/default

spin_start "Testing and reloading Nginx config..."
nginx -t > /dev/null 2>&1 && systemctl reload nginx > /dev/null 2>&1
spin_stop; ok "Nginx configured and reloaded"

# ── Let's Encrypt (only when CERT_MODE is letsencrypt) ────
if $USE_HTTPS && [[ "$CERT_MODE" == "letsencrypt" ]]; then
  info "Requesting Let's Encrypt certificate for ${BOLD}$HOST${NC}..."
  certbot --nginx -d "$HOST" --non-interactive --agree-tos -m "admin@$HOST" --redirect
  ok "HTTPS enabled via Let's Encrypt"
fi

# ── Manual cert confirmation ───────────────────────────────
if $USE_HTTPS && [[ "$CERT_MODE" == "manual" ]]; then
  ok "HTTPS enabled with your existing certificate"
fi

# ══════════════════════════════════════════════════════════
# DONE — Summary
# ══════════════════════════════════════════════════════════
echo ""
echo ""
echo -e "${GREEN}$(repeat_char '━' "$TERM_WIDTH")${NC}"
center_text "✔  Installation Complete" "${BOLD}${GREEN}"
echo -e "${GREEN}$(repeat_char '━' "$TERM_WIDTH")${NC}"
echo ""

box_top
box_line ""
box_line "  Deployment Details" "${BOLD}${WHITE}"
box_line ""
box_sep
box_line ""
box_line "  Panel URL       :  $PROTOCOL://$HOST" "${CYAN}"
box_line "  API Docs        :  $PROTOCOL://$HOST/api/v1/openapi.json" "${CYAN}"
box_line ""
box_sep
box_line ""
box_line "  Admin Username  :  $ADMIN_USER" "${WHITE}"
box_line "  DB User / Pass  :  $DB_USER  /  $DB_PASS" "${DIM}"
box_line ""
box_sep
box_line ""
box_line "  Edge Token      :  $HUB_TOKEN" "${YELLOW}"
box_line ""
box_bottom

echo ""
echo -e "  ${YELLOW}⚠${NC}  ${BOLD}Save the Edge Token above!${NC}"
echo -e "     Add it to each HiVoid edge node as ${BOLD}HUB_TOKEN${NC}."
echo ""
echo -e "${DIM}$(repeat_char '─' "$TERM_WIDTH")${NC}"
echo ""