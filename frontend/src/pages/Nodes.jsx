import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import API from '../services/api';
import { useFeedback } from '../components/feedback/FeedbackProvider';
import NodeList from '../components/nodes/NodeList';
import NodeForm from '../components/nodes/NodeForm';

const sortById = (nodes) =>
  [...nodes].sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));

const isSameNode = (a, b) => {
  const aKeys = Object.keys(a || {});
  const bKeys = Object.keys(b || {});
  if (aKeys.length !== bKeys.length) return false;
  return bKeys.every((key) => a[key] === b[key]);
};

const mergeNodes = (prevNodes, nextNodes) => {
  const previousById = new Map(prevNodes.map((node) => [node.id, node]));
  let changed = prevNodes.length !== nextNodes.length;

  const merged = nextNodes.map((node, index) => {
    const previous = previousById.get(node.id);
    if (!previous) {
      changed = true;
      return node;
    }

    if (!isSameNode(previous, node)) {
      changed = true;
      return node;
    }

    if (prevNodes[index] !== previous) {
      changed = true;
    }

    return previous;
  });

  return changed ? merged : prevNodes;
};

export default function Nodes() {
  const { notify, confirm } = useFeedback();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const fetchInFlightRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  const fetchNodes = useCallback(async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;

    try {
      const data = await API.getActiveNodes();
      const raw = Array.isArray(data?.nodes) ? data.nodes : [];
      // Stability: sort by node_id to avoid jitter from array order shifts
      const nextNodes = [...raw].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      
      setNodes((prev) => {
        if (!hasLoadedOnceRef.current) return nextNodes;
        if (nextNodes.length === 0 && prev.length > 0) return prev; // Guard against transient errors

        if (prev.length === nextNodes.length) {
          // Deep comparison of meaningful fields to avoid re-renders if nothing changed
          const prevHash = JSON.stringify(prev.map(n => ({ 
            id: n.id, s: n.status, u: n.usersCount, cpu: n.cpu_usage, ram: n.ram_usage,
            name: n.name, ip: n.ip, listen: n.listen_addr
          })));
          const nextHash = JSON.stringify(nextNodes.map(n => ({ 
            id: n.id, s: n.status, u: n.usersCount, cpu: n.cpu_usage, ram: n.ram_usage,
            name: n.name, ip: n.ip, listen: n.listen_addr
          })));
          
          if (prevHash === nextHash) return prev;
        }
        return nextNodes;
      });
    } catch (e) {
      // Silent failure for periodic updates
    } finally {
      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
        setLoading(false);
      }
      fetchInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 10000);
    return () => clearInterval(interval);
  }, [fetchNodes]);

  const handleOpenEdit = (node) => {
    setEditingNode(node);
    setShowEditModal(true);
  };

  const handleUpdateNode = async (payload, nodeId) => {
    try {
      await API.updateNode(nodeId, payload);
      setShowEditModal(false);
      setEditingNode(null);
      fetchNodes();
      notify('Node configuration pushed successfully.', { type: 'success' });
    } catch (e) {
      notify('Failed to update node.', { type: 'error' });
    }
  };

  const handleDisconnect = async (nodeId) => {
    const approved = await confirm({
      title: 'Disconnect Node?',
      message: 'This will immediately close the node WebSocket connection.',
      confirmText: 'Disconnect',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!approved) return;

    try {
      await API.deleteNode(nodeId);
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, status: 'offline' } : n));
      notify('WS connection closed.', { type: 'success' });
    } catch (e) {
      notify('Failed to disconnect node.', { type: 'error' });
    }
  };
  
  const handleRemoveNode = async (nodeId) => {
    const approved = await confirm({
      title: 'Remove Node Forever?',
      message: 'This will delete the node from DB and drop its connection. You will need to re-add it manually.',
      confirmText: 'Delete Node',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!approved) return;

    try {
      await API.removeNode(nodeId);
      setNodes(prev => prev.filter(n => n.id !== nodeId));
      notify('Node removed from cluster.', { type: 'success' });
    } catch (e) {
       notify('Failed to remove node.', { type: 'error' });
    }
  };

  // Show all nodes (internal DB records + live status)
  const visibleNodes = nodes;

  return (
    <div className="page-shell animate-fade-slide">
      <div className="page-topline">Cluster</div>

      <div className="page-card">
        <div className="page-card-header">
          <div>
            <h1 className="page-card-title">Hub Nodes</h1>
            <p className="page-card-desc">{visibleNodes.length} connected · Auto-refresh 10s</p>
          </div>

          <div className="page-card-actions">
            <button
              type="button"
              className="btn btn-secondary btn-icon-only"
              onClick={fetchNodes}
              disabled={loading}
              title="Refresh nodes"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        <NodeList
          nodes={visibleNodes}
          loading={loading}
          onEdit={handleOpenEdit}
          onDisconnect={handleDisconnect}
          onRemove={handleRemoveNode}
        />
      </div>

      <NodeForm
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingNode(null); }}
        onSave={handleUpdateNode}
        editingNode={editingNode}
        loading={loading}
      />
    </div>
  );
}
