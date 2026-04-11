import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Server,
  Save,
  Copy,
  Check,
  RefreshCw,
  Zap,
  Activity,
  Globe,
  Lock,
  Route,
  Cpu,
  Database,
  Eye,
  SlidersHorizontal,
  Key,
  Gauge,
  Network,
  Layers,
  ShieldCheck,
  User,
  Fingerprint,
  Hash,
  Monitor,
  Calendar,
} from 'lucide-react';
import API from '../services/api';
import { useFeedback } from '../components/feedback/FeedbackProvider';
import RouteCategoryPicker from '../components/common/RouteCategoryPicker';
import { MODES, OBFS, ROUTE_CATEGORIES, GEOIP_COUNTRIES } from '../constants/networkProfiles';

const SECTION = {
  NETWORK: 'network',
  GLOBAL_CLIENT: 'global-client',
  ROUTING: 'routing',
  DEFAULTS: 'defaults',
  CLUSTER: 'cluster',
};

const HUB_CONFIG_DEFAULT = {
  pool_size: 4,
  socks_port: 1080,
  dns_port: 0,
  dns_upstream: '8.8.8.8:53',
  insecure: false,
  cert_pin: '',
  bypass_domains: '',
  bypass_ips: '',
  direct_route: '',
  direct_geosite: '',
  direct_geoip: '',
  direct_domains: '',
  direct_ips: '',
  cloudflare_api_token: '',
  default_data_limit: 10,
  default_bandwidth_limit: 0,
  default_expire_days: 30,
  default_max_connections: 5,
  default_max_ips: 2,
  default_mode: '',
  default_obfs: '',
  default_blocked_tags: '',
  default_blocked_hosts: '',
  geoip_path: '',
  geosite_path: '',
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
  timezone: 'America/New_York',
};

const GEOIP_TAG_OPTIONS = GEOIP_COUNTRIES.map((country) => country.code);
const GEOIP_TAG_LABELS = GEOIP_COUNTRIES.reduce((acc, country) => {
  acc[country.code] = `${country.code} - ${country.name}`;
  return acc;
}, {});
const BLOCKED_TAG_OPTIONS = Array.from(new Set([...ROUTE_CATEGORIES, ...GEOIP_TAG_OPTIONS]));
const BLOCKED_TAG_LABELS = {
  ...Object.fromEntries(ROUTE_CATEGORIES.map((tag) => [tag, `GeoSite: ${tag}`])),
  ...GEOIP_COUNTRIES.reduce((acc, country) => {
    acc[country.code] = `GeoIP: ${country.code} - ${country.name}`;
    return acc;
  }, {}),
};

const DATA_FACTORS = { MB: 1024 * 1024, GB: 1024 * 1024 * 1024, TB: 1024 * 1024 * 1024 * 1024 };
const SPEED_FACTORS = { 'KB/s': 1, 'MB/s': 1024, 'GB/s': 1024 * 1024 };
const BIGINT_MAX = 9223372036854775807;

const GlobalField = ({ icon: Icon, label, desc, children }) => (
  <div className="settings-field-card">
    <div className="settings-field-header">
      <div className="settings-field-icon">{Icon ? <Icon size={15} /> : null}</div>
      <div>
        <div className="settings-field-label">{label}</div>
        <div className="settings-field-desc">{desc}</div>
      </div>
    </div>
    <div className="settings-field-input">{children}</div>
  </div>
);

