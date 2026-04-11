from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from urllib.parse import urlencode
from app.core.database import get_db
from app.models.base import User as DBUser, Node as DBNode
from app.core.hub_config import load_hub_config

router = APIRouter()

@router.get("/{uuid}")
async def get_subscription_info(uuid: str, db: Session = Depends(get_db)):
    db_user = db.query(DBUser).filter(DBUser.uuid == uuid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Subscription not found")
        
    from app.core.redis_client import redis_client
    
    # Fetch live traffic data
    traffic_hash = await redis_client.hgetall(f"user:{uuid}:traffic")
    if traffic_hash:
        bytes_in = int(traffic_hash.get(b'total_in', traffic_hash.get('total_in', 0)))
        bytes_out = int(traffic_hash.get(b'total_out', traffic_hash.get('total_out', 0)))
        total_bytes = int(traffic_hash.get(b'total_bytes', traffic_hash.get('total_bytes', 0)))
    else:
        bytes_in = 0
        bytes_out = 0
        total_bytes = 0
    
    # Get available nodes for connection URIs
    db_nodes = db.query(DBNode).filter(DBNode.is_active == True).all()
    
    hub_config = load_hub_config(db)
    nodes_info = []
    hivoid_uris = []
    
    for node in db_nodes:
        host = node.public_host or node.ip_address or "0.0.0.0"
        port = node.port or 4433
        node_name = node.name or f"Node {node.node_id[:6]}"
        
        # Per-node cert_pin with fallback chain: node > user > hub_config
        node_cert_pin = node.cert_pin or db_user.cert_pin or hub_config.get("cert_pin") or ""
        
        nodes_info.append({
            "name": node_name,
            "host": host,
            "port": port,
            "cert_pin": node_cert_pin,
        })
        
        # Build hivoid:// URI
        # Format: hivoid://<uuid>@<host>:<port>[?key=value&...]#<name>
        params = {}
        effective_mode = (db_user.mode or hub_config.get("default_mode") or "").strip()
        effective_obfs = (db_user.obfs or hub_config.get("default_obfs") or "").strip()
        if effective_mode:
            params["mode"] = effective_mode
        if effective_obfs:
            params["obfs"] = effective_obfs
        # Include cert_pin in URI if available
        if node_cert_pin:
            params["cert_pin"] = node_cert_pin
        # Client runtime params (user override > hub global)
        pool_size = db_user.pool_size if db_user.pool_size is not None else hub_config.get("pool_size")
        socks_port = db_user.socks_port if db_user.socks_port is not None else hub_config.get("socks_port")
        dns_port = db_user.dns_port if db_user.dns_port is not None else hub_config.get("dns_port")
        if pool_size is not None:
            params["pool_size"] = pool_size
        if socks_port is not None:
            params["socks_port"] = socks_port
        if dns_port is not None:
            params["dns_port"] = dns_port
        
        query_str = ""
        if params:
            query_str = "?" + urlencode(params)
        
        uri_name = node_name.replace(" ", "-")
        uri = f"hivoid://{db_user.uuid}@{host}:{port}{query_str}#{uri_name}"
        hivoid_uris.append(uri)
    
    return {
        "status": "active" if db_user.is_active else "disabled",
        "username": db_user.username,
        "email": db_user.email or "",
        "uuid": db_user.uuid,
        "data_limit": db_user.data_limit,
        "total_used": total_bytes,
        "upload_used": bytes_in,
        "download_used": bytes_out,
        "max_connections": db_user.max_connections,
        "max_ips": db_user.max_ips,
        "bandwidth_limit": db_user.bandwidth_limit,
        "expire_at": db_user.expire_at.strftime("%Y-%m-%dT%H:%M:%SZ") if db_user.expire_at else None,
        "mode": (db_user.mode or hub_config.get("default_mode") or "").strip(),
        "obfs": (db_user.obfs or hub_config.get("default_obfs") or "").strip(),
        "bind_ip": db_user.bind_ip or "",
        "pool_size": db_user.pool_size if db_user.pool_size is not None else hub_config.get("pool_size"),
        "socks_port": db_user.socks_port if db_user.socks_port is not None else hub_config.get("socks_port"),
        "dns_port": db_user.dns_port if db_user.dns_port is not None else hub_config.get("dns_port"),
        "dns_upstream": db_user.dns_upstream or hub_config.get("dns_upstream") or "",
        "insecure": db_user.insecure if db_user.insecure is not None else bool(hub_config.get("insecure", False)),
        "cert_pin": db_user.cert_pin or hub_config.get("cert_pin") or "",
        "bypass_domains": db_user.bypass_domains or hub_config.get("bypass_domains") or [],
        "bypass_ips": db_user.bypass_ips or hub_config.get("bypass_ips") or [],
        "direct_route": db_user.direct_route or hub_config.get("direct_route") or [],
        "direct_geosite": db_user.direct_geosite or hub_config.get("direct_geosite") or [],
        "direct_geoip": db_user.direct_geoip or hub_config.get("direct_geoip") or [],
        "direct_domains": db_user.direct_domains or hub_config.get("direct_domains") or [],
        "direct_ips": db_user.direct_ips or hub_config.get("direct_ips") or [],
        "client_geoip_path": db_user.client_geoip_path or hub_config.get("geoip_path") or "",
        "client_geosite_path": db_user.client_geosite_path or hub_config.get("geosite_path") or "",
        # Connection info
        "nodes": nodes_info,
        "hivoid_uris": hivoid_uris,
        "sub_page": hub_config.get("sub_page") or {},
    }
