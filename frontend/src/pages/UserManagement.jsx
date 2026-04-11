import React, { useState, useEffect } from 'react';
import { Search, Plus, SlidersHorizontal, RotateCcw } from 'lucide-react';
import API from '../services/api';
import { useFeedback } from '../components/feedback/FeedbackProvider';
import UserForm from '../components/users/UserForm';
import UserList from '../components/users/UserList';
import SubscriptionDetailsModal from '../components/users/SubscriptionDetailsModal';

// Check if date is expired
const isExpired = (date) => date && new Date(date) < new Date();

const USER_TABLE_COLUMNS = [
  { id: 'name', label: 'Name', hint: 'Subscriber name' },
  { id: 'email', label: 'Email', hint: 'Optional label' },
  { id: 'uuid', label: 'UUID', hint: 'Unique identifier' },
  { id: 'usage', label: 'Usage', hint: 'Traffic and quota' },
  { id: 'live', label: 'Live', hint: 'Active requests' },
  { id: 'expiry', label: 'Expiry', hint: 'Expiration date' },
  { id: 'engine', label: 'Engine', hint: 'Mode and obfs' },
  { id: 'status', label: 'Status', hint: 'Subscriber state' },
];

const DEFAULT_USER_COLUMNS = ['name', 'engine', 'usage', 'expiry', 'status'];

const NORMAL_PANEL_LABELS = {
  name: 'Subscriber Identity',
  email: 'Email',
  uuid: 'UUID',
  usage: 'Throughput',
  live: 'Live',
  expiry: 'Quotas & Expiry',
  engine: 'Heuristics',
  status: 'Status',
};

const loadVisibleColumns = () => {
  try {
    const raw = window.localStorage.getItem('hivoid-user-table-columns');
    if (!raw) return DEFAULT_USER_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_USER_COLUMNS;
    const allowed = new Set(USER_TABLE_COLUMNS.map((column) => column.id));
    return parsed.filter((column) => allowed.has(column));
  } catch {
    return DEFAULT_USER_COLUMNS;
  }
};

