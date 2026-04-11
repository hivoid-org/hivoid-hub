import React from 'react';
import { Edit2, UserPlus, Shield, Activity, Globe, Key, Cpu } from 'lucide-react';
import Modal from '../common/Modal';
import { FormField, FormSection } from '../common/FormField';
import RouteCategoryPicker from '../common/RouteCategoryPicker';
import API from '../../services/api';
import { MODES, OBFS, ROUTE_CATEGORIES, GEOIP_COUNTRIES } from '../../constants/networkProfiles';

const DATA_FACTORS = { MB: 1024 * 1024, GB: 1024 * 1024 * 1024, TB: 1024 * 1024 * 1024 * 1024 };
const SPEED_FACTORS = { 'KB/s': 1, 'MB/s': 1024, 'GB/s': 1024 * 1024 };
const BIGINT_MAX = 9223372036854775807;
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

const convertSpeedValue = (value, fromUnit, toUnit) => {
  const numeric = Number(value) || 0;
  const fromFactor = SPEED_FACTORS[fromUnit] || 1;
  const toFactor = SPEED_FACTORS[toUnit] || 1;
  return Number(((numeric * fromFactor) / toFactor).toFixed(3));
};

const convertDataValue = (value, fromUnit, toUnit) => {
  const numeric = Number(value) || 0;
  const fromFactor = DATA_FACTORS[fromUnit] || DATA_FACTORS.GB;
  const toFactor = DATA_FACTORS[toUnit] || DATA_FACTORS.GB;
  return Number(((numeric * fromFactor) / toFactor).toFixed(3));
};

const initialForm = {
  username: '',
  email: '',
  dataLimit: 100,
  maxConnections: 5,
  maxIps: 2,
  bandwidthLimit: 0,
  blockedTags: '',
  blockedHosts: '',
  expireAt: '',
  bindIp: '',
  mode: '',
  obfs: '',
  pool_size: '',
  socks_port: '',
  dns_port: '',
  dns_upstream: '',
  insecure: false,
  cert_pin: '',
  bypass_domains: '',
  bypass_ips: '',
  direct_route: '',
  direct_geosite: '',
  direct_geoip: '',
  direct_domains: '',
  direct_ips: '',
  client_geoip_path: '',
  client_geosite_path: ''
};

