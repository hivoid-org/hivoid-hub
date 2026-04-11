import React from 'react';
import { Users, Cpu, Clock, Edit2, Share2, Eye } from 'lucide-react';

// Format bytes to human readable
const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Check if date is expired
const isExpired = (date) => date && new Date(date) < new Date();

// Format expiry date
const formatExpiry = (date) => {
  if (!date) return 'Never';
  const diff = new Date(date) - new Date();
  if (diff < 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  if (days > 30) return `${Math.floor(days / 30)}mo`;
  if (days > 0) return `${days}d`;
  return `${Math.floor(diff / 3600000)}h`;
};

const getUsagePercent = (user) => {
  if (!user.dataLimitRaw || user.dataLimitRaw <= 0) return 0;
  return Math.max(0, Math.min(100, (user.totalBytes / user.dataLimitRaw) * 100));
};

const getStatusLabel = (user) => {
  if (!user.is_active) return 'Disabled';
  if (isExpired(user.expire_at)) return 'Expired';
  return 'Active';
};

const getStatusClass = (user) => {
  if (!user.is_active) return 'badge-soft';
  if (isExpired(user.expire_at)) return 'badge-soft';
  return 'badge-strong';
};

const formatList = (items) => {
  if (!items || items.length === 0) return '—';
  if (items.length <= 2) return items.join(', ');
  return `${items.slice(0, 2).join(', ')} +${items.length - 2}`;
};

const fieldOrder = ['name', 'email', 'uuid', 'usage', 'live', 'expiry', 'engine', 'status'];

const renderFieldValue = (user, field) => {
  switch (field) {
    case 'name':
      return (
        <div className="users-name-cell">
          <div className="user-avatar user-avatar--lg">{user.username.charAt(0).toUpperCase()}</div>
          <div className="users-name-copy">
            <span className="users-name-primary">{user.username}</span>
            <span className="users-name-secondary">Primary subscriber name</span>
          </div>
        </div>
      );
    case 'email':
      return user.email || '—';
    case 'uuid':
      return <span className="mono">{user.uuid}</span>;
    case 'usage':
      return (
        <div className="usage-stack usage-stack-tight">
          <div className="usage-row usage-row-center">
            <Cpu size={14} color="var(--text-muted)" />
            <span className="usage-main-text">
              {formatBytes(user.totalBytes)} <span>/ {user.dataLimit}</span>
            </span>
          </div>
          <div className="usage-meter" aria-hidden="true">
            <div className="usage-meter-fill" style={{ width: `${getUsagePercent(user)}%` }} />
          </div>
          <div className="usage-meta usage-meta-center">
            <span>↓ {formatBytes(user.bytesOut)}</span>
            <span>↑ {formatBytes(user.bytesIn)}</span>
          </div>
        </div>
      );
    case 'live':
      return <span className="live-count">{user.activeRequests} Requests</span>;
    case 'expiry':
      return <span className={isExpired(user.expire_at) ? 'table-expiry table-expiry-expired' : 'table-expiry'}>{formatExpiry(user.expire_at)}</span>;
    case 'engine':
      return (
        <div className="engine-stack">
          {user.mode && <span className="badge badge-neutral">{user.mode}</span>}
          {user.obfs && <span className="badge badge-neutral">{user.obfs}</span>}
          {!user.mode && !user.obfs && <span className="table-muted">Default</span>}
        </div>
      );
    case 'status':
      return <div className={`badge badge-neutral ${getStatusClass(user)}`}>{getStatusLabel(user)}</div>;
    default:
      return '—';
  }
};

const columnLabelMap = {
  name: 'Name',
  email: 'Email',
  uuid: 'UUID',
  usage: 'Usage',
  live: 'Live',
  expiry: 'Expiry',
  engine: 'Engine',
  status: 'Status',
};

// Table view for desktop
function UserTable({ users, visibleColumns, onEdit, onShareLink, onOpenDetails, columnLabels, tableClassName }) {
  const activeColumns = fieldOrder.filter((column) => visibleColumns.includes(column));

  return (
    <table className={`data-table users-table users-table-centered ${tableClassName || ''}`}>
       <thead>
         <tr>
          {activeColumns.map((column) => (
            <th key={column}>{columnLabels[column] || columnLabelMap[column]}</th>
          ))}
          <th className="users-table-actions-head">Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user.id}>
            {activeColumns.map((column) => (
              <td key={column}>
                {renderFieldValue(user, column)}
              </td>
            ))}
            <td>
              <div className="user-actions-row user-actions-row-compact">
                <button onClick={() => onEdit(user)} className="btn btn-secondary user-action-btn" title="Edit" aria-label={`Edit ${user.username}`}>
                  <Edit2 size={15} />
                </button>
                <button onClick={() => onShareLink(user)} className="btn btn-secondary user-action-btn" title="Share" aria-label={`Share ${user.username}`}>
                  <Share2 size={15} />
                </button>
                <button onClick={() => onOpenDetails(user)} className="btn btn-secondary user-action-btn" title="More Info" aria-label={`More info for ${user.username}`}>
                  <Eye size={15} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Card view for mobile
function UserCards({ users, visibleColumns, onEdit, onShareLink, onOpenDetails, columnLabels }) {
  const activeColumns = fieldOrder.filter((column) => visibleColumns.includes(column));

  return (
    <div className="table-card-view">
      {users.map(user => (
        <div key={user.id} className="table-card">
          <div className="table-card-header">
            <div className="users-name-cell">
              <div className="user-avatar">{user.username.charAt(0).toUpperCase()}</div>
              <div className="users-name-copy">
                <span className="users-name-primary">{user.username}</span>
                <span className="users-name-secondary">{user.email || 'No email'}</span>
              </div>
            </div>
            <div className={`badge badge-neutral ${getStatusClass(user)}`}>{getStatusLabel(user)}</div>
          </div>

          <div className="table-card-body">
            {activeColumns.map((column) => (
              <div key={column} className="table-card-row">
                <span className="table-card-label">{columnLabels[column] || columnLabelMap[column]}</span>
                <div className="table-card-value table-card-value-block">{renderFieldValue(user, column)}</div>
              </div>
            ))}
          </div>

          <div className="table-card-actions table-card-actions-neutral">
             <button onClick={() => onEdit(user)} className="btn btn-secondary" style={{ flex: 1, padding: '10px' }} aria-label={`Edit ${user.username}`}>
               <Edit2 size={16} /> Edit
             </button>
             <button onClick={() => onShareLink(user)} className="btn btn-secondary" style={{ padding: '10px' }} aria-label={`Share ${user.username}`}>
               <Share2 size={16} /> Share
             </button>
             <button onClick={() => onOpenDetails(user)} className="btn btn-secondary" style={{ padding: '10px' }} aria-label={`More info for ${user.username}`}>
               <Eye size={16} /> Info
             </button>
            </div>
        </div>
      ))}
    </div>
  );
}

// Empty state
function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <Users size={48} className="empty-state-icon" />
      <p className="empty-state-title">{title || 'No subscribers found'}</p>
      {text ? <p className="empty-state-text">{text}</p> : null}
    </div>
  );
}

