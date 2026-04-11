from sqlalchemy.orm import Session
from app.models.base import User
from app.schemas.user import UserCreate, UserUpdate
from typing import List

def get_user(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_uuid(db: Session, uuid: str):
    return db.query(User).filter(User.uuid == uuid).first()

def get_all_users(db: Session, skip: int = 0, limit: int = 1000) -> List[User]:
    return db.query(User).offset(skip).limit(limit).all()

def get_active_users(db: Session, skip: int = 0, limit: int = 1000) -> List[User]:
    return db.query(User).filter(User.is_active == True).offset(skip).limit(limit).all()

def create_user(db: Session, user: UserCreate):
    db_user = User(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, db_user: User, user_update: UserUpdate):
    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user_permanent(db: Session, db_user: User):
    db.delete(db_user)
    db.commit()

def build_user_sync_payload(user: User) -> dict:
    """Build the user dict that gets sent to nodes in SYNC messages."""
    payload = {
        "uuid": user.uuid,
        "email": user.email or user.username,
        "enabled": user.is_active,
        "max_connections": user.max_connections,
        "max_ips": user.max_ips,
        "bandwidth_limit": user.bandwidth_limit,
        "data_limit": user.data_limit,
        "blocked_tags": user.blocked_tags or [],
        "blocked_hosts": user.blocked_hosts or [],
    }
    # Optional fields — only include if set
    if user.expire_at:
        payload["expire_at"] = user.expire_at.strftime("%Y-%m-%dT%H:%M:%SZ")
    else:
        payload["expire_at"] = ""
    if user.bind_ip:
        payload["bind_ip"] = user.bind_ip
    if user.mode:
        payload["mode"] = user.mode
    if user.obfs:
        payload["obfs"] = user.obfs
    if user.pool_size is not None:
        payload["pool_size"] = user.pool_size
    if user.socks_port is not None:
        payload["socks_port"] = user.socks_port
    if user.dns_port is not None:
        payload["dns_port"] = user.dns_port
    if user.dns_upstream:
        payload["dns_upstream"] = user.dns_upstream
    if user.insecure is not None:
        payload["insecure"] = user.insecure
    if user.cert_pin:
        payload["cert_pin"] = user.cert_pin
    if user.bypass_domains:
        payload["bypass_domains"] = user.bypass_domains
    if user.bypass_ips:
        payload["bypass_ips"] = user.bypass_ips
    if user.direct_route:
        payload["direct_route"] = user.direct_route
    if user.direct_geosite:
        payload["direct_geosite"] = user.direct_geosite
    if user.direct_geoip:
        payload["direct_geoip"] = user.direct_geoip
    if user.direct_domains:
        payload["direct_domains"] = user.direct_domains
    if user.direct_ips:
        payload["direct_ips"] = user.direct_ips
    if user.client_geoip_path:
        payload["geoip_path"] = user.client_geoip_path
    if user.client_geosite_path:
        payload["geosite_path"] = user.client_geosite_path
    return payload
