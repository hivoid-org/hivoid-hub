from sqlalchemy import Column, String, Integer, BigInteger, Boolean, ARRAY, DateTime, Text, JSON
from app.core.database import Base
import uuid
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True)
    email = Column(String, default="")
    max_connections = Column(Integer, default=5)
    max_ips = Column(Integer, default=2)
    blocked_tags = Column(ARRAY(String), default=[])
    blocked_hosts = Column(ARRAY(String), default=[])
    bandwidth_limit = Column(Integer, default=0)       # KB/s (0=unlimited)
    data_limit = Column(BigInteger, default=10737418240)  # 10 GB in bytes
    expire_at = Column(DateTime, nullable=True)         # RFC3339 expiration
    bind_ip = Column(String, default="")                # Per-user outbound IP
    mode = Column(String, default="")                   # Per-user engine mode override
    obfs = Column(String, default="")                   # Per-user obfuscation override
    # Client-side routing and transport overrides (optional)
    pool_size = Column(Integer, nullable=True)
    socks_port = Column(Integer, nullable=True)
    dns_port = Column(Integer, nullable=True)
    dns_upstream = Column(String, nullable=True)
    insecure = Column(Boolean, nullable=True)
    cert_pin = Column(String, nullable=True)
    bypass_domains = Column(ARRAY(String), nullable=True)
    bypass_ips = Column(ARRAY(String), nullable=True)
    direct_route = Column(ARRAY(String), nullable=True)
    direct_geosite = Column(ARRAY(String), nullable=True)
    direct_geoip = Column(ARRAY(String), nullable=True)
    direct_domains = Column(ARRAY(String), nullable=True)
    direct_ips = Column(ARRAY(String), nullable=True)
    direct_dns_servers = Column(ARRAY(String), nullable=True)
    client_geoip_path = Column(String, nullable=True)
    client_geosite_path = Column(String, nullable=True)
    # Core v1.1.0 Persistence
    persistence = Column(Boolean, default=True)
    state_file = Column(String, default="state.json")
    is_active = Column(Boolean, default=True)

class Node(Base):
    __tablename__ = "nodes"
    
    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(String, unique=True, index=True)
    name = Column(String)
    ip_address = Column(String)
    is_active = Column(Boolean, default=True)
    # Node server config (pushed from hub)
    listen_addr = Column(String, default=":4433")
    server_mode = Column(String, default="adaptive")        # performance, stealth, balanced, adaptive
    log_level = Column(String, default="info")
    cert_file = Column(String, default="")
    key_file = Column(String, default="")
    cert_pin = Column(String, default="")                   # SHA256 fingerprint of server certificate
    hot_reload = Column(Boolean, default=True)
    connection_tracking = Column(Boolean, default=True)
    disconnect_expired = Column(Boolean, default=True)
    max_conns = Column(Integer, default=0)                  # 0=unlimited
    anti_probe = Column(Boolean, default=True)
    fallback_addr = Column(String, default="")
    geoip_path = Column(String, default="")
    geosite_path = Column(String, default="")
    allowed_hosts = Column(ARRAY(String), default=[])
    blocked_hosts = Column(ARRAY(String), default=[])
    blocked_tags = Column(ARRAY(String), default=[])
    # Port for client connections (used in URI generation)
    port = Column(Integer, default=4433)
    # Public hostname (for sub link URI generation)
    public_host = Column(String, default="")
    tls_mode = Column(String, default="")
    tls_domain = Column(String, default="")
    tls_email = Column(String, default="")
    last_install_status = Column(String, default="")
    last_install_type = Column(String, default="")
    last_install_message = Column(String, default="")
    last_install_request_id = Column(String, default="")
    voidreach_config = Column(JSON, nullable=True)


class AdminUser(Base):
    __tablename__ = "admin_users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    totp_secret = Column(String, nullable=True)     # Secret key for TOTP
    totp_enabled = Column(Boolean, default=False)   # Whether 2FA is active
    totp_recovery_codes = Column(JSON, nullable=True)
    webauthn_credentials = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)

class GlobalSettings(Base):
    __tablename__ = "global_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, index=True) # ID of admin who performed action
    timestamp = Column(DateTime, default=datetime.utcnow)
    action = Column(String, index=True)    # e.g. "USER_CREATED", "NODE_DELETED"
    details = Column(String)               # JSON string or description
    ip_address = Column(String)
    user_agent = Column(String)
