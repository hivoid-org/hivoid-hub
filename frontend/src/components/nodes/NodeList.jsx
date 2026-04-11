import { Server, Settings2, X, Loader2, Trash2 } from 'lucide-react';

function EmptyState() {
  return (
    <div className="nodes-empty-state">
      <div className="empty-state-visual">
        <div className="empty-state-icon-wrapper">
          <Server size={48} />
        </div>
        <div className="empty-state-rings">
          <div className="ring ring-1" />
          <div className="ring ring-2" />
          <div className="ring ring-3" />
        </div>
      </div>
      <h3 className="empty-state-title">No Nodes Registered</h3>
      <p className="empty-state-text">Nodes you add to the cluster will appear here.</p>
    </div>
  );
}

export default function NodeList({ nodes, loading, onEdit, onDisconnect, onRemove }) {
  if (loading && nodes.length === 0) {
    return (
      <div className="nodes-loading">
        <Loader2 size={32} className="spin" />
        <span>Loading nodes...</span>
      </div>
    );
  }

  if (nodes.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="nodes-container">
      <div className="data-table-container">
        <table className="data-table node-table users-table-centered">
          <thead>
            <tr>
              <th style={{ width: '300px' }}>Node</th>
              <th>Address</th>
              <th>Users</th>
              <th>Status</th>
              <th style={{ width: '150px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => {
              const isOnline = node.status === 'online';
              const isStale = node.status === 'stale';
              const isOffline = !isOnline && !isStale;
              
              let badgeClass = 'badge-neutral';
              if (isOnline) badgeClass = 'badge-success';
              else if (isStale) badgeClass = 'badge-warning';
              else if (isOffline) badgeClass = 'badge-danger';

              return (
                <tr key={node.id} className={isOffline ? 'row-dimmed' : ''}>
                  <td>
                    <div className="node-cell">
                      <div className="node-cell-info">
                        <span className="node-cell-name">{node.name || `Node ${node.id?.slice(0, 6)}`}</span>
                        <span className="node-cell-sub">{node.listen_addr || ':4433'}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="node-address">
                      <span className="mono">{node.ip}</span>
                      <span className="node-port">:{node.port}</span>
                    </div>
                  </td>
                  <td>
                    <span>{node.usersCount || 0}</span>
                  </td>
                  <td>
                    <span className={`badge ${badgeClass}`}>
                      {isOnline ? 'Online' : isStale ? 'Connecting' : 'Offline'}
                    </span>
                  </td>
                  <td>
                    <div className="node-actions">
                      <button
                        onClick={() => onEdit(node)}
                        className="btn-icon"
                        title="Manage node"
                      >
                        <Settings2 size={16} />
                      </button>
                      
                      {isOnline && (
                        <button
                          onClick={() => onDisconnect(node.id)}
                          className="btn-icon warning"
                          title="Disconnect WebSocket"
                        >
                          <X size={16} />
                        </button>
                      )}

                      <button
                        onClick={() => onRemove(node.id)}
                        className="btn-icon danger"
                        title="Remove from DB"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
