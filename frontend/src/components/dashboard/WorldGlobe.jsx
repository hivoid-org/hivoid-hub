import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  latLonToXYZ, rotY, rotX, project,
  decodeArcs, getOuterRings, buildLandDots, buildArc,
  COUNTRY_LABELS, getNodeColors,
} from './globeHelpers';

// 50m resolution → accurate strait/border data
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';

const MAJOR_CODES = new Set([
  '840','124','643','156','036','076','356','392','276','250',
  '826','724','380','792','364','818','710','484','704','586',
  '566','410','616','804','398','729','231','404','246','752',
  '578','360','170','152','032','068','218','450','466','512',
  '104','516','600','072','188','258','788','760','368','031',
]);

const MAX_SEG_SQ = (w, h) => Math.pow(Math.min(w, h) * 0.25, 2);

export default function WorldGlobe({ nodes = [], nodeLocations = {}, hubLocation, onNodeClick }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const globeData = useRef({ dots: [], borders: [], labels: [] });
  const sizeRef   = useRef({ w: 1, h: 1 });
  const stateRef  = useRef({
    rotY: 0.3, rotX: 0.18,
    dragging: false, lastX: 0, lastY: 0,
    velX: 0, velY: 0,
    autoRotate: true,
    zoom: 1.0, pulse: 0,
    _projNodes: [],
  });
  const [loading, setLoading] = useState(true);
  const [popup,   setPopup]   = useState(null);

  // Stability markers: keep data updated without restarting the animation loop
  const nodesRef = useRef(nodes);
  const locsRef  = useRef(nodeLocations);
  
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { locsRef.current = nodeLocations; }, [nodeLocations]);

  useEffect(() => {
    fetch(TOPO_URL)
      .then(r => r.json())
      .then(topo => {
        const decoded = decodeArcs(topo.arcs, topo.transform);
        const dots = buildLandDots(topo, decoded, 2.2);
        const borders = [];
        for (const g of (topo.objects.countries?.geometries ?? []))
          borders.push(...getOuterRings(g, decoded));
        const labels = [];
        for (const g of (topo.objects.countries?.geometries ?? [])) {
          const id = String(g.id);
          const e  = COUNTRY_LABELS[id];
          if (e) labels.push({ name: e[0], lon: e[1], lat: e[2], major: MAJOR_CODES.has(id) });
        }
        globeData.current = { dots, borders, labels };
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const buildNodeItems = useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentLocs = locsRef.current;
    return currentNodes.map(node => {
      const loc = currentLocs[node.ip];
      let lat, lon;
      if (loc) { lat = loc.lat; lon = loc.lon; }
      else {
        const seed = `${node.ip}-${node.id}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) { hash = (hash << 5) - hash + seed.charCodeAt(i); hash |= 0; }
        lat = ((Math.abs(hash)     % 12000) / 100) - 60;
        lon = ((Math.abs(hash * 7) % 36000) / 100) - 180;
      }
      return { node, lat, lon, loc };
    });
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w: W, h: H } = sizeRef.current;
    if (W <= 1) return;

    const cx = W / 2, cy = H / 2;
    const R  = Math.min(W, H) * 0.46 * stateRef.current.zoom;
    const D  = 700;
    const st = stateRef.current;

    if (!st.dragging) {
      st.rotY += st.velX; st.rotX += st.velY;
      st.velX *= 0.92; st.velY *= 0.92;
      if (Math.abs(st.velX) < 0.0003 && st.autoRotate) st.velX = 0;
      if (st.autoRotate && Math.abs(st.velX) < 0.001) st.rotY += 0.0015;
    }
    st.rotX = Math.max(-1.35, Math.min(1.35, st.rotX));
    st.pulse = (st.pulse + 0.04) % (Math.PI * 2);

    const tf = p => rotX(rotY(p, st.rotY), st.rotX);
    const pr = p => project(tf(p), cx, cy, D);
    const edgeZ = -R * 0.08;
    const vis = p => tf(p)[2] < edgeZ;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, W, H);

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0d0d';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const { dots, borders, labels } = globeData.current;
    const nodeItems = buildNodeItems();
    const hubLat = hubLocation?.lat;
    const hubLon = hubLocation?.lon;

    const dotR = Math.max(1.1, R * 0.011);
    ctx.fillStyle = '#2a2a2a';
    for (const [lat, lon] of dots) {
      const xyz = latLonToXYZ(lat, lon, R);
      if (!vis(xyz)) continue;
      const { sx, sy } = pr(xyz);
      ctx.beginPath(); ctx.arc(sx, sy, dotR, 0, Math.PI * 2); ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 0.6;
    const maxSq = MAX_SEG_SQ(W, H);
    for (const ring of borders) {
      ctx.beginPath();
      let started = false;
      let prevSx = 0, prevSy = 0;
      for (const [lon, lat] of ring) {
        const xyz = latLonToXYZ(lat, lon, R);
        if (!vis(xyz)) { started = false; continue; }
        const { sx, sy } = pr(xyz);
        if (!started) { ctx.moveTo(sx, sy); started = true; }
        else {
          const dx = sx - prevSx, dy = sy - prevSy;
          if (dx * dx + dy * dy > maxSq) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        prevSx = sx; prevSy = sy;
      }
      ctx.stroke();
    }

    const namePx = Math.min(11, Math.max(9, Math.round(R * 0.038)));
    ctx.font = `500 ${namePx}px Inter, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const drawn = [];
    labels.filter(l => l.major || st.zoom > 1.4).forEach(l => {
      const xyz = latLonToXYZ(l.lat, l.lon, R * 1.012);
      if (!vis(xyz)) return;
      const p = pr(xyz);
      const tw = ctx.measureText(l.name).width + 8, th = namePx + 6;
      const rx = p.sx - tw/2, ry = p.sy - th/2;
      if (drawn.some(r => rx < r.x+r.w && rx+tw > r.x && ry < r.y+r.h && ry+th > r.y)) return;
      drawn.push({ x: rx, y: ry, w: tw, h: th });
      ctx.fillStyle = `rgba(200,200,200,${Math.min(0.85, (p.s - 0.7) * 15)})`;
      ctx.fillText(l.name, p.sx, p.sy);
    });

    if (hubLat && hubLon) {
      for (const { node, lat, lon } of nodeItems) {
        const col = getNodeColors(node.status);
        const arc = buildArc(lat, lon, hubLat, hubLon, R, 0.16, 55);
        ctx.beginPath(); let started = false;
        for (const pt of arc) {
          if (!vis(pt)) { started = false; continue; }
          const { sx, sy } = pr(pt);
          if (!started) { ctx.moveTo(sx, sy); started = true; }
          else ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = col.arc + '0.5)';
        ctx.lineWidth = 1.1; ctx.stroke();
      }
      const hubXYZ = latLonToXYZ(hubLat, hubLon, R);
      if (vis(hubXYZ)) {
        const hp = pr(hubXYZ);
        const ps = 1 + 0.45 * Math.abs(Math.sin(st.pulse * 1.6));
        ctx.beginPath(); ctx.arc(hp.sx, hp.sy, 14 * hp.s * ps, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.1+0.07*Math.sin(st.pulse*1.6)})`;
        ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(hp.sx, hp.sy, 7 * hp.s, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(hp.sx, hp.sy, 3.5 * hp.s, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.font = `bold ${Math.max(9, Math.round(R * 0.05))}px Inter`;
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('HUB', hp.sx, hp.sy - 12 * hp.s);
      }
    }

    const projNodes = [];
    for (const { node, lat, lon, loc } of nodeItems) {
      const xyz = latLonToXYZ(lat, lon, R * 1.008);
      if (!vis(xyz)) continue;
      const p = pr(xyz), nr = Math.max(4, 6.5 * p.s);
      const col = getNodeColors(node.status);
      const grd = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, nr * 3.5);
      grd.addColorStop(0, col.arc + '0.18)'); grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.sx, p.sy, nr * 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.sx, p.sy, nr, 0, Math.PI * 2);
      ctx.fillStyle = '#000'; ctx.fill(); ctx.strokeStyle = col.border; ctx.lineWidth = 2; ctx.stroke();
      projNodes.push({ node, loc, sx: p.sx, sy: p.sy, r: nr });
    }
    st._projNodes = projNodes;
    animRef.current = requestAnimationFrame(draw);
  }, [buildNodeItems, hubLocation]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const par = canvas.parentElement; if (!par) return;
      const dpr = window.devicePixelRatio || 1, w = par.clientWidth, h = par.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      sizeRef.current = { w, h };
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const st = stateRef.current;
    let lastMoveTime = 0, lastMoveX = 0, lastMoveY = 0;
    const onDown = e => {
      const cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY;
      st.dragging = true; st.autoRotate = false; st.velX = 0; st.velY = 0;
      st.lastX = cx; st.lastY = cy; lastMoveX = cx; lastMoveY = cy; lastMoveTime = Date.now();
      canvas.style.cursor = 'grabbing';
    };
    const onMove = e => {
      if (!st.dragging) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = cx - st.lastX, dy = cy - st.lastY;
      st.rotY += dx * 0.005; st.rotX += dy * 0.005;
      const now = Date.now(), dt = Math.max(1, now - lastMoveTime);
      st.velX = (cx - lastMoveX) * 0.005 * (16 / dt); st.velY = (cy - lastMoveY) * 0.005 * (16 / dt);
      st.lastX = cx; st.lastY = cy; lastMoveX = cx; lastMoveY = cy; lastMoveTime = now;
    };
    const onUp = () => {
      st.dragging = false; canvas.style.cursor = 'grab';
      st.velX = Math.max(-0.04, Math.min(0.04, st.velX)); st.velY = Math.max(-0.02, Math.min(0.02, st.velY));
      setTimeout(() => { st.autoRotate = true; }, 3000);
    };
    const onWheel = e => { e.preventDefault(); st.zoom = Math.max(0.5, Math.min(2.5, st.zoom - e.deltaY * 0.0008)); };
    const onClick = e => {
      const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const found = (st._projNodes || []).find(pn => {
        const dx = mx - pn.sx, dy = my - pn.sy; return dx * dx + dy * dy < (pn.r + 8) ** 2;
      });
      if (found) { e.stopPropagation(); setPopup({ node: found.node, loc: found.loc, x: e.clientX, y: e.clientY }); if (onNodeClick) onNodeClick(found.node); }
      else setPopup(null);
    };
    canvas.addEventListener('mousedown', onDown); canvas.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove); window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp); window.addEventListener('touchend', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('click', onClick);
    return () => {
      canvas.removeEventListener('mousedown', onDown); canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove); window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp); window.removeEventListener('touchend', onUp);
      canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('click', onClick);
    };
  }, [onNodeClick]);

  useEffect(() => { if (!loading) draw(); return () => { if (animRef.current) cancelAnimationFrame(animRef.current); }; }, [draw, loading]);

  const fmt = {
    uptime: n => n.uptime || (n.uptime_seconds > 0 ? `${Math.floor(n.uptime_seconds/3600)}h ${Math.floor((n.uptime_seconds%3600)/60)}m` : 'N/A'),
    cpu: n => n.cpu_usage != null ? `${Number(n.cpu_usage).toFixed(1)}%` : 'N/A',
    ram: n => n.ram_usage_mb != null ? `${Number(n.ram_usage_mb).toFixed(1)} MB` : 'N/A',
  };

  return (
    <div className="world-globe-wrapper" style={{ position: 'relative', width: '100%', height: '100%', background: '#080808', overflow: 'hidden' }} onClick={() => setPopup(null)}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.06)', borderTop: '2px solid rgba(255,255,255,0.55)', animation: 'gSpin 0.85s linear infinite' }} />
          <style>{`@keyframes gSpin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', flexDirection: 'column', gap: 5, pointerEvents: 'none' }}>
        {[{ c: '#22c55e', l: 'Online' }, { c: '#4b5563', l: 'Offline' }].map(({ c, l }) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#000', border: `2px solid ${c}` }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{l}</span>
          </div>
        ))}
      </div>
      {popup && (
        <div className="globe-popup" style={{ position: 'fixed', left: Math.min(popup.x + 12, window.innerWidth - 295), top: Math.min(popup.y - 10, window.innerHeight - 295), zIndex: 9999 }} onClick={e => e.stopPropagation()}>
          <div className="globe-popup-header"><strong>{popup.node.name || `Node ${popup.node.id?.slice(0, 8)}`}</strong><button className="globe-popup-close" onClick={() => setPopup(null)}>×</button></div>
          <div className="globe-popup-body">
            {[ ['IP', popup.node.ip], ['Location', popup.loc ? `${popup.loc.city || ''} ${popup.loc.country}` : 'Estimated'], ['Status', <span key="s" className={`globe-status globe-status-${popup.node.status}`}>{popup.node.status}</span>], ['Users', popup.node.usersCount || 0], ['CPU', fmt.cpu(popup.node)], ['RAM', fmt.ram(popup.node)], ['Uptime', fmt.uptime(popup.node)] ].map(([k, v]) => (
              <div key={k} className="globe-popup-row"><span>{k}</span><span>{v}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
