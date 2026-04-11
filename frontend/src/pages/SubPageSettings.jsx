import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  User,
  Mail,
  Key,
  Gauge,
  Clock,
  Shield,
  Server,
  Zap,
  FileCode,
  Share2,
  Wifi,
  Globe,
  Layers,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  Copy,
  Save,
  RefreshCw,
  Monitor,
} from 'lucide-react';
import API from '../services/api';
import { useFeedback } from '../components/feedback/FeedbackProvider';

const HUB_CONFIG_DEFAULT = {
  sub_page: {
    title: 'HiVoid Network',
    subtitle: 'Subscription Dashboard',
    show_status_badge: true,
    show_username: true,
    show_email: true,
    show_uuid: true,
    show_usage: true,
    show_usage_progress: true,
    show_upload_download: true,
    show_expiry: true,
    show_policy_cards: true,
    show_max_connections: true,
    show_max_ips: true,
    show_bandwidth_limit: true,
    show_mode: true,
    show_obfs: true,
    show_bind_ip: true,
    show_nodes: true,
    show_hivoid_links: true,
    show_json_export: true,
    show_runtime_cards: true,
    show_qr: true,
    show_footer_branding: true,
    allow_copy_uuid: true,
    allow_copy_links: true,
    allow_copy_json: true,
    allow_share_native: true,
  },
};

const MOCK_SUB_DATA = {
  username: 'John Doe',
  email: 'john@example.com',
  uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  status: 'active',
  total_used: 15728640000,
  data_limit: 107374182400,
  download_used: 12884901888,
  upload_used: 2843738112,
  expire_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  max_connections: 3,
  max_ips: 5,
  bandwidth_limit: 0,
  mode: 'adaptive',
  obfs: 'salamander',
  bind_ip: '0.0.0.0',
  nodes: [
    { name: 'Frankfurt DE', host: 'de1.hivoid.net', port: 4433 },
    { name: 'Amsterdam NL', host: 'nl1.hivoid.net', port: 4433 },
  ],
  hivoid_uris: [
    'hivoid://de1.hivoid.net:4433?uuid=a1b2c3d4-e5f6-7890-abcd-ef1234567890&mode=adaptive&obfs=salamander',
    'hivoid://nl1.hivoid.net:4433?uuid=a1b2c3d4-e5f6-7890-abcd-ef1234567890&mode=adaptive&obfs=salamander',
  ],
};

