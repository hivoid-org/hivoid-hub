import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import API from '../../services/api';

// Dark theme tile with labels - CartoDB Dark Matter
const TILE_PROVIDERS = [
  {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '',
  },
  {
    url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '',
  },
];

const getStatusColor = (status) => {
  if (status === 'online') return '#f5f5f5';
  if (status === 'warning' || status === 'stale') return '#a3a3a3';
  return '#737373';
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const formatCpuValue = (node) => {
  if (!hasValue(node?.cpu_usage)) return 'N/A';
  const value = Number(node.cpu_usage);
  if (!Number.isFinite(value)) return String(node.cpu_usage);
  return `${value.toFixed(1)}%`;
};

const formatRamValue = (node) => {
  if (hasValue(node?.ram_usage_mb)) {
    const mb = Number(node.ram_usage_mb);
    if (Number.isFinite(mb)) return `${mb.toFixed(1)} MB`;
    return `${node.ram_usage_mb} MB`;
  }

  if (!hasValue(node?.ram_usage)) return 'N/A';

  const value = Number(node.ram_usage);
  if (!Number.isFinite(value)) return String(node.ram_usage);
  if (value <= 100) return `${value.toFixed(1)}%`;
  return `${value.toFixed(1)} MB`;
};

export default function WorldMap({ nodes = [] }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markerLayerRef = useRef(null);
  const selectedNodeIdRef = useRef(null);
  const [nodeLocations, setNodeLocations] = useState({});

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      center: [25, 0],
      zoomSnap: 0,
      zoomDelta: 0,
      worldCopyJump: false,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      attributionControl: false,
    });
    
    map.on('click', () => {
      selectedNodeIdRef.current = null;
      map.closePopup();
    });
    mapInstanceRef.current = map;

    const addTileLayer = (providerIndex) => {
      if (!mapInstanceRef.current) return;
      if (tileLayerRef.current) {
        tileLayerRef.current.remove();
      }

      const provider = TILE_PROVIDERS[providerIndex];
      const tileLayer = L.tileLayer(provider.url, {
        attribution: '',
        minZoom: 0,
        maxZoom: 18,
        detectRetina: true,
      });

      tileLayer.on('tileerror', () => {
        if (providerIndex < TILE_PROVIDERS.length - 1) {
          addTileLayer(providerIndex + 1);
        }
      });

      tileLayer.addTo(mapInstanceRef.current);
      tileLayerRef.current = tileLayer;
    };

    addTileLayer(0);
    
    markerLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerLayerRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    
    let isMounted = true;
    const applyMapFit = () => {
      if (!isMounted) return;
      map.invalidateSize();
      // Hard fallback to window size for fixed absolute backgrounds
      const W = window.innerWidth;
      const H = window.innerHeight;
      
      const zoomW = Math.log2(W / 256);
      const zoomH = Math.log2(H / 256);
      // Perfect object-fit: cover equivalent zoom level
      const targetZoom = Math.max(zoomW, zoomH);

      map.setMinZoom(0);
      map.setMaxZoom(18);

      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      if (map.zoomControl) map.zoomControl.disable();

      // Center exactly on the equator to ensure extreme poles don't show up 
      // when math stretches the height or width
      map.setView([0, 0], targetZoom, { animate: false });
      
      map.setMinZoom(targetZoom);
      map.setMaxZoom(targetZoom);
    };

    // Apply on mount, and slightly delayed to ensure DOM sizing is correct
    applyMapFit();
    setTimeout(applyMapFit, 50);
    setTimeout(applyMapFit, 200);

    const handleResize = () => {
      applyMapFit();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const fetchLocations = async () => {
      const isPrivateIP = (ip) => {
        if (!ip) return true;
        const parts = ip.split('.');
        if (parts.length !== 4) return true;
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);
        
        if (first === 10) return true;
        if (first === 172 && second >= 16 && second <= 31) return true;
        if (first === 192 && second === 168) return true;
        if (first === 127) return true;
        return false;
      };

      const ipsToFetch = nodes
        .map(node => node.ip)
        .filter(ip => ip && !nodeLocations[ip] && !isPrivateIP(ip));
      
      if (ipsToFetch.length === 0) return;
      
      try {
        const results = await API.batchIPLocation(ipsToFetch);
        
        const newLocations = {};
        results.forEach(result => {
          if (result.latitude && result.longitude) {
            newLocations[result.ip] = {
              lat: result.latitude,
              lon: result.longitude,
              country: result.country,
              countryCode: result.country_code,
              city: result.city
            };
          }
        });
        
        if (Object.keys(newLocations).length > 0) {
          setNodeLocations(prev => ({ ...prev, ...newLocations }));
        }
      } catch (error) {
        console.warn('Failed to fetch IP locations:', error);
      }
    };
    
    fetchLocations();
  }, [nodes.map(n => n.ip).join(',')]);

  const formatUptime = (node) => {
    if (node.uptime && node.uptime !== '0s' && node.uptime !== '0') return node.uptime;
    if (node.uptime_seconds !== null && node.uptime_seconds !== undefined && node.uptime_seconds > 0) {
      const totalSeconds = Math.max(0, Number(node.uptime_seconds) || 0);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const totalHours = Math.floor(totalSeconds / 3600);
      const diffDays = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      const minutes = totalMinutes % 60;
      if (diffDays > 0) return `${diffDays}d ${hours}h`;
      if (totalHours > 0) return `${totalHours}h ${minutes}m`;
      if (totalMinutes > 0) return `${totalMinutes}m`;
      return 'Just now';
    }
    if (node.connected_at) {
      const connectedTime = new Date(node.connected_at);
      const now = new Date();
      const diffMs = now - connectedTime;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      const hours = diffHours % 24;
      const minutes = diffMinutes % 60;
      
      if (diffDays > 0) return `${diffDays}d ${hours}h`;
      if (diffHours > 0) return `${diffHours}h ${minutes}m`;
      if (diffMinutes > 0) return `${diffMinutes}m`;
      return 'Just now';
    }
    return 'N/A';
  };

  const getFallbackPosition = (ip = '', nodeId = '') => {
    const seed = `${ip}-${nodeId}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const lat = ((Math.abs(hash) % 12000) / 100) - 60; // -60..60
    const lon = ((Math.abs(hash * 7) % 36000) / 100) - 180; // -180..180
    return [lat, lon];
  };

  const nodesWithPositions = useMemo(
    () =>
      nodes.map((node) => {
        const live = nodeLocations[node.ip];
        const position = live ? [live.lat, live.lon] : getFallbackPosition(node.ip, node.id);
        return { node, location: live || null, position };
      }),
    [nodes, nodeLocations]
  );

  useEffect(() => {
    if (!markerLayerRef.current) return;

    markerLayerRef.current.clearLayers();

    nodesWithPositions.forEach(({ node, location, position }) => {
      const statusColor = getStatusColor(node.status);
      const marker = L.circleMarker(position, {
        radius: 7,
        color: '#fafafa',
        weight: 1,
        fillColor: statusColor,
        fillOpacity: 0.95,
      });

      const statusBg =
        node.status === 'online'
          ? 'rgba(245, 245, 245, 0.15)'
          : node.status === 'warning' || node.status === 'stale'
            ? 'rgba(163, 163, 163, 0.15)'
            : 'rgba(115, 115, 115, 0.15)';

      const statusBorder =
        node.status === 'online'
          ? 'rgba(245, 245, 245, 0.3)'
          : node.status === 'warning' || node.status === 'stale'
            ? 'rgba(163, 163, 163, 0.3)'
            : 'rgba(115, 115, 115, 0.3)';

      const popupHtml = `
        <div style="background:linear-gradient(135deg,#262626 0%,#171717 100%);color:#fafafa;padding:12px;border-radius:8px;min-width:240px;">
          <div style="display:flex;align-items:center;gap:8px;padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid #404040;">
            <strong style="font-size:15px;">${escapeHtml(node.name || `Node ${String(node.id || '').slice(0, 8)}`)}</strong>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;">
            <div style="display:flex;justify-content:space-between;"><span style="color:#a3a3a3;">IP Address:</span><span style="font-weight:500;">${escapeHtml(node.ip || 'N/A')}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#a3a3a3;">Location:</span><span style="font-weight:500;">${location ? escapeHtml(location.city ? `${location.city}, ${location.country}` : location.country) : 'Estimated'}</span></div>
            ${
              location
                ? `<div style="display:flex;justify-content:space-between;"><span style="color:#a3a3a3;">Coordinates:</span><span style="font-weight:500;font-family:monospace;">${Number(location.lat).toFixed(2)}°, ${Number(location.lon).toFixed(2)}°</span></div>`
                : ''
            }
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="color:#a3a3a3;">Status:</span>
              <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;background:${statusBg};color:${statusColor};border:1px solid ${statusBorder};">${escapeHtml(node.status || 'offline')}</span>
            </div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#a3a3a3;">Users:</span><span style="font-weight:500;">${Number(node.usersCount || 0)}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#a3a3a3;">CPU:</span><span style="font-weight:500;">${escapeHtml(formatCpuValue(node))}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#a3a3a3;">RAM:</span><span style="font-weight:500;">${escapeHtml(formatRamValue(node))}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#a3a3a3;">Uptime:</span><span style="font-weight:500;">${escapeHtml(formatUptime(node))}</span></div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 320, closeButton: true, autoClose: true, closeOnClick: true });
      marker.on('click', () => {
        selectedNodeIdRef.current = node.id;
        marker.openPopup();
      });
      marker.addTo(markerLayerRef.current);
      if (selectedNodeIdRef.current === node.id) {
        marker.openPopup();
      }
    });
  }, [nodesWithPositions]);

  return (
    <div className="world-map-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, background: '#000000' }}>
      <style>{`
        .world-map-container .leaflet-container {
          background: #000000 !important;
        }
        .world-map-container .leaflet-tile-pane {
          opacity: 1 !important;
        }
        .world-map-container .leaflet-tile {
          /* Dark tiles - grayscale and slight adjustments for better contrast */
          filter: grayscale(0.3) brightness(0.95) contrast(1.1);
        }
      `}</style>
      <div ref={mapRef} style={{ height: '100%', width: '100%', background: '#000000' }} />
      {nodes.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#a3a3a3',
            background: 'rgba(23, 23, 23, 0.85)',
            border: '1px solid #404040',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '13px',
            zIndex: 500,
            pointerEvents: 'none',
          }}
        >
          No active nodes to display on map
        </div>
      )}
    </div>
  );
}
