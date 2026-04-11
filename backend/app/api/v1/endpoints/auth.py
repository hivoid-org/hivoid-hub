from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
import logging
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
import json
from datetime import datetime
import base64

from app.core.database import get_db
from app.core.auth import authenticate_admin, create_access_token, get_password_hash, get_current_admin
from app.core.config import settings
from app.core.hub_config import load_hub_config, save_hub_config
from app.models.base import AdminUser, AuditLog
from app.services.dashboard_metrics import record_auth_attempt
from app.services.audit_service import log_security_event
from app.api.v1.endpoints.geoip import get_geoip_info
from app.services import telegram_service
import secrets
import string
import ipaddress

logger = logging.getLogger(__name__)

BIGINT_MAX = 9223372036854775807

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor
)
from sqlalchemy.orm.attributes import flag_modified
from app.core.redis_client import redis_client

router = APIRouter()

# (Redundant logger and BIGINT_MAX removed)

class Token(BaseModel):
    access_token: str | None = None
    token_type: str | None = None
    username: str | None = None
    status: str = "success"
    tx_id: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str
    otp_code: str | None = None

class TelegramOnlyRequest(BaseModel):
    username: str


class ProfileUpdate(BaseModel):
    new_username: str | None = None


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str


class TOTPSetup(BaseModel):
    secret: str
    uri: str


class TOTPEnable(BaseModel):
    code: str
    secret: str

class WebAuthnRegisterBegin(BaseModel):
    pass

class WebAuthnRegisterComplete(BaseModel):
    response: dict

class WebAuthnLoginBegin(BaseModel):
    username: str

class WebAuthnLoginComplete(BaseModel):
    username: str
    response: dict


class AdminCreate(BaseModel):
    username: str
    password: str


class UnlockRequest(BaseModel):
    password: str


class HubConfigUpdate(BaseModel):
    pool_size: int | None = None
    socks_port: int | None = None
    dns_port: int | None = None
    geosite_path: str | None = None
    login_path: str | None = None
    admin_ip_whitelist: list[str] | None = None
    admin_geo_whitelist: list[str] | None = None
    session_timeout: int | None = None
    auto_lock_timeout: int | None = None
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    telegram_alerts: dict | None = None
    telegram_login_auth: bool | None = None
    telegram_2fa_approval: bool | None = None
    insecure: bool | None = None
    cert_pin: str | None = None
    bypass_domains: list[str] | None = None
    bypass_ips: list[str] | None = None
    direct_route: list[str] | None = None
    direct_geosite: list[str] | None = None
    direct_geoip: list[str] | None = None
    direct_domains: list[str] | None = None
    direct_ips: list[str] | None = None
    cloudflare_api_token: str | None = None
    default_data_limit: int | None = None
    default_bandwidth_limit: int | None = None
    default_expire_days: int | None = None
    default_max_connections: int | None = None
    default_max_ips: int | None = None
    default_mode: str | None = None
    default_obfs: str | None = None
    geoip_path: str | None = None
    geosite_path: str | None = None
    dns_upstream: str | None = None
    timezone: str | None = None
    sub_page: dict | None = None



def is_ip_allowed(ip: str, whitelist: list[str]) -> bool:
    """Checks if an IP address is in a whitelist (supports CIDR)."""
    if not whitelist:
        return True
    client_obj = ipaddress.ip_address(ip)
    for entry in whitelist:
        try:
            if "/" in entry:
                if client_obj in ipaddress.ip_network(entry, strict=False):
                    return True
            elif ip == entry:
                return True
        except ValueError:
            continue
    return False

