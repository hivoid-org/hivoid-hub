import logging
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from app.models.base import AdminUser
from app.services.node_manager import node_manager
from app.services.audit_service import log_security_event
from app.services import telegram_service
from app.core.hub_config import load_hub_config
from app.core.config import settings
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.crud.crud_user import get_active_users, build_user_sync_payload
from app.core.redis_client import redis_client
from app.services.dashboard_metrics import record_auth_attempt
from app.api.v1.endpoints.geoip import get_geoip_info

router = APIRouter()
logger = logging.getLogger(__name__)

from app.models.base import Node as DBNode
from app.schemas.node import NodeUpdate


def _build_node_config(db_node: DBNode) -> dict:
    """Build the server.json config dict from a DB node record."""
    return {
        "server": {
            "listen": db_node.listen_addr or ":4433",
            "mode": db_node.server_mode or "adaptive",
            "log_level": db_node.log_level or "info",
        },
        "security": {
            "cert_file": db_node.cert_file or "",
            "key_file": db_node.key_file or "",
        },
        "features": {
            "hot_reload": db_node.hot_reload if db_node.hot_reload is not None else True,
            "connection_tracking": db_node.connection_tracking if db_node.connection_tracking is not None else True,
            "disconnect_expired": db_node.disconnect_expired if db_node.disconnect_expired is not None else True,
        },
        "max_conns": db_node.max_conns or 0,
        "anti_probe": db_node.anti_probe if db_node.anti_probe is not None else True,
        "fallback_addr": db_node.fallback_addr or "",
        "geoip_path": db_node.geoip_path or "",
        "geosite_path": db_node.geosite_path or "",
        "allowed_hosts": db_node.allowed_hosts or [],
        "blocked_hosts": db_node.blocked_hosts or [],
        "blocked_tags": db_node.blocked_tags or [],
    }


def _build_tls_install_payload(mode: str, domain: str, email: str, cloudflare_token: str = "") -> dict:
    return {
        "type": mode,
        "domain": domain,
        "email": email,
        "cloudflare_api_token": cloudflare_token or ""
    }


def _build_geodata_install_payload(geoip_path: str, geosite_path: str) -> dict:
    return {
        "geoip_path": geoip_path,
        "geosite_path": geosite_path
    }


def _new_install_request_id(kind: str) -> str:
    return f"{kind}_{uuid.uuid4().hex}"


