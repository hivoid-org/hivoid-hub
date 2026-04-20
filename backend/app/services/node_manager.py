import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict
from fastapi import WebSocket
from app.core.redis_client import redis_client
from app.services.dashboard_metrics import record_connection_success, record_disconnect_reason

logger = logging.getLogger(__name__)

# Freshness is now purely based on WebSocket connection state.
# If the WS is open → online.  If closed → offline.  No timestamp-based flicker.


class NodeManager:
    def __init__(self):
        # Maps node_id to its active WebSocket connection
        self.active_nodes: Dict[str, WebSocket] = {}
        self.presence_ttl_seconds = 30  # longer TTL so user-count keys survive between reports
        # Last runtime metrics reported by each node.
        self.node_runtime: Dict[str, dict] = {}
        # Connection start time per node, used as fallback connected_at.
        self.node_connected_at: Dict[str, str] = {}

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _to_float(value):
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_int(value):
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    async def connect(self, node_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_nodes[node_id] = websocket
        self.node_connected_at[node_id] = self._now_iso()
        client_ip = websocket.client.host if websocket.client else "unknown"
        logger.info(f"🟢 Node {node_id} connected via WSS from {client_ip}.")

    def disconnect(self, node_id: str):
        if node_id in self.active_nodes:
            del self.active_nodes[node_id]
            logger.info(f"🔴 Node {node_id} disconnected from WSS cluster.")
        self.node_runtime.pop(node_id, None)
        self.node_connected_at.pop(node_id, None)
        self._schedule_node_presence_cleanup(node_id)
        self._schedule_disconnect_reason("node_disconnect")

    def update_runtime_report(self, node_id: str, report: dict):
        """
        Store latest runtime telemetry sent by node REPORT messages.
        Supports new Core contract fields including process/system metrics.
        """
        stats = report.get("stats") if isinstance(report.get("stats"), dict) else {}

        # CPU usage
        cpu_usage = self._to_float(report.get("cpu_usage"))
        if cpu_usage is None:
            cpu_usage = self._to_float(report.get("system_cpu_usage"))
        if cpu_usage is None:
            cpu_usage = self._to_float(stats.get("cpu_percent"))

        # RAM usage MB
        ram_usage_mb = self._to_float(report.get("ram_usage_mb"))
        if ram_usage_mb is None:
            ram_usage_mb = self._to_float(report.get("system_ram_usage_mb"))
        if ram_usage_mb is None:
            memory_bytes = self._to_float(stats.get("memory_bytes"))
            if memory_bytes is not None:
                ram_usage_mb = round(memory_bytes / (1024 * 1024), 2)

        # RAM usage Percent
        ram_usage_percent = self._to_float(report.get("system_ram_usage"))
        if ram_usage_percent is None:
            ram_usage_percent = self._to_float(report.get("ram_usage")) # Fallback to ram_usage if it represents percent
        if ram_usage_percent is None:
            ram_usage_percent = self._to_float(stats.get("system_memory_percent"))
        if ram_usage_percent is None:
            ram_usage_percent = self._to_float(stats.get("memory_percent"))

        uptime = report.get("uptime")
        uptime_seconds = self._to_int(report.get("uptime_seconds"))
        if uptime_seconds is None:
            uptime_seconds = self._to_int(stats.get("uptime_seconds"))

        connected_at = report.get("connected_at") or self.node_connected_at.get(node_id) or self._now_iso()
        reported_at = report.get("reported_at") or self._now_iso()
        report_interval_ms = self._to_int(report.get("report_interval_ms"))

        # Process-level metrics
        process_cpu_usage = self._to_float(report.get("process_cpu_usage"))
        process_ram_usage_mb = self._to_float(report.get("process_ram_usage_mb"))
        process_ram_usage_bytes = self._to_int(report.get("process_ram_usage_bytes"))

        # System-level metrics
        system_cpu_usage = self._to_float(report.get("system_cpu_usage"))
        system_ram_usage = self._to_float(report.get("system_ram_usage"))
        system_ram_usage_mb = self._to_float(report.get("system_ram_usage_mb"))
        system_ram_total_mb = self._to_float(report.get("system_ram_total_mb"))
        system_ram_used_bytes = self._to_int(report.get("system_ram_used_bytes"))
        system_ram_total_bytes = self._to_int(report.get("system_ram_total_bytes"))

        # Connection metrics
        active_connections = self._to_int(stats.get("active_connections"))

        snapshot = {
            "cpu_usage": cpu_usage,
            "ram_usage": ram_usage_mb,
            "ram_usage_mb": ram_usage_mb,
            "ram_usage_percent": ram_usage_percent,
            "uptime": uptime,
            "uptime_seconds": uptime_seconds,
            "connected_at": connected_at,
            "reported_at": reported_at,
            "report_interval_ms": report_interval_ms,
            "last_report_at": self._now_iso(),
            "active_connections": active_connections,
            # Process metrics
            "process_cpu_usage": process_cpu_usage,
            "process_ram_usage_mb": process_ram_usage_mb,
            "process_ram_usage_bytes": process_ram_usage_bytes,
            # System metrics
            "system_cpu_usage": system_cpu_usage,
            "system_ram_usage": system_ram_usage,
            "system_ram_usage_mb": system_ram_usage_mb,
            "system_ram_total_mb": system_ram_total_mb,
            "system_ram_used_bytes": system_ram_used_bytes,
            "system_ram_total_bytes": system_ram_total_bytes,
        }
        self.node_runtime[node_id] = snapshot
        if node_id not in self.node_connected_at:
            self.node_connected_at[node_id] = connected_at
        return snapshot

    def get_runtime_snapshot(self, node_id: str) -> dict:
        snapshot = dict(self.node_runtime.get(node_id, {}))
        if "connected_at" not in snapshot and node_id in self.node_connected_at:
            snapshot["connected_at"] = self.node_connected_at[node_id]
        return snapshot

    def get_freshness_status(self, node_id: str) -> str:
        """
        Calculates status with a 15-second grace period to handle restarts/updates gracefully.
        - WS Open → online (Green)
        - WS Closed but seen < 15s ago → stale (Yellow/Connecting)
        - Otherwise → offline (Gray)
        """
        if node_id in self.active_nodes:
            return "online"
            
        # Check runtime report timestamp for grace-period survival
        report = self.node_runtime.get(node_id, {})
        last_report_iso = report.get("last_report_at")
        if last_report_iso:
            try:
                last_seen = datetime.fromisoformat(last_report_iso.replace("Z", "+00:00"))
                delta = (datetime.now(timezone.utc) - last_seen).total_seconds()
                if delta < 15:
                    return "stale"
            except Exception:
                pass

        return "offline"

    def _schedule_disconnect_reason(self, reason: str):
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(record_disconnect_reason(reason))
        except RuntimeError:
            # No running loop in current context.
            pass

    async def cleanup_node_presence(self, node_id: str):
        """
        Remove node-scoped online/presence keys so dashboards immediately reflect disconnect.
        """
        try:
            for pattern in (
                f"node:{node_id}:user:*:online",
                f"node:{node_id}:user:*:connected_at",
                f"node:{node_id}:user:*:src_ip",
            ):
                keys = await redis_client.keys(pattern)
                if keys:
                    await redis_client.delete(*keys)
        except Exception as e:
            logger.error(f"Failed to cleanup presence keys for node {node_id}: {e}")

    def _schedule_node_presence_cleanup(self, node_id: str):
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.cleanup_node_presence(node_id))
        except RuntimeError:
            # No running loop in current context.
            pass

    async def broadcast_kill_signal(self, uuid: str):
        """
        Sends the REVOKE signal to ALL connected nodes to instantly drop the user's connection.
        """
        message = {
            "type": "REVOKE",
            "uuid": uuid
        }
        dead_nodes = []
        for node_id, ws in self.active_nodes.items():
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send kill signal to Node {node_id}: {e}")
                dead_nodes.append(node_id)
        
        # Cleanup broken connections
        for node_id in dead_nodes:
            self.disconnect(node_id)

    async def broadcast_sync(self, users_list: list):
        """
        Re-sync user policies to ALL connected nodes (e.g. after user create/update/delete).
        """
        logger.info(f"🔄 Broadcasting SYNC signal with {len(users_list)} users to all nodes.")
        message = {
            "type": "SYNC",
            "users": users_list
        }
        dead_nodes = []
        for node_id, ws in self.active_nodes.items():
            try:
                await ws.send_json(message)
                logger.debug(f"SYNC sent to Node {node_id}")
            except Exception as e:
                logger.error(f"❌ Failed to send SYNC to Node {node_id}: {e}")
                dead_nodes.append(node_id)
        for node_id in dead_nodes:
            self.disconnect(node_id)

    async def broadcast_shock(self):
        """
        Sends SHOCK signal to ALL connected nodes to force-reconnect all clients.
        """
        message = {"type": "SHOCK"}
        dead_nodes = []
        for node_id, ws in self.active_nodes.items():
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send SHOCK to Node {node_id}: {e}")
                dead_nodes.append(node_id)
        for node_id in dead_nodes:
            self.disconnect(node_id)
        logger.info("SHOCK signal broadcasted to all nodes.")

    async def send_config_update(self, node_id: str, config: dict):
        """
        Sends CONFIG_UPDATE to a specific node to update its server.json settings.
        """
        if node_id not in self.active_nodes:
            logger.warning(f"Node {node_id} not connected, cannot send config.")
            return False
        
        message = {
            "type": "CONFIG_UPDATE",
            "config": config
        }
        try:
            await self.active_nodes[node_id].send_json(message)
            logger.info(f"CONFIG_UPDATE sent to Node {node_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to send CONFIG_UPDATE to Node {node_id}: {e}")
            self.disconnect(node_id)
            return False

    async def send_tls_install(self, node_id: str, tls_payload: dict, request_id: str = ""):
        """
        Sends TLS_INSTALL command to a specific node.
        """
        if node_id not in self.active_nodes:
            logger.warning(f"Node {node_id} not connected, cannot send TLS_INSTALL.")
            return False
        
        message = {
            "type": "TLS_INSTALL",
            "request_id": request_id,
            "tls": tls_payload
        }
        try:
            await self.active_nodes[node_id].send_json(message)
            logger.info(f"TLS_INSTALL sent to Node {node_id} (request_id={request_id})")
            return True
        except Exception as e:
            logger.error(f"Failed to send TLS_INSTALL to Node {node_id}: {e}")
            self.disconnect(node_id)
            return False

    async def send_geodata_install(self, node_id: str, geodata_payload: dict, request_id: str = ""):
        """
        Sends GEODATA_INSTALL command to a specific node.
        """
        if node_id not in self.active_nodes:
            logger.warning(f"Node {node_id} not connected, cannot send GEODATA_INSTALL.")
            return False
        
        message = {
            "type": "GEODATA_INSTALL",
            "request_id": request_id,
            "geodata": geodata_payload
        }
        try:
            await self.active_nodes[node_id].send_json(message)
            logger.info(f"GEODATA_INSTALL sent to Node {node_id} (request_id={request_id})")
            return True
        except Exception as e:
            logger.error(f"Failed to send GEODATA_INSTALL to Node {node_id}: {e}")
            self.disconnect(node_id)
            return False

    async def broadcast_config_update(self, config: dict):
        """
        Sends CONFIG_UPDATE to ALL connected nodes (for global setting changes).
        """
        message = {
            "type": "CONFIG_UPDATE",
            "config": config
        }
        dead_nodes = []
        for node_id, ws in self.active_nodes.items():
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send CONFIG_UPDATE to Node {node_id}: {e}")
                dead_nodes.append(node_id)
        for node_id in dead_nodes:
            self.disconnect(node_id)
            
    async def process_telemetry(self, node_id: str, telemetry_data: dict):
        """
        Process the JSON batch of user traffic sent by a node.
        Data received is Absolute Baseline Total + Active Delta on THIS NODE.
        We must calculate the delta to increment the global database correctly.
        """
        usage_list = telemetry_data.get('usage', [])
        logger.debug(f"Received USAGE from Node {node_id}: {len(usage_list)} users.")
        
        for usage in usage_list:
            uuid = usage.get("uuid")
            bytes_in = int(usage.get("bytes_in", 0))
            bytes_out = int(usage.get("bytes_out", 0))
            
            if not uuid:
                continue
                
            # Store live stream count (request_pool) for dashboard
            request_pool = int(usage.get("request_pool", 0))
            online_key = f"node:{node_id}:user:{uuid}:online"
            connected_at = usage.get("connected_at")
            src_ip = usage.get("src_ip")
            connected_at_key = f"node:{node_id}:user:{uuid}:connected_at"
            src_ip_key = f"node:{node_id}:user:{uuid}:src_ip"
            seen_connected_key = f"node:{node_id}:user:{uuid}:seen_connected_at"

            # v1.1.0 Intelligence Fields
            active_state = usage.get("active_state", "OPTIMAL")
            threat_level = self._to_int(usage.get("threat_level")) or 0
            rtt_std_dev = self._to_float(usage.get("rtt_std_dev")) or 0.0

            if request_pool > 0:
                # Presence keys expire automatically if node stops reporting.
                await redis_client.set(online_key, request_pool, ex=self.presence_ttl_seconds)
                if connected_at is not None:
                    await redis_client.set(connected_at_key, connected_at, ex=self.presence_ttl_seconds)
                    last_seen_connected = await redis_client.get(seen_connected_key)
                    if last_seen_connected is None:
                        await record_connection_success(reconnect=False)
                    elif str(last_seen_connected) != str(connected_at):
                        await record_connection_success(reconnect=True)
                    await redis_client.set(seen_connected_key, str(connected_at), ex=60 * 60 * 24 * 7)
                if src_ip:
                    await redis_client.set(src_ip_key, str(src_ip), ex=self.presence_ttl_seconds)
                
                await redis_client.set(f"node:{node_id}:user:{uuid}:active_state", active_state, ex=self.presence_ttl_seconds)
                await redis_client.set(f"node:{node_id}:user:{uuid}:threat_level", threat_level, ex=self.presence_ttl_seconds)
                await redis_client.set(f"node:{node_id}:user:{uuid}:rtt_std_dev", rtt_std_dev, ex=self.presence_ttl_seconds)
            else:
                await redis_client.delete(
                    online_key, connected_at_key, src_ip_key,
                    f"node:{node_id}:user:{uuid}:active_state",
                    f"node:{node_id}:user:{uuid}:threat_level",
                    f"node:{node_id}:user:{uuid}:rtt_std_dev"
                )
            
            current_node_usage = bytes_in + bytes_out
            
            # Fetch last known usage for this specific node and user to get delta
            last_usage_in_key = f"node:{node_id}:user:{uuid}:last_usage_in"
            last_usage_out_key = f"node:{node_id}:user:{uuid}:last_usage_out"
            last_in_str = await redis_client.get(last_usage_in_key)
            last_out_str = await redis_client.get(last_usage_out_key)
            last_in = int(last_in_str) if last_in_str else 0
            last_out = int(last_out_str) if last_out_str else 0
            
            delta_in = bytes_in - last_in
            delta_out = bytes_out - last_out
            
            redis_key = f"user:{uuid}:traffic"
            total_traffic = 0
            
            if delta_in > 0 or delta_out > 0:
                await redis_client.set(last_usage_in_key, bytes_in)
                await redis_client.set(last_usage_out_key, bytes_out)
                
                # Atomic increment in Redis for global tracking
                if delta_in > 0:
                    await redis_client.hincrby(redis_key, "total_in", delta_in)
                if delta_out > 0:
                    await redis_client.hincrby(redis_key, "total_out", delta_out)
                
                total_traffic = await redis_client.hincrby(redis_key, "total_bytes", max(0, delta_in) + max(0, delta_out))
                logger.debug(f"Traffic Update User {uuid} - In: +{delta_in}, Out: +{delta_out} (Total: {total_traffic})")
            elif delta_in < 0 or delta_out < 0:
                # If negative, node might have restarted and reset its counters. 
                # Save the new current usage and add it completely as fresh delta.
                logger.info(f"📶 Node {node_id} restart detected for user {uuid}. Resetting node-local counters.")
                await redis_client.set(last_usage_in_key, bytes_in)
                await redis_client.set(last_usage_out_key, bytes_out)
                
                if bytes_in > 0:
                    await redis_client.hincrby(redis_key, "total_in", bytes_in)
                if bytes_out > 0:
                    await redis_client.hincrby(redis_key, "total_out", bytes_out)
                    
                total_traffic = await redis_client.hincrby(redis_key, "total_bytes", bytes_in + bytes_out)
                logger.debug(f"Reset Traffic Update User {uuid} - In: +{bytes_in}, Out: +{bytes_out} (Total: {total_traffic})")
            else:
                # Delta is 0, no change, just check current global traffic
                total_traffic_str = await redis_client.hget(redis_key, "total_bytes")
                total_traffic = int(total_traffic_str) if total_traffic_str else 0
            
            # Check user limits to see if we should issue a kill signal
            limit_key = f"user:{uuid}:limit"
            user_limit = await redis_client.get(limit_key)
            
            if user_limit and int(user_limit) > 0:
                if total_traffic >= int(user_limit):
                    logger.warning(f"User {uuid} reached global data limit! Triggering REVOKE.")
                    await record_disconnect_reason("limit_reached")
                    await self.broadcast_kill_signal(uuid)

    async def optimize_system(self, node_id: str):
        """
        Sends SYSTEM_OPTIMIZE command to increase UDP buffers and kernel performance.
        """
        if node_id not in self.active_nodes:
            return False
            
        message = {
            "type": "SYSTEM_OPTIMIZE",
            "sysctl": {
                "net.core.rmem_max": 7340032,
                "net.core.wmem_max": 7340032,
                "net.core.rmem_default": 262144,
                "net.core.wmem_default": 262144
            }
        }
        try:
            await self.active_nodes[node_id].send_json(message)
            logger.info(f"🚀 SYSTEM_OPTIMIZE signal sent to Node {node_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to send SYSTEM_OPTIMIZE to Node {node_id}: {e}")
            return False


node_manager = NodeManager()
