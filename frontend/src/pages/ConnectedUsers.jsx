import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Wifi, RefreshCw, Eye, UserCircle2, Server, Globe2, Clock3, ArrowUpDown, Mail, Fingerprint, Timer, Gauge, Search, SlidersHorizontal, Zap, AlertTriangle } from 'lucide-react';

import API from '../services/api';
import Modal from '../components/common/Modal';

const CONNECTED_USER_COLUMNS = [
  { id: 'identity', label: 'Client Identity', hint: 'Config, email, UUID' },
  { id: 'node', label: 'Node', hint: 'Connected node' },
  { id: 'state', label: 'State', hint: 'OPTIMAL, THROTTLED, BLOCKED' },
  { id: 'threat', label: 'Threat', hint: 'Path risk level (0-100)' },
  { id: 'jitter', label: 'Jitter', hint: 'RTT Std Dev (ms)' },
  { id: 'sourceIp', label: 'Network Source', hint: 'Client source IP' },
  { id: 'connectedFor', label: 'Uptime', hint: 'Elapsed connection time' },
  { id: 'connectedTimer', label: 'Connected For', hint: 'Seconds / minutes / hours' },
  { id: 'sessionUsage', label: 'Throughput', hint: 'Session upload/download' },
  { id: 'live', label: 'Status', hint: 'Session state' },
  { id: 'connectedAt', label: 'Connected At', hint: 'Connection start timestamp' },
];

const DEFAULT_CONNECTED_COLUMNS = ['identity', 'node', 'state', 'threat', 'jitter', 'sessionUsage', 'live'];


const fmtBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const fmtTime = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '-';
  }
};

const fmtElapsed = (iso, nowMs) => {
  if (!iso) return '-';
  const start = Date.parse(iso);
  if (Number.isNaN(start)) return '-';
  const diffSec = Math.max(0, Math.floor((nowMs - start) / 1000));
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
};

