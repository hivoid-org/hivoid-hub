import React, { useState, useEffect } from 'react';
import { Settings2, Server, Lock, Zap, Globe, Activity, Database, Clock, Shield, RefreshCw } from 'lucide-react';
import Modal from '../common/Modal';
import { FormField, FormSection, Toggle } from '../common/FormField';
import RouteCategoryPicker from '../common/RouteCategoryPicker';
import API from '../../services/api';
import { useFeedback } from '../feedback/FeedbackProvider';
import { ROUTE_CATEGORIES, GEOIP_COUNTRIES } from '../../constants/networkProfiles';

const MODES = ['adaptive', 'performance', 'stealth', 'balanced'];
const LOG_LEVELS = ['info', 'debug', 'warn', 'error'];
const GEOIP_TAG_OPTIONS = GEOIP_COUNTRIES.map((country) => country.code);
const BLOCKED_TAG_OPTIONS = Array.from(new Set([...ROUTE_CATEGORIES, ...GEOIP_TAG_OPTIONS]));
const BLOCKED_TAG_LABELS = {
  ...Object.fromEntries(ROUTE_CATEGORIES.map((tag) => [tag, `GeoSite: ${tag}`])),
  ...GEOIP_COUNTRIES.reduce((acc, country) => {
    acc[country.code] = `GeoIP: ${country.code} - ${country.name}`;
    return acc;
  }, {}),
};

const initialForm = {
  name: '',
  listen_addr: ':4433',
  server_mode: 'adaptive',
  log_level: 'info',
  cert_file: '',
  key_file: '',
  cert_pin: '',
  hot_reload: true,
  connection_tracking: true,
  disconnect_expired: true,
  max_conns: 0,
  anti_probe: true,
  fallback_addr: '',
  geoip_path: '',
  geosite_path: '',
  allowed_hosts: '',
  blocked_hosts: '',
  blocked_tags: '',
  port: 4433,
  public_host: '',
  voidreach_enabled: false,
  voidreach_mode: 'cdn',
  voidreach_listen_addr: '0.0.0.0:8080',
  voidreach_fronting_domain: '',
  voidreach_real_host: '',
  voidreach_relay_addr: '',
  voidreach_preshared_key: '',
  voidreach_decoy_file: '',
  voidreach_tls_cert_file: '',
  voidreach_tls_key_file: '',
  voidreach_tls_insecure_skip_verify: false,
  voidreach_cdn_domain: '',
  voidreach_cdn_agent: '',
  voidreach_path: '/ws-path',
};


