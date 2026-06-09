from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class NodeBase(BaseModel):
    name: str
    node_id: str
    ip_address: str
    is_active: bool = True

class NodeCreate(NodeBase):
    pass

class NodeUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    # Server config fields
    listen_addr: Optional[str] = None
    server_mode: Optional[str] = None
    log_level: Optional[str] = None
    cert_file: Optional[str] = None
    key_file: Optional[str] = None
    cert_pin: Optional[str] = None
    hot_reload: Optional[bool] = None
    connection_tracking: Optional[bool] = None
    disconnect_expired: Optional[bool] = None
    max_conns: Optional[int] = None
    anti_probe: Optional[bool] = None
    fallback_addr: Optional[str] = None
    geoip_path: Optional[str] = None
    geosite_path: Optional[str] = None
    allowed_hosts: Optional[List[str]] = None
    blocked_hosts: Optional[List[str]] = None
    blocked_tags: Optional[List[str]] = None
    port: Optional[int] = None
    public_host: Optional[str] = None
    tls_mode: Optional[str] = None
    tls_domain: Optional[str] = None
    tls_email: Optional[str] = None
    last_install_status: Optional[str] = None
    last_install_type: Optional[str] = None
    last_install_message: Optional[str] = None
    last_install_request_id: Optional[str] = None
    voidreach_config: Optional[dict] = None


class NodeInDBBase(NodeBase):
    id: int
    listen_addr: str = ":4433"
    server_mode: str = "adaptive"
    log_level: str = "info"
    cert_file: str = ""
    key_file: str = ""
    cert_pin: str = ""
    hot_reload: bool = True
    connection_tracking: bool = True
    disconnect_expired: bool = True
    max_conns: int = 0
    anti_probe: bool = True
    fallback_addr: str = ""
    geoip_path: str = ""
    geosite_path: str = ""
    allowed_hosts: List[str] = []
    blocked_hosts: List[str] = []
    blocked_tags: List[str] = []
    port: int = 4433
    public_host: str = ""
    last_install_status: str = ""
    last_install_type: str = ""
    last_install_message: str = ""
    last_install_request_id: str = ""
    voidreach_config: Optional[dict] = None

    
    model_config = ConfigDict(from_attributes=True)

class Node(NodeInDBBase):
    pass
