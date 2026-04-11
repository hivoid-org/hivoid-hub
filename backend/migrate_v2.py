import sys
import os

# Add current directory to path to import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("🚀 Starting HiVoid Hub DB Migration v2.0...")
        
        # 1. Update USERS Table
        user_updates = [
            ("email", "TEXT DEFAULT ''"),
            ("expire_at", "TIMESTAMP NULL"),
            ("bind_ip", "TEXT DEFAULT ''"),
            ("mode", "TEXT DEFAULT ''"),
            ("obfs", "TEXT DEFAULT ''"),
            ("pool_size", "INTEGER NULL"),
            ("socks_port", "INTEGER NULL"),
            ("dns_port", "INTEGER NULL"),
            ("dns_upstream", "TEXT NULL"),
            ("insecure", "BOOLEAN NULL"),
            ("cert_pin", "TEXT NULL"),
            ("bypass_domains", "TEXT[] NULL"),
            ("bypass_ips", "TEXT[] NULL"),
            ("direct_route", "TEXT[] NULL"),
            ("direct_geosite", "TEXT[] NULL"),
            ("direct_geoip", "TEXT[] NULL"),
            ("direct_domains", "TEXT[] NULL"),
            ("direct_ips", "TEXT[] NULL"),
            ("client_geoip_path", "TEXT NULL"),
            ("client_geosite_path", "TEXT NULL")
        ]
        
        for col_name, col_type in user_updates:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                print(f"✅ Added '{col_name}' to users table.")
            except Exception as e:
                # Column likely already exists
                print(f"ℹ️ Skipping '{col_name}' for users (may already exist).")

        # 2. Update NODES Table
        node_updates = [
            ("listen_addr", "TEXT DEFAULT ':4433'"),
            ("server_mode", "TEXT DEFAULT 'adaptive'"),
            ("log_level", "TEXT DEFAULT 'info'"),
            ("cert_file", "TEXT DEFAULT ''"),
            ("key_file", "TEXT DEFAULT ''"),
            ("hot_reload", "BOOLEAN DEFAULT TRUE"),
            ("connection_tracking", "BOOLEAN DEFAULT TRUE"),
            ("disconnect_expired", "BOOLEAN DEFAULT TRUE"),
            ("max_conns", "INTEGER DEFAULT 0"),
            ("anti_probe", "BOOLEAN DEFAULT TRUE"),
            ("fallback_addr", "TEXT DEFAULT ''"),
            ("geoip_path", "TEXT DEFAULT ''"),
            ("geosite_path", "TEXT DEFAULT ''"),
            ("port", "INTEGER DEFAULT 4433"),
            ("public_host", "TEXT DEFAULT ''"),
            ("tls_mode", "TEXT DEFAULT ''"),
            ("tls_domain", "TEXT DEFAULT ''"),
            ("tls_email", "TEXT DEFAULT ''"),
            ("last_install_status", "TEXT DEFAULT ''"),
            ("last_install_type", "TEXT DEFAULT ''"),
            ("last_install_message", "TEXT DEFAULT ''"),
            ("last_install_request_id", "TEXT DEFAULT ''"),
            ("allowed_hosts", "TEXT[] DEFAULT '{}'"),
            ("blocked_hosts", "TEXT[] DEFAULT '{}'"),
            ("blocked_tags", "TEXT[] DEFAULT '{}'")
        ]
        
        for col_name, col_type in node_updates:
            try:
                conn.execute(text(f"ALTER TABLE nodes ADD COLUMN {col_name} {col_type}"))
                print(f"✅ Added '{col_name}' to nodes table.")
            except Exception as e:
                print(f"ℹ️ Skipping '{col_name}' for nodes (may already exist).")

        conn.commit()
        print("\n✨ Migration complete! Your database is now compatible with HiVoid Hub v2.0.")

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
