import asyncio
import logging
import httpx
import json
from app.core.redis_client import redis_client
from app.core.database import SessionLocal
from app.core.hub_config import load_hub_config

logger = logging.getLogger(__name__)

async def bot_poll_loop():
    """
    Simple Telegram Bot poller to handle login approval responses.
    This runs in a background task in the main FastAPI app.
    """
    offset = 0
    client = httpx.AsyncClient(timeout=30.0)
    
    while True:
        try:
            # 1. Load config to get token
            with SessionLocal() as db:
                cfg = load_hub_config(db)
                token = cfg.get("telegram_bot_token")
                chat_id = cfg.get("telegram_chat_id")
            
            if not token:
                await asyncio.sleep(10)
                continue

            # 2. Poll for updates
            url = f"https://api.telegram.org/bot{token}/getUpdates"
            params = {"offset": offset, "timeout": 20, "allowed_updates": ["callback_query"]}
            
            response = await client.get(url, params=params)
            if response.status_code != 200:
                logger.error(f"Telegram polling error: {response.text}")
                await asyncio.sleep(10)
                continue
                
            data = response.json()
            if not data.get("ok"):
                await asyncio.sleep(10)
                continue
            
            updates = data.get("result", [])
            for update in updates:
                offset = update["update_id"] + 1
                
                # Handle button clicks
                if "callback_query" in update:
                    cb = update["callback_query"]
                    cb_data = cb.get("data", "")
                    from_id = str(cb.get("from", {}).get("id", ""))
                    
                    # Security: Only handle clicks from the authorized chat_id
                    if from_id != str(chat_id):
                        logger.warning(f"Unauthorized Telegram interaction from {from_id}")
                        continue
                    
                    if cb_data.startswith("auth_app_") or cb_data.startswith("auth_den_"):
                        status = "APPROVED" if "auth_app_" in cb_data else "DENIED"
                        tx_id = cb_data.split("_")[-1]
                        
                        # Update Redis status for this transaction
                        await redis_client.set(f"tg_auth_status:{tx_id}", status, ex=120)
                        
                        # Answer callback to remove loading state in TG
                        msg = "Login Approved ✅" if status == "APPROVED" else "Login Denied ❌"
                        answer_url = f"https://api.telegram.org/bot{token}/answerCallbackQuery"
                        await client.post(answer_url, json={
                            "callback_query_id": cb["id"],
                            "text": msg
                        })
                        
                        # Optional: Edit message to show result
                        edit_url = f"https://api.telegram.org/bot{token}/editMessageText"
                        edit_payload = {
                            "chat_id": chat_id,
                            "message_id": cb["message"]["message_id"],
                            "text": cb["message"]["text"] + f"\n\n<b>Result: {msg}</b>",
                            "parse_mode": "HTML"
                        }
                        await client.post(edit_url, json=edit_payload)

        except Exception as e:
            logger.error(f"Telegram bot loop error: {e}")
            await asyncio.sleep(5)
            
        await asyncio.sleep(0.5)