const fmtDurationDetailed = (iso, nowMs) => {
  if (!iso) return '-';
  const start = Date.parse(iso);
  if (Number.isNaN(start)) return '-';
  const diffSec = Math.max(0, Math.floor((nowMs - start) / 1000));
  if (diffSec < 60) return `${diffSec} second${diffSec === 1 ? '' : 's'}`;
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins} minute${mins === 1 ? '' : 's'} ${secs} second${secs === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ${mins} minute${mins === 1 ? '' : 's'}`;
};

const identityOf = (item) => item.config_name || item.username || item.email || item.uuid || '-';

const loadVisibleColumns = () => {
  try {
    const raw = window.localStorage.getItem('hivoid-connected-columns');
    if (!raw) return DEFAULT_CONNECTED_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CONNECTED_COLUMNS;
    const allowed = new Set(CONNECTED_USER_COLUMNS.map((column) => column.id));
    const filtered = parsed.filter((column) => allowed.has(column));
    return filtered.length > 0 ? filtered : DEFAULT_CONNECTED_COLUMNS;
  } catch {
    return DEFAULT_CONNECTED_COLUMNS;
  }
};

function ConnectedUserDetailsModal({ isOpen, onClose, item, userInfo, loading }) {
  if (!isOpen) return null;

  const sessionTraffic = (Number(item?.upload_bytes || 0) + Number(item?.download_bytes || 0));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connected Session Details"
      subtitle="Read-only session and subscriber telemetry"
      icon={<Eye size={24} color="var(--text-primary)" />}
      size="xl"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {(loading || !item) ? (
        <div className="sub-details-loading">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '14px' }}>
          <div className="sub-details-grid sub-details-grid-wide">
            <div className="sub-details-card">
              <UserCircle2 size={16} />
              <div>
                <div className="sub-details-label">Config Name</div>
                <div className="sub-details-value">{item.config_name || item.username || '-'}</div>
              </div>
            </div>
            <div className="sub-details-card">
              <Mail size={16} />
              <div>
                <div className="sub-details-label">Email</div>
                <div className="sub-details-value">{item.email || '-'}</div>
              </div>
            </div>
            <div className="sub-details-card">
              <Fingerprint size={16} />
              <div>
                <div className="sub-details-label">UUID</div>
                <div className="sub-details-value mono">{item.uuid}</div>
              </div>
            </div>
            <div className="sub-details-card">
              <Gauge size={16} />
              <div>
                <div className="sub-details-label">Session Traffic</div>
                <div className="sub-details-value">{fmtBytes(sessionTraffic)}</div>
              </div>
            </div>
            <div className="sub-details-card">
              <ArrowUpDown size={16} />
              <div>
                <div className="sub-details-label">Session Up / Down</div>
                <div className="sub-details-value">↑ {fmtBytes(item.upload_bytes)} / ↓ {fmtBytes(item.download_bytes)}</div>
              </div>
            </div>
            <div className="sub-details-card">
              <Activity size={16} />
              <div>
                <div className="sub-details-label">Live Sessions</div>
                <div className="sub-details-value">{item.active_sessions || 0}</div>
              </div>
            </div>
            <div className="sub-details-card">
              <Server size={16} />
              <div>
                <div className="sub-details-label">Node</div>
                <div className="sub-details-value">{item.node_name || item.node}</div>
              </div>
            </div>
            <div className="sub-details-card">
              <Globe2 size={16} />
              <div>
                <div className="sub-details-label">Source IP</div>
                <div className="sub-details-value mono">{item.ip_src || '-'}</div>
              </div>
            </div>
            <div className="sub-details-card">
              <Zap size={16} color="var(--success-color)" />
              <div>
                <div className="sub-details-label">Path State</div>
                <div className="sub-details-value">{item.active_state || 'OPTIMAL'}</div>
              </div>
            </div>
            <div className="sub-details-card">
              <AlertTriangle size={16} color="var(--warning-color)" />
              <div>
                <div className="sub-details-label">Threat Level</div>
                <div className="sub-details-value">{item.threat_level || 0}%</div>
              </div>
            </div>
            <div className="sub-details-card">
              <Activity size={16} color="var(--info-color)" />
              <div>
                <div className="sub-details-label">Jitter</div>
                <div className="sub-details-value mono">{Number(item.rtt_std_dev || 0).toFixed(2)}ms</div>
              </div>
            </div>
            <div className="sub-details-card">
              <Clock3 size={16} />

              <div>
                <div className="sub-details-label">Connected At</div>
                <div className="sub-details-value">{fmtTime(item.connection_time)}</div>
              </div>
            </div>
            <div className="sub-details-card">
              <Timer size={16} />
              <div>
                <div className="sub-details-label">Connected For</div>
                <div className="sub-details-value">{fmtElapsed(item.connection_time, Date.now())}</div>
              </div>
            </div>
          </div>

          {userInfo && (
            <>
              <div className="sub-details-section-title">Full User Profile</div>
              <div className="sub-details-list">
                <div className="sub-details-row"><span>Status</span><strong>{userInfo.status || '-'}</strong></div>
                <div className="sub-details-row"><span>Total Usage</span><strong>{fmtBytes(userInfo.total_used)} / {userInfo.data_limit === 0 ? 'Unlimited' : fmtBytes(userInfo.data_limit)}</strong></div>
                <div className="sub-details-row"><span>Upload Total</span><strong>{fmtBytes(userInfo.upload_used)}</strong></div>
                <div className="sub-details-row"><span>Download Total</span><strong>{fmtBytes(userInfo.download_used)}</strong></div>
                <div className="sub-details-row"><span>Max Connections</span><strong>{userInfo.max_connections ?? '-'}</strong></div>
                <div className="sub-details-row"><span>Max IPs</span><strong>{userInfo.max_ips ?? '-'}</strong></div>
                <div className="sub-details-row"><span>Bandwidth Limit</span><strong>{userInfo.bandwidth_limit ? fmtBytes(userInfo.bandwidth_limit) : 'Unlimited'}</strong></div>
                <div className="sub-details-row"><span>Expire At</span><strong>{userInfo.expire_at ? new Date(userInfo.expire_at).toLocaleString() : 'Never'}</strong></div>
                <div className="sub-details-row"><span>Engine</span><strong>{userInfo.mode || '-'} / {userInfo.obfs || '-'}</strong></div>
                <div className="sub-details-row"><span>Bind IP</span><strong className="mono">{userInfo.bind_ip || '-'}</strong></div>
                <div className="sub-details-row"><span>Pool Size</span><strong>{userInfo.pool_size ?? '-'}</strong></div>
                <div className="sub-details-row"><span>SOCKS Port</span><strong>{userInfo.socks_port ?? '-'}</strong></div>
                <div className="sub-details-row"><span>DNS Port</span><strong>{userInfo.dns_port ?? '-'}</strong></div>
                <div className="sub-details-row"><span>DNS Upstream</span><strong>{userInfo.dns_upstream || '-'}</strong></div>
                <div className="sub-details-row"><span>Insecure TLS</span><strong>{userInfo.insecure ? 'Yes' : 'No'}</strong></div>
                <div className="sub-details-row"><span>Cert Pin</span><strong className="mono">{userInfo.cert_pin || '-'}</strong></div>
              </div>

              <div className="sub-details-section-title">Routes & Rules</div>
              <div className="sub-details-list">
                <div className="sub-details-row"><span>Bypass Domains</span><strong>{(userInfo.bypass_domains || []).join(', ') || '—'}</strong></div>
                <div className="sub-details-row"><span>Bypass IPs</span><strong>{(userInfo.bypass_ips || []).join(', ') || '—'}</strong></div>
                <div className="sub-details-row"><span>Direct Route</span><strong>{(userInfo.direct_route || []).join(', ') || '—'}</strong></div>
                <div className="sub-details-row"><span>Direct GeoSite</span><strong>{(userInfo.direct_geosite || []).join(', ') || '—'}</strong></div>
                <div className="sub-details-row"><span>Direct GeoIP</span><strong>{(userInfo.direct_geoip || []).join(', ') || '—'}</strong></div>
                <div className="sub-details-row"><span>Direct Domains</span><strong>{(userInfo.direct_domains || []).join(', ') || '—'}</strong></div>
                <div className="sub-details-row"><span>Direct IPs</span><strong>{(userInfo.direct_ips || []).join(', ') || '—'}</strong></div>
                <div className="sub-details-row"><span>GeoIP Path</span><strong className="mono">{userInfo.client_geoip_path || '-'}</strong></div>
                <div className="sub-details-row"><span>GeoSite Path</span><strong className="mono">{userInfo.client_geosite_path || '-'}</strong></div>
              </div>

              <div className="sub-details-section-title">Available Nodes</div>
              <div className="sub-details-list">
                {(userInfo.nodes || []).length > 0 ? userInfo.nodes.map((node, idx) => (
                  <div key={`${node.host}-${idx}`} className="sub-details-row">
                    <span>{node.name}</span>
                    <strong className="mono">{node.host}:{node.port}</strong>
                  </div>
                )) : (
                  <div className="sub-details-row"><span>Nodes</span><strong>—</strong></div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function ConnectedUsers() {
  const [items, setItems] = useState([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());
  const [searchQuery, setSearchQuery] = useState('');

  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedUserInfo, setSelectedUserInfo] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showAdvancedColumns, setShowAdvancedColumns] = useState(false);

  const activeColumns = useMemo(
    () => CONNECTED_USER_COLUMNS.filter((column) => visibleColumns.includes(column.id)),
    [visibleColumns]
  );

  useEffect(() => {
    window.localStorage.setItem('hivoid-connected-columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const fetchItems = async ({ silent = false } = {}) => {
    if (!silent) {
      if (!hasLoadedOnceRef.current) setLoading(true);
      else setRefreshing(true);
    }
    try {
      const data = await API.getConnectedUsers();
      const incomingItems = data?.items || [];
      const incomingTotal = Number(data?.total_sessions || 0);

      setItems((prev) => {
        if (prev.length === incomingItems.length) {
          // Check core fields (UUID, Node, and Traffic) to see if anything truly changed
          const prevStr = JSON.stringify(prev.map(i => ({ 
            u: i.uuid, n: i.node, up: i.upload_bytes, dn: i.download_bytes 
          })));
          const nextStr = JSON.stringify(incomingItems.map(i => ({ 
            u: i.uuid, n: i.node, up: i.upload_bytes, dn: i.download_bytes 
          })));
          if (prevStr === nextStr) return prev;
        }
        return incomingItems;
      });

      setTotalSessions((prev) => (prev === incomingTotal ? prev : incomingTotal));
      setLastUpdated(new Date().toLocaleTimeString());
      hasLoadedOnceRef.current = true;
    } catch {
      if (!hasLoadedOnceRef.current) {
        setItems([]);
        setTotalSessions(0);
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchItems();
    const t = setInterval(() => fetchItems({ silent: true }), 10000);
    return () => clearInterval(t);
  }, []);

  const openDetails = async (item) => {
    setSelectedItem(item);
    setSelectedUserInfo(null);
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const userInfo = await API.getSubInfo(item.uuid);
      setSelectedUserInfo(userInfo);
    } catch {
      setSelectedUserInfo(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const toggleVisibleColumn = (columnId) => {
    setVisibleColumns((current) => (
      current.includes(columnId)
        ? current.filter((item) => item !== columnId)
        : [...current, columnId]
    ));
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => {
      const identity = identityOf(item).toLowerCase();
      return (
        identity.includes(q) ||
        (item.email || '').toLowerCase().includes(q) ||
        (item.uuid || '').toLowerCase().includes(q) ||
        (item.ip_src || '').toLowerCase().includes(q) ||
        (item.node_name || item.node || '').toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery]);

  return (
    <div className="page-shell animate-fade-slide">
      <div className="page-topline">Online</div>

      <div className="page-card">
        <div className="page-card-header">
          <div>
            <h1 className="page-card-title">Live Connections</h1>
            <p className="page-card-desc">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Wifi size={12} /> {totalSessions} Active Sessions
              </span>
              <span style={{ marginLeft: '8px' }}>
                · {lastUpdated ? `Updated ${lastUpdated}` : 'Waiting for sync'} · {filteredItems.length} of {totalSessions} shown
              </span>
            </p>
          </div>

          <div className="page-card-actions">
            <div className="page-search">
              <Search size={16} />
              <input
                type="text"
                className="input-field"
                placeholder="Search by Email or UUID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary btn-icon-only" onClick={() => fetchItems()} disabled={loading || refreshing} title="Refresh">
              {loading || refreshing ? <RefreshCw size={15} className="spin" /> : <RefreshCw size={15} />}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-icon-only"
              onClick={() => setShowAdvancedColumns((v) => !v)}
              title="Columns"
              aria-label="Toggle columns"
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </div>

        {showAdvancedColumns && (
          <div className="connected-users-normal-advanced">
            <div className="users-column-grid connected-users-column-grid">
              {CONNECTED_USER_COLUMNS.map((column) => (
                <label key={column.id} className="users-column-chip">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(column.id)}
                    onChange={() => toggleVisibleColumn(column.id)}
                  />
                  <span>
                    <strong>{column.label}</strong>
                    <em>{column.hint}</em>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="connected-users-table-shell">
          <div className="data-table-container users-table-panel connected-users-normal-table-wrap">
            <table className="data-table users-table users-table-centered connected-users-normal-table">
            <thead>
              <tr>
                {activeColumns.map((column) => <th key={column.id}>{column.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={activeColumns.length} className="connected-users-empty-cell">
                    {loading ? 'Loading sessions...' : 'NO ACTIVE CONNECTIONS FOUND'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={`${item.node}-${item.uuid}-${idx}`} className="connected-users-row" onClick={() => openDetails(item)}>
                    {activeColumns.map((column) => {
                      if (column.id === 'identity') {
                        return (
                          <td key={column.id}>
                            <div className="users-name-cell" style={{ justifyContent: 'center' }}>
                              <div className="user-avatar">{identityOf(item).charAt(0).toUpperCase()}</div>
                              <div className="users-name-copy">
                                <span className="users-name-primary">{identityOf(item)}</span>
                                <span className="users-name-secondary mono">{item.uuid}</span>
                              </div>
                            </div>
                          </td>
                        );
                      }
                      if (column.id === 'node') {
                        return (
                          <td key={column.id}>
                            <div className="users-name-copy" style={{ alignItems: 'center' }}>
                              <span className="users-name-primary">{item.node_name || item.node}</span>
                              <span className="users-name-secondary mono">{item.node}</span>
                            </div>
                          </td>
                        );
                      }
                      if (column.id === 'state') {
                        const state = item.active_state || 'OPTIMAL';
                        let badgeClass = 'badge-success';
                        if (state === 'THROTTLED') badgeClass = 'badge-warning';
                        else if (state === 'BLOCKED' || state === 'FALLBACK') badgeClass = 'badge-danger';
                        
                        return (
                          <td key={column.id}>
                            <span className={`badge ${badgeClass} badge-strong`}>{state}</span>
                          </td>
                        );
                      }
                      if (column.id === 'threat') {
                        const threat = item.threat_level || 0;
                        let color = 'var(--success-color)';
                        if (threat > 70) color = 'var(--danger-color)';
                        else if (threat > 30) color = 'var(--warning-color)';
                        
                        return (
                          <td key={column.id}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                              <div className="threat-bar-bg" style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div className="threat-bar-fill" style={{ width: `${threat}%`, height: '100%', background: color }} />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color }}>{threat}%</span>
                            </div>
                          </td>
                        );
                      }
                      if (column.id === 'jitter') {
                        return (
                          <td key={column.id}>
                            <span className="mono" style={{ fontSize: '11px', opacity: 0.8 }}>{Number(item.rtt_std_dev || 0).toFixed(2)}ms</span>
                          </td>
                        );
                      }
                      if (column.id === 'sourceIp') {

                        return <td key={column.id}><span className="mono">{item.ip_src || '-'}</span></td>;
                      }
                      if (column.id === 'connectedFor') {
                        return <td key={column.id}><span className="live-count">{fmtElapsed(item.connection_time, nowMs)}</span></td>;
                      }
                      if (column.id === 'connectedTimer') {
                        return <td key={column.id}><span className="live-count">{fmtDurationDetailed(item.connection_time, nowMs)}</span></td>;
                      }
                      if (column.id === 'live') {
                        return (
                          <td key={column.id}>
                            <span className="badge badge-neutral badge-strong">{(item.active_sessions || 0) > 0 ? 'Active' : 'Idle'}</span>
                          </td>
                        );
                      }
                      if (column.id === 'sessionUsage') {
                        return (
                          <td key={column.id}>
                            <div className="usage-stack usage-stack-tight" style={{ alignItems: 'center' }}>
                              <span className="usage-main-text">
                                {fmtBytes((item.upload_bytes || 0) + (item.download_bytes || 0))}
                              </span>
                              <span className="users-name-secondary">↑ {fmtBytes(item.upload_bytes)} / ↓ {fmtBytes(item.download_bytes)}</span>
                            </div>
                          </td>
                        );
                      }
                      if (column.id === 'connectedAt') {
                        return <td key={column.id}><span>{fmtTime(item.connection_time)}</span></td>;
                      }
                      return <td key={column.id}>-</td>;
                    })}
                  </tr>
                ))
              )}
            </tbody>
            </table>

            <div className="table-card-view">
              {filteredItems.length === 0 ? (
                <div className="table-card">
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                    {loading ? 'Loading sessions...' : 'NO ACTIVE CONNECTIONS FOUND'}
                  </div>
                </div>
              ) : (
                filteredItems.map((item, idx) => (
                  <div key={`${item.node}-${item.uuid}-${idx}-card`} className="table-card">
                    <div className="table-card-header">
                      <span className="badge badge-neutral">#{idx + 1}</span>
                      <span className="badge badge-neutral badge-strong">{(item.active_sessions || 0) > 0 ? 'Active' : 'Idle'}</span>
                    </div>

                    <div className="table-card-row">
                      <span className="table-card-label">Client Identity</span>
                      <span className="table-card-value">{identityOf(item)}</span>
                    </div>
                    <div className="table-card-row">
                      <span className="table-card-label">Node</span>
                      <span className="table-card-value">{item.node_name || item.node}</span>
                    </div>
                    <div className="table-card-row">
                      <span className="table-card-label">Network State</span>
                      <span className="table-card-value">{item.active_state || 'OPTIMAL'}</span>
                    </div>
                    <div className="table-card-row">
                      <span className="table-card-label">Path Threat</span>
                      <span className="table-card-value">{item.threat_level || 0}%</span>
                    </div>
                    <div className="table-card-row">
                      <span className="table-card-label">Jitter</span>
                      <span className="table-card-value">{Number(item.rtt_std_dev || 0).toFixed(2)}ms</span>
                    </div>
                    <div className="table-card-row">
                      <span className="table-card-label">Network Source</span>
                      <span className="table-card-value mono">{item.ip_src || '-'}</span>
                    </div>

                    <div className="table-card-row">
                      <span className="table-card-label">Uptime</span>
                      <span className="table-card-value">{fmtElapsed(item.connection_time, nowMs)}</span>
                    </div>
                    <div className="table-card-row">
                      <span className="table-card-label">Connected For</span>
                      <span className="table-card-value">{fmtDurationDetailed(item.connection_time, nowMs)}</span>
                    </div>

                    <div className="table-card-actions table-card-actions-neutral">
                      <button onClick={() => openDetails(item)} className="btn btn-secondary" style={{ padding: '10px' }}>
                        <Eye size={16} /> Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <ConnectedUserDetailsModal
        isOpen={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedItem(null);
          setSelectedUserInfo(null);
          setDetailsLoading(false);
        }}
        item={selectedItem}
        userInfo={selectedUserInfo}
        loading={detailsLoading}
      />
    </div>
  );
}
