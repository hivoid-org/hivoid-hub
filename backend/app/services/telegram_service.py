import httpx
import logging
import asyncio
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

async def send_telegram_alert(
    bot_token: str, 
    chat_id: str, 
    message: str,
    parse_mode: str = "HTML",
    reply_markup: Optional[dict] = None
) -> bool:
    if not bot_token or not chat_id:
        logger.warning("Telegram Bot Token or Chat ID is missing.")
        return False
        
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": parse_mode
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                logger.error(f"Telegram API response error ({response.status_code}): {response.text}")
                return False
            return True
    except httpx.ConnectTimeout:
        logger.error("Telegram API connection timeout. Is api.telegram.org reachable?")
        return False
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {str(e)}")
        return False

async def send_telegram_approval(
    bot_token: str,
    chat_id: str,
    tx_id: str,
    username: str,
    ip: str,
    location: str
) -> bool:
    message = (
        f"<b>🛡 Login Approval Request</b>\n\n"
        f"👤 <b>User:</b> <code>{username}</code>\n"
        f"🌐 <b>IP:</b> <code>{ip}</code>\n"
        f"📍 <b>Location:</b> {location}\n\n"
        f"Should I authorize this login attempt?"
    )
    reply_markup = {
        "inline_keyboard": [
            [
                {"text": "✅ Approve", "callback_data": f"auth_app_{tx_id}"},
                {"text": "❌ Deny", "callback_data": f"auth_den_{tx_id}"}
            ]
        ]
    }
    return await send_telegram_alert(bot_token, chat_id, message, reply_markup=reply_markup)

from app.core.time_utils import get_now_str

# Utility to format common alerts
def format_login_alert(username: str, ip: str, country: str, ua: str, tz: str = "UTC") -> str:
    return (
        f"<b>🔐 Admin Login Success</b>\n\n"
        f"👤 <b>Username:</b> <code>{username}</code>\n"
        f"🌐 <b>IP:</b> <code>{ip}</code>\n"
        f"🌍 <b>Location:</b> {country}\n"
        f"📱 <b>UA:</b> <i>{ua[:50]}...</i>\n"
        f"🕒 <b>Time:</b> {get_now_str(tz)}"
    )

def format_ban_alert(ip: str, reason: str = "Brute-force protection", tz: str = "UTC") -> str:
    return (
        f"<b>🚫 IP Banned</b>\n\n"
        f"🌐 <b>IP:</b> <code>{ip}</code>\n"
        f"⚠️ <b>Reason:</b> {reason}\n"
        f"⏳ <b>Duration:</b> 30 minutes\n"
        f"🕒 <b>Time:</b> {get_now_str(tz)}"
    )

def format_node_alert(node_id: str, event: str, tz: str = "UTC") -> str:
    emoji = "🔴" if "disconnected" in event.lower() else "ℹ️"
    return (
        f"{emoji} <b>Node Alert</b>\n\n"
        f"🏷️ <b>Node ID:</b> <code>{node_id}</code>\n"
        f"📝 <b>Event:</b> {event}\n"
        f"🕒 <b>Time:</b> {get_now_str(tz)}"
    )

def format_failed_login_alert(username: str, ip: str, country: str, reason: str, tz: str = "UTC") -> str:
    return (
        f"<b>⚠️ Failed Login Attempt</b>\n\n"
        f"👤 <b>Target:</b> <code>{username}</code>\n"
        f"🌐 <b>IP:</b> <code>{ip}</code>\n"
        f"🌍 <b>Location:</b> {country}\n"
        f"🚫 <b>Reason:</b> {reason}\n"
        f"🕒 <b>Time:</b> {get_now_str(tz)}"
    )

def format_suspicious_alert(event: str, details: str, tz: str = "UTC") -> str:
    return (
        f"<b>🛡️ System Security Audit</b>\n\n"
        f"🔔 <b>Event:</b> {event}\n"
        f"📝 <b>Details:</b> {details}\n"
        f"🕒 <b>Time:</b> {get_now_str(tz)}"
    )

def format_user_action_alert(username: str, action: str, tz: str = "UTC") -> str:
    emoji = "👤" if "Created" in action else "🗑️"
    return (
        f"{emoji} <b>User {action}</b>\n\n"
        f"👤 <b>Username:</b> <code>{username}</code>\n"
        f"🕒 <b>Time:</b> {get_now_str(tz)}"
    )

def format_subscription_alert(username: str, action: str, tz: str = "UTC") -> str:
    emoji = "💳" if "Created" in action else "🚫"
    return (
        f"{emoji} <b>Subscription {action}</b>\n\n"
        f"👤 <b>Subscriber:</b> <code>{username}</code>\n"
        f"🕒 <b>Time:</b> {get_now_str(tz)}"
    )

def format_config_alert(admin_name: str, details: str, tz: str = "UTC") -> str:
    return (
        f"<b>⚙️ Hub Configuration Changed</b>\n\n"
        f"👤 <b>Admin:</b> <code>{admin_name}</code>\n"
        f"📝 <b>Updates:</b> {details}\n"
        f"🕒 <b>Time:</b> {get_now_str(tz)}"
    )

def format_health_alert(node_id: str, status: str, details: str, ip: str = "Unknown", node_name: str = "Unnamed", location: str = "Unknown", tz: str = "UTC") -> str:
    emoji = "⚠️" if status == "Critical" else "ℹ️"
    return (
        f"{emoji} <b>Node Health Alert</b>\n\n"
        f"🏷️ <b>Node Name:</b> <code>{node_name}</code>\n"
        f"🌍 <b>Location:</b> <code>{location}</code>\n"
        f"🚨 <b>Status:</b> {status}\n"
        f"🆔 <b>Node ID:</b> <code>{node_id}</code>\n"
        f"🌐 <b>IP Address:</b> <code>{ip}</code>\n"
        f"📝 <b>Details:</b> {details}\n"
        f"🕒 <b>Time:</b> {get_now_str(tz)}"
    )

def format_node_status_alert(node_id: str, status: str, ip: str = "Unknown", node_name: str = "Unnamed", country: str = "Unknown", city: str = "Unknown", tz: str = "UTC") -> str:
    emoji = "🟢" if status == "Online" else "🔴"
    return (
        f"{emoji} <b>Node {status}</b>\n\n"
        f"🏷️ <b>Node Name:</b> <code>{node_name}</code>\n"
        f"🌍 <b>Location:</b> <code>{country}, {city}</code>\n"
        f"🆔 <b>Node ID:</b> <code>{node_id}</code>\n"
        f"🌐 <b>IP Address:</b> <code>{ip}</code>\n"
        f"🕒 <b>Time:</b> {get_now_str(tz)}"
    )
