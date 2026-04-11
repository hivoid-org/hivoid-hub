import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  FileCode,
  Clock,
  Server,
  Share2,
  Download,
  Upload,
  User,
  Mail,
  Key,
  Wifi,
  Shield,
  Gauge,
  Globe,
  Layers,
  Zap,
  Sun,
  Moon,
} from 'lucide-react';
import API from '../services/api';
import { useFeedback } from '../components/feedback/FeedbackProvider';

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

const buildJsonConfig = (info) =>
  JSON.stringify(
    {
      uuid: info.uuid,
      server: info.nodes?.[0]?.host || '',
      port: info.nodes?.[0]?.port || 4433,
      mode: info.mode || 'adaptive',
      obfs: info.obfs || 'none',
      pool_size: info.pool_size ?? 4,
      socks_port: info.socks_port ?? 1080,
      dns_port: info.dns_port ?? 0,
      dns_upstream: info.dns_upstream || '8.8.8.8:53',
      insecure: !!info.insecure,
      cert_pin: info.cert_pin || '',
      bypass_domains: info.bypass_domains || [],
      bypass_ips: info.bypass_ips || [],
      direct_route: info.direct_route || [],
      geoip_path: info.client_geoip_path || '',
      geosite_path: info.client_geosite_path || '',
      name: info.username,
    },
    null,
    2
  );

export default function SubInfo() {
  const { notify, showCopyDialog } = useFeedback();
  const { uuid } = useParams();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedUri, setCopiedUri] = useState(-1);

  const fetchInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await API.getSubInfo(uuid);
      setInfo(data);
    } catch (e) {
      setInfo(null);
      setError(e.response?.status === 404 ? 'Subscription not found.' : 'Failed to retrieve data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
  }, [uuid]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const copyText = async (text, idx=-1) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUri(idx);
      setTimeout(() => setCopiedUri(-1), 2000);
      notify('Copied to clipboard.', { type: 'success', duration: 1600 });
    } catch {
      showCopyDialog({
        title: 'Copy Value',
        message: 'Clipboard access failed. Copy this value manually.',
        value: text,
      });
    }
  };

  const shareText = async (title, text, url) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        notify('Shared successfully.', { type: 'success', duration: 1400 });
      } catch {
        // User canceled or share failed; no noisy error required.
      }
      return;
    }

    if (url) {
      await copyText(url);
    }
  };

  const renderInPreviewFrame = (content) => (
    <div className="subpage-preview-panel subinfo-public-panel">
      <button
        type="button"
        className="subinfo-theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      </button>
      <div className="subpage-preview-container subinfo-public-container">
        <div className="subpage-preview-frame subinfo-public-frame">{content}</div>
      </div>
    </div>
  );

  if (loading) {
    return renderInPreviewFrame(
      <div className="subinfo-v2-loading">
        <div className="subinfo-v2-spinner" />
        <p>Loading subscription...</p>
      </div>
    );
  }

  if (error || !info) {
    return renderInPreviewFrame(
      <div className="subinfo-v2-error">
        <AlertCircle size={48} />
        <h2>Access Denied</h2>
        <p>{error}</p>
      </div>
    );
  }

  const isUnlimited = info.data_limit === 0;
  const pct = isUnlimited ? 0 : Math.min(100, (info.total_used / info.data_limit) * 100);
  const isExpired = info.expire_at && new Date(info.expire_at) < new Date();
  const isActive = info.status === 'active' && !isExpired;
  const ui = info.sub_page || {};
  const jsonConfig = buildJsonConfig(info);

  return renderInPreviewFrame(
    <>
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

      <main className="subinfo-v2-main">
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
                    <strong>{info.username || 'Subscriber'}</strong>
                  </div>
                </div>
              )}
              {(ui.show_email ?? true) && (
                <div className="subinfo-v2-identity-item">
                  <Mail size={16} />
                  <div>
                    <span>Email</span>
                    <strong>{info.email || '—'}</strong>
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
                    <button
                      type="button"
                      className="subinfo-v2-copy-btn"
                      onClick={() => copyText(info.uuid, 99)}
                    >
                      {copiedUri === 99 ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

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
                  <strong>{info.max_connections ?? '—'}</strong>
                </div>
              )}
              {(ui.show_max_ips ?? true) && (
                <div className="subinfo-v2-policy-item">
                  <Globe size={16} />
                  <span>Max IPs</span>
                  <strong>{info.max_ips ?? '—'}</strong>
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
                  <strong>{info.mode || 'adaptive'}</strong>
                </div>
              )}
              {(ui.show_obfs ?? true) && (
                <div className="subinfo-v2-policy-item">
                  <Shield size={16} />
                  <span>Obfuscation</span>
                  <strong>{info.obfs || 'none'}</strong>
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
                    <strong>{node.name || `Node ${index + 1}`}</strong>
                    <span className="mono">{node.host}:{node.port}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
                      <button
                        type="button"
                        className="subinfo-v2-copy-btn"
                        onClick={() => copyText(uri, index)}
                      >
                        {copiedUri === index ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="subinfo-v2-actions">
          {(ui.show_json_export ?? true) && (
            <button 
              type="button" 
              className="subinfo-v2-btn subinfo-v2-btn-primary" 
              onClick={() => copyText(jsonConfig, 98)}
            >
              <FileCode size={18} />
              <span>Export JSON Config</span>
            </button>
          )}
          {(ui.allow_share_native ?? true) && (
            <button
              type="button"
              className="subinfo-v2-btn subinfo-v2-btn-secondary"
              onClick={() => shareText('HiVoid Subscription', 'Subscription details', window.location.href)}
            >
              <Share2 size={18} />
              <span>Share</span>
            </button>
          )}
        </div>

        {(ui.show_footer_branding ?? true) && (
          <footer className="subinfo-v2-footer">
            <span>Powered by</span>
            <strong>HiVoid QUIC Edge Engine</strong>
          </footer>
        )}
      </main>
    </>
  );
}
