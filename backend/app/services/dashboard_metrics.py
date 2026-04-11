from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable

from app.core.redis_client import redis_client

_MINUTE_FMT = "%Y%m%d%H%M"
_HOUR_FMT = "%Y%m%d%H"

COUNTER_TTL_SECONDS = 60 * 60 * 3
GAUGE_TTL_SECONDS = 60 * 60 * 2
REASON_TTL_SECONDS = 60 * 60 * 48
ALERT_ACK_TTL_SECONDS = 60 * 60 * 6

DISCONNECT_REASON_LABELS = {
    "policy_disable": "Policy Disabled",
    "manual_revoke": "Manual Revoke",
    "manual_delete": "Manual Delete",
    "limit_reached": "Data Limit Reached",
    "node_disconnect": "Node Disconnected",
    "unknown": "Unknown",
}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _minute_bucket(dt: datetime | None = None) -> str:
    return (dt or _now_utc()).strftime(_MINUTE_FMT)


def _hour_bucket(dt: datetime | None = None) -> str:
    return (dt or _now_utc()).strftime(_HOUR_FMT)


def _counter_key(name: str, bucket: str) -> str:
    return f"dashboard:counter:{name}:{bucket}"


def _gauge_key(name: str, bucket: str) -> str:
    return f"dashboard:gauge:{name}:{bucket}"


def _reason_key(reason: str, bucket: str) -> str:
    return f"dashboard:disconnect-reason:{reason}:{bucket}"


def _alert_ack_key(alert_id: str) -> str:
    return f"dashboard:alert:ack:{alert_id}"


async def _incr_minute_counter(name: str, amount: int = 1):
    amount = int(amount)
    if amount == 0:
        return
    key = _counter_key(name, _minute_bucket())
    await redis_client.incrby(key, amount)
    await redis_client.expire(key, COUNTER_TTL_SECONDS)


async def set_minute_gauge(name: str, value: int | float):
    key = _gauge_key(name, _minute_bucket())
    await redis_client.set(key, float(value), ex=GAUGE_TTL_SECONDS)


async def sum_minute_counter(name: str, minutes: int) -> int:
    minutes = max(1, int(minutes))
    now = _now_utc()
    keys = [
        _counter_key(name, _minute_bucket(now - timedelta(minutes=i)))
        for i in range(minutes)
    ]
    values = await redis_client.mget(keys)
    total = 0
    for value in values:
        try:
            total += int(float(value or 0))
        except Exception:
            continue
    return total


async def average_minute_gauge(name: str, minutes: int, skip_current: bool = False) -> float:
    minutes = max(1, int(minutes))
    now = _now_utc()
    offset = 1 if skip_current else 0
    keys = [
        _gauge_key(name, _minute_bucket(now - timedelta(minutes=i + offset)))
        for i in range(minutes)
    ]
    values = await redis_client.mget(keys)
    parsed = []
    for value in values:
        if value is None:
            continue
        try:
            parsed.append(float(value))
        except Exception:
            continue
    if not parsed:
        return 0.0
    return sum(parsed) / len(parsed)


async def record_auth_attempt(success: bool):
    await _incr_minute_counter("auth_attempts", 1)
    if success:
        await _incr_minute_counter("auth_success", 1)
    else:
        await _incr_minute_counter("auth_failures", 1)


async def record_connection_success(reconnect: bool = False):
    await _incr_minute_counter("conn_success", 1)
    if reconnect:
        await _incr_minute_counter("conn_retries", 1)


async def record_disconnect_reason(reason: str):
    normalized = (reason or "").strip().lower() or "unknown"
    if normalized not in DISCONNECT_REASON_LABELS:
        normalized = "unknown"
    key = _reason_key(normalized, _hour_bucket())
    await redis_client.incrby(key, 1)
    await redis_client.expire(key, REASON_TTL_SECONDS)


async def summarize_disconnect_reasons(hours: int = 24) -> list[dict]:
    hours = max(1, int(hours))
    now = _now_utc()
    summary = []

    for reason, label in DISCONNECT_REASON_LABELS.items():
        keys = [
            _reason_key(reason, _hour_bucket(now - timedelta(hours=i)))
            for i in range(hours)
        ]
        values = await redis_client.mget(keys)
        count = 0
        for value in values:
            try:
                count += int(value or 0)
            except Exception:
                continue
        summary.append({
            "reason": reason,
            "label": label,
            "count": count,
        })

    summary.sort(key=lambda item: item["count"], reverse=True)
    return summary


async def acknowledge_alert(alert_id: str):
    if not alert_id:
        return
    await redis_client.set(_alert_ack_key(alert_id), _now_utc().isoformat(), ex=ALERT_ACK_TTL_SECONDS)


async def get_alert_ack_map(alert_ids: Iterable[str]) -> Dict[str, str]:
    alert_ids = [alert_id for alert_id in alert_ids if alert_id]
    if not alert_ids:
        return {}
    keys = [_alert_ack_key(alert_id) for alert_id in alert_ids]
    values = await redis_client.mget(keys)
    return {
        alert_id: value
        for alert_id, value in zip(alert_ids, values)
        if value
    }
