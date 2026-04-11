from datetime import datetime, timedelta, timezone
from statistics import median
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.core.database import get_db
from app.core.redis_client import redis_client
from app.models.base import User as DBUser
from app.models.base import Node as DBNode
from app.services.node_manager import node_manager
from app.services.dashboard_metrics import (
    acknowledge_alert,
    average_minute_gauge,
    get_alert_ack_map,
    set_minute_gauge,
    sum_minute_counter,
    summarize_disconnect_reasons,
)

router = APIRouter()


def _safe_int(value, fallback: int = 0) -> int:
    try:
        return int(float(value))
    except Exception:
        return fallback


async def _cleanup_stale_presence_key(key: str):
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


async def _collect_live_sessions() -> list[dict]:
    sessions: list[dict] = []
    online_keys = await redis_client.keys("node:*:user:*:online")

    for key in online_keys:
        request_pool = _safe_int(await redis_client.get(key), 0)
        if request_pool <= 0:
            await _cleanup_stale_presence_key(key)
            continue

        parts = key.split(":")
        if len(parts) < 5:
            continue

        node_id = parts[1]
        user_uuid = parts[3]
        connected_at_raw = await redis_client.get(f"node:{node_id}:user:{user_uuid}:connected_at")
        connected_at_ts = None
        if connected_at_raw is not None:
            try:
                connected_at_ts = float(connected_at_raw)
            except Exception:
                connected_at_ts = None

        sessions.append(
            {
                "node_id": node_id,
                "uuid": user_uuid,
                "request_pool": request_pool,
                "connected_at_ts": connected_at_ts,
            }
        )

    return sessions


async def _collect_global_traffic() -> dict:
    global_traffic_bytes = 0
    global_in_bytes = 0
    global_out_bytes = 0

    try:
        keys = await redis_client.keys("user:*:traffic")
        for key in keys:
            traffic_hash = await redis_client.hgetall(key)
            if not traffic_hash:
                continue
            global_traffic_bytes += _safe_int(traffic_hash.get("total_bytes"), 0)
            global_in_bytes += _safe_int(traffic_hash.get("total_in"), 0)
            global_out_bytes += _safe_int(traffic_hash.get("total_out"), 0)
    except Exception:
        global_traffic_bytes = 0
        global_in_bytes = 0
        global_out_bytes = 0

    traffic_gb = global_traffic_bytes / (1024 ** 3)
    traffic_str = f"{traffic_gb:.1f} GB"
    if traffic_gb > 1024:
        traffic_str = f"{(traffic_gb / 1024):.2f} TB"

    return {
        "global_traffic": traffic_str,
        "global_upload": global_in_bytes,
        "global_download": global_out_bytes,
    }


async def _build_global_snapshot(db: Session) -> tuple[dict, list[dict]]:
    active_users_count = db.query(DBUser).filter(DBUser.is_active == True).count()
    total_users_count = db.query(DBUser).count()

    expired_count = db.query(DBUser).filter(
        DBUser.expire_at != None,
        DBUser.expire_at < datetime.utcnow(),
        DBUser.is_active == True,
    ).count()

    connected_nodes_count = len(node_manager.active_nodes)
    sessions = await _collect_live_sessions()

    online_users_count = len({session["uuid"] for session in sessions})
    total_sessions = sum(session["request_pool"] for session in sessions)

    traffic = await _collect_global_traffic()

    network_load_pct = min(100.0, (connected_nodes_count * 9.0) + (total_sessions * 2.8))
    await set_minute_gauge("online_users", online_users_count)

    return {
        "active_users": active_users_count,
        "total_users": total_users_count,
        "online_users": online_users_count,
        "expired_users": expired_count,
        "connected_nodes": connected_nodes_count,
        "total_sessions": total_sessions,
        "global_traffic": traffic["global_traffic"],
        "global_upload": traffic["global_upload"],
        "global_download": traffic["global_download"],
        "network_load": f"{network_load_pct:.0f}%",
        "network_load_pct": round(network_load_pct, 2),
    }, sessions


