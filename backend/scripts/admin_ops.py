import sys
import os
import argparse

# Ensure we can import the app modules
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

from app.core.database import SessionLocal
from app.models.base import AdminUser
from app.core.auth import get_password_hash
from app.core.hub_config import load_hub_config, save_hub_config

def main():
    parser = argparse.ArgumentParser(description='HiVoid Hub CLI Manager Helper')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Reset Password
    p_reset = subparsers.add_parser('reset-password', help='Reset admin password')
    p_reset.add_argument('username', help='Admin username')
    p_reset.add_argument('password', help='New password')

    # Change Username
    p_user = subparsers.add_parser('change-username', help='Change admin username')
    p_user.add_argument('old_username', help='Current username')
    p_user.add_argument('new_username', help='New username')

    # Set Timezone
    p_tz = subparsers.add_parser('set-timezone', help='Set global timezone')
    p_tz.add_argument('timezone', help='Timezone (e.g. Asia/Tehran)')

    # Set Master Token in DB (though it's usually in .env, we update Hub config)
    p_token = subparsers.add_parser('set-token', help='Update Hub master token')
    p_token.add_argument('token', help='New master token')

    args = parser.parse_args()
    db = SessionLocal()

    try:
        if args.command == 'reset-password':
            admin = db.query(AdminUser).filter(AdminUser.username == args.username).first()
            if not admin:
                print(f"ERROR: User '{args.username}' not found.")
                sys.exit(1)
            admin.hashed_password = get_password_hash(args.password)
            db.commit()
            print(f"SUCCESS: Password for '{args.username}' has been reset.")

        elif args.command == 'change-username':
            admin = db.query(AdminUser).filter(AdminUser.username == args.old_username).first()
            if not admin:
                print(f"ERROR: User '{args.old_username}' not found.")
                sys.exit(1)
            exists = db.query(AdminUser).filter(AdminUser.username == args.new_username).first()
            if exists:
                print(f"ERROR: Username '{args.new_username}' is already taken.")
                sys.exit(1)
            admin.username = args.new_username
            db.commit()
            print(f"SUCCESS: Username changed to '{args.new_username}'.")

        elif args.command == 'set-timezone':
            save_hub_config(db, {"timezone": args.timezone})
            print(f"SUCCESS: Global timezone set to '{args.timezone}'.")

        elif args.command == 'set-token':
            # This follows the pattern of updating runtime config
            save_hub_config(db, {"hub_master_token": args.token})
            # Note: The .env file should also be updated manually for persistence across fresh installs,
            # but the app prioritized DB or .env based on implementation. 
            # In our case, app.core.config.settings reads from .env.
            print(f"SUCCESS: Master token updated in database. (Manual .env update may be required for full persistence)")

        else:
            parser.print_help()
    finally:
        db.close()

if __name__ == "__main__":
    main()
