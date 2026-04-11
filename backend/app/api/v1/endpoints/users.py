from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.hub_config import load_hub_config
from app.models.base import User as DBUser
from app.schemas.user import User, UserCreate, UserUpdate
from app.crud.crud_user import (
    create_user,
    get_active_users,
    get_all_users,
    update_user,
    build_user_sync_payload,
    delete_user_permanent,
)
from app.core.redis_client import redis_client
from app.services.node_manager import node_manager
from app.services.audit_service import log_security_event
from app.services.dashboard_metrics import record_disconnect_reason
from app.services import telegram_service
import logging
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)
BIGINT_MAX = 9223372036854775807

router = APIRouter(dependencies=[Depends(get_current_admin)])


async def _broadcast_full_sync(db: Session):
    """Helper: re-sync all active user policies to all connected nodes."""
    active_users = get_active_users(db)
    users_list = [build_user_sync_payload(u) for u in active_users]
    await node_manager.broadcast_sync(users_list)


async def _safe_broadcast_full_sync(db: Session, ctx: str):
    """Best-effort SYNC: never break user CRUD if node broadcast fails."""
    try:
        await _broadcast_full_sync(db)
    except Exception as e:
        logger.exception(f"SYNC broadcast failed during {ctx}: {e}")


async def _safe_broadcast_kill(uuid: str, ctx: str, reason: str = "manual_revoke"):
    """Best-effort REVOKE: log failures without failing the API request."""
    try:
        await record_disconnect_reason(reason)
        await node_manager.broadcast_kill_signal(uuid)
    except Exception as e:
        logger.exception(f"KILL broadcast failed during {ctx} for {uuid}: {e}")