def _health_item(status: str, label: str, detail: str, **extra) -> dict:
    payload = {
        "status": status,
        "label": label,
        "detail": detail,
    }
    payload.update(extra)
    return payload


async def _build_health_snapshot(db: Session, connected_nodes_count: int) -> dict:
    redis_status = "healthy"
    redis_detail = "Connected"
    redis_latency_ms = 0.0

    try:
        start = perf_counter()
        await redis_client.ping()
        redis_latency_ms = (perf_counter() - start) * 1000
        redis_detail = f"{redis_latency_ms:.1f} ms"
        if redis_latency_ms > 120:
            redis_status = "warning"
    except Exception:
        redis_status = "critical"
        redis_detail = "Unavailable"

    total_nodes_count = db.query(DBNode).count()
    pending_sync = db.query(DBNode).filter(DBNode.last_install_status == "requested").count()

    if total_nodes_count == 0:
        nodes_status = "warning"
        nodes_detail = "No registered nodes"
    elif connected_nodes_count == 0:
        nodes_status = "critical"
        nodes_detail = "All nodes offline"
    elif connected_nodes_count < total_nodes_count:
        nodes_status = "warning"
        nodes_detail = f"{connected_nodes_count}/{total_nodes_count} online"
    else:
        nodes_status = "healthy"
        nodes_detail = f"{connected_nodes_count}/{total_nodes_count} online"

    if pending_sync <= 0:
        sync_status = "healthy"
        sync_detail = "Queue empty"
    elif pending_sync <= 2:
        sync_status = "warning"
        sync_detail = f"{pending_sync} pending"
    else:
        sync_status = "critical"
        sync_detail = f"{pending_sync} pending"

    return {
        "api": _health_item("healthy", "API", "Live"),
        "redis": _health_item(redis_status, "Redis", redis_detail, latency_ms=round(redis_latency_ms, 2)),
        "nodes": _health_item(nodes_status, "Nodes", nodes_detail, connected=connected_nodes_count, total=total_nodes_count),
        "sync_queue": _health_item(sync_status, "Sync Queue", sync_detail, pending=pending_sync),
    }


async def _build_subscription_snapshot(db: Session) -> dict:
    now = datetime.utcnow()
    h24 = now + timedelta(hours=24)
    h72 = now + timedelta(hours=72)
    d7 = now + timedelta(days=7)

    active_users = db.query(DBUser).filter(DBUser.is_active == True).all()

    expiring_24h = 0
    expiring_72h = 0
    expiring_7d = 0
    near_quota_80 = 0
    near_quota_95 = 0
    near_quota_users = []

    for user in active_users:
        if user.expire_at and user.expire_at > now:
            if user.expire_at <= h24:
                expiring_24h += 1
            if user.expire_at <= h72:
                expiring_72h += 1
            if user.expire_at <= d7:
                expiring_7d += 1

        if not user.data_limit or user.data_limit <= 0:
            continue

        usage = _safe_int(await redis_client.hget(f"user:{user.uuid}:traffic", "total_bytes"), 0)
        pct = (usage / user.data_limit) * 100.0 if user.data_limit > 0 else 0.0

        if pct >= 80.0:
            near_quota_80 += 1
        if pct >= 95.0:
            near_quota_95 += 1
            near_quota_users.append(
                {
                    "uuid": user.uuid,
                    "username": user.username,
                    "usage_pct": round(pct, 2),
                    "used_bytes": usage,
                    "limit_bytes": int(user.data_limit),
                }
            )

    near_quota_users.sort(key=lambda item: item["usage_pct"], reverse=True)

    return {
        "active_users": len(active_users),
        "expiring_24h": expiring_24h,
        "expiring_72h": expiring_72h,
        "expiring_7d": expiring_7d,
        "near_quota_80": near_quota_80,
        "near_quota_95": near_quota_95,
        "near_quota_users": near_quota_users[:8],
    }