// Main component
export default function UserList({
  users,
  loading,
  visibleColumns,
  onEdit,
  onShareLink,
  onOpenDetails,
  showHeader = true,
  customColumnLabels,
  emptyTitle,
  emptyText,
  tableClassName,
}) {
  const columnLabels = customColumnLabels || columnLabelMap;

  if (loading && users.length === 0) {
    return (
      <div className="data-table-container">
        <div className="users-table-skeleton">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      </div>
    );
  }

  if (users.length === 0 && !loading) {
    return <EmptyState title={emptyTitle} text={emptyText} />;
  }

  return (
    <div className="users-list-shell">
      {showHeader && (
        <div className="users-list-header">
          <div>
            <div className="users-list-kicker">Subscriber roster</div>
            <div className="users-list-title">Usage, routing, and lifecycle at a glance</div>
          </div>
          <div className="users-list-meta">
            <span className="badge badge-neutral">{users.length} shown</span>
            <span className="badge badge-neutral">{users.filter((user) => isExpired(user.expire_at)).length} expired</span>
          </div>
        </div>
      )}
      <div className="data-table-container users-table-panel">
      <UserTable 
        users={users}
        visibleColumns={visibleColumns}
        onEdit={onEdit}
        onShareLink={onShareLink}
        onOpenDetails={onOpenDetails}
        columnLabels={columnLabels}
        tableClassName={tableClassName}
      />
      <UserCards 
        users={users}
        visibleColumns={visibleColumns}
        onEdit={onEdit}
        onShareLink={onShareLink}
        onOpenDetails={onOpenDetails}
        columnLabels={columnLabels}
      />
      </div>
    </div>
  );
}
