import React, { useEffect, useState } from 'react';
import { Copy, Link2, FileCode, QrCode, User, Shield, Cpu, Share2, Mail, Fingerprint, Activity, Clock3, Layers3, RefreshCcw, Trash2, Power, Edit2 } from 'lucide-react';
import Modal from '../common/Modal';
import QRCode from 'qrcode';

const fmt = (b) => {
  if (!b) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export default function SubscriptionDetailsModal({
  isOpen,
  onClose,
  info,
  user,
  onCopy,
  loading = false,
  onEdit,
  onShare,
  onReset,
  onRevoke,
  onToggleActive,
  onDelete,
  onPermanentDelete,
}) {
  const [qrSrc, setQrSrc] = useState('');
  const subLink = info ? `${window.location.origin}/sub/${info.uuid}` : '';

  useEffect(() => {
    let active = true;
    const generate = async () => {
      if (!info?.uuid) {
        setQrSrc('');
        return;
      }
      try {
        const dataUrl = await QRCode.toDataURL(subLink, { width: 320, margin: 1 });
        if (active) setQrSrc(dataUrl);
      } catch {
        if (active) setQrSrc('');
      }
    };
    generate();
    return () => {
      active = false;
    };
  }, [info?.uuid, subLink]);

  const allHivoid = info ? (info.hivoid_uris || []).join('\n') : '';
  const renderList = (value) => {
    if (!value || value.length === 0) return '—';
    return value.join(', ');
  };

  const shareSubscription = async () => {
    if (!subLink) return;
    if (onShare && actionUser) {
      await onShare(actionUser);
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: 'HiVoid Subscription', text: 'Subscription link', url: subLink });
        return;
      }
      if (onCopy) await onCopy(subLink, 'Subscription link copied.');
    } catch {
      if (onCopy) await onCopy(subLink, 'Subscription link copied.');
    }
  };

  const actionUser = user || info;
  const isActionUserActive = actionUser?.is_active ?? (info?.status === 'active');
  const statusLabel = info?.status === 'active' ? 'Active' : 'Disabled';
  const jsonConfig = info
    ? JSON.stringify(
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
          direct_geosite: info.direct_geosite || [],
          direct_geoip: info.direct_geoip || [],
          direct_domains: info.direct_domains || [],
          direct_ips: info.direct_ips || [],
          geoip_path: info.client_geoip_path || '',
          geosite_path: info.client_geosite_path || '',
          name: info.username,
        },
        null,
        2
      )
    : '{}';
  const shareNative = async () => {
    if (!navigator.share || !subLink) return;
    try {
      await navigator.share({ title: 'HiVoid Subscription', text: 'Subscription link', url: subLink });
    } catch {}
  };
  const ui = info?.sub_page || {};

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Subscription Details"
      subtitle="Read-only subscription profile with quick actions."
      icon={<QrCode size={24} color="var(--text-primary)" />}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={shareSubscription}>
            <Share2 size={16} /> Share
          </button>
          {actionUser && onEdit && (
            <button type="button" className="btn btn-secondary" onClick={() => onEdit(actionUser)}>
              <Edit2 size={16} /> Edit
            </button>
          )}
          {actionUser && onReset && (
            <button type="button" className="btn btn-secondary" onClick={() => onReset(actionUser.uuid)}>
              <RefreshCcw size={16} /> Reset Traffic
            </button>
          )}
          {actionUser && onRevoke && (
            <button type="button" className="btn btn-secondary" onClick={() => onRevoke(actionUser.uuid)}>
              <Shield size={16} /> Revoke
            </button>
          )}
          {actionUser && onToggleActive && (
            <button type="button" className="btn btn-secondary" onClick={() => onToggleActive(actionUser)}>
              <Power size={16} /> {isActionUserActive ? 'Disable' : 'Enable'}
            </button>
          )}
          {actionUser && onDelete && !onToggleActive && (
            <button type="button" className="btn btn-secondary" onClick={() => onDelete(actionUser.uuid)}>
              <Power size={16} /> Disable
            </button>
          )}
          {actionUser && onPermanentDelete && (
            <button type="button" className="btn btn-secondary" onClick={() => onPermanentDelete(actionUser)}>
              <Trash2 size={16} /> Delete
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className="sub-details-modern-shell">
        {(loading || !info) ? (
          <div className="sub-details-loading">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-qr" />
          </div>
        ) : (
          <>
        <div className="sub-details-grid sub-details-grid-clean">
          <div className="sub-details-card">
            <User size={16} />
            <div>
              <div className="sub-details-label">Name</div>
              <div className="sub-details-value">{info.username}</div>
            </div>
          </div>
          <div className="sub-details-card">
            <Mail size={16} />
            <div>
              <div className="sub-details-label">Email</div>
              <div className="sub-details-value">{info.email || '—'}</div>
            </div>
          </div>
          <div className="sub-details-card">
            <Fingerprint size={16} />
            <div>
              <div className="sub-details-label">UUID</div>
              <div className="sub-details-value mono">{info.uuid}</div>
            </div>
          </div>
          <div className="sub-details-card">
            <Cpu size={16} />
            <div>
              <div className="sub-details-label">Usage</div>
              <div className="sub-details-value">{fmt(info.total_used)} / {info.data_limit === 0 ? 'Unlimited' : fmt(info.data_limit)}</div>
            </div>
          </div>
          <div className="sub-details-card">
            <Activity size={16} />
            <div>
              <div className="sub-details-label">Live</div>
              <div className="sub-details-value">{fmt(info.upload_used)} up / {fmt(info.download_used)} down</div>
            </div>
          </div>
          <div className="sub-details-card">
            <Clock3 size={16} />
            <div>
              <div className="sub-details-label">Expiry</div>
              <div className="sub-details-value">{info.expire_at ? new Date(info.expire_at).toLocaleString() : 'Never'}</div>
            </div>
          </div>
          <div className="sub-details-card">
            <Layers3 size={16} />
            <div>
              <div className="sub-details-label">Engine</div>
              <div className="sub-details-value">{info.mode || '—'} / {info.obfs || '—'}</div>
            </div>
          </div>
          <div className="sub-details-card">
            <Shield size={16} />
            <div>
              <div className="sub-details-label">Status</div>
              <div className="sub-details-value">{statusLabel}</div>
            </div>
          </div>
        </div>

        <div className="sub-details-section-title">Actions</div>
        <div className="sub-actions-grid sub-actions-grid-clean">
          {(ui.allow_copy_links ?? true) && <button className="btn btn-secondary" onClick={() => onCopy && onCopy(subLink, 'Subscription link copied.')}>
            <Link2 size={16} /> Copy Subscription Link
          </button>}
          {(ui.allow_copy_links ?? true) && <button className="btn btn-secondary" onClick={() => onCopy && onCopy(allHivoid || subLink, 'HiVoid links copied.')}>
            <Copy size={16} /> Copy HiVoid Links
          </button>}
          {(ui.allow_copy_json ?? true) && <button className="btn btn-primary" onClick={() => onCopy && onCopy(jsonConfig, 'JSON config copied.')}>
            <FileCode size={16} /> Copy JSON Config
          </button>}
          {(ui.allow_share_native ?? true) && (
            <button className="btn btn-secondary" onClick={shareNative}>
              <Share2 size={16} /> Share
            </button>
          )}
        </div>

        <div className="sub-details-section-title">Routing Summary</div>
        <div className="sub-details-list sub-details-list-clean">
          <div className="sub-details-row"><span>Bind IP</span><strong>{info.bind_ip || '—'}</strong></div>
          <div className="sub-details-row"><span>Max Connections</span><strong>{info.max_connections ?? '—'}</strong></div>
          <div className="sub-details-row"><span>Max IPs</span><strong>{info.max_ips ?? '—'}</strong></div>
          <div className="sub-details-row"><span>Bandwidth Limit</span><strong>{info.bandwidth_limit ? fmt(info.bandwidth_limit) : 'Unlimited'}</strong></div>
          <div className="sub-details-row"><span>Pool Size</span><strong>{info.pool_size ?? '—'}</strong></div>
          <div className="sub-details-row"><span>SOCKS Port</span><strong>{info.socks_port ?? '—'}</strong></div>
          <div className="sub-details-row"><span>DNS Port</span><strong>{info.dns_port ?? '—'}</strong></div>
          <div className="sub-details-row"><span>DNS Upstream</span><strong>{info.dns_upstream || '—'}</strong></div>
          <div className="sub-details-row"><span>Cert Pin</span><strong className="mono">{info.cert_pin || '—'}</strong></div>
          <div className="sub-details-row"><span>Insecure TLS</span><strong>{info.insecure ? 'Yes' : 'No'}</strong></div>
        </div>

        <div className="sub-details-section-title">Traffic Rules</div>
        <div className="sub-details-list sub-details-list-clean">
          <div className="sub-details-row"><span>Bypass Domains</span><strong>{renderList(info.bypass_domains)}</strong></div>
          <div className="sub-details-row"><span>Bypass IPs</span><strong>{renderList(info.bypass_ips)}</strong></div>
          <div className="sub-details-row"><span>Direct Route</span><strong>{renderList(info.direct_route)}</strong></div>
          <div className="sub-details-row"><span>Direct GeoSite</span><strong>{renderList(info.direct_geosite)}</strong></div>
          <div className="sub-details-row"><span>Direct GeoIP</span><strong>{renderList(info.direct_geoip)}</strong></div>
          <div className="sub-details-row"><span>Direct Domains</span><strong>{renderList(info.direct_domains)}</strong></div>
          <div className="sub-details-row"><span>Direct IPs</span><strong>{renderList(info.direct_ips)}</strong></div>
          <div className="sub-details-row"><span>GeoIP Path</span><strong className="mono">{info.client_geoip_path || '—'}</strong></div>
          <div className="sub-details-row"><span>GeoSite Path</span><strong className="mono">{info.client_geosite_path || '—'}</strong></div>
        </div>

        <div className="sub-details-section-title">Available Nodes</div>
        <div className="sub-details-list sub-details-list-clean">
          {(info.nodes || []).length > 0 ? info.nodes.map((node, index) => (
            <div key={`${node.host}-${index}`} className="sub-details-row">
              <span>{node.name}</span>
              <strong className="mono">{node.host}:{node.port}</strong>
            </div>
          )) : <div className="sub-details-row"><span>Nodes</span><strong>—</strong></div>}
        </div>

        {(ui.show_qr ?? true) && <div className="sub-qr-wrap">
          {qrSrc ? (
            <img src={qrSrc} alt="Subscription QR" className="sub-qr-image" />
          ) : (
            <div className="sub-qr-image skeleton" />
          )}
          <div className="sub-details-label" style={{ textAlign: 'center' }}>
            Scan QR for subscription link
          </div>
        </div>}
          </>
        )}
      </div>
    </Modal>
  );
}