async def _build_connection_quality_snapshot(active_users_count: int, sessions: list[dict]) -> dict:
    now_ts = datetime.now(timezone.utc).timestamp()
    durations = []
    for session in sessions:
        connected_at_ts = session.get("connected_at_ts")
        if connected_at_ts is None:
            continue
        duration = max(0, int(now_ts - connected_at_ts))
        durations.append(duration)

    median_duration_sec = int(median(durations)) if durations else 0

    conn_success = await sum_minute_counter("conn_success", 15)
    conn_retries = await sum_minute_counter("conn_retries", 15)
    derived_attempts = conn_success + conn_retries

    if derived_attempts > 0:
        success_rate_pct = (conn_success / derived_attempts) * 100.0
    else:
        online_unique = len({session["uuid"] for session in sessions})
        if active_users_count > 0:
            success_rate_pct = (online_unique / active_users_count) * 100.0
        else:
            success_rate_pct = 100.0

    reconnect_rate_pct = (conn_retries / conn_success) * 100.0 if conn_success > 0 else 0.0
    disconnect_reasons = [item for item in await summarize_disconnect_reasons(24) if item["count"] > 0]

    return {
        "success_rate_pct": round(min(100.0, max(0.0, success_rate_pct)), 2),
        "median_connection_duration_sec": median_duration_sec,
        "reconnect_rate_pct": round(max(0.0, reconnect_rate_pct), 2),
        "reconnect_events_15m": conn_retries,
        "session_starts_15m": conn_success,
        "sessions_active": sum(session.get("request_pool", 0) for session in sessions),
        "disconnect_reasons": disconnect_reasons,
    }


