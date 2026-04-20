import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Info,
  RefreshCw,
  Server,
  ShieldCheck,
  Timer,
  Users,
  Wifi,
  Zap,
  HardDrive,
  Cpu,
  Shield,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import API from '../services/api';
import { useFeedback } from '../components/feedback/FeedbackProvider';
import WorldGlobe from '../components/dashboard/WorldGlobe';
import StatCard from '../components/dashboard/StatCard';

const POLL_MS = 10000;

const SEVERITY_META = {
  critical: { Icon: AlertCircle, label: 'Critical', className: 'dashboard-alert-critical' },
  warning: { Icon: AlertTriangle, label: 'Warning', className: 'dashboard-alert-warning' },
  info: { Icon: Info, label: 'Info', className: 'dashboard-alert-info' },
};

const fmtPct = (value) => `${Number(value || 0).toFixed(1)}%`;

const fmtDuration = (seconds) => {
  const sec = Math.max(0, Number(seconds || 0));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const fmtBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export default function Dashboard() {
  const { notify, confirm } = useFeedback();
  const [insights, setInsights] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nodeLocations, setNodeLocations] = useState({});
  const [hubLocation, setHubLocation] = useState(null);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    const fetchHubLocation = async () => {
      try {
        const res = await API.getHubLocation();
        if (res && res.latitude && res.longitude) {
          console.log('Hub identified at:', res.ip, res.country);
          setHubLocation({
            lat: res.latitude,
            lon: res.longitude,
            ip: res.ip,
            country: res.country
          });
        }
      } catch (e) {}
    };
    fetchHubLocation();
  }, []);

  useEffect(() => {
    fetchInsights();
    fetchNodes();
    const interval = setInterval(() => {
      fetchInsights({ silent: true });
      fetchNodes();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const fetchNodes = async () => {
    try {
      const data = await API.getActiveNodes();
      const rawNodes = Array.isArray(data?.nodes) ? data.nodes : [];
      // Sort nodes by ID to ensure stable comparison regardless of backend order
      const nodesList = [...rawNodes].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      
      setNodes((prev) => {
        if (nodesList.length === 0 && prev.length > 0) return prev;

        if (prev.length === nodesList.length) {
          // Deep compare meaningful fields to decide if we should trigger a re-render
          const prevHash = JSON.stringify(prev.map(n => ({ 
            id: n.id, s: n.status, u: n.usersCount, c: n.cpu_usage, r: n.ram_usage 
          })));
          const nextHash = JSON.stringify(nodesList.map(n => ({ 
            id: n.id, s: n.status, u: n.usersCount, c: n.cpu_usage, r: n.ram_usage 
          })));
          
          if (prevHash === nextHash) return prev;
        }
        return nodesList;
      });
    } catch (e) {}
  };

  const fetchInsights = async ({ silent = false } = {}) => {
    if (!silent) {
      if (!hasLoadedOnceRef.current) setLoading(true);
      else setRefreshing(true);
    }
    try {
      const data = await API.getDashboardInsights();
      if (!data) return;

      setInsights((prev) => {
        // If it's the first load or data is fundamentally different, just update
        if (!prev) return data;
        
        // Check if the source data is actually newer
        if (prev.generated_at === data.generated_at) return prev;

        // Perform clean update without "stabilizers" that might cause desync
        // The backend is the source of truth.
        return data;
      });
      hasLoadedOnceRef.current = true;
    } catch (e) {
      if (!silent) notify('Failed to load dashboard insights.', { type: 'error' });
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Fetch GeoIP locations for nodes
  useEffect(() => {
    const fetchLocations = async () => {
      const isPrivateIP = (ip) => {
        if (!ip) return true;
        const parts = ip.split('.');
        if (parts.length !== 4) return true;
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);
        if (first === 10) return true;
        if (first === 172 && second >= 16 && second <= 31) return true;
        if (first === 192 && second === 168) return true;
        if (first === 127) return true;
        return false;
      };

      const ipsToFetch = nodes
        .map(node => node.ip)
        .filter(ip => ip && !nodeLocations[ip] && !isPrivateIP(ip));

      if (ipsToFetch.length === 0) return;

      try {
        const results = await API.batchIPLocation(ipsToFetch);
        const newLocations = {};
        results.forEach(result => {
          if (result.latitude && result.longitude) {
            newLocations[result.ip] = {
              lat: result.latitude,
              lon: result.longitude,
              country: result.country,
              countryCode: result.country_code,
              city: result.city,
            };
          }
        });
        if (Object.keys(newLocations).length > 0) {
          setNodeLocations(prev => ({ ...prev, ...newLocations }));
        }
      } catch (error) {
        console.warn('Failed to fetch IP locations:', error);
      }
    };
    fetchLocations();
  }, [nodes.map(n => n.ip).join(',')]);

  const handleShock = async () => {
    const approved = await confirm({
      title: 'Send SHOCK Signal?',
      message: 'This will force reconnect every connected client on all nodes.',
      confirmText: 'Send SHOCK',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!approved) return;
    try {
      await API.shockAllNodes();
      notify('SHOCK signal broadcasted successfully.', { type: 'success' });
    } catch (e) {
      notify('Failed to send SHOCK signal.', { type: 'error' });
    }
  };

  const handleForceSync = async () => {
    try {
      await API.forceSyncAll();
      notify('Force SYNC completed.', { type: 'success' });
      fetchInsights({ silent: true });
    } catch (e) {
      notify('Failed to force sync.', { type: 'error' });
    }
  };

  const handleAckAlert = async (alertId) => {
    try {
      await API.acknowledgeDashboardAlert(alertId);
      notify('Alert acknowledged.', { type: 'success', duration: 1400 });
      setInsights((prev) => {
        if (!prev?.alerts) return prev;
        return {
          ...prev,
          alerts: prev.alerts.map((alert) => (
            alert.id === alertId
              ? { ...alert, acknowledged: true, acked_at: new Date().toISOString() }
              : alert
          )),
        };
      });
    } catch {
      notify('Failed to acknowledge alert.', { type: 'error' });
    }
  };

  const global = insights?.global || {
    total_users: 0, active_users: 0, online_users: 0,
    connected_nodes: 0, global_upload: 0, global_download: 0, network_load_pct: 0,
  };
  const health = insights?.health || {
    api: { status: 'warning', label: 'API', detail: 'Loading' },
    redis: { status: 'warning', label: 'Redis', detail: 'Loading' },
    nodes: { status: 'warning', label: 'Nodes', detail: 'Loading' },
    sync_queue: { status: 'warning', label: 'Sync Queue', detail: 'Loading', pending: 0 },
  };
  const quality = insights?.connection_quality || {
    success_rate_pct: 0, median_connection_duration_sec: 0, reconnect_rate_pct: 0,
    reconnect_events_15m: 0, session_starts_15m: 0, sessions_active: 0, disconnect_reasons: [],
  };
  const subscriptions = insights?.subscriptions || {
    expiring_24h: 0, expiring_72h: 0, expiring_7d: 0,
    near_quota_80: 0, near_quota_95: 0, near_quota_users: [],
  };
  const alerts = insights?.alerts || [];

  const updatedAt = useMemo(() => {
    if (!insights?.generated_at) return 'Waiting for data';
    const dt = new Date(insights.generated_at);
    if (Number.isNaN(dt.getTime())) return 'Waiting for data';
    return dt.toLocaleTimeString();
  }, [insights?.generated_at]);

  if (loading && !insights) {
    return (
      <div className="dashboard-intel">
        <div className="page-card">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      </div>
    );
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  if (isMobile) {
    return (
      <div className="dashboard-intel animate-fade-slide">
        <div className="dashboard-intel-top">
          <div>
            <div className="dashboard-intel-kicker">Operational Intelligence</div>
            <h1 className="dashboard-intel-title">Network Quality & Risk Monitor</h1>
            <div className="dashboard-intel-meta">
              <span><Users size={14} /> {global.total_users} total users</span>
              <span><Wifi size={14} /> {global.online_users} online users</span>
              <span><Server size={14} /> {global.connected_nodes} connected nodes</span>
              <span><Clock3 size={14} /> Updated {updatedAt}</span>
            </div>
          </div>
          <div className="dashboard-intel-actions">
            <button type="button" className="btn btn-secondary btn-icon-only" onClick={() => fetchInsights()} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleForceSync}><RefreshCw size={15} /> Force Sync</button>
            <button type="button" className="btn btn-primary" onClick={handleShock}><Zap size={15} /> Shock All</button>
          </div>
        </div>

        <div className="dashboard-intel-health">
          <div className="dashboard-intel-section-head"><ShieldCheck size={16} /> Live Health Bar</div>
          <div className="dashboard-health-grid">
            <HealthChip item={health.api} icon={Activity} />
            <HealthChip item={health.redis} icon={Database} />
            <HealthChip item={health.nodes} icon={Server} />
            <HealthChip item={health.sync_queue} icon={RefreshCw} />
          </div>
        </div>

        <div className="dashboard-intel-grid">
          <section className="dashboard-intel-panel">
            <div className="dashboard-intel-section-head"><Gauge size={16} /> Connection Quality</div>
            <div className="dashboard-quality-cards">
              <MetricCard label="Connection Success Rate" value={fmtPct(quality.success_rate_pct)} />
              <MetricCard label="Median Connection Time" value={fmtDuration(quality.median_connection_duration_sec)} />
              <MetricCard label="Reconnect Rate" value={fmtPct(quality.reconnect_rate_pct)} />
            </div>
            <div className="dashboard-quality-meta">
              <span><Wifi size={14} /> Active Sessions: {quality.sessions_active}</span>
              <span><RefreshCw size={14} /> Session Starts (15m): {quality.session_starts_15m}</span>
              <span><Timer size={14} /> Reconnect Events (15m): {quality.reconnect_events_15m}</span>
              <span><Activity size={14} /> Network Load: {fmtPct(global.network_load_pct)}</span>
            </div>
            <div className="dashboard-reasons">
              <div className="dashboard-reasons-title">Disconnect Reasons (24h)</div>
              {quality.disconnect_reasons.length === 0 ? (
                <div className="dashboard-empty-inline">No disconnect reason data in last 24h.</div>
              ) : (
                <div className="dashboard-reasons-list">
                  {quality.disconnect_reasons.map((item) => (
                    <div key={item.reason} className="dashboard-reason-item">
                      <span>{item.label}</span><strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="dashboard-intel-panel">
            <div className="dashboard-intel-section-head"><Users size={16} /> Subscription Status</div>
            <div className="dashboard-subscription-cards">
              <MetricCard label="Traffic Upload" value={fmtBytes(global.global_upload)} />
              <MetricCard label="Traffic Download" value={fmtBytes(global.global_download)} />
            </div>
            <div className="dashboard-near-quota">
              <div className="dashboard-reasons-title">Users Near Quota (95%+)</div>
              {subscriptions.near_quota_users.length === 0 ? (
                <div className="dashboard-empty-inline">No users above 95% quota.</div>
              ) : (
                <div className="dashboard-near-quota-list">
                  {subscriptions.near_quota_users.slice(0, 6).map((user) => (
                    <div key={user.uuid} className="dashboard-near-quota-item">
                      <span>{user.username}</span><strong>{fmtPct(user.usage_pct)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="dashboard-intel-panel">
          <div className="dashboard-intel-section-head"><AlertTriangle size={16} /> Alert Center</div>
          {alerts.length === 0 ? (
            <div className="dashboard-alert-empty"><CheckCircle2 size={16} /> No active alerts.</div>
          ) : (
            <div className="dashboard-alert-list">
              {alerts.map((alert) => {
                const meta = SEVERITY_META[alert.severity] || SEVERITY_META.info;
                const Icon = meta.Icon;
                return (
                  <div key={alert.id} className={`dashboard-alert-item ${meta.className} ${alert.acknowledged ? 'is-ack' : ''}`}>
                    <div className="dashboard-alert-main">
                      <div className="dashboard-alert-title-row">
                        <span className="dashboard-alert-severity"><Icon size={14} /> {meta.label}</span>
                        <strong>{alert.title}</strong>
                      </div>
                      <p>{alert.message}</p>
                      <div className="dashboard-alert-metric">{alert.metric}</div>
                    </div>
                    <div className="dashboard-alert-actions">
                      {alert.acknowledged ? (
                        <span className="dashboard-alert-ack-tag"><CheckCircle2 size={14} /> Acknowledged</span>
                      ) : (
                        <button type="button" className="btn btn-secondary" onClick={() => handleAckAlert(alert.id)}>Acknowledge</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  /* ═══ DESKTOP LAYOUT: Cards left + Globe right ═══ */
  const avgCpu = nodes.length > 0
    ? Math.round(nodes.reduce((sum, n) => sum + (n.cpu_usage || 0), 0) / nodes.length) : 0;
  const avgRam = nodes.length > 0
    ? Math.round(nodes.reduce((sum, n) => sum + (n.ram_usage || 0), 0) / nodes.length) : 0;

  return (
    <div className="dashboard-desktop">
      {/* Header */}
      <div className="dashboard-desktop-header">
        <div className="dashboard-header-content">
          <h1 className="dashboard-title">Global Network Dashboard</h1>
          <p className="dashboard-subtitle">Real-time monitoring • Updated {updatedAt}</p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => fetchInsights()} disabled={refreshing}>
            <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleForceSync}>
            <RefreshCw size={16} /> Sync
          </button>
          <button type="button" className="btn btn-danger" onClick={handleShock}>
            <Zap size={16} /> Shock
          </button>
        </div>
      </div>

      {/* Main content: compact sidebar left + globe right */}
      <div className="dashboard-desktop-body">
        <div className="dashboard-desktop-left">
          {/* Top: Stat Cards Grid */}
          <div className="dashboard-desktop-cards">
            <StatCard icon={Server} label="Total Nodes" value={global.connected_nodes} subtitle="Active nodes" />
            <StatCard icon={Users} label="Total Users" value={global.total_users} subtitle={`${global.online_users} online`} />
            <StatCard icon={Activity} label="Avg Jitter" value={`${quality.avg_jitter_ms} ms`} subtitle="Network stability" />
            <StatCard icon={Shield} label="Threat Level" value={`${quality.avg_threat_level}`} subtitle="Path risk score" />
            <StatCard icon={Cpu} label="Avg CPU Usage" value={nodes.length > 0 ? `${avgCpu}%` : 'N/A'} subtitle="Across all nodes" />
            <StatCard icon={HardDrive} label="Avg RAM Usage" value={nodes.length > 0 ? `${avgRam} MB` : 'N/A'} subtitle="Memory utilization" />
            <StatCard icon={ArrowUp} label="Total Upload" value={fmtBytes(global.global_upload)} subtitle="Network traffic" />
            <StatCard icon={ArrowDown} label="Total Download" value={fmtBytes(global.global_download)} subtitle="Network traffic" />
          </div>

          {/* Bottom: Inline Alerts Card */}
          <div className="dashboard-desktop-alerts-card">
            <div className="dashboard-desktop-alerts-header">
              <span><AlertTriangle size={16} color="#f59e0b" /> Alert Center</span>
              <div className="dashboard-section-subtitle" style={{ margin: 0, fontSize: '0.75rem' }}>{alerts.length} active</div>
            </div>
            <div className="dashboard-desktop-alerts-list">
              {alerts.length === 0 ? (
                <div className="desktop-alert-empty">
                  <CheckCircle2 size={32} color="#22c55e" style={{ opacity: 0.5 }} />
                  <span>All systems operational. No active threats detected.</span>
                </div>
              ) : (
                alerts.map(alert => (
                  <div key={alert.id} className={`desktop-alert-item ${alert.severity}`}>
                    <div className="desktop-alert-title">{alert.title}</div>
                    <div className="desktop-alert-msg">{alert.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center/Right: 3D Globe */}
        <div className="dashboard-desktop-globe">
          <WorldGlobe
            nodes={nodes}
            nodeLocations={nodeLocations}
            hubLocation={hubLocation}
          />
        </div>
      </div>
    </div>
  );
}

function HealthChip({ item, icon: Icon }) {
  return (
    <div className={`dashboard-health-chip ${item.status}`}>
      <div className="dashboard-health-chip-head">
        <Icon size={14} /><span>{item.label}</span>
      </div>
      <div className="dashboard-health-chip-detail">{item.detail}</div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="dashboard-metric-card">
      <span>{label}</span><strong>{value}</strong>
    </div>
  );
}
