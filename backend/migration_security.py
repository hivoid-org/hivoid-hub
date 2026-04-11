import sys
import os

# Add current directory to path to import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("🚀 Starting Security Update Migration...")
        
        # Update ADMIN_USERS Table
        admin_updates = [
            ("totp_recovery_codes", "JSON NULL"),
            ("webauthn_credentials", "JSON NULL")
        ]
        
        for col_name, col_type in admin_updates:
            try:
                conn.execute(text(f"ALTER TABLE admin_users ADD COLUMN {col_name} {col_type}"))
                print(f"✅ Added '{col_name}' to admin_users table.")
            except Exception as e:
                # Column likely already exists
                print(f"ℹ️ Skipping '{col_name}' for admin_users (may already exist).")

        conn.commit()
        print("\n✨ Security Migration complete!")

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