async def _build_alerts(global_stats: dict, health: dict, connection_quality: dict, subscriptions: dict) -> list[dict]:
    alerts: list[dict] = []

    auth_failures_5m = await sum_minute_counter("auth_failures", 5)
    auth_attempts_5m = await sum_minute_counter("auth_attempts", 5)

    if auth_failures_5m >= 10:
        alerts.append(
            {
                "id": "auth-failure-spike",
                "severity": "critical",
                "title": "Authentication Failure Spike",
                "message": f"{auth_failures_5m} failed auth attempts detected in the last 5 minutes.",
                "metric": f"{auth_failures_5m}/{max(1, auth_attempts_5m)} failed",
            }
        )
    elif auth_failures_5m >= 5:
        alerts.append(
            {
                "id": "auth-failure-spike",
                "severity": "warning",
                "title": "Authentication Failure Increase",
                "message": f"{auth_failures_5m} failed auth attempts detected in the last 5 minutes.",
                "metric": f"{auth_failures_5m}/{max(1, auth_attempts_5m)} failed",
            }
        )

    current_online = global_stats.get("online_users", 0)
    avg_online_10m = await average_minute_gauge("online_users", 10, skip_current=True)
    if avg_online_10m >= 5:
        drop_count = avg_online_10m - current_online
        drop_ratio = drop_count / avg_online_10m if avg_online_10m > 0 else 0.0
        if drop_ratio >= 0.5 and drop_count >= 5:
            alerts.append(
                {
                    "id": "online-drop",
                    "severity": "critical",
                    "title": "Sudden Online User Drop",
                    "message": "Online users dropped sharply versus the 10-minute baseline.",
                    "metric": f"{current_online} now vs {avg_online_10m:.1f} baseline",
                }
            )
        elif drop_ratio >= 0.3 and drop_count >= 3:
            alerts.append(
                {
                    "id": "online-drop",
                    "severity": "warning",
                    "title": "Online User Drop Detected",
                    "message": "Online users are below normal baseline.",
                    "metric": f"{current_online} now vs {avg_online_10m:.1f} baseline",
                }
            )

    reconnect_rate = connection_quality.get("reconnect_rate_pct", 0.0)
    reconnect_events = connection_quality.get("reconnect_events_15m", 0)
    if reconnect_events >= 8 or reconnect_rate >= 25:
        alerts.append(
            {
                "id": "retry-spike",
                "severity": "critical",
                "title": "Reconnect Spike",
                "message": "Reconnect volume indicates unstable network sessions.",
                "metric": f"{reconnect_events} reconnects / 15m ({reconnect_rate:.1f}%)",
            }
        )
    elif reconnect_events >= 4 or reconnect_rate >= 12:
        alerts.append(
            {
                "id": "retry-spike",
                "severity": "warning",
                "title": "Reconnect Increase",
                "message": "Reconnect events are above normal range.",
                "metric": f"{reconnect_events} reconnects / 15m ({reconnect_rate:.1f}%)",
            }
        )

    pending_sync = health.get("sync_queue", {}).get("pending", 0)
    if pending_sync >= 5:
        alerts.append(
            {
                "id": "sync-queue-backlog",
                "severity": "critical",
                "title": "Sync Queue Backlog",
                "message": "Node installation/sync queue is heavily backlogged.",
                "metric": f"{pending_sync} pending",
            }
        )
    elif pending_sync >= 1:
        alerts.append(
            {
                "id": "sync-queue-backlog",
                "severity": "info",
                "title": "Pending Sync Tasks",
                "message": "There are pending node install/sync tasks in queue.",
                "metric": f"{pending_sync} pending",
            }
        )

    expiring_24h = subscriptions.get("expiring_24h", 0)
    if expiring_24h >= 5:
        alerts.append(
            {
                "id": "subscriptions-expiring-soon",
                "severity": "warning",
                "title": "Subscriptions Expiring Soon",
                "message": "Multiple active subscriptions will expire within 24 hours.",
                "metric": f"{expiring_24h} expiring in 24h",
            }
        )
    elif expiring_24h > 0:
        alerts.append(
            {
                "id": "subscriptions-expiring-soon",
                "severity": "info",
                "title": "Upcoming Expirations",
                "message": "Some active subscriptions are approaching expiry.",
                "metric": f"{expiring_24h} expiring in 24h",
            }
        )

    near_quota_95 = subscriptions.get("near_quota_95", 0)
    if near_quota_95 > 0:
        alerts.append(
            {
                "id": "quota-near-limit",
                "severity": "warning",
                "title": "Users Near Data Limit",
                "message": "Some users are above 95% of their data quota.",
                "metric": f"{near_quota_95} users > 95%",
            }
        )

    ack_map = await get_alert_ack_map([alert["id"] for alert in alerts])

    severity_order = {"critical": 0, "warning": 1, "info": 2}
    for alert in alerts:
        acked_at = ack_map.get(alert["id"], "")
        alert["acknowledged"] = bool(acked_at)
        alert["acked_at"] = acked_at

    alerts.sort(key=lambda alert: severity_order.get(alert["severity"], 99))
    return alerts

@router.get("/global")
async def get_global_stats(db: Session = Depends(get_db)):
    global_snapshot, _ = await _build_global_snapshot(db)
    return global_snapshot


@router.get("/insights", dependencies=[Depends(get_current_admin)])
async def get_dashboard_insights(db: Session = Depends(get_db)):
    global_snapshot, sessions = await _build_global_snapshot(db)
    health = await _build_health_snapshot(db, global_snapshot["connected_nodes"])
    connection_quality = await _build_connection_quality_snapshot(global_snapshot["active_users"], sessions)
    subscriptions = await _build_subscription_snapshot(db)
    alerts = await _build_alerts(global_snapshot, health, connection_quality, subscriptions)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "global": global_snapshot,
        "health": health,
        "connection_quality": connection_quality,
        "subscriptions": subscriptions,
        "alerts": alerts,
    }


@router.post("/alerts/{alert_id}/ack", dependencies=[Depends(get_current_admin)])
async def acknowledge_dashboard_alert(alert_id: str):
    normalized = "".join(ch for ch in (alert_id or "").strip().lower() if ch.isalnum() or ch in {"-", "_"})
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid alert id")

    await acknowledge_alert(normalized)
    return {"status": "acknowledged", "alert_id": normalized}