const fmt = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const fmtExp = (date) => {
  if (!date) return 'Never expires';
  const dt = new Date(date);
  const diff = dt - new Date();
  if (diff < 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days} days remaining`;
  return `${Math.floor(diff / 3600000)} hours remaining`;
};

const ToggleField = ({ icon: Icon, label, checked, onChange }) => (
  <div className="subpage-toggle-field">
    <div className="subpage-toggle-info">
      <Icon size={16} />
      <span>{label}</span>
    </div>
    <button
      type="button"
      className={`subpage-toggle-btn ${checked ? 'active' : ''}`}
      onClick={onChange}
    >
      {checked ? <Eye size={14} /> : <EyeOff size={14} />}
    </button>
  </div>
);

const LivePreview = ({ config }) => {
  const ui = config;
  const info = MOCK_SUB_DATA;
  const isUnlimited = info.data_limit === 0;
  const pct = isUnlimited ? 0 : Math.min(100, (info.total_used / info.data_limit) * 100);
  const isExpired = info.expire_at && new Date(info.expire_at) < new Date();
  const isActive = info.status === 'active' && !isExpired;

  return (
    <div className="subpage-preview-container">
      <div className="subpage-preview-frame">
        {/* Hero Header */}
        <header className="subinfo-v2-hero">
          <div className="subinfo-v2-hero-content">
            <h1>{ui.title || 'HiVoid Network'}</h1>
            <p>{ui.subtitle || 'Subscription Dashboard'}</p>
          </div>
          {(ui.show_status_badge ?? true) && (
            <div className={`subinfo-v2-badge ${isActive ? 'active' : 'inactive'}`}>
              {isActive ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{isActive ? 'Active' : 'Expired'}</span>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="subinfo-v2-main">
          {/* Identity Card */}
          {((ui.show_username ?? true) || (ui.show_email ?? true) || (ui.show_uuid ?? true)) && (
            <section className="subinfo-v2-card">
              <div className="subinfo-v2-card-header">
                <User size={18} />
                <span>Identity</span>
              </div>
              <div className="subinfo-v2-identity-grid">
                {(ui.show_username ?? true) && (
                  <div className="subinfo-v2-identity-item">
                    <User size={16} />
                    <div>
                      <span>Username</span>
                      <strong>{info.username}</strong>
                    </div>
                  </div>
                )}
                {(ui.show_email ?? true) && (
                  <div className="subinfo-v2-identity-item">
                    <Mail size={16} />
                    <div>
                      <span>Email</span>
                      <strong>{info.email}</strong>
                    </div>
                  </div>
                )}
                {(ui.show_uuid ?? true) && (
                  <div className="subinfo-v2-identity-item subinfo-v2-identity-uuid">
                    <Key size={16} />
                    <div>
                      <span>UUID</span>
                      <strong className="mono">{info.uuid}</strong>
                    </div>
                    {(ui.allow_copy_uuid ?? true) && (
                      <button type="button" className="subinfo-v2-copy-btn">
                        <Copy size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Traffic Usage */}
          {(ui.show_usage ?? true) && (
            <section className="subinfo-v2-card">
              <div className="subinfo-v2-card-header">
                <Gauge size={18} />
                <span>Traffic Usage</span>
              </div>
              <div className="subinfo-v2-usage">
                <div className="subinfo-v2-usage-header">
                  <span className="subinfo-v2-usage-label">Data Used</span>
                  <span className="subinfo-v2-usage-value">
                    {fmt(info.total_used)} / {isUnlimited ? '∞ Unlimited' : fmt(info.data_limit)}
                  </span>
                </div>
                {(ui.show_usage_progress ?? true) && (
                  <div className="subinfo-v2-progress">
                    <div 
                      className="subinfo-v2-progress-fill" 
                      style={{ width: isUnlimited ? '0%' : `${pct}%` }}
                    />
                  </div>
                )}
                {(ui.show_upload_download ?? true) && (
                  <div className="subinfo-v2-traffic-split">
                    <div className="subinfo-v2-traffic-item">
                      <Download size={16} />
                      <div>
                        <span>Download</span>
                        <strong>{fmt(info.download_used)}</strong>
                      </div>
                    </div>
                    <div className="subinfo-v2-traffic-item">
                      <Upload size={16} />
                      <div>
                        <span>Upload</span>
                        <strong>{fmt(info.upload_used)}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Expiry */}
          {(ui.show_expiry ?? true) && (
            <section className={`subinfo-v2-card subinfo-v2-expiry-card ${isExpired ? 'expired' : ''}`}>
              <div className="subinfo-v2-expiry">
                <Clock size={24} />
                <div className="subinfo-v2-expiry-content">
                  <strong>{fmtExp(info.expire_at)}</strong>
                  {info.expire_at && (
                    <span>{new Date(info.expire_at).toLocaleDateString('en-US', { 
                      weekday: 'long',
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</span>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Policy Details */}
          {(ui.show_policy_cards ?? true) && (
            <section className="subinfo-v2-card">
              <div className="subinfo-v2-card-header">
                <Shield size={18} />
                <span>Policy & Limits</span>
              </div>
              <div className="subinfo-v2-policy-grid">
                {(ui.show_max_connections ?? true) && (
                  <div className="subinfo-v2-policy-item">
                    <Wifi size={16} />
                    <span>Max Connections</span>
                    <strong>{info.max_connections}</strong>
                  </div>
                )}
                {(ui.show_max_ips ?? true) && (
                  <div className="subinfo-v2-policy-item">
                    <Globe size={16} />
                    <span>Max IPs</span>
                    <strong>{info.max_ips}</strong>
                  </div>
                )}
                {(ui.show_bandwidth_limit ?? true) && (
                  <div className="subinfo-v2-policy-item">
                    <Zap size={16} />
                    <span>Bandwidth</span>
                    <strong>{info.bandwidth_limit === 0 ? 'Unlimited' : `${info.bandwidth_limit} KB/s`}</strong>
                  </div>
                )}
                {(ui.show_mode ?? true) && (
                  <div className="subinfo-v2-policy-item">
                    <Layers size={16} />
                    <span>Mode</span>
                    <strong>{info.mode}</strong>
                  </div>
                )}
                {(ui.show_obfs ?? true) && (
                  <div className="subinfo-v2-policy-item">
                    <Shield size={16} />
                    <span>Obfuscation</span>
                    <strong>{info.obfs}</strong>
                  </div>
                )}
                {(ui.show_bind_ip ?? true) && info.bind_ip && (
                  <div className="subinfo-v2-policy-item">
                    <Server size={16} />
                    <span>Bind IP</span>
                    <strong className="mono">{info.bind_ip}</strong>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Connection Nodes */}
          {(ui.show_nodes ?? true) && info.nodes?.length > 0 && (
            <section className="subinfo-v2-card">
              <div className="subinfo-v2-card-header">
                <Server size={18} />
                <span>Available Nodes</span>
                <span className="subinfo-v2-card-count">{info.nodes.length}</span>
              </div>
              <div className="subinfo-v2-nodes">
                {info.nodes.map((node, index) => (
                  <div key={`node-${index}`} className="subinfo-v2-node">
                    <div className="subinfo-v2-node-icon">
                      <Server size={18} />
                    </div>
                    <div className="subinfo-v2-node-info">
                      <strong>{node.name}</strong>
                      <span className="mono">{node.host}:{node.port}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* HiVoid Links */}
          {(ui.show_hivoid_links ?? true) && info.hivoid_uris?.length > 0 && (
            <section className="subinfo-v2-card">
              <div className="subinfo-v2-card-header">
                <Zap size={18} />
                <span>Connection Links</span>
                <span className="subinfo-v2-card-count">{info.hivoid_uris.length}</span>
              </div>
              <div className="subinfo-v2-links">
                {info.hivoid_uris.map((uri, index) => (
                  <div key={`link-${index}`} className="subinfo-v2-link">
                    <div className="subinfo-v2-link-header">
                      <Server size={14} />
                      <span>{info.nodes?.[index]?.name || `Node ${index + 1}`}</span>
                    </div>
                    <div className="subinfo-v2-link-uri">
                      <code>{uri}</code>
                      {(ui.allow_copy_links ?? true) && (
                        <button type="button" className="subinfo-v2-copy-btn">
                          <Copy size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Actions */}
          <div className="subinfo-v2-actions">
            {(ui.show_json_export ?? true) && (
              <button type="button" className="subinfo-v2-btn subinfo-v2-btn-primary">
                <FileCode size={18} />
                <span>Export JSON Config</span>
              </button>
            )}
            {(ui.allow_share_native ?? true) && (
              <button type="button" className="subinfo-v2-btn subinfo-v2-btn-secondary">
                <Share2 size={18} />
                <span>Share</span>
              </button>
            )}
          </div>

          {/* Footer */}
          {(ui.show_footer_branding ?? true) && (
            <footer className="subinfo-v2-footer">
              <span>Powered by</span>
              <strong>HiVoid QUIC Edge Engine</strong>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
};

export default function SubPageSettings() {
  const { notify } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subPageConfig, setSubPageConfig] = useState(HUB_CONFIG_DEFAULT.sub_page);
  const [subPageJson, setSubPageJson] = useState('');
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        const cfg = await API.getHubConfig();
        const merged = { ...HUB_CONFIG_DEFAULT.sub_page, ...(cfg.sub_page || {}) };
        setSubPageConfig(merged);
        setSubPageJson(JSON.stringify(merged, null, 2));
      } catch (e) {
        notify('Failed to load config.', { type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const toggle = (key) => {
    setSubPageConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (key, value) => {
    setSubPageConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cfg = await API.getHubConfig();
      await API.updateHubConfig({ ...cfg, sub_page: subPageConfig });
      notify('Sub page settings saved.', { type: 'success' });
    } catch (e) {
      notify('Failed to save.', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(subPageJson);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        notify('JSON must be an object.', { type: 'error' });
        return;
      }
      setSubPageConfig({ ...HUB_CONFIG_DEFAULT.sub_page, ...parsed });
      notify('JSON applied.', { type: 'success' });
    } catch {
      notify('Invalid JSON.', { type: 'error' });
    }
  };

  const resetToDefaults = () => {
    setSubPageConfig(HUB_CONFIG_DEFAULT.sub_page);
    setSubPageJson(JSON.stringify(HUB_CONFIG_DEFAULT.sub_page, null, 2));
    notify('Reset to defaults.', { type: 'info' });
  };

  if (loading) {
    return (
      <div className="page-root">
        <div className="page-centered-loader">Loading...</div>
      </div>
    );
  }

  const toggleGroups = [
    {
      title: 'Header & Status',
      items: [
        { key: 'show_status_badge', label: 'Status Badge', icon: CheckCircle2 },
      ],
    },
    {
      title: 'Identity Section',
      items: [
        { key: 'show_username', label: 'Username', icon: User },
        { key: 'show_email', label: 'Email', icon: Mail },
        { key: 'show_uuid', label: 'UUID', icon: Key },
        { key: 'allow_copy_uuid', label: 'Allow Copy UUID', icon: Copy },
      ],
    },
    {
      title: 'Traffic & Usage',
      items: [
        { key: 'show_usage', label: 'Usage Section', icon: Gauge },
        { key: 'show_usage_progress', label: 'Progress Bar', icon: Gauge },
        { key: 'show_upload_download', label: 'Upload/Download Split', icon: Upload },
      ],
    },
    {
      title: 'Expiry',
      items: [
        { key: 'show_expiry', label: 'Expiry Block', icon: Clock },
      ],
    },
    {
      title: 'Policy & Limits',
      items: [
        { key: 'show_policy_cards', label: 'Policy Cards Section', icon: Shield },
        { key: 'show_max_connections', label: 'Max Connections', icon: Wifi },
        { key: 'show_max_ips', label: 'Max IPs', icon: Globe },
        { key: 'show_bandwidth_limit', label: 'Bandwidth Limit', icon: Zap },
        { key: 'show_mode', label: 'Mode', icon: Layers },
        { key: 'show_obfs', label: 'Obfuscation', icon: Shield },
        { key: 'show_bind_ip', label: 'Bind IP', icon: Server },
      ],
    },
    {
      title: 'Nodes & Links',
      items: [
        { key: 'show_nodes', label: 'Nodes List', icon: Server },
        { key: 'show_hivoid_links', label: 'HiVoid Links', icon: Zap },
        { key: 'allow_copy_links', label: 'Allow Copy Links', icon: Copy },
      ],
    },
    {
      title: 'Actions & Footer',
      items: [
        { key: 'show_json_export', label: 'JSON Export Button', icon: FileCode },
        { key: 'allow_share_native', label: 'Share Button', icon: Share2 },
        { key: 'show_footer_branding', label: 'Footer Branding', icon: Eye },
      ],
    },
  ];

  return (
    <div className="subpage-settings-root">
      {/* Settings Panel */}
      <aside className="subpage-settings-panel">
        <div className="subpage-settings-header">
          <h1>
            <Monitor size={20} />
            <span>Sub Page Settings</span>
          </h1>
          <p>Configure public subscription page appearance</p>
        </div>

        <div className="subpage-settings-content">
          {/* Branding Fields */}
          <div className="subpage-settings-section">
            <h3>Branding</h3>
            <div className="subpage-text-field">
              <label>Page Title</label>
              <input
                type="text"
                className="input-field"
                value={subPageConfig.title || ''}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="HiVoid Network"
              />
            </div>
            <div className="subpage-text-field">
              <label>Page Subtitle</label>
              <input
                type="text"
                className="input-field"
                value={subPageConfig.subtitle || ''}
                onChange={(e) => updateField('subtitle', e.target.value)}
                placeholder="Subscription Dashboard"
              />
            </div>
          </div>

          {/* Toggle Groups */}
          {toggleGroups.map((group) => (
            <div key={group.title} className="subpage-settings-section">
              <h3>{group.title}</h3>
              <div className="subpage-toggle-list">
                {group.items.map((item) => (
                  <ToggleField
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    checked={!!subPageConfig[item.key]}
                    onChange={() => toggle(item.key)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* JSON Editor */}
          <div className="subpage-settings-section">
            <button
              type="button"
              className="subpage-json-toggle"
              onClick={() => {
                setShowJson(!showJson);
                if (!showJson) {
                  setSubPageJson(JSON.stringify(subPageConfig, null, 2));
                }
              }}
            >
              <FileCode size={16} />
              <span>{showJson ? 'Hide JSON Editor' : 'Show JSON Editor'}</span>
            </button>
            {showJson && (
              <div className="subpage-json-editor">
                <textarea
                  className="input-field mono"
                  value={subPageJson}
                  onChange={(e) => setSubPageJson(e.target.value)}
                />
                <div className="subpage-json-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setSubPageJson(JSON.stringify(subPageConfig, null, 2))}>
                    Load Current
                  </button>
                  <button type="button" className="btn btn-primary" onClick={applyJson}>
                    Apply JSON
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="subpage-settings-actions">
          <button type="button" className="btn btn-secondary" onClick={resetToDefaults}>
            <RefreshCw size={16} />
            Reset
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </aside>

      {/* Live Preview */}
      <div className="subpage-preview-panel">
        <div className="subpage-preview-header">
          <span>Live Preview</span>
        </div>
        <LivePreview config={subPageConfig} />
      </div>
    </div>
  );
}