export default function UserForm({ isOpen, onClose, onSave, editingUser, loading }) {
  const [form, setForm] = React.useState(initialForm);
  const [dataUnit, setDataUnit] = React.useState('GB');
  const [speedUnit, setSpeedUnit] = React.useState('KB/s');
  const isEditing = !!editingUser;

  React.useEffect(() => {
    if (editingUser) {
      setForm({
        username: editingUser.username,
        email: editingUser.email,
        dataLimit: editingUser.dataLimitRaw > 0 ? Math.round(editingUser.dataLimitRaw / 1073741824) : 0,
        maxConnections: editingUser.maxConnections,
        maxIps: editingUser.maxIps,
        bandwidthLimit:
          (Number(editingUser.bandwidthLimit) || 0) % 1024 === 0 && (Number(editingUser.bandwidthLimit) || 0) >= 1024
            ? Number(editingUser.bandwidthLimit) / 1024
            : Number(editingUser.bandwidthLimit) || 0,
        blockedTags: editingUser.blockedTags?.join(', ') || '',
        blockedHosts: editingUser.blockedHosts?.join(', ') || '',
        expireAt: editingUser.expire_at ? editingUser.expire_at.slice(0, 16) : '',
        bindIp: editingUser.bind_ip,
        mode: editingUser.mode,
        obfs: editingUser.obfs,
        pool_size: editingUser.pool_size ?? '',
        socks_port: editingUser.socks_port ?? '',
        dns_port: editingUser.dns_port ?? '',
        dns_upstream: editingUser.dns_upstream || '',
        insecure: !!editingUser.insecure,
        cert_pin: editingUser.cert_pin || '',
        bypass_domains: (editingUser.bypass_domains || []).join(', '),
        bypass_ips: (editingUser.bypass_ips || []).join(', '),
        direct_route: (editingUser.direct_route || []).join(', '),
        direct_geosite: (editingUser.direct_geosite || []).join(', '),
        direct_geoip: (editingUser.direct_geoip || []).join(', '),
        direct_domains: (editingUser.direct_domains || []).join(', '),
        direct_ips: (editingUser.direct_ips || []).join(', '),
        client_geoip_path: editingUser.client_geoip_path || '',
        client_geosite_path: editingUser.client_geosite_path || ''
      });
      setDataUnit('GB');
      setSpeedUnit(
        (Number(editingUser.bandwidthLimit) || 0) % 1024 === 0 && (Number(editingUser.bandwidthLimit) || 0) >= 1024
          ? 'MB/s'
          : 'KB/s'
      );
    } else {
      let alive = true;
      const loadDefaults = async () => {
        try {
          const cfg = await API.getHubConfig();
          if (!alive) return;
          const loadedDefaultDataBytes = Number(cfg.default_data_limit ?? 10737418240) || 0;
          let defaultDataDisplayUnit = 'GB';
          if (loadedDefaultDataBytes >= DATA_FACTORS.TB && loadedDefaultDataBytes % DATA_FACTORS.TB === 0) {
            defaultDataDisplayUnit = 'TB';
          } else if (loadedDefaultDataBytes >= DATA_FACTORS.GB && loadedDefaultDataBytes % DATA_FACTORS.GB === 0) {
            defaultDataDisplayUnit = 'GB';
          } else {
            defaultDataDisplayUnit = 'MB';
          }
          const loadedDefaultSpeed = Number(cfg.default_bandwidth_limit ?? 0) || 0;
          const preferMbDisplay = loadedDefaultSpeed >= 1024 && loadedDefaultSpeed % 1024 === 0;
          const expireDays = Number(cfg.default_expire_days ?? 30);
          const defaultExpire = new Date(Date.now() + Math.max(expireDays, 0) * 86400000);
          const localIso = new Date(defaultExpire.getTime() - defaultExpire.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setForm({
            ...initialForm,
            dataLimit: Number((loadedDefaultDataBytes / (DATA_FACTORS[defaultDataDisplayUnit] || DATA_FACTORS.GB)).toFixed(3)),
            bandwidthLimit: preferMbDisplay ? loadedDefaultSpeed / 1024 : loadedDefaultSpeed,
            maxConnections: Number(cfg.default_max_connections ?? 5) || 5,
            maxIps: Number(cfg.default_max_ips ?? 2) || 2,
            mode: cfg.default_mode || '',
            obfs: cfg.default_obfs || '',
            expireAt: localIso,
          });
          setDataUnit(defaultDataDisplayUnit);
          setSpeedUnit(preferMbDisplay ? 'MB/s' : 'KB/s');
        } catch {
          setForm(initialForm);
        }
      };
      loadDefaults();
      return () => {
        alive = false;
      };
    }
  }, [editingUser, isOpen]);

  const dataLimitBytes = React.useMemo(() => {
    const value = Number(form.dataLimit) || 0;
    const bytes = Math.round(value * (DATA_FACTORS[dataUnit] || DATA_FACTORS.GB));
    return Math.max(0, Math.min(BIGINT_MAX, bytes));
  }, [form.dataLimit, dataUnit]);

  const bandwidthKbps = React.useMemo(() => {
    const value = Number(form.bandwidthLimit) || 0;
    return Math.round(value * (SPEED_FACTORS[speedUnit] || 1));
  }, [form.bandwidthLimit, speedUnit]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      username: form.username,
      email: form.email,
      data_limit: dataLimitBytes,
      max_connections: form.maxConnections,
      max_ips: form.maxIps,
      bandwidth_limit: bandwidthKbps,
      blocked_tags: form.blockedTags ? form.blockedTags.split(',').map(s => s.trim()).filter(Boolean) : [],
      blocked_hosts: form.blockedHosts ? form.blockedHosts.split(',').map(s => s.trim()).filter(Boolean) : [],
      expire_at: form.expireAt ? new Date(form.expireAt).toISOString() : null,
      bind_ip: form.bindIp || '',
      mode: form.mode || '',
      obfs: form.obfs || '',
      pool_size: form.pool_size === '' ? null : (parseInt(form.pool_size) || 0),
      socks_port: form.socks_port === '' ? null : (parseInt(form.socks_port) || 0),
      dns_port: form.dns_port === '' ? null : (parseInt(form.dns_port) || 0),
      dns_upstream: form.dns_upstream || null,
      insecure: !!form.insecure,
      cert_pin: form.cert_pin || null,
      bypass_domains: form.bypass_domains ? form.bypass_domains.split(',').map(s => s.trim()).filter(Boolean) : [],
      bypass_ips: form.bypass_ips ? form.bypass_ips.split(',').map(s => s.trim()).filter(Boolean) : [],
      direct_route: form.direct_route ? form.direct_route.split(',').map(s => s.trim()).filter(Boolean) : [],
      direct_geosite: form.direct_geosite ? form.direct_geosite.split(',').map(s => s.trim()).filter(Boolean) : [],
      direct_geoip: form.direct_geoip ? form.direct_geoip.split(',').map(s => s.trim()).filter(Boolean) : [],
      direct_domains: form.direct_domains ? form.direct_domains.split(',').map(s => s.trim()).filter(Boolean) : [],
      direct_ips: form.direct_ips ? form.direct_ips.split(',').map(s => s.trim()).filter(Boolean) : [],
      client_geoip_path: form.client_geoip_path || null,
      client_geosite_path: form.client_geosite_path || null
    };
    onSave(payload, isEditing, editingUser?.uuid);
  };

  const icon = isEditing 
    ? <Edit2 size={24} color="var(--text-primary)" />
    : <UserPlus size={24} color="var(--text-primary)" />;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Policy' : 'Create Subscriber'}
      subtitle={isEditing ? 'Update limits and engine.' : 'Issue new UUID license.'}
      icon={icon}
      size="xl"
      footer={
        <>
          <div className="modal-footer-note">
            <Key size={18} color="var(--text-muted)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Manual policy sync is not required.
            </span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            type="submit" 
            form="user-form"
            className="btn btn-primary" 
            style={{ minWidth: '140px' }} 
            disabled={loading}
          >
            {loading ? 'Saving...' : (isEditing ? 'Save Policy' : 'Issue Subscription')}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="user-form-layout">
        <div className="user-form-intro">
          <div className="user-form-intro-title">{isEditing ? 'Update subscriber policy' : 'Create new subscription profile'}</div>
          <div className="user-form-intro-subtitle">
            Keep limits, routing and client overrides in one consistent profile.
          </div>
        </div>

        {/* Identity */}
        <div className="grid-cols-2" style={{ marginBottom: '24px' }}>
          <FormField label="Username">
            <input
              type="text"
              className="input-field"
              placeholder="e.g. john_doe"
              required
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              disabled={isEditing}
            />
          </FormField>
          <FormField label="Email / Label">
            <input
              type="text"
              className="input-field"
              placeholder="user@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
        </div>

        {/* Quotas */}
        <FormSection title="QUOTAS & LIMITS" icon={Shield}>
          <div className="grid-cols-4">
            <FormField label="Data Limit">
              <div className="value-with-unit">
                <input
                  type="number"
                  className="input-field"
                  required
                  value={form.dataLimit}
                  onChange={e => setForm({ ...form, dataLimit: parseFloat(e.target.value) || 0 })}
                />
                <select
                  className="input-field unit-field"
                  value={dataUnit}
                  onChange={(e) => {
                    const nextUnit = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      dataLimit: convertDataValue(prev.dataLimit, dataUnit, nextUnit),
                    }));
                    setDataUnit(nextUnit);
                  }}
                >
                  <option value="MB">MB</option>
                  <option value="GB">GB</option>
                  <option value="TB">TB</option>
                </select>
              </div>
            </FormField>
            <FormField label="Max Conn">
              <input
                type="number"
                className="input-field"
                min="0"
                required
                value={form.maxConnections}
                onChange={e => setForm({ ...form, maxConnections: parseInt(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Max IPs">
              <input
                type="number"
                className="input-field"
                min="0"
                required
                value={form.maxIps}
                onChange={e => setForm({ ...form, maxIps: parseInt(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Speed Limit">
              <div className="value-with-unit">
                <input
                  type="number"
                  className="input-field"
                  value={form.bandwidthLimit}
                  onChange={e => setForm({ ...form, bandwidthLimit: parseFloat(e.target.value) || 0 })}
                />
                <select
                  className="input-field unit-field"
                  value={speedUnit}
                  onChange={(e) => {
                    const nextUnit = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      bandwidthLimit: convertSpeedValue(prev.bandwidthLimit, speedUnit, nextUnit),
                    }));
                    setSpeedUnit(nextUnit);
                  }}
                >
                  <option value="KB/s">KB/s</option>
                  <option value="MB/s">MB/s</option>
                  <option value="GB/s">GB/s</option>
                </select>
              </div>
            </FormField>
          </div>
          <div className="grid-cols-2" style={{ marginTop: '16px' }}>
            <FormField label="Expiration">
              <input
                type="datetime-local"
                className="input-field"
                value={form.expireAt}
                onChange={e => setForm({ ...form, expireAt: e.target.value })}
              />
            </FormField>
            <FormField label="Bind IP">
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 1.2.3.4"
                value={form.bindIp}
                onChange={e => setForm({ ...form, bindIp: e.target.value })}
              />
            </FormField>
          </div>
        </FormSection>

        {/* Engine */}
        <FormSection title="ENGINE OVERRIDE" icon={Activity}>
          <div className="grid-cols-2">
            <FormField label="Mode Override">
              <select
                className="input-field"
                value={form.mode}
                onChange={e => setForm({ ...form, mode: e.target.value })}
              >
                <option value="">Default (Auto)</option>
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Obfuscation Override">
              <select
                className="input-field"
                value={form.obfs}
                onChange={e => setForm({ ...form, obfs: e.target.value })}
              >
                <option value="">Default (Auto)</option>
                {OBFS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </FormField>
          </div>
        </FormSection>

        {/* Filtering */}
        <FormSection title="GEODATA FILTERING" icon={Globe} style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <FormField label="Blocked Tags">
              <RouteCategoryPicker
                value={form.blockedTags}
                onChange={(next) => setForm({ ...form, blockedTags: next })}
                options={BLOCKED_TAG_OPTIONS}
                optionLabels={BLOCKED_TAG_LABELS}
                placeholder="Search GeoSite/GeoIP tag..."
              />
            </FormField>
            <FormField label="Blocked Hosts">
              <input
                type="text"
                className="input-field"
                placeholder="e.g. *.ads.google.com, x.com"
                value={form.blockedHosts}
                onChange={e => setForm({ ...form, blockedHosts: e.target.value })}
              />
            </FormField>
            <div className="grid-cols-2">
              <FormField label="Direct GeoSite" hint="Search + select categories. Click item again to remove.">
                <RouteCategoryPicker
                  value={form.direct_geosite}
                  onChange={(next) => setForm({ ...form, direct_geosite: next })}
                  options={ROUTE_CATEGORIES}
                  placeholder="Search geosite category..."
                />
              </FormField>
              <FormField label="Direct GeoIP" hint="Search + select GeoIP tags. Click item again to remove.">
                <RouteCategoryPicker
                  value={form.direct_geoip}
                  onChange={(next) => setForm({ ...form, direct_geoip: next })}
                  options={GEOIP_TAG_OPTIONS}
                  optionLabels={GEOIP_TAG_LABELS}
                  placeholder="Search country code or GeoIP tag..."
                />
              </FormField>
            </div>
            <div className="grid-cols-2">
              <FormField label="Direct Domains">
                <input type="text" className="input-field" placeholder="example.com, *.local" value={form.direct_domains} onChange={e => setForm({ ...form, direct_domains: e.target.value })} />
              </FormField>
              <FormField label="Direct IPs">
                <input type="text" className="input-field" placeholder="1.1.1.1, 10.0.0.0/8" value={form.direct_ips} onChange={e => setForm({ ...form, direct_ips: e.target.value })} />
              </FormField>
            </div>
          </div>
        </FormSection>

        <FormSection title="CLIENT OVERRIDES" icon={Cpu} style={{ marginTop: '16px', marginBottom: 0 }}>
          <div className="grid-cols-4">
            <FormField label="Pool Size">
              <input type="number" className="input-field" value={form.pool_size} onChange={e => setForm({ ...form, pool_size: e.target.value })} />
            </FormField>
            <FormField label="SOCKS Port">
              <input type="number" className="input-field" value={form.socks_port} onChange={e => setForm({ ...form, socks_port: e.target.value })} />
            </FormField>
            <FormField label="DNS Port">
              <input type="number" className="input-field" value={form.dns_port} onChange={e => setForm({ ...form, dns_port: e.target.value })} />
            </FormField>
            <FormField label="DNS Upstream">
              <input type="text" className="input-field" placeholder="8.8.8.8:53" value={form.dns_upstream} onChange={e => setForm({ ...form, dns_upstream: e.target.value })} />
            </FormField>
          </div>
          <div className="grid-cols-2" style={{ marginTop: '12px' }}>
            <FormField label="Bypass Domains">
              <input type="text" className="input-field" placeholder=".ir, localhost" value={form.bypass_domains} onChange={e => setForm({ ...form, bypass_domains: e.target.value })} />
            </FormField>
            <FormField label="Bypass IPs">
              <input type="text" className="input-field" placeholder="10.0.0.0/8, 192.168.1.0/24" value={form.bypass_ips} onChange={e => setForm({ ...form, bypass_ips: e.target.value })} />
            </FormField>
          </div>
          <div className="grid-cols-2" style={{ marginTop: '12px' }}>
            <FormField label="Direct Route">
              <input type="text" className="input-field" placeholder="ir, category-ir" value={form.direct_route} onChange={e => setForm({ ...form, direct_route: e.target.value })} />
            </FormField>
            <FormField label="Cert Pin">
              <input type="text" className="input-field" placeholder="sha256 hex" value={form.cert_pin} onChange={e => setForm({ ...form, cert_pin: e.target.value })} />
            </FormField>
          </div>
          <div className="grid-cols-2" style={{ marginTop: '12px' }}>
            <FormField label="Client GeoIP Path">
              <input type="text" className="input-field" value={form.client_geoip_path} onChange={e => setForm({ ...form, client_geoip_path: e.target.value })} />
            </FormField>
            <FormField label="Client GeoSite Path">
              <input type="text" className="input-field" value={form.client_geosite_path} onChange={e => setForm({ ...form, client_geosite_path: e.target.value })} />
            </FormField>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '10px', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={form.insecure} onChange={e => setForm({ ...form, insecure: e.target.checked })} />
            Insecure TLS (skip verify)
          </label>
        </FormSection>
      </form>
    </Modal>
  );
}