@router.get("/", dependencies=[Depends(get_current_admin)])
async def list_nodes(db: Session = Depends(get_db)):
    """
    Returns a combined list of nodes (DB persistence + Live status).
    """
    db_nodes = db.query(DBNode).all()
    nodes_data = []
    
    # Track which DB nodes are currently online
    online_ids = set(node_manager.active_nodes.keys())
    
    for db_node in db_nodes:
        node_id = db_node.node_id
        is_online = node_id in online_ids
        runtime = node_manager.get_runtime_snapshot(node_id)
        freshness_status = node_manager.get_freshness_status(node_id)
        
        # Use freshness-based status if node is connected
        if is_online:
            status = freshness_status
        else:
            status = "offline"
        
        active_users = 0
        ip = db_node.ip_address or "Unknown"
        
        if is_online:
            ws = node_manager.active_nodes[node_id]
            if ws.client:
                ip = ws.client.host
            
            # Calculate active users from Redis
            keys = await redis_client.keys(f"node:{node_id}:user:*:online")
            for key in keys:
                val = await redis_client.get(key)
                if val and int(val) > 0:
                    active_users += 1
                else:
                    parts = key.split(":")
                    if len(parts) >= 4:
                        user_uuid = parts[3]
                        await redis_client.delete(
                            key,
                            f"node:{node_id}:user:{user_uuid}:connected_at",
                            f"node:{node_id}:user:{user_uuid}:src_ip",
                        )
        
        nodes_data.append({
            "id": node_id,
            "name": db_node.name or f"Node {node_id[:6]}",
            "ip": ip,
            "usersCount": active_users,
            "load": "Healthy" if status == "online" else ("Stale" if status == "stale" else "Offline"),
            "status": status,
            "cpu_usage": runtime.get("cpu_usage"),
            "ram_usage": runtime.get("ram_usage"),
            "ram_usage_mb": runtime.get("ram_usage_mb"),
            "uptime": runtime.get("uptime"),
            "uptime_seconds": runtime.get("uptime_seconds"),
            "connected_at": runtime.get("connected_at"),
            "last_report_at": runtime.get("last_report_at"),
            "reported_at": runtime.get("reported_at"),
            "report_interval_ms": runtime.get("report_interval_ms"),
            "active_connections": runtime.get("active_connections"),
            # Process metrics
            "process_cpu_usage": runtime.get("process_cpu_usage"),
            "process_ram_usage_mb": runtime.get("process_ram_usage_mb"),
            "process_ram_usage_bytes": runtime.get("process_ram_usage_bytes"),
            # System metrics
            "system_cpu_usage": runtime.get("system_cpu_usage"),
            "system_ram_usage": runtime.get("system_ram_usage"),
            "system_ram_usage_mb": runtime.get("system_ram_usage_mb"),
            "system_ram_total_mb": runtime.get("system_ram_total_mb"),
            "system_ram_used_bytes": runtime.get("system_ram_used_bytes"),
            "system_ram_total_bytes": runtime.get("system_ram_total_bytes"),
            # Full server config
            "listen_addr": db_node.listen_addr or ":4433",
            "server_mode": db_node.server_mode or "adaptive",
            "log_level": db_node.log_level or "info",
            "cert_file": db_node.cert_file or "",
            "key_file": db_node.key_file or "",
            "cert_pin": db_node.cert_pin or "",
            "hot_reload": db_node.hot_reload if db_node.hot_reload is not None else True,
            "connection_tracking": db_node.connection_tracking if db_node.connection_tracking is not None else True,
            "disconnect_expired": db_node.disconnect_expired if db_node.disconnect_expired is not None else True,
            "max_conns": db_node.max_conns or 0,
            "anti_probe": db_node.anti_probe if db_node.anti_probe is not None else True,
            "fallback_addr": db_node.fallback_addr or "",
            "geoip_path": db_node.geoip_path or "",
            "geosite_path": db_node.geosite_path or "",
            "allowed_hosts": db_node.allowed_hosts or [],
            "blocked_hosts": db_node.blocked_hosts or [],
            "blocked_tags": db_node.blocked_tags or [],
            "port": db_node.port or 4433,
            "public_host": db_node.public_host or ip,
            "tls_mode": db_node.tls_mode or "",
            "tls_domain": db_node.tls_domain or "",
            "tls_email": db_node.tls_email or "",
            "last_install_status": db_node.last_install_status or "",
            "last_install_type": db_node.last_install_type or "",
            "last_install_message": db_node.last_install_message or "",
            "last_install_request_id": db_node.last_install_request_id or "",
        })
        
    return {"nodes": nodes_data}


@router.put("/{node_id}", dependencies=[Depends(get_current_admin)])
async def update_node(node_id: str, node_update: NodeUpdate, db: Session = Depends(get_db), current_admin: AdminUser = Depends(get_current_admin)):
    """
    Updates node metadata and server config in the DB.
    If the node is online, pushes CONFIG_UPDATE over WSS.
    """
    db_node = db.query(DBNode).filter(DBNode.node_id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Node record not found")
        
    update_data = node_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_node, key, value)
        
    db.commit()
    db.refresh(db_node)
    
    # If node is online, push new config immediately
    if node_id in node_manager.active_nodes:
        config = _build_node_config(db_node)
        logger.info(f"🚀 Pushing immediate CONFIG_UPDATE to Node {node_id} following configuration change.")
        await node_manager.send_config_update(node_id, config)
    
    await log_security_event(db, current_admin.id, "NODE_UPDATED", f"Node {node_id} configuration updated", "n/a", "n/a")
    return db_node


@router.delete("/{node_id}", dependencies=[Depends(get_current_admin)])
async def disconnect_node(node_id: str, db: Session = Depends(get_db), current_admin: AdminUser = Depends(get_current_admin)):
    """
    Forcefully disconnects an edge node WebSocket.
    """
    if node_id in node_manager.active_nodes:
        try:
            ws = node_manager.active_nodes[node_id]
            await ws.close(code=1000, reason="Disconnected by admin")
        except: pass
        node_manager.disconnect(node_id)
        await log_security_event(db, current_admin.id, "NODE_DISCONNECTED", f"Node {node_id} manually disconnected", "n/a", "n/a")
        return {"status": "disconnected"}
    
    raise HTTPException(status_code=400, detail="Node is not currently connected")