export default function UserManagement() {
  const { notify, confirm, showCopyDialog } = useFeedback();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showSubDetails, setShowSubDetails] = useState(false);
  const [selectedSubInfo, setSelectedSubInfo] = useState(null);
  const [selectedSubUser, setSelectedSubUser] = useState(null);
  const [subDetailsLoading, setSubDetailsLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);
  const [showAdvancedColumns, setShowAdvancedColumns] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('hivoid-user-table-columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await API.getUsers();
      setUsers(data.map(u => ({
        id: u.id,
        uuid: u.uuid,
        username: u.username,
        email: u.email || '',
        maxConnections: u.max_connections,
        maxIps: u.max_ips,
        bandwidthLimit: u.bandwidth_limit,
        blockedTags: u.blocked_tags,
        blockedHosts: u.blocked_hosts,
        dataLimit: u.data_limit > 0 ? `${(u.data_limit / 1073741824).toFixed(1)} GB` : 'Unlimited',
        dataLimitRaw: u.data_limit,
        bytesIn: u.bytesIn || 0,
        bytesOut: u.bytesOut || 0,
        totalBytes: u.totalBytes || 0,
        activeRequests: u.activeRequests || 0,
        is_active: u.is_active,
        expire_at: u.expire_at || null,
        bind_ip: u.bind_ip || '',
        mode: u.mode || '',
        obfs: u.obfs || '',
        pool_size: u.pool_size ?? null,
        socks_port: u.socks_port ?? null,
        dns_port: u.dns_port ?? null,
        dns_upstream: u.dns_upstream || '',
        insecure: !!u.insecure,
        cert_pin: u.cert_pin || '',
        bypass_domains: u.bypass_domains || [],
        bypass_ips: u.bypass_ips || [],
        direct_route: u.direct_route || [],
        direct_geosite: u.direct_geosite || [],
        direct_geoip: u.direct_geoip || [],
        direct_domains: u.direct_domains || [],
        direct_ips: u.direct_ips || [],
        client_geoip_path: u.client_geoip_path || '',
        client_geosite_path: u.client_geosite_path || ''
      })));
    } catch (e) {
      setUsers([]);
    }
    setLoading(false);
  };

  const openModal = (user = null) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const handleSave = async (payload, isEditing, uuid) => {
    setLoading(true);
    try {
      if (isEditing) {
        await API.updateUser(uuid, payload);
      } else {
        await API.createUser(payload);
      }
      setShowModal(false);
      setEditingUser(null);
      fetchUsers();
      notify(isEditing ? 'Subscriber policy updated.' : 'Subscriber created successfully.', { type: 'success' });
    } catch (e) {
      const detail = e?.response?.data?.detail;
      notify(detail ? `Failed to save user: ${detail}` : 'Failed to save user.', { type: 'error' });
    }
    setLoading(false);
  };

  const handleDelete = async (uuid) => {
    const approved = await confirm({
      title: 'Disable Subscriber?',
      message: 'This will disable the user and stop active sessions on nodes.',
      confirmText: 'Disable',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!approved) return;

    try {
      await API.deleteUser(uuid);
      fetchUsers();
      notify('Subscriber disabled.', { type: 'success' });
    } catch (e) {
      notify('Failed to disable subscriber.', { type: 'error' });
    }
  };

  const handlePermanentDelete = async (user) => {
    const approved = await confirm({
      title: 'Delete Subscriber Permanently?',
      message: `User ${user.username} will be permanently removed from database.`,
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!approved) return;

    try {
      await API.deleteUserPermanent(user.uuid);
      fetchUsers();
      notify('Subscriber permanently deleted.', { type: 'success' });
    } catch {
      notify('Failed to permanently delete subscriber.', { type: 'error' });
    }
  };

  const handleToggleActive = async (user) => {
    const enabling = !user.is_active;
    const approved = await confirm({
      title: enabling ? 'Enable Subscriber?' : 'Disable Subscriber?',
      message: enabling
        ? 'This will reactivate the user and allow new sessions.'
        : 'This will disable the user and stop active sessions on nodes.',
      confirmText: enabling ? 'Enable' : 'Disable',
      cancelText: 'Cancel',
      danger: !enabling,
    });
    if (!approved) return;

    try {
      if (enabling) {
        await API.updateUser(user.uuid, { is_active: true });
        notify('Subscriber enabled.', { type: 'success' });
      } else {
        await API.deleteUser(user.uuid);
        notify('Subscriber disabled.', { type: 'success' });
      }
      fetchUsers();
    } catch (e) {
      notify(enabling ? 'Failed to enable subscriber.' : 'Failed to disable subscriber.', { type: 'error' });
    }
  };

  const handleRevoke = async (uuid) => {
    const approved = await confirm({
      title: 'Revoke Active Sessions?',
      message: 'A global kill signal will be sent to all connected nodes.',
      confirmText: 'Send Revoke',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!approved) return;

    try {
      await API.revokeUser(uuid);
      notify('Kill signal sent.', { type: 'success' });
    } catch (e) {
      notify('Failed to send kill signal.', { type: 'error' });
    }
  };

  const handleReset = async (uuid) => {
    const approved = await confirm({
      title: 'Reset Traffic Counters?',
      message: 'This clears usage counters for this subscriber.',
      confirmText: 'Reset Traffic',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!approved) return;

    try {
      await API.resetTraffic(uuid);
      fetchUsers();
      notify('Traffic counters reset.', { type: 'success' });
    } catch (e) {
      notify('Failed to reset traffic.', { type: 'error' });
    }
  };

  const handleShareSubscription = async (user) => {
    if (!user?.uuid) return;
    const subLink = `${window.location.origin}/sub/${user.uuid}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Subscription ${user.username}`,
          text: 'Subscription link',
          url: subLink,
        });
        return;
      }
      await navigator.clipboard.writeText(subLink);
      notify('Subscription link copied.', { type: 'success', duration: 1800 });
    } catch {
      showCopyDialog({
        title: 'Share Subscription',
        message: 'Clipboard access failed. Copy this link manually.',
        value: subLink,
      });
    }
  };

  const copySubLink = async (user) => {
    if (!user?.uuid) return;
    setShowSubDetails(true);
    setSubDetailsLoading(true);
    setSelectedSubInfo(null);
    setSelectedSubUser(user);
    try {
      const info = await API.getSubInfo(user.uuid);
      setSelectedSubInfo(info);
    } catch {
      notify('Failed to load subscription details.', { type: 'error' });
      setShowSubDetails(false);
      setSelectedSubUser(null);
    } finally {
      setSubDetailsLoading(false);
    }
  };

  const toggleVisibleColumn = (columnId) => {
    setVisibleColumns((current) => (
      current.includes(columnId)
        ? current.filter((item) => item !== columnId)
        : [...current, columnId]
    ));
  };

  const copyTextValue = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value);
      notify(successMessage, { type: 'success', duration: 1800 });
    } catch {
      showCopyDialog({
        title: 'Copy Value',
        message: 'Clipboard access failed. Copy this link manually.',
        value,
      });
    }
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.uuid.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeUsers = users.filter((u) => u.is_active && !isExpired(u.expire_at)).length;

  return (
    <div className="page-shell animate-fade-slide">
      <div className="page-topline">Users</div>

      <div className="page-card">
        <div className="page-card-header">
          <div>
            <h1 className="page-card-title">Identity Management</h1>
            <p className="page-card-desc">{users.length} registered · {activeUsers} active · {filtered.length} of {users.length} shown</p>
          </div>

          <div className="page-card-actions">
            <div className="page-search">
              <Search size={16} />
              <input
                type="text"
                className="input-field"
                placeholder="Search by name, UUID or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-icon-only"
              onClick={fetchUsers}
              disabled={loading}
              title="Refresh users"
            >
              {loading ? <RotateCcw size={15} className="spin" /> : <RotateCcw size={15} />}
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
            <button
              type="button"
              onClick={() => openModal()}
              className="btn btn-primary btn-icon-only"
              title="Create"
              aria-label="Create user"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {showAdvancedColumns && (
          <div className="users-normal-advanced">
            <div className="users-column-grid">
              {USER_TABLE_COLUMNS.map((column) => (
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

        <UserList
          users={filtered}
          loading={loading}
          visibleColumns={visibleColumns}
          onEdit={openModal}
          onShareLink={handleShareSubscription}
          onOpenDetails={copySubLink}
          showHeader={false}
          customColumnLabels={NORMAL_PANEL_LABELS}
          emptyTitle="No users found."
          emptyText=""
          tableClassName="users-normal-table"
        />
      </div>

      <UserForm
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingUser(null); }}
        onSave={handleSave}
        editingUser={editingUser}
        loading={loading}
      />
      <SubscriptionDetailsModal
        isOpen={showSubDetails}
        onClose={() => { setShowSubDetails(false); setSelectedSubInfo(null); setSubDetailsLoading(false); }}
        info={selectedSubInfo}
        user={selectedSubUser}
        loading={subDetailsLoading}
        onCopy={copyTextValue}
        onEdit={openModal}
        onShare={handleShareSubscription}
        onReset={handleReset}
        onRevoke={handleRevoke}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        onPermanentDelete={handlePermanentDelete}
      />
    </div>
  );
}