@router.post("/login", response_model=Token)
async def login(
    payload: LoginRequest, 
    request: Request, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    import pyotp
    client_ip = request.client.host if request.client else "unknown"
    # 1. IP Whitelist Check
    cfg = load_hub_config(db)
    whitelist = cfg.get("admin_ip_whitelist", [])
    if not is_ip_allowed(client_ip, whitelist):
        raise HTTPException(status_code=403, detail="IP_NOT_ALLOWED")

    # 1.1 Geo-Fencing Check
    country = "Unknown"
    try:
        geo = get_geoip_info(client_ip)
        if geo:
            country = geo.get("country_code", "Unknown") # Use code for whitelist
    except: pass

    geo_whitelist = cfg.get("admin_geo_whitelist", [])
    if geo_whitelist and country not in geo_whitelist:
        raise HTTPException(status_code=403, detail="GEO_NOT_ALLOWED")

    # 2. Rate Limiting Check
    ban_key = f"auth:ban:{client_ip}"
    if await redis_client.get(ban_key):
        raise HTTPException(status_code=429, detail="TOO_MANY_ATTEMPTS")

    admin = authenticate_admin(db, payload.username, payload.password)
    
    if not admin:
        # Increment failure counter
        fail_key = f"auth:fails:{client_ip}"
        fails = await redis_client.incr(fail_key)
        await redis_client.expire(fail_key, 3600) # reset counter after 1 hour of silence
        
        if fails >= 5:
            await redis_client.set(ban_key, "1", ex=1800) # 30 min ban
            await redis_client.delete(fail_key)
            # Notify Telegram for Ban
            if cfg.get("telegram_alerts", {}).get("ip_ban"):
                msg = telegram_service.format_ban_alert(client_ip, tz=cfg.get("timezone", "UTC"))
                background_tasks.add_task(telegram_service.send_telegram_alert, cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg)
            raise HTTPException(status_code=429, detail="TOO_MANY_ATTEMPTS")

        # Notify Telegram for Failed Login
        if cfg.get("telegram_alerts", {}).get("failed_login"):
             msg = telegram_service.format_failed_login_alert(payload.username, client_ip, country, "Invalid credentials", tz=cfg.get("timezone", "UTC"))
             background_tasks.add_task(telegram_service.send_telegram_alert, cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg)

        await record_auth_attempt(success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check 2FA if enabled
    if admin.totp_enabled:
        if not payload.otp_code:
            raise HTTPException(status_code=403, detail="2FA_REQUIRED")
        
        totp = pyotp.TOTP(admin.totp_secret)
        is_otp_valid = totp.verify(payload.otp_code, valid_window=1)
        
        # Check Recovery Codes
        is_recovery_valid = False
        if not is_otp_valid and admin.totp_recovery_codes:
            if payload.otp_code in admin.totp_recovery_codes:
                is_recovery_valid = True
                # Remove used recovery code
                new_codes = [c for c in admin.totp_recovery_codes if c != payload.otp_code]
                admin.totp_recovery_codes = new_codes
                flag_modified(admin, "totp_recovery_codes")
                db.commit()

        if not is_otp_valid and not is_recovery_valid:
            # 2FA failure also counts towards rate limit
            fail_key = f"auth:fails:{client_ip}"
            fails = await redis_client.incr(fail_key)
            if fails >= 5:
                await redis_client.set(ban_key, "1", ex=1800)
                await redis_client.delete(fail_key)
                raise HTTPException(status_code=429, detail="TOO_MANY_ATTEMPTS")
            
            await record_auth_attempt(success=False)
            raise HTTPException(status_code=401, detail="Invalid 2FA code")

    # Success: Clear failure counter
    await redis_client.delete(f"auth:fails:{client_ip}")

    # Optional: Telegram 2FA Approval Step (If enabled in settings)
    if cfg.get("telegram_2fa_approval") and cfg.get("telegram_bot_token") and cfg.get("telegram_chat_id"):
        tx_id = secrets.token_hex(16)
        ua = request.headers.get("user-agent", "Unknown")
        # Save pending session detail
        pending_data = {
            "username": admin.username,
            "ip": client_ip,
            "country": country,
            "ua": ua,
            "flow": "2fa"
        }
        await redis_client.set(f"tg_auth_pending:{tx_id}", json.dumps(pending_data), ex=120)
        await redis_client.set(f"tg_auth_status:{tx_id}", "PENDING", ex=120)
        
        # Send approval request to Telegram
        background_tasks.add_task(
            telegram_service.send_telegram_approval,
            cfg.get("telegram_bot_token"),
            cfg.get("telegram_chat_id"),
            tx_id,
            admin.username,
            client_ip,
            country
        )
        return {"status": "TELEGRAM_APPROVAL_PENDING", "tx_id": tx_id}

    # Internal Session Creation Helper
    return await create_session_and_respond(admin, client_ip, country, request, db, cfg, background_tasks)

@router.post("/login-telegram-only", response_model=Token)
async def login_telegram_only(
    payload: TelegramOnlyRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    cfg = load_hub_config(db)
    if not cfg.get("telegram_login_auth"):
        raise HTTPException(status_code=403, detail="TELEGRAM_LOGIN_DISABLED")
        
    client_ip = request.client.host if request.client else "unknown"
    
    # Basic Rate Limit
    if await redis_client.get(f"auth:ban:{client_ip}"):
        raise HTTPException(status_code=429, detail="TOO_MANY_ATTEMPTS")

    admin = db.query(AdminUser).filter(AdminUser.username == payload.username).first()
    if not admin:
        # Silent fail or fake pending? Better to just fail for security monitoring.
        raise HTTPException(status_code=401, detail="Invalid username")

    country = "Unknown"
    try:
        geo = get_geoip_info(client_ip)
        if geo: country = geo.get("country_code", "Unknown")
    except: pass

    # Trigger Approval Flow
    tx_id = secrets.token_hex(16)
    ua = request.headers.get("user-agent", "Unknown")
    pending_data = {
        "username": admin.username,
        "ip": client_ip,
        "country": country,
        "ua": ua,
        "flow": "passwordless"
    }
    await redis_client.set(f"tg_auth_pending:{tx_id}", json.dumps(pending_data), ex=120)
    await redis_client.set(f"tg_auth_status:{tx_id}", "PENDING", ex=120)
    
    background_tasks.add_task(
        telegram_service.send_telegram_approval,
        cfg.get("telegram_bot_token"),
        cfg.get("telegram_chat_id"),
        tx_id,
        admin.username,
        client_ip,
        country
    )
    return {"status": "TELEGRAM_APPROVAL_PENDING", "tx_id": tx_id}

async def create_session_and_respond(admin, client_ip, country, request, db, cfg, background_tasks):
    from app.core.time_utils import get_now_str
    sid = uuid.uuid4().hex
    ua = request.headers.get("user-agent", "Unknown")
    session_meta = {
        "sid": sid,
        "username": admin.username,
        "ip": client_ip,
        "ua": ua,
        "country": country,
        "created_at": get_now_str(cfg.get("timezone", "UTC"))
    }
    timeout_mins = cfg.get("session_timeout", 120)
    await redis_client.set(f"admin_session:{sid}", json.dumps(session_meta), ex=timeout_mins * 60)
    await log_security_event(db, admin.id, "ADMIN_LOGIN", f"Admin {admin.username} logged in from {client_ip}", client_ip, ua)
    if cfg.get("telegram_alerts", {}).get("admin_login"):
        msg = telegram_service.format_login_alert(admin.username, client_ip, country, ua)
        background_tasks.add_task(telegram_service.send_telegram_alert, cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg)
    await record_auth_attempt(success=True)
    access_token = create_access_token(data={"sub": admin.username, "sid": sid})
    return {"access_token": access_token, "token_type": "bearer", "username": admin.username, "status": "success"}

@router.get("/telegram-approval/{tx_id}")
async def check_telegram_approval(
    tx_id: str, 
    request: Request,
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    status = await redis_client.get(f"tg_auth_status:{tx_id}")
    if not status or status == "DENIED":
        raise HTTPException(status_code=401, detail="LOGIN_DENIED" if status else "TX_EXPIRED")
    
    if status == "PENDING":
        return {"status": "PENDING"}
    
    # APPROVED
    raw_pending = await redis_client.get(f"tg_auth_pending:{tx_id}")
    if not raw_pending:
        raise HTTPException(status_code=400, detail="PENDING_DATA_LOST")
        
    pending = json.loads(raw_pending)
    admin = db.query(AdminUser).filter(AdminUser.username == pending["username"]).first()
    if not admin:
        raise HTTPException(status_code=404)
        
    cfg = load_hub_config(db)
    # Clean up
    await redis_client.delete(f"tg_auth_status:{tx_id}")
    await redis_client.delete(f"tg_auth_pending:{tx_id}")
    
    return await create_session_and_respond(admin, pending["ip"], pending["country"], request, db, cfg, background_tasks)


@router.post("/test-telegram")
async def test_telegram(
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    cfg = load_hub_config(db)
    token = cfg.get("telegram_bot_token")
    chat_id = cfg.get("telegram_chat_id")
    
    if not token or not chat_id:
        raise HTTPException(status_code=400, detail="Telegram not configured")
        
    success = await telegram_service.send_telegram_alert(
        token, 
        chat_id, 
        f"🤖 *HiVoid Hub Connection Test*\n\nYour bot is correctly configured for admin: `{current_admin.username}`"
    )
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to send test message")
        
    return {"status": "success"}


@router.post("/setup", response_model=Token, summary="First-time admin account creation")
async def setup_admin(payload: AdminCreate, db: Session = Depends(get_db)):
    """
    Creates the first admin account. Will fail if any admin already exists.
    This endpoint is used by install.sh during initial setup.
    """
    existing = db.query(AdminUser).first()
    if existing:
        raise HTTPException(status_code=400, detail="Admin account already configured. Use /login.")
    
    hashed = get_password_hash(payload.password)
    admin = AdminUser(username=payload.username, hashed_password=hashed)
    db.add(admin)
    db.commit()
    db.refresh(admin)
    
    access_token = create_access_token(data={"sub": admin.username})
    return {"access_token": access_token, "token_type": "bearer", "username": admin.username}


@router.get("/me", summary="Get current admin info")
async def get_me(current_admin: AdminUser = Depends(get_current_admin)):
    """Returns admin info — validates the stored JWT token."""
    return {
        "status": "authenticated", 
        "username": current_admin.username,
        "totp_enabled": current_admin.totp_enabled,
        "webauthn_credentials": current_admin.webauthn_credentials or []
    }


@router.put("/profile", summary="Update admin username")
async def update_profile(
    payload: ProfileUpdate, 
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if payload.new_username:
        # Check if username exists
        exists = db.query(AdminUser).filter(AdminUser.username == payload.new_username).first()
        if exists and exists.id != current_admin.id:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_admin.username = payload.new_username
    
    db.commit()
    await log_security_event(db, current_admin.id, "PROFILE_UPDATE", f"Username changed to {current_admin.username}", "n/a", "n/a")
    return {"status": "updated", "username": current_admin.username}


@router.put("/password", summary="Update admin password")
async def update_password(
    payload: PasswordUpdate,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    from app.core.auth import verify_password
    if not verify_password(payload.current_password, current_admin.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    current_admin.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    await log_security_event(db, current_admin.id, "PASSWORD_CHANGE", "Admin password changed", "n/a", "n/a")
    return {"status": "password_updated"}


@router.get("/2fa/setup", response_model=TOTPSetup, summary="Generate 2FA secret")
async def setup_2fa(current_admin: AdminUser = Depends(get_current_admin)):
    import pyotp
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current_admin.username, issuer_name="HiVoid Hub")
    return {"secret": secret, "uri": uri}


@router.post("/2fa/enable", summary="Verify and enable 2FA")
async def enable_2fa(
    payload: TOTPEnable,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    import pyotp
    import traceback
    try:
        totp = pyotp.TOTP(payload.secret)
        if not totp.verify(payload.code, valid_window=1):
            raise HTTPException(status_code=400, detail="Invalid verification code")
        
        current_admin.totp_secret = payload.secret
        current_admin.totp_enabled = True
        
        # Generate Recovery Codes
        codes = []
        for _ in range(8):
            code = ''.join(secrets.choice(string.digits) for _ in range(10))
            codes.append(code)
        current_admin.totp_recovery_codes = codes
        flag_modified(current_admin, "totp_recovery_codes")
        
        db.commit()
        await log_security_event(db, current_admin.id, "2FA_ENABLED", "Two-factor authentication enabled", "n/a", "n/a")
        return {"status": "2fa_enabled", "recovery_codes": codes}
    except Exception as e:
        db.rollback()
        logger.error(f"Error in enable_2fa: {str(e)}")
        logger.error(traceback.format_exc())
        
        if isinstance(e, HTTPException):
            raise e
            
        error_msg = str(e)
        if "base32" in error_msg.lower() or "binascii" in error_msg.lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid 2FA secret format. Please setup again.")
            
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal Server Error: {error_msg}")


@router.delete("/2fa/disable", summary="Disable 2FA")
async def disable_2fa(
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    current_admin.totp_enabled = False
    current_admin.totp_secret = None
    current_admin.totp_recovery_codes = None
    db.commit()
    await log_security_event(db, current_admin.id, "2FA_DISABLED", "Two-factor authentication disabled", "n/a", "n/a")
    return {"status": "2fa_disabled"}


@router.post("/unlock")
async def unlock(
    payload: UnlockRequest,
    current_admin: AdminUser = Depends(get_current_admin)
):
    from app.core.auth import verify_password
    if not verify_password(payload.password, current_admin.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    return {"status": "unlocked"}


@router.post("/logout")
async def logout(
    current_admin: AdminUser = Depends(get_current_admin)
):
    sid = getattr(current_admin, "_sid", None)
    if sid:
        await redis_client.delete(f"admin_session:{sid}")
    return {"status": "logged_out"}


@router.get("/sessions", summary="Get all active admin sessions")
async def get_active_sessions(current_admin: AdminUser = Depends(get_current_admin)):
    from app.core.redis_client import redis_client
    keys = await redis_client.keys("admin_session:*")
    sessions = []
    current_sid = getattr(current_admin, "_sid", None)
    
    for key in keys:
        raw = await redis_client.get(key)
        if raw:
            meta = json.loads(raw)
            meta["is_current"] = (meta.get("sid") == current_sid)
            sessions.append(meta)
    
    # Sort by created_at descending
    sessions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return sessions


@router.delete("/sessions/{sid}", summary="Revoke an active session")
async def revoke_session(
    sid: str, 
    current_admin: AdminUser = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    # You cannot revoke your own session via this endpoint
    my_sid = getattr(current_admin, "_sid", None)

    # You cannot revoke your own session via this endpoint
    if sid == my_sid:
        raise HTTPException(status_code=400, detail="CANNOT_REVOKE_SELF")
        
    await redis_client.delete(f"admin_session:{sid}")
    await log_security_event(db, current_admin.id, "SESSION_REVOKE", f"Session {sid} was revoked", "n/a", "n/a")
    return {"status": "revoked"}



@router.get("/audit-logs", summary="Get administrative audit logs")
async def get_audit_logs(
    limit: int = 100,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return logs


@router.get("/login-path", summary="Get the current required login path")
async def get_login_path(db: Session = Depends(get_db)):
    """Returns the custom path required to access the login page."""
    cfg = load_hub_config(db)
    return {"login_path": cfg.get("login_path", "login")}


@router.get("/public-info")
async def get_public_info(db: Session = Depends(get_db)):
    cfg = load_hub_config(db)
    return {
        "login_path": cfg.get("login_path", "login"),
        "telegram_login_auth": cfg.get("telegram_login_auth", False)
    }


@router.get("/hub-token", summary="Get current hub master token")
async def get_hub_token(current_admin: AdminUser = Depends(get_current_admin)):
    """Returns the active HUB master token from runtime settings."""
    return {"hub_master_token": settings.HUB_MASTER_TOKEN}


@router.get("/hub-config", summary="Get global hub client defaults")
async def get_hub_config(
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    _ = current_admin
    return load_hub_config(db)


@router.put("/hub-config", summary="Update global hub client defaults")
async def update_hub_config(
    payload: HubConfigUpdate,
    background_tasks: BackgroundTasks,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    current_cfg = load_hub_config(db)
    received_updates = payload.model_dump(exclude_unset=True)
    
    # Find active changes
    actual_updates = {}
    for k, v in received_updates.items():
        if current_cfg.get(k) != v:
            actual_updates[k] = v

    if not actual_updates:
        return current_cfg

    # Apply limits
    if actual_updates.get("default_data_limit") is not None:
        from app.api.v1.endpoints.auth import BIGINT_MAX
        actual_updates["default_data_limit"] = max(0, min(int(actual_updates["default_data_limit"]), BIGINT_MAX))
    
    updated_cfg = save_hub_config(db, actual_updates)
    
    # Notify Telegram for Config Change
    if updated_cfg.get("telegram_alerts", {}).get("config_changed"):
        # Summarize changes
        summary = ", ".join(actual_updates.keys())
        msg = telegram_service.format_config_alert(current_admin.username, summary, tz=updated_cfg.get("timezone", "UTC"))
        background_tasks.add_task(
            telegram_service.send_telegram_alert, 
            updated_cfg.get("telegram_bot_token"), 
            updated_cfg.get("telegram_chat_id"), 
            msg
        )
    
    await log_security_event(db, current_admin.id, "CONFIG_UPDATED", f"Updated fields: {', '.join(actual_updates.keys())}", "n/a", "n/a")
    return updated_cfg


# --- WEBAUTHN (PASSKEYS) ---

@router.post("/webauthn/register/options")
async def webauthn_register_options(request: Request, current_admin: AdminUser = Depends(get_current_admin)):
    # Automatically determine rp_id from Host header
    host = request.headers.get("host", "localhost").split(":")[0]
    
    options = generate_registration_options(
        rp_id=host,
        rp_name="HiVoid Hub",
        user_id=str(current_admin.id).encode(),
        user_name=current_admin.username,
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )
    # Store challenge as base64 string in Redis (because decode_responses=True)
    challenge_b64 = base64.b64encode(options.challenge).decode()
    await redis_client.set(f"webauthn_reg_challenge:{current_admin.id}", challenge_b64, ex=300)
    return json.loads(options_to_json(options))

@router.post("/webauthn/register/verify")
async def webauthn_register_verify(
    request: Request,
    payload: WebAuthnRegisterComplete,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    challenge_b64 = await redis_client.get(f"webauthn_reg_challenge:{current_admin.id}")
    if not challenge_b64:
        raise HTTPException(status_code=400, detail="Challenge expired")
    
    # Automatically determine host and origin
    host = request.headers.get("host", "localhost").split(":")[0]
    # Robust protocol detection: check X-Forwarded-Proto, or trust Origin if it matches host
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    if proto != "https":
        origin_hdr = request.headers.get("origin")
        if origin_hdr and origin_hdr.startswith("https://") and host in origin_hdr:
            proto = "https"
    origin = f"{proto}://{host}"
    try:
        challenge = base64.b64decode(challenge_b64)
        verification = verify_registration_response(
            credential=payload.response,
            expected_challenge=challenge,
            expected_origin=origin,
            expected_rp_id=host,
        )

        # Use URL-SAFE base64 to avoid slashes in URLs during deletion
        cred = {
            "credential_id": base64.urlsafe_b64encode(verification.credential_id).decode(),
            "public_key": base64.urlsafe_b64encode(verification.credential_public_key).decode(),
            "sign_count": verification.sign_count,
            "transports": payload.response.get("response", {}).get("transports", []),
            "created_at": datetime.utcnow().isoformat(),
            "last_used_at": datetime.utcnow().isoformat(),
            "login_count": 1
        }
        
        if not current_admin.webauthn_credentials:
            current_admin.webauthn_credentials = []
        
        # Store multiple credentials
        current_admin.webauthn_credentials = current_admin.webauthn_credentials + [cred]
        db.commit()
    except Exception as e:
        db.rollback()
        logging.error(f"Passkey Verification Failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


    await log_security_event(db, current_admin.id, "PASSKEY_REGISTERED", "New passkey added", "n/a", "n/a")
    return {"status": "registered"}

@router.post("/webauthn/login/options")
async def webauthn_login_options(request: Request, payload: WebAuthnLoginBegin, db: Session = Depends(get_db)):
    admin = db.query(AdminUser).filter(AdminUser.username == payload.username).first()
    if not admin or not admin.webauthn_credentials:
        raise HTTPException(status_code=404, detail="No passkeys found")

    host = request.headers.get("host", "localhost").split(":")[0]
    
    allow_credentials = []
    for c in admin.webauthn_credentials:
        try:
            cid_str = c.get("credential_id")
            if not cid_str or not isinstance(cid_str, str):
                continue
            # Try both URL-safe and standard padding to be robust
            cid_bytes = base64.urlsafe_b64decode(cid_str + "===") if "-" in cid_str or "_" in cid_str else base64.b64decode(cid_str)
            allow_credentials.append(PublicKeyCredentialDescriptor(id=cid_bytes))
        except Exception as e:
            logging.warning(f"Skipping malformed credential in login: {e}")
            continue

    if not allow_credentials:
        raise HTTPException(status_code=404, detail="No valid passkeys found")

    options = generate_authentication_options(
        rp_id=host,
        allow_credentials=allow_credentials,
    )
    # Store challenge as base64 string
    challenge_b64 = base64.b64encode(options.challenge).decode()
    await redis_client.set(f"webauthn_auth_challenge:{admin.username}", challenge_b64, ex=300)
    return json.loads(options_to_json(options))

@router.post("/webauthn/login/verify")
async def webauthn_login_verify(
    request: Request,
    payload: WebAuthnLoginComplete,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    admin = db.query(AdminUser).filter(AdminUser.username == payload.username).first()
    if not admin: raise HTTPException(status_code=404)

    challenge_b64 = await redis_client.get(f"webauthn_auth_challenge:{admin.username}")
    if not challenge_b64: raise HTTPException(status_code=400, detail="Challenge expired")
    challenge = base64.b64decode(challenge_b64)

    # Find matching credential
    cred_id = payload.response.get("id")
    
    def normalize_id(cid: str) -> str:
        return cid.replace("+", "-").replace("/", "_").rstrip("=")

    normalized_input_id = normalize_id(cred_id)
    stored_cred = next((
        c for c in admin.webauthn_credentials 
        if normalize_id(c["credential_id"]) == normalized_input_id
    ), None)
    
    if not stored_cred: 
        raise HTTPException(status_code=400, detail="Credential not found")

    # Automatically determine host and origin
    host = request.headers.get("host", "localhost").split(":")[0]
    # Robust protocol detection: check X-Forwarded-Proto, or trust Origin if it matches host
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    if proto != "https":
        origin_hdr = request.headers.get("origin")
        if origin_hdr and origin_hdr.startswith("https://") and host in origin_hdr:
            proto = "https"
    origin = f"{proto}://{host}"

    try:
        client_ip = request.client.host if request.client else "unknown"
        
        # Handle decoding of public key robustly
        pk_str = stored_cred["public_key"]
        pk_bytes = base64.urlsafe_b64decode(pk_str + "===") if "-" in pk_str or "_" in pk_str else base64.b64decode(pk_str)
        
        verification = verify_authentication_response(
            credential=payload.response,
            expected_challenge=challenge,
            expected_origin=origin,
            expected_rp_id=host,
            credential_public_key=pk_bytes,
            credential_current_sign_count=stored_cred["sign_count"],
        )

        # Update sign count
        # Ensure we create a fresh list of dicts for SQLAlchemy mutation detection
        new_creds = []
        updated_any = False
        for c in admin.webauthn_credentials:
            nc = dict(c) # Shallow copy
            if normalize_id(c["credential_id"]) == normalized_input_id:
                nc["sign_count"] = verification.new_sign_count
                nc["last_used_at"] = datetime.utcnow().isoformat()
                nc["login_count"] = int(nc.get("login_count", 0)) + 1
                updated_any = True
            new_creds.append(nc)
        
        if updated_any:
            admin.webauthn_credentials = new_creds
            flag_modified(admin, "webauthn_credentials")
            db.commit()
            db.refresh(admin)
            logger.info(f"✅ Passkey login_count updated for user {admin.username}")
        else:
            logger.warning(f"⚠️ Could not find credential {normalized_input_id} in admin list for update")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    # 1. IP Whitelist and Geo-Fencing (Security checks)
    cfg = load_hub_config(db)
    whitelist = cfg.get("admin_ip_whitelist", [])
    if not is_ip_allowed(client_ip, whitelist):
        raise HTTPException(status_code=403, detail="IP_NOT_ALLOWED")

    country = "Unknown"
    try:
        geo = get_geoip_info(client_ip)
        if geo: country = geo.get("country_code", "Unknown")
    except: pass
    
    geo_whitelist = cfg.get("admin_geo_whitelist", [])
    if geo_whitelist and country not in geo_whitelist:
        raise HTTPException(status_code=403, detail="GEO_NOT_ALLOWED")

    sid = uuid.uuid4().hex
    ua = request.headers.get("user-agent", "Unknown")
    
    from app.core.time_utils import get_now_str
    session_meta = {
        "sid": sid,
        "username": admin.username,
        "ip": client_ip,
        "ua": ua,
        "country": country,
        "created_at": get_now_str(cfg.get("timezone", "UTC"))
    }
    
    timeout_mins = cfg.get("session_timeout", 120)
    await redis_client.set(f"admin_session:{sid}", json.dumps(session_meta), ex=timeout_mins * 60)
    
    await log_security_event(db, admin.id, "PASSKEY_LOGIN", f"Passkey login from {client_ip}", client_ip, ua)
    
    # Notify Telegram in background
    if cfg.get("telegram_alerts", {}).get("admin_login"):
        msg = telegram_service.format_login_alert(admin.username, client_ip, country, ua, tz=cfg.get("timezone", "UTC"))
        background_tasks.add_task(telegram_service.send_telegram_alert, cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg)

    await record_auth_attempt(success=True)
    access_token = create_access_token(data={"sub": admin.username, "sid": sid})
    return {"access_token": access_token, "token_type": "bearer", "username": admin.username}

@router.delete("/webauthn/credentials/{cred_id:path}")
async def delete_webauthn_credential(
    cred_id: str,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Deleted a credential. Using :path allows slashes in the cred_id 
    (from standard base64) to be captured correctly.
    """
    if not current_admin.webauthn_credentials: 
        return {"status": "deleted"}
        
    # Standardize: check both encoded and decoded or literal
    new_creds = [c for c in current_admin.webauthn_credentials if c["credential_id"] != cred_id]
    
    if len(new_creds) == len(current_admin.webauthn_credentials):
        # If not found directly, try un-escaping common URL encodings
        from urllib.parse import unquote
        decoded_id = unquote(cred_id)
        new_creds = [c for c in current_admin.webauthn_credentials if c["credential_id"] != decoded_id]

    current_admin.webauthn_credentials = new_creds
    flag_modified(current_admin, "webauthn_credentials")
    db.commit()
    return {"status": "deleted"}
