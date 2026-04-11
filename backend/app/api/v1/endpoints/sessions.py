from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.core.database import get_db
from app.core.redis_client import redis_client
from app.models.base import Node as DBNode
from app.models.base import User as DBUser

router = APIRouter(dependencies=[Depends(get_current_admin)])


def _utc_iso_from_ts(ts: str | None) -> str:
    if not ts:
        return ""
    try:
        dt = datetime.fromtimestamp(float(ts), tz=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")
    except Exception:
        return ""


async def _cleanup_stale_presence_key(key: str):
    """
    Remove stale presence key and associated metadata.
    """
    parts = key.split(":")
    if len(parts) < 5:
        await redis_client.delete(key)
        return
    node_id = parts[1]
    user_uuid = parts[3]
    await redis_client.delete(
        key,
        f"node:{node_id}:user:{user_uuid}:connected_at",
        f"node:{node_id}:user:{user_uuid}:src_ip",
    )


@router.get("/connected-users")
async def connected_users(db: Session = Depends(get_db)):
    # key format: node:<node_id>:user:<uuid>:online
    online_keys = await redis_client.keys("node:*:user:*:online")
    if not online_keys:
        return {"items": [], "total_sessions": 0}

    # Build quick lookup for email by uuid
    users = db.query(DBUser).all()
    email_by_uuid = {u.uuid: (u.email or "") for u in users}
    username_by_uuid = {u.uuid: (u.username or "") for u in users}
    nodes = db.query(DBNode).all()
    node_name_by_id = {n.node_id: (n.name or n.node_id) for n in nodes}

    items = []
    total_sessions = 0
    for key in online_keys:
        try:
            request_pool = int(await redis_client.get(key) or 0)
        except Exception:
            request_pool = 0
        if request_pool <= 0:
            await _cleanup_stale_presence_key(key)
            continue

        parts = key.split(":")
        if len(parts) < 5:
            continue
        node_id = parts[1]
        user_uuid = parts[3]
        total_sessions += request_pool

        connected_at_key = f"node:{node_id}:user:{user_uuid}:connected_at"
        src_ip_key = f"node:{node_id}:user:{user_uuid}:src_ip"
        # Node-local counters for this user: this is the live session traffic source.
        last_usage_in_key = f"node:{node_id}:user:{user_uuid}:last_usage_in"
        last_usage_out_key = f"node:{node_id}:user:{user_uuid}:last_usage_out"

        bytes_in_raw = await redis_client.get(last_usage_in_key)
        bytes_out_raw = await redis_client.get(last_usage_out_key)
        bytes_in = int(bytes_in_raw or 0)
        bytes_out = int(bytes_out_raw or 0)
        connected_at_raw = await redis_client.get(connected_at_key)
        src_ip = await redis_client.get(src_ip_key) or ""

        items.append(
            {
                "uuid": user_uuid,
                "email": email_by_uuid.get(user_uuid, ""),
                "username": username_by_uuid.get(user_uuid, ""),
                "config_name": username_by_uuid.get(user_uuid, ""),
                "upload_bytes": bytes_out,
                "download_bytes": bytes_in,
                "connection_time": _utc_iso_from_ts(connected_at_raw),
                "node": node_id,
                "node_name": node_name_by_id.get(node_id, node_id),
                "ip_src": src_ip,
                "active_sessions": request_pool,
            }
        )

    items.sort(key=lambda x: x.get("connection_time") or "", reverse=True)
    return {"items": items, "total_sessions": total_sessions}
