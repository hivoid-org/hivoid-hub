import json
from typing import Any
from sqlalchemy.orm import Session
from app.models.base import GlobalSettings


DEFAULT_HUB_CONFIG = {
    "pool_size": 4,
    "socks_port": 1080,
    "dns_port": 0,
    "dns_upstream": "8.8.8.8:53",
    "login_path": "login",
    "admin_ip_whitelist": [],
    "admin_geo_whitelist": [],
    "session_timeout": 120, # In minutes
    "auto_lock_timeout": 5, # In minutes
    "timezone": "America/New_York",
    "telegram_bot_token": "",
    "telegram_chat_id": "",
    "telegram_alerts": {
        "admin_login": True,
        "failed_login": True,
        "ip_ban": True,
        "node_alert": True,
        "audit_alert": False,
        "user_created": False,
        "user_deleted": False,
        "config_changed": False,
        "backup_success": False,
        "node_online": True,
        "node_offline": True,
        "critical_health": True,
        "subscription_created": False,
        "subscription_revoked": False
    },
    "telegram_login_auth": False,
    "telegram_2fa_approval": False,
    "insecure": False,
    "cert_pin": "",
    "bypass_domains": [],
    "bypass_ips": [],
    "direct_route": [],
    "direct_geosite": [],
    "direct_geoip": [],
    "direct_domains": [],
    "direct_ips": [],
    "cloudflare_api_token": "",
    "default_data_limit": 10737418240,
    "default_bandwidth_limit": 0,
    "default_expire_days": 30,
    "default_max_connections": 5,
    "default_max_ips": 2,
    "default_mode": "",
    "default_obfs": "",
    "geoip_path": "",
    "geosite_path": "",
    "sub_page": {
        "title": "HiVoid Network",
        "subtitle": "Subscription Dashboard",
        "show_status_badge": True,
        "show_username": True,
        "show_email": True,
        "show_uuid": True,
        "show_usage": True,
        "show_usage_progress": True,
        "show_upload_download": True,
        "show_expiry": True,
        "show_policy_cards": True,
        "show_max_connections": True,
        "show_max_ips": True,
        "show_bandwidth_limit": True,
        "show_mode": True,
        "show_obfs": True,
        "show_bind_ip": True,
        "show_nodes": True,
        "show_hivoid_links": True,
        "show_json_export": True,
        "show_runtime_cards": True,
        "show_qr": True,
        "show_footer_branding": True,
        "allow_copy_uuid": True,
        "allow_copy_links": True,
        "allow_copy_json": True,
        "allow_share_native": True,
    },
}


def load_hub_config(db: Session) -> dict[str, Any]:
    setting = db.query(GlobalSettings).filter(GlobalSettings.key == "hub_config").first()
    if not setting or not setting.value:
        return dict(DEFAULT_HUB_CONFIG)
    try:
        parsed = json.loads(setting.value)
        if not isinstance(parsed, dict):
            return dict(DEFAULT_HUB_CONFIG)
        merged = dict(DEFAULT_HUB_CONFIG)
        merged.update(parsed)
        return merged
    except Exception:
        return dict(DEFAULT_HUB_CONFIG)


def save_hub_config(db: Session, updates: dict[str, Any]) -> dict[str, Any]:
    current = load_hub_config(db)
    current.update(updates)
    setting = db.query(GlobalSettings).filter(GlobalSettings.key == "hub_config").first()
    if not setting:
        setting = GlobalSettings(key="hub_config", value=json.dumps(current))
        db.add(setting)
    else:
        setting.value = json.dumps(current)
    db.commit()
    return current
