import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.base import AuditLog

async def log_security_event(
    db: Session, 
    admin_id: int, 
    action: str, 
    details: str | dict, 
    ip: str = "0.0.0.0", 
    ua: str = "Unknown"
):
    if isinstance(details, dict):
        details = json.dumps(details)
    
    entry = AuditLog(
        admin_id=admin_id,
        action=action,
        details=details,
        ip_address=ip,
        user_agent=ua,
        timestamp=datetime.utcnow()
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Trigger Telegram Alert if configured
    try:
        from app.core.hub_config import load_hub_config
        from app.services import telegram_service
        import asyncio
        
        cfg = load_hub_config(db)
        if cfg.get("telegram_alerts", {}).get("audit_alert"):
            # Exclude actions that already have their own dedicated alert toggles
            # This prevents the admin from receiving two messages for the same event
            dedicated_actions = [
                "ADMIN_LOGIN", "FAILED_LOGIN", "USER_CREATED", "USER_DELETED", 
                "USER_DISABLED", "USER_REVOKED", "NODE_ONLINE", "NODE_OFFLINE",
                "CONFIG_CHANGED", "CONFIG_UPDATED"
            ]
            if action not in dedicated_actions:
                msg = telegram_service.format_suspicious_alert(action, str(details), tz=cfg.get("timezone", "UTC"))
                asyncio.create_task(telegram_service.send_telegram_alert(cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg))
    except Exception:
        pass # Never fail the audit log because of telegram failure

    return entry