@router.delete("/{node_id}/remove", dependencies=[Depends(get_current_admin)])
async def remove_node(node_id: str, db: Session = Depends(get_db), current_admin: AdminUser = Depends(get_current_admin)):
    """
    Force remove a node from the cluster (database and live status).
    """
    # 1. Check DB
    db_node = db.query(DBNode).filter(DBNode.node_id == node_id).first()
    
    # 2. Disconnect if online
    if node_id in node_manager.active_nodes:
        try:
            ws = node_manager.active_nodes[node_id]
            await ws.close(code=1000, reason="Node removed from cluster")
        except: pass
        node_manager.disconnect(node_id)

    if not db_node:
        return {"status": "removed", "detail": "Node was only in memory or already deleted from DB"}

    # 3. Delete from DB
    db.delete(db_node)
    db.commit()
    
    await log_security_event(db, current_admin.id, "NODE_REMOVED", f"Node {node_id} removed from cluster", "n/a", "n/a")
    return {"status": "removed"}


@router.post("/shock", dependencies=[Depends(get_current_admin)])
async def shock_all_nodes(db: Session = Depends(get_db), current_admin: AdminUser = Depends(get_current_admin)):
    """
    Sends SHOCK signal to all connected nodes to force-reconnect all clients.
    """
    await node_manager.broadcast_shock()
    await log_security_event(db, current_admin.id, "GLOBAL_SHOCK", "Sent SHOCK signal to all nodes", "n/a", "n/a")
    return {"status": "shock_sent", "nodes_affected": len(node_manager.active_nodes)}


@router.post("/sync", dependencies=[Depends(get_current_admin)])
async def force_sync_all(db: Session = Depends(get_db), current_admin: AdminUser = Depends(get_current_admin)):
    """
    Force re-sync all user policies to all connected nodes.
    """
    active_users = get_active_users(db)
    users_list = [build_user_sync_payload(u) for u in active_users]
    await node_manager.broadcast_sync(users_list)
    await log_security_event(db, current_admin.id, "GLOBAL_SYNC", "Triggered manual policy sync across cluster", "n/a", "n/a")
    return {"status": "synced", "users_count": len(users_list), "nodes_count": len(node_manager.active_nodes)}