@router.post("/", response_model=User)
async def create_new_user(user: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_admin=Depends(get_current_admin)):
    if user.data_limit < 0 or user.data_limit > BIGINT_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"data_limit must be between 0 and {BIGINT_MAX} bytes"
        )
    hub_config = load_hub_config(db)
    patch = {}
    if not (user.mode or "").strip():
        patch["mode"] = (hub_config.get("default_mode") or "").strip()
    if not (user.obfs or "").strip():
        patch["obfs"] = (hub_config.get("default_obfs") or "").strip()
    if patch:
        user = user.model_copy(update=patch)

    db_user = db.query(DBUser).filter(DBUser.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    try:
        new_user = create_user(db=db, user=user)
        await log_security_event(db, current_admin.id, "USER_CREATED", f"User {new_user.username} created", "n/a", "n/a")
    except SQLAlchemyError as e:
        db.rollback()
        logger.exception(f"create_user failed for username={user.username}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database schema mismatch or DB error. Run backend migrate_v2.py on production and retry."
        )
    logger.info(f"👤 Created new subscriber: {new_user.username} (UUID: {new_user.uuid})")
    
    # Notify Telegram
    cfg = load_hub_config(db)
    if cfg.get("telegram_alerts", {}).get("user_created"):
        msg = telegram_service.format_user_action_alert(new_user.username, "Created")
        background_tasks.add_task(telegram_service.send_telegram_alert, cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg)
    if cfg.get("telegram_alerts", {}).get("subscription_created"):
        msg = telegram_service.format_subscription_alert(new_user.username, "Created")
        background_tasks.add_task(telegram_service.send_telegram_alert, cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg)

    # Sync to all nodes immediately
    await _safe_broadcast_full_sync(db, "create_user")
    
    return new_user


@router.get("/", response_model=List[User])
async def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users_db = get_all_users(db, skip=skip, limit=limit)
    
    enriched_users = []
    for user_db in users_db:
        # Calculate total live requests from all nodes for this user
        keys = await redis_client.keys(f"node:*:user:{user_db.uuid}:online")
        active_requests = 0
        for key in keys:
            val = await redis_client.get(key)
            current_val = int(val or 0)
            if current_val > 0:
                active_requests += current_val
            else:
                parts = key.split(":")
                if len(parts) >= 4:
                    node_id = parts[1]
                    await redis_client.delete(
                        key,
                        f"node:{node_id}:user:{user_db.uuid}:connected_at",
                        f"node:{node_id}:user:{user_db.uuid}:src_ip",
                    )
                
        # Fetch traffic data (uploaded / downloaded bytes)
        traffic_hash = await redis_client.hgetall(f"user:{user_db.uuid}:traffic")
        if traffic_hash:
            bytes_in = int(traffic_hash.get(b'total_in', traffic_hash.get('total_in', 0)))
            bytes_out = int(traffic_hash.get(b'total_out', traffic_hash.get('total_out', 0)))
            total_bytes = int(traffic_hash.get(b'total_bytes', traffic_hash.get('total_bytes', 0)))
        else:
            bytes_in = 0
            bytes_out = 0
            total_bytes = 0
        
        user_data = User.model_validate(user_db)
        user_data.activeRequests = active_requests
        user_data.bytesIn = bytes_in
        user_data.bytesOut = bytes_out
        user_data.totalBytes = total_bytes
        enriched_users.append(user_data)
        
    return enriched_users


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(uuid: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_admin=Depends(get_current_admin)):
    db_user = db.query(DBUser).filter(DBUser.uuid == uuid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Send kill signal
    await _safe_broadcast_kill(uuid, "delete_user_pre_disable", reason="policy_disable")
    
    db_user.is_active = False
    db.commit()
    await log_security_event(db, current_admin.id, "USER_DISABLED", f"User {db_user.username} disabled", "n/a", "n/a")
    
    # Notify Telegram for Revocation
    cfg = load_hub_config(db)
    if cfg.get("telegram_alerts", {}).get("subscription_revoked"):
        msg = telegram_service.format_subscription_alert(db_user.username, "Revoked")
        background_tasks.add_task(telegram_service.send_telegram_alert, cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg)
    
    # Re-sync so nodes remove the user
    await _safe_broadcast_full_sync(db, "delete_user_post_disable")
    return


@router.delete("/{uuid}/permanent", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_permanently(uuid: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_admin=Depends(get_current_admin)):
    db_user = db.query(DBUser).filter(DBUser.uuid == uuid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    await _safe_broadcast_kill(uuid, "delete_user_permanent_pre_delete", reason="manual_delete")
    username = db_user.username
    delete_user_permanent(db, db_user)
    await log_security_event(db, current_admin.id, "USER_DELETED", f"User {username} permanently deleted", "n/a", "n/a")
    
    # Notify Telegram for Deletion
    cfg = load_hub_config(db)
    if cfg.get("telegram_alerts", {}).get("user_deleted"):
        msg = telegram_service.format_user_action_alert(username, "Permanently Deleted")
        background_tasks.add_task(telegram_service.send_telegram_alert, cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg)

    await _safe_broadcast_full_sync(db, "delete_user_permanent_post_delete")
    return


@router.put("/{uuid}", response_model=User)
async def update_existing_user(uuid: str, user_update: UserUpdate, db: Session = Depends(get_db), current_admin=Depends(get_current_admin)):
    db_user = db.query(DBUser).filter(DBUser.uuid == uuid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    updated_user = update_user(db, db_user, user_update)
    await log_security_event(db, current_admin.id, "USER_UPDATED", f"User {updated_user.username} updated", "n/a", "n/a")
    logger.info(f"📝 Updated subscriber policy: {updated_user.username} (UUID: {updated_user.uuid})")
    
    # Update Redis cache if limits changed
    if user_update.data_limit is not None:
        await redis_client.set(f"user:{updated_user.uuid}:limit", updated_user.data_limit)
    
    # Re-sync all nodes with new user policies
    await _safe_broadcast_full_sync(db, "update_user")
    
    # If user was disabled or critical limits changed, also kill existing sessions
    if user_update.is_active is False:
        logger.info(f"🚫 Subscriber {updated_user.username} disabled. Broadcasting kill signal.")
        await _safe_broadcast_kill(updated_user.uuid, "update_user_disable", reason="policy_disable")
    
    return updated_user


@router.post("/{uuid}/revoke", status_code=status.HTTP_200_OK)
async def revoke_user_access(uuid: str, db: Session = Depends(get_db), current_admin=Depends(get_current_admin)):
    db_user = db.query(DBUser).filter(DBUser.uuid == uuid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    await _safe_broadcast_kill(uuid, "revoke_user_access", reason="manual_revoke")
    await log_security_event(db, current_admin.id, "USER_REVOKED", f"User {db_user.username} access revoked", "n/a", "n/a")
    return {"status": "revoked"}


@router.post("/{uuid}/reset-traffic", status_code=status.HTTP_200_OK)
async def reset_user_traffic(uuid: str, db: Session = Depends(get_db), current_admin=Depends(get_current_admin)):
    """Reset traffic counters for a specific user."""
    db_user = db.query(DBUser).filter(DBUser.uuid == uuid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete traffic hash in Redis
    await redis_client.delete(f"user:{uuid}:traffic")
    
    # Delete per-node last usage keys
    node_keys = await redis_client.keys(f"node:*:user:{uuid}:last_usage_*")
    for key in node_keys:
        await redis_client.delete(key)
    
    logger.info(f"🔄 Traffic reset for user {uuid} ({db_user.username}). All node-local counters cleared.")
    return {"status": "traffic_reset", "uuid": uuid}
