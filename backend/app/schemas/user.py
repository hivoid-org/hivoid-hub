from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: str = ""
    max_connections: int = 5
    max_ips: int = 2
    blocked_tags: List[str] = []
    blocked_hosts: List[str] = []
    bandwidth_limit: int = 0       # KB/s
    data_limit: int = 10737418240  # 10 GB
    expire_at: Optional[datetime] = None
    bind_ip: str = ""
    mode: str = ""                  # performance, stealth, balanced, adaptive
    obfs: str = ""                  # none, random, http, tls, masque, webtransport, ghost
    pool_size: Optional[int] = None
    socks_port: Optional[int] = None
    dns_port: Optional[int] = None
    dns_upstream: Optional[str] = None
    insecure: Optional[bool] = None
    cert_pin: Optional[str] = None
    bypass_domains: Optional[List[str]] = None
    bypass_ips: Optional[List[str]] = None
    direct_route: Optional[List[str]] = None
    direct_geosite: Optional[List[str]] = None
    direct_geoip: Optional[List[str]] = None
    direct_domains: Optional[List[str]] = None
    direct_ips: Optional[List[str]] = None
    client_geoip_path: Optional[str] = None
    client_geosite_path: Optional[str] = None
    is_active: bool = True

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    email: Optional[str] = None
    max_connections: Optional[int] = None
    max_ips: Optional[int] = None
    blocked_tags: Optional[List[str]] = None
    blocked_hosts: Optional[List[str]] = None
    bandwidth_limit: Optional[int] = None
    data_limit: Optional[int] = None
    expire_at: Optional[datetime] = None
    bind_ip: Optional[str] = None
    mode: Optional[str] = None
    obfs: Optional[str] = None
    pool_size: Optional[int] = None
    socks_port: Optional[int] = None
    dns_port: Optional[int] = None
    dns_upstream: Optional[str] = None
    insecure: Optional[bool] = None
    cert_pin: Optional[str] = None
    bypass_domains: Optional[List[str]] = None
    bypass_ips: Optional[List[str]] = None
    direct_route: Optional[List[str]] = None
    direct_geosite: Optional[List[str]] = None
    direct_geoip: Optional[List[str]] = None
    direct_domains: Optional[List[str]] = None
    direct_ips: Optional[List[str]] = None
    client_geoip_path: Optional[str] = None
    client_geosite_path: Optional[str] = None
    is_active: Optional[bool] = None

class UserInDBBase(UserBase):
    id: int
    uuid: str

    model_config = ConfigDict(from_attributes=True)

class User(UserInDBBase):
    activeRequests: int = 0
    bytesIn: int = 0
    bytesOut: int = 0
    totalBytes: int = 0