export default function Settings() {
  const { notify, confirm, showCopyDialog } = useFeedback();
  const [activeSection, setActiveSection] = useState(SECTION.NETWORK);
  const [hubToken, setHubToken] = useState('');
  const [hubConfig, setHubConfig] = useState(HUB_CONFIG_DEFAULT);
  const [copied, setCopied] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingToken, setLoadingToken] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [defaultDataUnit, setDefaultDataUnit] = useState('GB');
  const [defaultSpeedUnit, setDefaultSpeedUnit] = useState('KB/s');

  useEffect(() => {
    let alive = true;
    const loadHubToken = async () => {
      setLoadingToken(true);
      try {
        const data = await API.getHubToken();
        if (alive) setHubToken(data?.hub_master_token || '');
      } catch {
        if (alive) notify('Failed to load master token.', { type: 'error' });
      } finally {
        if (alive) setLoadingToken(false);
      }
    };
    loadHubToken();
    return () => { alive = false; };
  }, [notify]);

  useEffect(() => {
    let alive = true;
    const loadHubConfig = async () => {
      setLoadingConfig(true);
      try {
        const cfg = await API.getHubConfig();
        if (!alive) return;
        const loadedDefaultDataBytes = Number(cfg.default_data_limit ?? 10737418240) || 0;
        let ddu = 'GB';
        if (loadedDefaultDataBytes >= DATA_FACTORS.TB) ddu = 'TB';
        else if (loadedDefaultDataBytes >= DATA_FACTORS.GB) ddu = 'GB';
        else ddu = 'MB';

        const loadedDefaultSpeed = Number(cfg.default_bandwidth_limit ?? 0) || 0;
        const preferMb = loadedDefaultSpeed >= 1024;

        setHubConfig({
          ...cfg,
          bypass_domains: (cfg.bypass_domains || []).join(', '),
          bypass_ips: (cfg.bypass_ips || []).join(', '),
          direct_route: (cfg.direct_route || []).join(', '),
          direct_geosite: (cfg.direct_geosite || []).join(', '),
          direct_geoip: (cfg.direct_geoip || []).join(', '),
          direct_domains: (cfg.direct_domains || []).join(', '),
          direct_ips: (cfg.direct_ips || []).join(', '),
          default_blocked_tags: (cfg.default_blocked_tags || []).join(', '),
          default_blocked_hosts: (cfg.default_blocked_hosts || []).join(', '),
          default_data_limit: Number((loadedDefaultDataBytes / (DATA_FACTORS[ddu] || DATA_FACTORS.GB)).toFixed(3)),
          default_bandwidth_limit: preferMb ? loadedDefaultSpeed / 1024 : loadedDefaultSpeed,
        });
        setDefaultDataUnit(ddu);
        setDefaultSpeedUnit(preferMb ? 'MB/s' : 'KB/s');
      } catch {
        if (alive) notify('Failed to load settings.', { type: 'error' });
      } finally {
        if (alive) setLoadingConfig(false);
      }
    };
    loadHubConfig();
    return () => { alive = false; };
  }, [notify]);

  const navItems = useMemo(() => [
    { key: SECTION.NETWORK, icon: Shield, title: 'Network' },
    { key: SECTION.GLOBAL_CLIENT, icon: Cpu, title: 'Runtime' },
    { key: SECTION.ROUTING, icon: Route, title: 'Routing' },
    { key: SECTION.DEFAULTS, icon: User, title: 'Defaults' },
    { key: SECTION.CLUSTER, icon: Zap, title: 'Cluster' },
  ], []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hubToken);
      setCopied(true);
      notify('Master token copied.', { type: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showCopyDialog({ title: 'Copy Master Token', value: hubToken });
    }
  };

  const handleSave = async () => {
    setSavingConfig(true);
    try {
      const payload = {
        ...hubConfig,
        default_data_limit: Math.round(hubConfig.default_data_limit * DATA_FACTORS[defaultDataUnit]),
        default_bandwidth_limit: Math.round(hubConfig.default_bandwidth_limit * (SPEED_FACTORS[defaultSpeedUnit] || 1)),
        bypass_domains: (hubConfig.bypass_domains || '').split(',').map(s => s.trim()).filter(Boolean),
        bypass_ips: (hubConfig.bypass_ips || '').split(',').map(s => s.trim()).filter(Boolean),
        direct_route: (hubConfig.direct_route || '').split(',').map(s => s.trim()).filter(Boolean),
        direct_geosite: (hubConfig.direct_geosite || '').split(',').map(s => s.trim()).filter(Boolean),
        direct_geoip: (hubConfig.direct_geoip || '').split(',').map(s => s.trim()).filter(Boolean),
        direct_domains: (hubConfig.direct_domains || '').split(',').map(s => s.trim()).filter(Boolean),
        direct_ips: (hubConfig.direct_ips || '').split(',').map(s => s.trim()).filter(Boolean),
        default_blocked_tags: (hubConfig.default_blocked_tags || '').split(',').map(s => s.trim()).filter(Boolean),
        default_blocked_hosts: (hubConfig.default_blocked_hosts || '').split(',').map(s => s.trim()).filter(Boolean),
      };
      await API.updateHubConfig(payload);
      notify('Settings saved.', { type: 'success' });
    } catch {
      notify('Save failed.', { type: 'error' });
    } finally {
      setSavingConfig(false);
    }
  };

  const renderSection = () => {
    if (activeSection === SECTION.NETWORK) {
      return (
        <section className="settings-section animate-fade-slide">
          <div className="settings-section-header">
            <h2 className="settings-section-title">Network & Auth</h2>
            <p className="settings-section-desc">Protocol-level cryptographic and connectivity settings.</p>
          </div>
          <GlobalField icon={Lock} label="Master Token" desc="Hub password for edge nodes.">
            <div style={{ position: 'relative' }}>
              <input type="password" className="input-field mono" value={hubToken} readOnly style={{ paddingRight: '52px' }} />
              <button onClick={handleCopy} className="settings-copy-token-btn">
                {copied ? <Check size={17} /> : <Copy size={17} />}
              </button>
            </div>
          </GlobalField>
          <GlobalField icon={Activity} label="System Timezone" desc="Global Hub timezone for alerts and displays.">
            <div style={{ display: 'flex', gap: '8px' }}>
              <select className="input-field" style={{ flex: 1 }} value={hubConfig.timezone || 'America/New_York'} onChange={e => setHubConfig({...hubConfig, timezone: e.target.value})}>
                {Intl.supportedValuesOf('timeZone').map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
              <button className="btn btn-secondary" onClick={() => {
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                setHubConfig(prev => ({ ...prev, timezone: tz }));
                notify(`Detected: ${tz}`);
              }} title="Detect from browser">
                <RefreshCw size={14} /> Detect
              </button>
            </div>
          </GlobalField>
          <GlobalField icon={Key} label="Cloudflare Token" desc="For DNS-01 TLS verification.">
            <input className="input-field" type="password" value={hubConfig.cloudflare_api_token || ''} onChange={e => setHubConfig({...hubConfig, cloudflare_api_token: e.target.value})} />
          </GlobalField>
        </section>
      );
    }

    if (activeSection === SECTION.GLOBAL_CLIENT) {
        return (
          <section className="settings-section animate-fade-slide">
            <div className="settings-section-header">
              <h2 className="settings-section-title">Core Runtime</h2>
              <p className="settings-section-desc">Internal proxy and connection pooling parameters.</p>
            </div>
            <GlobalField icon={Cpu} label="Pool Size" desc="Inbound concurrency pool.">
              <input className="input-field" type="number" value={hubConfig.pool_size} onChange={e => setHubConfig({...hubConfig, pool_size: parseInt(e.target.value, 10) || 0})} />
            </GlobalField>
            <GlobalField icon={Network} label="System Ports" desc="Socks and DNS listening ports.">
               <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="input-field" type="number" placeholder="Socks" value={hubConfig.socks_port} onChange={e => setHubConfig({...hubConfig, socks_port: parseInt(e.target.value, 10) || 0})} />
                  <input className="input-field" type="number" placeholder="DNS" value={hubConfig.dns_port} onChange={e => setHubConfig({...hubConfig, dns_port: parseInt(e.target.value, 10) || 0})} />
               </div>
            </GlobalField>
            <GlobalField icon={Globe} label="DNS Upstream" desc="Upstream DNS server address (e.g. 8.8.8.8:53).">
               <input className="input-field" placeholder="8.8.8.8:53" value={hubConfig.dns_upstream || ''} onChange={e => setHubConfig({...hubConfig, dns_upstream: e.target.value})} />
            </GlobalField>
            <GlobalField icon={ShieldCheck} label="Insecure TLS" desc="Skip TLS certificate verification.">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={hubConfig.insecure || false} 
                  onChange={e => setHubConfig({...hubConfig, insecure: e.target.checked})} 
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Allow insecure connections</span>
              </label>
            </GlobalField>
            <GlobalField icon={Lock} label="Cert Pin" desc="Certificate public key pin (base64 SHA256).">
               <input className="input-field" placeholder='pin-sha256="..."' value={hubConfig.cert_pin || ''} onChange={e => setHubConfig({...hubConfig, cert_pin: e.target.value})} />
            </GlobalField>
            <GlobalField icon={Database} label="Geo Data Paths" desc="Paths to geoip and geosite data files.">
               <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                  <input className="input-field" placeholder="GeoIP Path (optional)" value={hubConfig.geoip_path || ''} onChange={e => setHubConfig({...hubConfig, geoip_path: e.target.value})} />
                  <input className="input-field" placeholder="GeoSite Path (optional)" value={hubConfig.geosite_path || ''} onChange={e => setHubConfig({...hubConfig, geosite_path: e.target.value})} />
               </div>
            </GlobalField>
          </section>
        );
    }

    if (activeSection === SECTION.ROUTING) {
      return (
        <section className="settings-section animate-fade-slide">
          <div className="settings-section-header">
            <h2 className="settings-section-title">Routing Rules</h2>
            <p className="settings-section-desc">Bypass and direct connection configurations. Comma-separated.</p>
          </div>
          <GlobalField icon={Globe} label="Bypass Domains" desc="Domains to completely bypass the proxy.">
            <input className="input-field" placeholder="example.com, .local" value={hubConfig.bypass_domains || ''} onChange={e => setHubConfig({...hubConfig, bypass_domains: e.target.value})} />
          </GlobalField>
          <GlobalField icon={Network} label="Bypass IPs" desc="IP CIDRs to completely bypass the proxy.">
            <input className="input-field" placeholder="10.0.0.0/8, 192.168.1.0/24" value={hubConfig.bypass_ips || ''} onChange={e => setHubConfig({...hubConfig, bypass_ips: e.target.value})} />
          </GlobalField>
          <GlobalField icon={Route} label="Direct Route Tags" desc="Specific route tags to handle directly.">
             <RouteCategoryPicker
                value={hubConfig.direct_route}
                onChange={(next) => setHubConfig({...hubConfig, direct_route: next})}
                options={BLOCKED_TAG_OPTIONS}
                optionLabels={BLOCKED_TAG_LABELS}
                placeholder="Search tags to direct..."
              />
          </GlobalField>
          <GlobalField icon={Globe} label="Direct Domains" desc="Domains to connect directly.">
            <input className="input-field" placeholder="example.com, *.ir" value={hubConfig.direct_domains || ''} onChange={e => setHubConfig({...hubConfig, direct_domains: e.target.value})} />
          </GlobalField>
          <GlobalField icon={Network} label="Direct IPs" desc="IPs to connect directly.">
            <input className="input-field" placeholder="1.1.1.1, 8.8.8.8" value={hubConfig.direct_ips || ''} onChange={e => setHubConfig({...hubConfig, direct_ips: e.target.value})} />
          </GlobalField>
          <div className="grid-cols-2" style={{ gap: '20px', marginBottom: '20px' }}>
            <GlobalField icon={Database} label="Direct GeoSite" desc="GeoSite categories for direct connection.">
                <RouteCategoryPicker
                  value={hubConfig.direct_geosite}
                  onChange={(next) => setHubConfig({...hubConfig, direct_geosite: next})}
                  options={ROUTE_CATEGORIES}
                  placeholder="Search geosite category..."
                />
            </GlobalField>
            <GlobalField icon={Database} label="Direct GeoIP" desc="GeoIP countries for direct connection.">
                <RouteCategoryPicker
                  value={hubConfig.direct_geoip}
                  onChange={(next) => setHubConfig({...hubConfig, direct_geoip: next})}
                  options={GEOIP_TAG_OPTIONS}
                  optionLabels={GEOIP_TAG_LABELS}
                  placeholder="Search GeoIP tag..."
                />
            </GlobalField>
          </div>
        </section>
      );
    }

    if (activeSection === SECTION.DEFAULTS) {
      return (
        <section className="settings-section animate-fade-slide">
          <div className="settings-section-header">
            <h2 className="settings-section-title">Subscriber Defaults</h2>
            <p className="settings-section-desc">Default values when creating new subscribers.</p>
          </div>
          <GlobalField icon={Database} label="Data Traffic Limit" desc="Data traffic quota for new users.">
            <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" min="0" step="0.1" className="input-field" style={{ flex: 1 }} value={hubConfig.default_data_limit} onChange={e => setHubConfig({...hubConfig, default_data_limit: e.target.value})} />
                <select className="input-field" style={{ width: '80px' }} value={defaultDataUnit} onChange={e => setDefaultDataUnit(e.target.value)}>
                    <option value="MB">MB</option>
                    <option value="GB">GB</option>
                    <option value="TB">TB</option>
                </select>
            </div>
            <p className="settings-field-desc" style={{marginTop: '4px'}}>Set to 0 for unlimited.</p>
          </GlobalField>
          <GlobalField icon={Activity} label="Bandwidth Limit" desc="Maximum streaming speed for new users.">
            <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" min="0" className="input-field" style={{ flex: 1 }} value={hubConfig.default_bandwidth_limit} onChange={e => setHubConfig({...hubConfig, default_bandwidth_limit: e.target.value})} />
                <select className="input-field" style={{ width: '100px' }} value={defaultSpeedUnit} onChange={e => setDefaultSpeedUnit(e.target.value)}>
                    <option value="KB/s">KB/s</option>
                    <option value="MB/s">MB/s</option>
                </select>
            </div>
            <p className="settings-field-desc" style={{marginTop: '4px'}}>Set to 0 for unlimited.</p>
          </GlobalField>
          <GlobalField icon={Layers} label="Protocol Engine" desc="Default mode and obfuscation.">
            <div style={{ display: 'flex', gap: '8px' }}>
                <select className="input-field" value={hubConfig.default_mode || ''} onChange={e => setHubConfig({...hubConfig, default_mode: e.target.value})}>
                    <option value="">(None - Mixed)</option>
                    {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select className="input-field" value={hubConfig.default_obfs || ''} onChange={e => setHubConfig({...hubConfig, default_obfs: e.target.value})}>
                    <option value="">(None)</option>
                    {OBFS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
            </div>
          </GlobalField>
          <GlobalField icon={Lock} label="Default Blocked Tags" desc="Automatically block these tags for new subscribers.">
             <RouteCategoryPicker
                value={hubConfig.default_blocked_tags}
                onChange={(next) => setHubConfig({...hubConfig, default_blocked_tags: next})}
                options={BLOCKED_TAG_OPTIONS}
                optionLabels={BLOCKED_TAG_LABELS}
                placeholder="Search tags to block..."
              />
          </GlobalField>
          <GlobalField icon={Network} label="Default Blocked Hosts" desc="Automatically block these hosts for new subscribers.">
             <input className="input-field" placeholder="ads.google.com, *.doubleclick.net" value={hubConfig.default_blocked_hosts || ''} onChange={e => setHubConfig({...hubConfig, default_blocked_hosts: e.target.value})} />
          </GlobalField>
          <GlobalField icon={Hash} label="Default Max Connections" desc="Limit simultaneous WebSocket/Proxy sessions.">
            <input className="input-field" type="number" min="0" placeholder="e.g. 5" value={hubConfig.default_max_connections ?? ''} onChange={e => setHubConfig({...hubConfig, default_max_connections: e.target.value ? parseInt(e.target.value, 10) : 0})} />
          </GlobalField>
          <GlobalField icon={Monitor} label="Default Max IPs" desc="Maximum unique IP addresses allowed to connect.">
            <input className="input-field" type="number" min="0" placeholder="e.g. 2" value={hubConfig.default_max_ips ?? ''} onChange={e => setHubConfig({...hubConfig, default_max_ips: e.target.value ? parseInt(e.target.value, 10) : 0})} />
          </GlobalField>
          <GlobalField icon={Calendar} label="Default Expiration (Days)" desc="Default active lifetime for new subscribers.">
            <input className="input-field" type="number" min="0" placeholder="e.g. 30" value={hubConfig.default_expire_days ?? ''} onChange={e => setHubConfig({...hubConfig, default_expire_days: e.target.value ? parseInt(e.target.value, 10) : 0})} />
            <p className="settings-field-desc" style={{marginTop: '4px'}}>Set to 0 for unlimited (lifelong) accounts.</p>
          </GlobalField>
        </section>
      );
    }

    if (activeSection === SECTION.CLUSTER) {
        return (
            <div className="settings-section animate-fade-slide" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                   <div className="settings-section-header">
                      <h2 className="settings-section-title">Cluster Operations</h2>
                      <p className="settings-section-desc">Dangerous actions affecting all connected nodes.</p>
                   </div>
                   <div style={{ display: 'flex', gap: '12px', padding: '0 20px 20px' }}>
                      <button className="btn btn-danger-ghost" onClick={() => API.shockAllNodes().then(() => notify('SHOCK sent'))}>
                         <Zap size={16} /> Broadcast SHOCK
                      </button>
                      <button className="btn btn-secondary" onClick={() => API.forceSyncAll().then(() => notify('SYNC sent'))}>
                         <RefreshCw size={16} /> Force Global Sync
                      </button>
                   </div>
                </div>
            </div>
        );
    }
    
    // Default fallback to show something
    return <div className="page-card p-4">Select a category from the sidebar.</div>;
  };

  return (
    <div className="page-shell animate-fade-slide">
      <div className="page-topline">Settings</div>

      <div className="page-card">
        <div className="page-card-header">
          <div>
            <h1 className="page-card-title">Network Settings</h1>
            <p className="page-card-desc">Configure core hub protocols and node interaction policies.</p>
          </div>

          <div className="page-card-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={savingConfig}>
              <Save size={15} /> <span>Save Changes</span>
            </button>
          </div>
        </div>

        <div className="settings-layout">
          <nav className="settings-sidebar">
            {navItems.map((n) => (
              <button key={n.key} className={`settings-nav-item ${activeSection === n.key ? 'active' : ''}`} onClick={() => setActiveSection(n.key)}>
                <n.icon size={18} /> {n.title}
              </button>
            ))}
          </nav>
          <main className="settings-main">{renderSection()}</main>
        </div>
      </div>

      <style>{`
        .settings-layout { display: flex; gap: 24px; padding: 0 20px 20px; }
        .settings-sidebar { width: 220px; display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
        .settings-nav-item { 
            display: flex; 
            align-items: center; 
            gap: 12px; 
            padding: 12px 16px; 
            border-radius: 10px; 
            background: transparent; 
            color: #fff; 
            transition: all 0.2s; 
            font-weight: 500; 
            font-size: 0.9rem; 
            text-align: left; 
            border: 1px solid rgba(255,255,255,0.8);
            margin-bottom: 8px;
            opacity: 0.8;
        }
        .settings-nav-item:hover { 
            background: rgba(255,255,255,0.1); 
            border-color: #fff;
            color: #fff; 
            opacity: 1;
        }
        .settings-nav-item.active { 
            background: #fff; 
            color: #000; 
            border-color: #fff;
            font-weight: 700;
            opacity: 1;
            box-shadow: 0 4px 12px rgba(255,255,255,0.2);
        }
        [data-theme='light'] .settings-nav-item {
            color: #171717;
            border-color: #e5e5e5;
        }
        [data-theme='light'] .settings-nav-item.active {
            background: #000;
            color: #fff;
            border-color: #000;
        }
        .settings-main { flex: 1; min-width: 0; }
        .settings-field-card { padding: 24px; background: rgba(255,255,255,0.015); border: 1px solid var(--border-color); border-radius: 16px; margin-bottom: 20px; transition: all 0.3s; }
        .settings-field-card:hover { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.1); transform: translateY(-2px); }
        .settings-field-header { display: flex; gap: 16px; margin-bottom: 20px; align-items: flex-start; }
        .settings-field-icon { width: 42px; height: 42px; border-radius: 12px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; color: var(--text-primary); border: 1px solid rgba(255,255,255,0.05); }
        .settings-field-label { font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
        .settings-field-desc { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; }
        .settings-copy-token-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: transparent; color: var(--text-muted); padding: 0; transition: color 0.2s;}
        .settings-copy-token-btn:hover { color: var(--text-primary); }
        .settings-section-header { margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .settings-section-title { font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
        .settings-section-desc { font-size: 0.9rem; color: var(--text-muted); }
        
        @media (max-width: 768px) {
            .settings-layout { flex-direction: column; }
            .settings-sidebar { width: 100%; flex-direction: row; overflow-x: auto; }
            .settings-nav-item { white-space: nowrap; }
        }
      `}</style>
    </div>
  );
}