export default function NodeForm({ isOpen, onClose, onSave, editingNode, loading }) {
  const [form, setForm] = useState(initialForm);
  const [activeTab, setActiveTab] = useState('general');
  const [tlsMode, setTlsMode] = useState('openssl_self_signed');
  const [tlsDomain, setTlsDomain] = useState('');
  const [tlsEmail, setTlsEmail] = useState('');
  const [tlsLoading, setTlsLoading] = useState(false);
  const [geodataLoading, setGeodataLoading] = useState(false);
  const { notify } = useFeedback();

  useEffect(() => {
    if (editingNode) {
      const vr = editingNode.voidreach_config || {};
      const vrTls = vr.tls || {};
      setForm({
        name: editingNode.name || '',
        listen_addr: editingNode.listen_addr || ':4433',
        server_mode: editingNode.server_mode || 'adaptive',
        log_level: editingNode.log_level || 'info',
        cert_file: editingNode.cert_file || '',
        key_file: editingNode.key_file || '',
        cert_pin: editingNode.cert_pin || '',
        hot_reload: editingNode.hot_reload !== false,
        connection_tracking: editingNode.connection_tracking !== false,
        disconnect_expired: editingNode.disconnect_expired !== false,
        max_conns: editingNode.max_conns || 0,
        anti_probe: editingNode.anti_probe !== false,
        fallback_addr: editingNode.fallback_addr || '',
        geoip_path: editingNode.geoip_path || '',
        geosite_path: editingNode.geosite_path || '',
        allowed_hosts: (editingNode.allowed_hosts || []).join(', '),
        blocked_hosts: (editingNode.blocked_hosts || []).join(', '),
        blocked_tags: (editingNode.blocked_tags || []).join(', '),
        port: editingNode.port || 4433,
        public_host: editingNode.public_host || '',
        voidreach_enabled: !!vr.enabled,
        voidreach_mode: vr.mode || 'cdn',
        voidreach_listen_addr: vr.listen_addr || '0.0.0.0:8080',
        voidreach_fronting_domain: vr.fronting_domain || '',
        voidreach_real_host: vr.real_host || '',
        voidreach_relay_addr: vr.relay_addr || '',
        voidreach_preshared_key: vr.preshared_key || '',
        voidreach_decoy_file: vr.decoy_file || '',
        voidreach_tls_cert_file: vrTls.cert_file || '',
        voidreach_tls_key_file: vrTls.key_file || '',
        voidreach_tls_insecure_skip_verify: !!vrTls.insecure_skip_verify,
        voidreach_cdn_domain: vr.cdn_domain || '',
        voidreach_cdn_agent: vr.cdn_agent || '',
        voidreach_path: vr.path || '/ws-path',
      });
      setTlsMode(editingNode.tls_mode || 'openssl_self_signed');
      setTlsDomain(editingNode.tls_domain || editingNode.public_host || '');
      setTlsEmail(editingNode.tls_email || '');
      setActiveTab('general');
    } else {
      setForm(initialForm);
      setTlsMode('openssl_self_signed');
      setTlsDomain('');
      setTlsEmail('');
    }
  }, [editingNode, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      listen_addr: form.listen_addr,
      server_mode: form.server_mode,
      log_level: form.log_level,
      cert_file: form.cert_file,
      key_file: form.key_file,
      cert_pin: form.cert_pin,
      hot_reload: form.hot_reload,
      connection_tracking: form.connection_tracking,
      disconnect_expired: form.disconnect_expired,
      max_conns: form.max_conns,
      anti_probe: form.anti_probe,
      fallback_addr: form.fallback_addr,
      geoip_path: form.geoip_path,
      geosite_path: form.geosite_path,
      allowed_hosts: form.allowed_hosts ? form.allowed_hosts.split(',').map(s => s.trim()).filter(Boolean) : [],
      blocked_hosts: form.blocked_hosts ? form.blocked_hosts.split(',').map(s => s.trim()).filter(Boolean) : [],
      blocked_tags: form.blocked_tags ? form.blocked_tags.split(',').map(s => s.trim()).filter(Boolean) : [],
      port: form.port,
      public_host: form.public_host,
      voidreach_config: {
        enabled: form.voidreach_enabled,
        mode: form.voidreach_mode,
        listen_addr: form.voidreach_listen_addr,
        fronting_domain: form.voidreach_fronting_domain,
        real_host: form.voidreach_real_host,
        relay_addr: form.voidreach_relay_addr,
        preshared_key: form.voidreach_preshared_key,
        decoy_file: form.voidreach_decoy_file,
        tls: {
          cert_file: form.voidreach_tls_cert_file,
          key_file: form.voidreach_tls_key_file,
          insecure_skip_verify: form.voidreach_tls_insecure_skip_verify,
        },
        cdn_domain: form.voidreach_cdn_domain,
        cdn_agent: form.voidreach_cdn_agent,
        path: form.voidreach_path,
      }
    };
    onSave(payload, editingNode?.id);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Server },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'features', label: 'Features', icon: Zap },
    { id: 'routing', label: 'Routing', icon: Globe },
    { id: 'voidreach', label: 'VoidReach', icon: RefreshCw },
  ];


  const handleInstallTls = async () => {
    if (!editingNode?.id) return;
    setTlsLoading(true);
    try {
      await API.installNodeTls(editingNode.id, {
        type: tlsMode,
        domain: tlsDomain || form.public_host,
        email: tlsEmail,
      });
      notify('TLS install command sent to node.', { type: 'success' });
    } catch (e) {
      const detail = e?.response?.data?.detail;
      notify(detail ? `TLS install failed: ${detail}` : 'TLS install failed.', { type: 'error' });
    } finally {
      setTlsLoading(false);
    }
  };

  const handleSyncTlsPaths = async () => {
    if (!editingNode?.id) return;
    setTlsLoading(true);
    try {
      const res = await API.syncNodeTlsPaths(editingNode.id);
      setForm((prev) => ({
        ...prev,
        cert_file: res.cert_file || prev.cert_file,
        key_file: res.key_file || prev.key_file,
      }));
      notify('TLS paths synced.', { type: 'success' });
    } catch (e) {
      const detail = e?.response?.data?.detail;
      notify(detail ? `TLS path sync failed: ${detail}` : 'TLS path sync failed.', { type: 'error' });
    } finally {
      setTlsLoading(false);
    }
  };

  const handleInstallGeodata = async () => {
    if (!editingNode?.id) return;
    setGeodataLoading(true);
    try {
      const res = await API.installNodeGeodata(editingNode.id, {
        geoip_path: form.geoip_path,
        geosite_path: form.geosite_path,
      });
      setForm((prev) => ({
        ...prev,
        geoip_path: res.geoip_path || prev.geoip_path,
        geosite_path: res.geosite_path || prev.geosite_path,
      }));
      notify('GeoData install requested and paths synced.', { type: 'success' });
    } catch (e) {
      const detail = e?.response?.data?.detail;
      notify(detail ? `GeoData install failed: ${detail}` : 'GeoData install failed.', { type: 'error' });
    } finally {
      setGeodataLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Node Configuration"
      subtitle="Full server.json push — changes applied instantly."
      icon={<Settings2 size={24} color="var(--text-primary)" />}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="node-form"
            className="btn btn-primary"
            style={{ minWidth: '140px' }}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Push Config'}
          </button>
        </>
      }
    >
      <form id="node-form" onSubmit={handleSubmit}>
        {/* Tabs */}
        <div className="tabs-header">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={14} style={{ marginRight: '6px' }} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="animate-fade-slide">
            <div className="grid-cols-2" style={{ marginBottom: '20px' }}>
              <FormField label="Node Name">
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Frankfurt Edge 1"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Public Host/IP">
                <input
                  type="text"
                  className="input-field"
                  placeholder="vps.example.com"
                  value={form.public_host}
                  onChange={e => setForm({ ...form, public_host: e.target.value })}
                />
              </FormField>
            </div>

            <FormSection title="LISTENER SETTINGS" icon={Activity}>
              <div className="grid-cols-4">
                <FormField label="Bind Addr">
                  <input
                    type="text"
                    className="input-field"
                    value={form.listen_addr}
                    onChange={e => setForm({ ...form, listen_addr: e.target.value })}
                  />
                </FormField>
                <FormField label="Public Port">
                  <input
                    type="number"
                    className="input-field"
                    value={form.port}
                    onChange={e => setForm({ ...form, port: parseInt(e.target.value) || 4433 })}
                  />
                </FormField>
                <FormField label="Default Mode">
                  <select
                    className="input-field"
                    value={form.server_mode}
                    onChange={e => setForm({ ...form, server_mode: e.target.value })}
                  >
                    {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </FormField>
                <FormField label="Log Level">
                  <select
                    className="input-field"
                    value={form.log_level}
                    onChange={e => setForm({ ...form, log_level: e.target.value })}
                  >
                    {LOG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </FormField>
              </div>
            </FormSection>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="animate-fade-slide">
            <FormSection title="TLS & CERTIFICATES" icon={Lock}>
              <div className="grid-cols-2">
                <FormField label="Cert File Path">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="/etc/hivoid/cert.pem"
                    value={form.cert_file}
                    onChange={e => setForm({ ...form, cert_file: e.target.value })}
                  />
                </FormField>
                <FormField label="Key File Path">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="/etc/hivoid/key.pem"
                    value={form.key_file}
                    onChange={e => setForm({ ...form, key_file: e.target.value })}
                  />
                </FormField>
              </div>
              <div className="grid-cols-2" style={{ marginTop: '12px' }}>
                <FormField label="TLS Type">
                  <select className="input-field" value={tlsMode} onChange={e => setTlsMode(e.target.value)}>
                    <option value="openssl_self_signed">OpenSSL (Self-signed)</option>
                    <option value="cloudflare">Cloudflare DNS challenge</option>
                  </select>
                </FormField>
                <FormField label="TLS Domain">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="helloworld1970.online"
                    value={tlsDomain}
                    onChange={e => setTlsDomain(e.target.value)}
                  />
                </FormField>
              </div>
              <div className="grid-cols-2" style={{ marginTop: '12px' }}>
                <FormField label="TLS Email">
                  <input
                    type="email"
                    className="input-field"
                    placeholder="admin@example.com"
                    value={tlsEmail}
                    onChange={e => setTlsEmail(e.target.value)}
                  />
                </FormField>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleInstallTls} disabled={tlsLoading}>
                    {tlsLoading ? <RefreshCw size={15} className="animate-spin" /> : null}
                    Install TLS
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleSyncTlsPaths} disabled={tlsLoading}>
                    Sync TLS Paths
                  </button>
                </div>
              </div>
            </FormSection>

            <FormSection title="CERTIFICATE PINNING" icon={Shield}>
              <FormField label="Certificate Pin (SHA256)">
                <input
                  type="text"
                  className="input-field mono"
                  placeholder="sha256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={form.cert_pin}
                  onChange={e => setForm({ ...form, cert_pin: e.target.value })}
                />
              </FormField>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                SHA256 fingerprint of this node's TLS certificate. Clients will verify this pin before connecting.
                Leave empty to disable pinning for this node. Format: sha256:xxxx...
              </p>
            </FormSection>

            <div className="grid-cols-2">
              <FormField label="Max Global Connections (0=∞)">
                <input
                  type="number"
                  className="input-field"
                  value={form.max_conns}
                  onChange={e => setForm({ ...form, max_conns: parseInt(e.target.value) || 0 })}
                />
              </FormField>
              <FormField label="Fallback Address">
                <input
                  type="text"
                  className="input-field"
                  placeholder="127.0.0.1:80"
                  value={form.fallback_addr}
                  onChange={e => setForm({ ...form, fallback_addr: e.target.value })}
                />
              </FormField>
            </div>
          </div>
        )}

        {/* Features Tab */}
        {activeTab === 'features' && (
          <div className="animate-fade-slide modal-toggle-grid">
            <Toggle
              label="Hot Reloading"
              icon={Activity}
              checked={form.hot_reload}
              onChange={v => setForm({ ...form, hot_reload: v })}
            />
            <Toggle
              label="Connection Tracking"
              icon={Activity}
              checked={form.connection_tracking}
              onChange={v => setForm({ ...form, connection_tracking: v })}
            />
            <Toggle
              label="Auto-Disconnect Expired"
              icon={Clock}
              checked={form.disconnect_expired}
              onChange={v => setForm({ ...form, disconnect_expired: v })}
            />
            <Toggle
              label="Anti-Probe Protection"
              icon={Shield}
              checked={form.anti_probe}
              onChange={v => setForm({ ...form, anti_probe: v })}
            />
          </div>
        )}

        {/* Routing Tab */}
        {activeTab === 'routing' && (
          <div className="animate-fade-slide">
            <FormSection title="GEODATA RESOURCES" icon={Database}>
              <div className="grid-cols-2">
                <FormField label="GeoIP Path">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="/var/lib/hivoid/geoip.dat"
                    value={form.geoip_path}
                    onChange={e => setForm({ ...form, geoip_path: e.target.value })}
                  />
                </FormField>
                <FormField label="GeoSite Path">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="/var/lib/hivoid/geosite.dat"
                    value={form.geosite_path}
                    onChange={e => setForm({ ...form, geosite_path: e.target.value })}
                  />
                </FormField>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={handleInstallGeodata} disabled={geodataLoading}>
                  {geodataLoading ? <RefreshCw size={15} className="animate-spin" /> : null}
                  Install GeoData
                </button>
              </div>
            </FormSection>

            <FormSection title="ACCESS CONTROL" icon={Globe} style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <FormField label="Allowed Domains (Whitelist)">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="*.google.com, github.com"
                    value={form.allowed_hosts}
                    onChange={e => setForm({ ...form, allowed_hosts: e.target.value })}
                  />
                </FormField>
                <FormField label="Blocked Domains (Blacklist)">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="*.ads.doubleclick.net"
                    value={form.blocked_hosts}
                    onChange={e => setForm({ ...form, blocked_hosts: e.target.value })}
                  />
                </FormField>
                <FormField label="Global Blocked Tags">
                  <RouteCategoryPicker
                    value={form.blocked_tags}
                    onChange={(next) => setForm({ ...form, blocked_tags: next })}
                    options={BLOCKED_TAG_OPTIONS}
                    optionLabels={BLOCKED_TAG_LABELS}
                    placeholder="Search GeoSite/GeoIP tag..."
                  />
                </FormField>
              </div>
            </FormSection>
          </div>
        )}
        {/* VoidReach Tab */}
        {activeTab === 'voidreach' && (

          <div className="animate-fade-slide">
            <FormSection title="VOIDREACH OBFUSCATION ENGINE" icon={RefreshCw}>
              <Toggle
                label="Enable VoidReach"
                icon={Zap}
                checked={form.voidreach_enabled}
                onChange={v => setForm({ ...form, voidreach_enabled: v })}
              />
              {form.voidreach_enabled && (
                <>
                  <div className="grid-cols-3" style={{ marginTop: '15px' }}>
                    <FormField label="VoidReach Mode">
                      <select
                        className="input-field"
                        value={form.voidreach_mode}
                        onChange={e => setForm({ ...form, voidreach_mode: e.target.value })}
                      >
                        <option value="cdn">cdn (Cloudflare etc.)</option>
                        <option value="direct">direct</option>
                        <option value="fronting">fronting</option>
                        <option value="relay">relay</option>
                      </select>
                    </FormField>
                    <FormField label="Listen Address">
                      <input
                        type="text"
                        className="input-field"
                        value={form.voidreach_listen_addr}
                        onChange={e => setForm({ ...form, voidreach_listen_addr: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Preshared Key (Secret)">
                      <input
                        type="text"
                        className="input-field mono"
                        placeholder="Secret Key"
                        value={form.voidreach_preshared_key}
                        onChange={e => setForm({ ...form, voidreach_preshared_key: e.target.value })}
                      />
                    </FormField>
                  </div>

                  <div className="grid-cols-2" style={{ marginTop: '12px' }}>
                    <FormField label="Fronting Domain">
                      <input
                        type="text"
                        className="input-field"
                        placeholder="fronting.domain.com"
                        value={form.voidreach_fronting_domain}
                        onChange={e => setForm({ ...form, voidreach_fronting_domain: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Real Host">
                      <input
                        type="text"
                        className="input-field"
                        placeholder="realhost.com"
                        value={form.voidreach_real_host}
                        onChange={e => setForm({ ...form, voidreach_real_host: e.target.value })}
                      />
                    </FormField>
                  </div>

                  <div className="grid-cols-3" style={{ marginTop: '12px' }}>
                    <FormField label="Relay Address">
                      <input
                        type="text"
                        className="input-field"
                        placeholder="1.2.3.4:443"
                        value={form.voidreach_relay_addr}
                        onChange={e => setForm({ ...form, voidreach_relay_addr: e.target.value })}
                      />
                    </FormField>
                    <FormField label="CDN Domain">
                      <input
                        type="text"
                        className="input-field"
                        placeholder="your-cdn-domain.cf"
                        value={form.voidreach_cdn_domain}
                        onChange={e => setForm({ ...form, voidreach_cdn_domain: e.target.value })}
                      />
                    </FormField>
                    <FormField label="CDN User Agent">
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Agent header"
                        value={form.voidreach_cdn_agent}
                        onChange={e => setForm({ ...form, voidreach_cdn_agent: e.target.value })}
                      />
                    </FormField>
                  </div>

                  <div className="grid-cols-2" style={{ marginTop: '12px' }}>
                    <FormField label="WS Path">
                      <input
                        type="text"
                        className="input-field"
                        placeholder="/ws-path"
                        value={form.voidreach_path}
                        onChange={e => setForm({ ...form, voidreach_path: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Decoy File Path">
                      <input
                        type="text"
                        className="input-field"
                        placeholder="/var/www/decoy.html"
                        value={form.voidreach_decoy_file}
                        onChange={e => setForm({ ...form, voidreach_decoy_file: e.target.value })}
                      />
                    </FormField>
                  </div>

                  <FormSection title="VOIDREACH TLS OVERRIDES" icon={Lock} style={{ marginTop: '15px' }}>
                    <div className="grid-cols-2">
                      <FormField label="TLS Cert File Path">
                        <input
                          type="text"
                          className="input-field"
                          placeholder="/etc/hivoid/cert.pem"
                          value={form.voidreach_tls_cert_file}
                          onChange={e => setForm({ ...form, voidreach_tls_cert_file: e.target.value })}
                        />
                      </FormField>
                      <FormField label="TLS Key File Path">
                        <input
                          type="text"
                          className="input-field"
                          placeholder="/etc/hivoid/key.pem"
                          value={form.voidreach_tls_key_file}
                          onChange={e => setForm({ ...form, voidreach_tls_key_file: e.target.value })}
                        />
                      </FormField>
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      <Toggle
                        label="Insecure Skip Verify"
                        icon={Shield}
                        checked={form.voidreach_tls_insecure_skip_verify}
                        onChange={v => setForm({ ...form, voidreach_tls_insecure_skip_verify: v })}
                      />
                    </div>
                  </FormSection>
                </>
              )}
            </FormSection>
          </div>
        )}
      </form>
    </Modal>

  );
}