@router.post("/{node_id}/tls/install", dependencies=[Depends(get_current_admin)])
async def install_tls_for_node(node_id: str, payload: dict, db: Session = Depends(get_db)):
    db_node = db.query(DBNode).filter(DBNode.node_id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Node record not found")

    tls_type = (payload or {}).get("type", "openssl_self_signed")
    domain = (payload or {}).get("domain", "") or db_node.public_host or ""
    email = (payload or {}).get("email", "")
    if not domain:
        raise HTTPException(status_code=400, detail="TLS domain is required")

    if tls_type not in ["openssl_self_signed", "cloudflare"]:
        raise HTTPException(status_code=400, detail="TLS type must be openssl_self_signed or cloudflare")

    cloudflare_token = ""
    if tls_type == "cloudflare":
        cfg = load_hub_config(db)
        cloudflare_token = (cfg.get("cloudflare_api_token") or "").strip()
        if not cloudflare_token:
            raise HTTPException(status_code=400, detail="Cloudflare API token is not set in hub config")

    db_node.tls_mode = tls_type
    db_node.tls_domain = domain
    db_node.tls_email = email

    if tls_type == "openssl_self_signed":
        db_node.cert_file = f"/etc/hivoid/tls/{domain}/cert.pem"
        db_node.key_file = f"/etc/hivoid/tls/{domain}/key.pem"
    else:
        cert_base = f"/etc/letsencrypt/live/{domain}"
        db_node.cert_file = f"{cert_base}/fullchain.pem"
        db_node.key_file = f"{cert_base}/privkey.pem"
    db.commit()
    db.refresh(db_node)

    request_id = _new_install_request_id("tls")
    db_node.last_install_status = "requested"
    db_node.last_install_type = "TLS_INSTALL"
    db_node.last_install_message = "TLS installation request queued by hub"
    db_node.last_install_request_id = request_id
    db.commit()
    db.refresh(db_node)

    install_payload = _build_tls_install_payload(tls_type, domain, email, cloudflare_token)
    if node_id in node_manager.active_nodes:
        await node_manager.send_tls_install(node_id, install_payload, request_id=request_id)
        await node_manager.send_config_update(node_id, _build_node_config(db_node))

    return {
        "status": "tls_install_requested",
        "request_id": request_id,
        "node_id": node_id,
        "tls": install_payload,
        "cert_file": db_node.cert_file,
        "key_file": db_node.key_file
    }


@router.post("/{node_id}/tls/sync-paths", dependencies=[Depends(get_current_admin)])
async def sync_tls_paths(node_id: str, db: Session = Depends(get_db)):
    db_node = db.query(DBNode).filter(DBNode.node_id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Node record not found")

    domain = (db_node.tls_domain or db_node.public_host or "").strip()
    if not domain:
        raise HTTPException(status_code=400, detail="TLS domain is not set for this node")

    cert_base = f"/etc/letsencrypt/live/{domain}"
    db_node.cert_file = f"{cert_base}/fullchain.pem"
    db_node.key_file = f"{cert_base}/privkey.pem"
    db.commit()
    db.refresh(db_node)

    if node_id in node_manager.active_nodes:
        await node_manager.send_config_update(node_id, _build_node_config(db_node))

    return {
        "status": "tls_paths_synced",
        "node_id": node_id,
        "cert_file": db_node.cert_file,
        "key_file": db_node.key_file
    }


@router.post("/{node_id}/geodata/install", dependencies=[Depends(get_current_admin)])
async def install_geodata_for_node(node_id: str, payload: dict | None = None, db: Session = Depends(get_db)):
    db_node = db.query(DBNode).filter(DBNode.node_id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Node record not found")

    requested_geoip = (payload or {}).get("geoip_path", "") if payload else ""
    requested_geosite = (payload or {}).get("geosite_path", "") if payload else ""

    geoip_path = requested_geoip or db_node.geoip_path or "/var/lib/hivoid/geoip.dat"
    geosite_path = requested_geosite or db_node.geosite_path or "/var/lib/hivoid/geosite.dat"

    db_node.geoip_path = geoip_path
    db_node.geosite_path = geosite_path
    db.commit()
    db.refresh(db_node)

    request_id = _new_install_request_id("geodata")
    db_node.last_install_status = "requested"
    db_node.last_install_type = "GEODATA_INSTALL"
    db_node.last_install_message = "GeoData installation request queued by hub"
    db_node.last_install_request_id = request_id
    db.commit()
    db.refresh(db_node)

    install_payload = _build_geodata_install_payload(geoip_path, geosite_path)
    if node_id in node_manager.active_nodes:
        await node_manager.send_geodata_install(node_id, install_payload, request_id=request_id)
        await node_manager.send_config_update(node_id, _build_node_config(db_node))

    return {
        "status": "geodata_install_requested",
        "request_id": request_id,
        "node_id": node_id,
        "geoip_path": geoip_path,
        "geosite_path": geosite_path
    }


@router.websocket("")
@router.websocket("/")
@router.websocket("/ws")
async def node_sync_endpoint(
    websocket: WebSocket, 
    db: Session = Depends(get_db)
):
    """
    Main WebSocket endpoint for HiVoid Cores to connect, authenticate, 
    receive user policies + server config, and send telemetry.
    """
    # Authenticate via Header (Bearer Token) or Query Parameter (?token=...)
    auth_header = websocket.headers.get("authorization")
    query_token = websocket.query_params.get("token")
    hub_header_token = websocket.headers.get("x-hub-token")
    
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    elif query_token:
        token = query_token
    elif hub_header_token:
        token = hub_header_token
        
    if token != settings.HUB_MASTER_TOKEN:
        await record_auth_attempt(success=False)
        await websocket.accept()
        await websocket.close(code=4001, reason="Unauthorized Hub Token")
        token_preview = f"{token[:4]}***" if token else "<missing>"
        logger.warning(f"🛡️ Unauthorized connection attempt from {websocket.client.host if websocket.client else 'unknown'} (Token: {token_preview})")
        return
        
    # Node identification (prefer stable id from query/header)
    provided_node_id = websocket.query_params.get("node_id") or websocket.headers.get("X-Node-ID")
    client_ip = websocket.client.host if websocket.client else "0.0.0.0"

    db_node = None
    if provided_node_id:
        db_node = db.query(DBNode).filter(DBNode.node_id == provided_node_id).first()
        if not db_node:
            db_node = DBNode(
                node_id=provided_node_id,
                name=f"Node {provided_node_id[:6]}",
                ip_address=client_ip
            )
            db.add(db_node)
            db.commit()
            db.refresh(db_node)
    else:
        # Backward compatibility for old agents that reconnect without stable node_id:
        # reuse latest node profile with same IP instead of creating duplicates
        db_node = (
            db.query(DBNode)
            .filter(DBNode.ip_address == client_ip)
            .order_by(DBNode.id.desc())
            .first()
        )
        if not db_node:
            fallback_node_id = str(uuid.uuid4())
            db_node = DBNode(
                node_id=fallback_node_id,
                name=f"Node {fallback_node_id[:6]}",
                ip_address=client_ip
            )
            db.add(db_node)
            db.commit()
            db.refresh(db_node)
        
    node_id = db_node.node_id
    db_node.ip_address = client_ip
    db.commit()
    logger.info(f"🤝 Handshake successful for Node {node_id} ({db_node.name}). Total active nodes: {len(node_manager.active_nodes)}")
    await node_manager.connect(node_id, websocket)
    
    # Notify Telegram for Node Online
    cfg = load_hub_config(db)
    if cfg.get("telegram_alerts", {}).get("node_online"):
        country, city, lat, lon = "Unknown", "Unknown", "N/A", "N/A"
        try:
            geo = get_geoip_info(client_ip)
            if geo:
                country = geo.get("country", "Unknown")
                city = geo.get("city", "Unknown")
                lat = str(geo.get("latitude", "N/A"))
                lon = str(geo.get("longitude", "N/A"))
        except: pass
        msg = telegram_service.format_node_status_alert(node_id, "Online", client_ip, db_node.name, country, city, tz=cfg.get("timezone", "UTC"))
        asyncio.create_task(telegram_service.send_telegram_alert(cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg))
    
    try:
        # Step 1: Send SYNC with all active users (including all new fields)
        active_users = get_active_users(db)
        users_list = [build_user_sync_payload(u) for u in active_users]
        
        # Cache data limits in Redis
        for user in active_users:
            await redis_client.set(f"user:{user.uuid}:limit", user.data_limit)

        initial_sync_payload = {
            "type": "SYNC",
            "users": users_list
        }
        await websocket.send_json(initial_sync_payload)
        
        # Step 2: Send CONFIG_UPDATE with this node's server config
        config = _build_node_config(db_node)
        config_payload = {
            "type": "CONFIG_UPDATE",
            "config": config
        }
        await websocket.send_json(config_payload)
        
        # Step 3: Listen for messages from the node
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "USAGE":
                await node_manager.process_telemetry(node_id, data)
            elif msg_type == "STATUS":
                # Node reporting its own status (future extension)
                logger.debug(f"Node {node_id} status: {data}")
            elif msg_type == "INSTALL_RESULT":
                install_kind = (data.get("kind") or "").strip()
                install_status = (data.get("status") or "").strip()
                request_id = (data.get("request_id") or "").strip()
                message = (data.get("message") or "").strip()
                details = data.get("details") or {}

                if not install_kind:
                    logger.warning(f"INSTALL_RESULT missing kind from Node {node_id}: {data}")
                    continue
                if install_status not in {"success", "failed"}:
                    logger.warning(f"INSTALL_RESULT invalid status from Node {node_id}: {data}")
                    continue

                db_node.last_install_type = install_kind
                db_node.last_install_status = install_status
                db_node.last_install_message = message
                db_node.last_install_request_id = request_id
                
                # Extract cert_pin from INSTALL_RESULT if TLS install succeeded
                if install_kind == "TLS_INSTALL" and install_status == "success":
                    cert_pin = (data.get("cert_pin") or details.get("cert_pin") or "").strip()
                    cert_file = (details.get("cert_file") or "").strip()
                    key_file = (details.get("key_file") or "").strip()
                    
                    if cert_pin:
                        db_node.cert_pin = cert_pin
                        logger.info(f"Node {node_id} cert_pin updated: {cert_pin[:30]}...")
                    if cert_file:
                        db_node.cert_file = cert_file
                    if key_file:
                        db_node.key_file = key_file
                
                db.commit()

                logger.info(
                    f"Node {node_id} INSTALL_RESULT kind={install_kind} status={install_status} "
                    f"request_id={request_id} message={message} details={details}"
                )
            elif msg_type == "REPORT":
                # Node reporting runtime metrics + cert_pin.
                snapshot = node_manager.update_runtime_report(node_id, data)

                # Critical Health Check (Cooldown is handled in nodes.py state or just simply here)
                cfg = load_hub_config(db)
                if cfg.get("telegram_alerts", {}).get("critical_health"):
                    cpu = snapshot.get("system_cpu_usage") or snapshot.get("cpu_usage")
                    ram = snapshot.get("system_ram_usage") or snapshot.get("ram_usage_percent")
                    
                    if (cpu and cpu > 90) or (ram and ram > 90):
                        # Use redis to manage cooldown per node for health alerts
                        cooldown_key = f"alert_cooldown:health:{node_id}"
                        if not await redis_client.get(cooldown_key):
                            details = f"CPU: {cpu:.2f}% | RAM: {ram:.2f}%"
                            location = "Unknown"
                            try:
                                geo = get_geoip_info(client_ip)
                                if geo:
                                    location = f"{geo.get('country', 'Unknown')}, {geo.get('city', 'Unknown')}"
                            except: pass

                            msg = telegram_service.format_health_alert(
                                node_id, "Critical", details, 
                                client_ip, db_node.name, location,
                                tz=cfg.get("timezone", "UTC")
                            )
                            asyncio.create_task(telegram_service.send_telegram_alert(cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg))
                            await redis_client.set(cooldown_key, "1", ex=3600) # 1 hour cooldown

                cert_pin = (data.get("cert_pin") or "").strip()
                if cert_pin and cert_pin != db_node.cert_pin:
                    db_node.cert_pin = cert_pin
                    db.commit()
                    logger.info(f"Node {node_id} cert_pin updated via REPORT: {cert_pin[:30]}...")
                
                logger.debug(f"Node {node_id} REPORT: {data}")
            elif msg_type == "COMMAND_ACK":
                # Initial acknowledgment for long-running commands (CONFIG_UPDATE, TLS_INSTALL, GEODATA_INSTALL)
                command_kind = (data.get("kind") or data.get("command") or "").strip()
                request_id = (data.get("request_id") or "").strip()
                message = (data.get("message") or "Command acknowledged").strip()

                if command_kind:
                    db_node.last_install_type = command_kind
                    db_node.last_install_status = "in_progress"
                    db_node.last_install_message = message
                    if request_id:
                        db_node.last_install_request_id = request_id
                    db.commit()

                logger.info(
                    f"Node {node_id} COMMAND_ACK kind={command_kind} "
                    f"request_id={request_id} message={message}"
                )
            elif msg_type == "COMMAND_RESULT":
                # Final result for CONFIG_UPDATE command
                command_kind = (data.get("kind") or data.get("command") or "").strip()
                command_status = (data.get("status") or "").strip()
                request_id = (data.get("request_id") or "").strip()
                message = (data.get("message") or "").strip()
                details = data.get("details") or {}

                if command_kind:
                    db_node.last_install_type = command_kind
                    db_node.last_install_status = command_status if command_status in {"success", "failed"} else "unknown"
                    db_node.last_install_message = message
                    if request_id:
                        db_node.last_install_request_id = request_id
                    db.commit()

                logger.info(
                    f"Node {node_id} COMMAND_RESULT kind={command_kind} status={command_status} "
                    f"request_id={request_id} message={message} details={details}"
                )
            else:
                logger.debug(f"Unknown message type from Node {node_id}: {msg_type}")
                
    except WebSocketDisconnect:
        logger.info(f"🔌 Node {node_id} disconnected gracefully (WebSocketDisconnect).")
        node_manager.disconnect(node_id)
        # Notify Telegram for Node Offline
        cfg = load_hub_config(db)
        if cfg.get("telegram_alerts", {}).get("node_offline"):
            country, city, lat, lon = "Unknown", "Unknown", "N/A", "N/A"
            try:
                geo = get_geoip_info(client_ip)
                if geo:
                    country = geo.get("country", "Unknown")
                    city = geo.get("city", "Unknown")
                    lat = str(geo.get("latitude", "N/A"))
                    lon = str(geo.get("longitude", "N/A"))
            except: pass
            msg = telegram_service.format_node_status_alert(node_id, "Offline", client_ip, db_node.name, country, city, tz=cfg.get("timezone", "UTC"))
            asyncio.create_task(telegram_service.send_telegram_alert(cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg))
            
    except Exception as e:
        logger.error(f"❌ WebSocket error for Node {node_id}: {str(e)}")
        node_manager.disconnect(node_id)
        # Notify Telegram for Node Offline (Error)
        cfg = load_hub_config(db)
        if cfg.get("telegram_alerts", {}).get("node_offline"):
            msg = telegram_service.format_node_status_alert(node_id, "Offline (Error)", client_ip)
            asyncio.create_task(telegram_service.send_telegram_alert(cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id"), msg))
