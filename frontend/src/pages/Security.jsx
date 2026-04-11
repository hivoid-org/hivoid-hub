import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Monitor, 
  Clock, 
  MapPin, 
  Globe, 
  Trash2, 
  AlertCircle, 
  Search,
  RefreshCw,
  Activity,
  History,
  Fingerprint,
  Download,
  Info
} from 'lucide-react';
import API from '../services/api';
import { useFeedback } from '../components/feedback/FeedbackProvider';
import Modal from '../components/common/Modal';

export default function Security() {
  const { notify, confirm } = useFeedback();
  const [activeTab, setActiveTab] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailLog, setDetailLog] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sessions') {
        const data = await API.getSessions();
        setSessions(data);
      } else {
        const data = await API.getAuditLogs();
        setLogs(data);
      }
    } catch (err) {
      notify('Failed to fetch security data.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleRevoke = async (sid, isCurrent) => {
    if (isCurrent) {
        notify('Cannot revoke current session. Use logout instead.', { type: 'warning' });
        return;
    }
    const approved = await confirm({
      title: 'Revoke Session?',
      message: 'This device will be immediately logged out.',
      confirmText: 'Revoke Access',
      danger: true
    });
    if (!approved) return;

    try {
      await API.revokeSession(sid);
      notify('Session revoked successfully.', { type: 'success' });
      setSessions(prev => prev.filter(s => s.sid !== sid));
    } catch (err) {
      notify('Failed to revoke session.', { type: 'error' });
    }
  };

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-shell animate-fade-slide">
      <div className="page-topline">Security</div>

      <div className="page-card">
        <div className="page-card-header">
          <div>
            <h1 className="page-card-title">Security Center</h1>
            <p className="page-card-desc">Monitor active sessions and administrative audit logs.</p>
          </div>
          <div className="page-card-actions" style={{ gap: '10px' }}>
            {activeTab === 'logs' && (
              <button className="btn btn-secondary" onClick={() => {
                const header = `HI-VOID HUB AUDIT LOGS EXPORT\nGenerated: ${new Date().toLocaleString()}\n--------------------------------------------------\n\n`;
                const content = logs.map(l => (
                    `LOG ID      : ${l.id}\n` +
                    `TIMESTAMP   : ${new Date(l.timestamp).toLocaleString()}\n` +
                    `ACTION      : ${l.action}\n` +
                    `IP ADDRESS  : ${l.ip_address}\n` +
                    `USER AGENT  : ${l.user_agent}\n` +
                    `DETAILS     : ${l.details}\n` +
                    `--------------------------------------------------`
                )).join('\n\n');
                const blob = new Blob([header + content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `hivoid_audit_logs_${new Date().toISOString().split('T')[0]}.log`;
                a.click();
                URL.revokeObjectURL(url);
                notify('Full log details exported.', { type: 'success' });
              }}>
                <Download size={15} /> <span>Export .log</span>
              </button>
            )}
            <button className="btn btn-secondary btn-icon-only" onClick={fetchData} disabled={loading} title="Refresh">
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        <div className="security-tabs-container">
          <div className="security-tabs">
            <button 
              className={`security-tab ${activeTab === 'sessions' ? 'active' : ''}`}
              onClick={() => setActiveTab('sessions')}
            >
              <Monitor size={16} />
              Active Sessions
            </button>
            <button 
              className={`security-tab ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              <History size={16} />
              Audit Logs
            </button>
          </div>
        </div>

        <div className="security-content">
        {activeTab === 'sessions' ? (
          <div className="sessions-grid">
            {sessions.map((s) => (
              <div key={s.sid} className={`session-card ${s.is_current ? 'is-current' : ''}`}>
                <div className="session-card-header">
                  <div className="session-device-icon">
                    <Monitor size={20} />
                  </div>
                  <div className="session-info">
                    <div className="session-title">
                        {s.is_current && <span className="current-badge">CURRENT</span>}
                        {s.ua.split(' ')[0] || 'Unknown Browser'}
                    </div>
                    <div className="session-ip">
                      <Globe size={12} /> {s.ip}
                    </div>
                  </div>
                  {!s.is_current && (
                    <button 
                        className="session-revoke-btn" 
                        onClick={() => handleRevoke(s.sid, s.is_current)}
                        title="Revoke Session"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="session-details">
                   <div className="session-detail-item">
                      <MapPin size={12} /> {s.country}
                   </div>
                   <div className="session-detail-item">
                      <Clock size={12} /> {new Date(s.created_at).toLocaleString()}
                   </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="audit-logs-wrap">
            <div className="logs-toolbar">
                <div className="search-box-wrap">
                    <Search size={16} />
                    <input 
                        type="text" 
                        placeholder="Search logs..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <div className="logs-table-container">
                <table className="data-table users-table logs-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Action</th>
                            <th>Details</th>
                            <th>IP / Origin</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.map((log) => (
                            <tr key={log.id}>
                                <td className="log-time">{new Date(log.timestamp + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                <td>
                                    <span className={`badge badge-action badge-${log.action.toLowerCase().replace(/_/g, '-')}`}>
                                        {log.action.replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td className="log-details">{log.details}</td>
                                <td className="log-origin">
                                    <span className="log-ip mono">{log.ip_address}</span>
                                    <span className="log-ua">{log.user_agent.split(')')[0] + ')'}</span>
                                </td>
                                <td>
                                    <button className="btn btn-secondary btn-icon-only" title="More Details" onClick={() => setDetailLog(log)}>
                                        <Info size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        )}
        </div>

        <Modal
            isOpen={!!detailLog}
            onClose={() => setDetailLog(null)}
            title="Audit Entry Details"
        >
            {detailLog && (
                <div className="log-detail-card animate-fade-slide">
                    <div className="detail-row">
                        <label>Action & Scope</label>
                        <div className="detail-value mono badge-action">{detailLog.action}</div>
                    </div>
                    <div className="detail-row">
                        <label>Timestamp</label>
                        <div className="detail-value">{new Date(detailLog.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="detail-row">
                        <label>Originator IP</label>
                        <div className="detail-value mono">{detailLog.ip_address}</div>
                    </div>
                    <div className="detail-row">
                        <label>User Agent / Identity</label>
                        <div className="detail-value ua-box">{detailLog.user_agent}</div>
                    </div>
                    <div className="detail-row full">
                        <label>Technical Details</label>
                        <div className="detail-value content-box">{detailLog.details}</div>
                    </div>
                </div>
            )}
        </Modal>
        </div>

      <style>{`
        .security-tabs-container {
            padding: 0 20px;
        }
        .security-tabs {
            display: flex;
            gap: 12px;
            margin-bottom: 32px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding: 0 4px;
        }
        .security-content {
            padding: 0 24px 24px;
        }
        .security-tab {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 14px 24px;
            background: transparent;
            color: var(--text-muted);
            font-size: 0.9rem;
            font-weight: 600;
            transition: all 0.2s;
            border: none;
            border-bottom: 2px solid transparent;
            cursor: pointer;
            margin-bottom: -1px;
        }
        .security-tab:hover {
            color: var(--text-primary);
            background: rgba(255,255,255,0.03);
            border-radius: 12px 12px 0 0;
        }
        .security-tab.active {
            color: var(--text-primary);
            border-bottom-color: var(--accent-primary);
            background: rgba(255,255,255,0.05);
            border-radius: 12px 12px 0 0;
        }
        .sessions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 20px;
        }
        .session-card {
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .session-card:hover {
            border-color: rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.03);
            transform: translateY(-2px);
        }
        .session-card.is-current {
            border-color: rgba(34, 197, 94, 0.4);
            background: rgba(34, 197, 94, 0.02);
        }
        .session-card.is-current::after {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 100%; height: 3px;
            background: #22c55e;
        }
        .session-card-header {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 20px;
        }
        .session-device-icon {
            width: 44px;
            height: 44px;
            background: rgba(255,255,255,0.03);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-primary);
        }
        .session-info {
            flex: 1;
        }
        .session-title {
            font-size: 1rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--text-primary);
        }
        .current-badge {
            font-size: 0.65rem;
            background: #22c55e;
            color: #000;
            padding: 1px 6px;
            border-radius: 4px;
            font-weight: 800;
        }
        .session-ip {
            font-size: 0.85rem;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 4px;
        }
        .session-revoke-btn {
            color: var(--text-muted);
            background: rgba(255,255,255,0.03);
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            border: 1px solid var(--border-color);
        }
        .session-revoke-btn:hover {
            color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.2);
            transform: translateY(-1px);
        }
        [data-theme='light'] .session-revoke-btn {
            background: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .session-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            padding-top: 16px;
            border-top: 1px solid rgba(255,255,255,0.05);
        }
        .session-detail-item {
            font-size: 0.8rem;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .audit-logs-wrap {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        .logs-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .search-box-wrap {
            position: relative;
            width: 320px;
        }
        .search-box-wrap svg {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
        }
        .search-box-wrap input {
            width: 100%;
            padding: 12px 14px 12px 44px;
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            color: #fff;
            font-size: 0.9rem;
            transition: all 0.2s;
        }
        .search-box-wrap input:focus {
            border-color: var(--accent-primary);
            background: rgba(255,255,255,0.04);
        }
        .logs-table-container {
            overflow-x: auto;
            border: 1px solid var(--border-color);
            border-radius: 16px;
            background: rgba(255,255,255,0.01);
        }
        .logs-table {
            width: 100%;
            border-collapse: collapse;
        }
        .logs-table th {
            text-align: center;
            padding: 16px 20px;
            color: var(--text-muted);
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            background: rgba(255,255,255,0.02);
            border-bottom: 2px solid var(--border-color);
        }
        .logs-table td {
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            vertical-align: middle;
            text-align: center;
            font-size: 0.9rem;
        }
        .logs-table tr:hover td {
            background: rgba(255,255,255,0.01);
        }
        .log-time {
            color: var(--text-secondary);
            font-weight: 500;
        }
        .badge {
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            border: 1px solid transparent;
        }
        .badge-action {
            background: rgba(255,255,255,0.05);
            color: var(--text-muted);
            border-color: rgba(255,255,255,0.1);
        }
        .badge-admin-login { background: rgba(34, 197, 94, 0.1); color: #22c55e; border-color: rgba(34,197,94,0.2) }
        .badge-user-created { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-color: rgba(59,130,246,0.2) }
        .badge-password-change { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border-color: rgba(245,158,11,0.2) }
        .badge-ip-ban { background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239,68,68,0.2) }
        .badge-node-created { background: rgba(168, 85, 247, 0.1); color: #a855f7; border-color: rgba(168,85,247,0.2) }
        .badge-settings-updated { background: rgba(20, 184, 166, 0.1); color: #14b8a6; border-color: rgba(20,184,166,0.2) }
        
        .log-details {
            max-width: 450px;
            line-height: 1.5;
            color: var(--text-primary);
        }
        .log-origin {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .log-ip {
            font-weight: 600;
            color: var(--text-primary);
        }
        .log-ua {
            font-size: 0.75rem;
            color: var(--text-muted);
            opacity: 0.6;
            max-width: 200px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .log-detail-card {
            display: grid;
            gap: 20px;
            padding: 10px 0;
        }
        .detail-row {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .detail-row label {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            font-weight: 700;
        }
        .detail-value {
            font-size: 0.95rem;
            color: var(--text-primary);
        }
        .ua-box {
            font-size: 0.8rem;
            padding: 12px;
            background: rgba(255,255,255,0.02);
            border-radius: 8px;
            border: 1px solid var(--border-color);
            line-height: 1.6;
            color: var(--text-secondary);
        }
        .content-box {
            background: rgba(0,0,0,0.2);
            padding: 16px;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            line-height: 1.7;
            white-space: pre-wrap;
            font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
