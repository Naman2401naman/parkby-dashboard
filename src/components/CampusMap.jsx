import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as turf from '@turf/turf';
import {
  Navigation, Navigation2, Compass, Activity, Edit3, Settings2,
  MapPin, Route, Trash2, Save, MousePointer2, PlusCircle,
  ChevronLeft, X, Clock, Milestone, ArrowUpCircle, ZoomIn, ZoomOut,
  CheckCircle, AlertTriangle, Info, MapPinned, LocateFixed, UploadCloud,
  Square, Maximize2, FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, Minus, Plus,
  Search, Car, PersonStanding, ArrowRight, ChevronDown, ChevronUp, CornerDownRight,
  TrendingUp, Target, Layers
} from 'lucide-react';
import DrawRectangle, { scalePolygon, flipHorizontal, flipVertical, rotatePolygon } from '../utils/drawRectangle';

// ─── Token ────────────────────────────────────────────────────────────────────
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// ─── Default campus center (Nagpur area) ──────────────────────────────────────
const DEFAULT_CENTER = [79.0615, 21.1775];
const DEFAULT_ZOOM = 17;
// Real-world campus road entry point (Mapbox external route destination)
const MAIN_GATE_COORDS = [79.05588, 21.15334]; // [lng, lat]
const NAVIGATION_STATE = {
  EXTERNAL_NAVIGATION: 'EXTERNAL_NAVIGATION',
  INTERNAL_NAVIGATION: 'INTERNAL_NAVIGATION',
  HYBRID_NAVIGATION: 'HYBRID_NAVIGATION',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusColor(occ, total) {
  if (!total) return '#475569';
  const r = occ / total;
  if (r >= 0.9) return '#ef4444';
  if (r >= 0.7) return '#f59e0b';
  return '#10b981';
}

function centroidOfPolygon(coords) {
  const ring = coords[0];
  let x = 0, y = 0;
  ring.forEach(([lng, lat]) => { x += lng; y += lat; });
  return [x / ring.length, y / ring.length];
}

function lngLatDist(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy) * 111000; // approx metres
}

function findShortestDrawnPath(startPt, targetPt, routes) {
  if (!routes || routes.length === 0) return [startPt, targetPt];

  const nodes = [startPt, targetPt];
  const adj = [[], []];

  const addNode = (pt) => { nodes.push(pt); adj.push([]); return nodes.length - 1; };
  const routeVerticesStart = nodes.length;

  routes.forEach(r => {
    let offset = nodes.length;
    r.coords.forEach(pt => addNode(pt));
    for (let i = 0; i < r.coords.length - 1; i++) {
      const u = offset + i, v = offset + i + 1;
      const d = lngLatDist(nodes[u], nodes[v]);
      adj[u].push({ node: v, weight: d });
      adj[v].push({ node: u, weight: d });
    }
  });

  // Implicitly connect nearby intersections 
  for (let i = routeVerticesStart; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = lngLatDist(nodes[i], nodes[j]);
      if (d < 12) { // Allow snapping if route lines were drawn slightly apart (up to 12m)
        adj[i].push({ node: j, weight: d });
        adj[j].push({ node: i, weight: d });
      }
    }
  }

  // Find closest point on ALL segments
  const snapToRoutes = (pIdx) => {
    let minD = Infinity;
    let bestP = null;
    let bestEdge = null;
    let currentIdx = routeVerticesStart;

    routes.forEach(r => {
      for (let i = 0; i < r.coords.length - 1; i++) {
        const u = currentIdx + i, v = currentIdx + i + 1;
        const a = nodes[u], b = nodes[v], p = nodes[pIdx];

        const dx = b[0] - a[0], dy = b[1] - a[1];
        let proj;
        if (dx === 0 && dy === 0) {
          proj = a;
        } else {
          const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
          if (t < 0) proj = a;
          else if (t > 1) proj = b;
          else proj = [a[0] + t * dx, a[1] + t * dy];
        }

        const d = lngLatDist(p, proj);
        if (d < minD) { minD = d; bestP = proj; bestEdge = { u, v }; }
      }
      currentIdx += r.coords.length;
    });

    if (bestEdge) {
      const ptIdx = addNode(bestP);
      adj[pIdx].push({ node: ptIdx, weight: minD });
      adj[ptIdx].push({ node: pIdx, weight: minD });

      const d1 = lngLatDist(bestP, nodes[bestEdge.u]);
      adj[ptIdx].push({ node: bestEdge.u, weight: d1 });
      adj[bestEdge.u].push({ node: ptIdx, weight: d1 });

      const d2 = lngLatDist(bestP, nodes[bestEdge.v]);
      adj[ptIdx].push({ node: bestEdge.v, weight: d2 });
      adj[bestEdge.v].push({ node: ptIdx, weight: d2 });
    }
  };

  snapToRoutes(0);
  snapToRoutes(1);

  // Dijkstra's algorithm
  const dist = Array(nodes.length).fill(Infinity);
  const prev = Array(nodes.length).fill(-1);
  dist[0] = 0;

  const unvisited = new Set(nodes.map((_, i) => i));

  while (unvisited.size > 0) {
    let u = -1, minDist = Infinity;
    for (const v of unvisited) {
      if (dist[v] < minDist) { minDist = dist[v]; u = v; }
    }
    if (u === -1 || u === 1 || minDist === Infinity) break;
    unvisited.delete(u);

    for (const neighbor of adj[u]) {
      if (!unvisited.has(neighbor.node)) continue;
      const alt = dist[u] + neighbor.weight;
      if (alt < dist[neighbor.node]) {
        dist[neighbor.node] = alt;
        prev[neighbor.node] = u;
      }
    }
  }

  const path = [];
  let curr = 1;
  if (prev[curr] !== -1 || curr === 0) {
    while (curr !== -1) {
      path.unshift(nodes[curr]);
      curr = prev[curr];
    }
  } else {
    return [startPt, targetPt];
  }

  return path;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts, remove }) {
  const icons = { success: <CheckCircle size={16} />, error: <X size={16} />, warning: <AlertTriangle size={16} />, info: <Info size={16} /> };
  const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: `rgba(${t.type === 'success' ? '16,185,129' : t.type === 'error' ? '239,68,68' : t.type === 'warning' ? '245,158,11' : '59,130,246'},0.15)`,
          border: `1px solid ${colors[t.type]}44`, borderRadius: 12,
          backdropFilter: 'blur(12px)', color: '#fff', fontSize: 13, maxWidth: 320,
          animation: 'slideToast 0.3s ease-out', boxShadow: `0 4px 24px rgba(0,0,0,0.4)`
        }}>
          <span style={{ color: colors[t.type], flexShrink: 0 }}>{icons[t.type]}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 0 }}><X size={12} /></button>
        </div>
      ))}
    </div>
  );
}

const downloadData = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

let toastId = 0;
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = 'info') => {
    const id = ++toastId;
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  const remove = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, add, remove };
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(135deg,#0f172a,#1e293b)',
        border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: 20,
        padding: '28px 28px 24px', minWidth: 340, maxWidth: 460, width: '90vw',
        boxShadow: '0 0 60px rgba(16,185,129,0.15), 0 24px 60px rgba(0,0,0,0.7)',
        animation: 'scaleIn 0.25s ease-out'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: '#10b981', fontSize: 16, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: '#9ca3af' }}><X size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const iStyle = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none' };
const lStyle = { display: 'block', color: '#9ca3af', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 };
const btnBase = { flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' };

// ─── Parking Area Modal ───────────────────────────────────────────────────────
function ParkingModal({ onConfirm, onCancel, gates }) {
  const [name, setName] = useState('');
  const [slots, setSlots] = useState('50');
  const [entryGate, setEntryGate] = useState('');
  const [exitGate, setExitGate] = useState('');
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <ModalShell title="🅿️ Name This Parking Area" onClose={onCancel}>
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onConfirm({ name: name.trim(), totalSlots: parseInt(slots) || 50, entryGate, exitGate }); }}>
        <div style={{ marginBottom: 14 }}>
          <label style={lStyle}>Parking Area Name</label>
          <input ref={ref} style={iStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Block-A Parking" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lStyle}>Total Slots</label>
          <input style={iStyle} type="number" min={1} value={slots} onChange={e => setSlots(e.target.value)} placeholder="50" />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          <div style={{ flex: 1 }}>
            <label style={lStyle}>Entry Gate</label>
            <select style={{ ...iStyle, appearance: 'menulist' }} value={entryGate} onChange={e => setEntryGate(e.target.value)}>
              <option value="">Select...</option>
              {gates.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lStyle}>Exit Gate</label>
            <select style={{ ...iStyle, appearance: 'menulist' }} value={exitGate} onChange={e => setExitGate(e.target.value)}>
              <option value="">Select...</option>
              {gates.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onCancel} style={{ ...btnBase, background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>Cancel</button>
          <button type="submit" style={{ ...btnBase, background: '#10b981', color: '#000' }}>Save Area →</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Update Occupancy Modal ──────────────────────────────────────────────────
function UpdateOccupancyModal({ area, onConfirm, onCancel }) {
  const [occupied, setOccupied] = useState(area.occupied.toString());
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <ModalShell title={`🔢 Update Slots: ${area.name}`} onClose={onCancel}>
      <div style={{ marginBottom: 14 }}>
        <label style={lStyle}>Total Configured Slots: {area.total}</label>
      </div>
      <div style={{ marginBottom: 22 }}>
        <label style={lStyle}>Currently Occupied</label>
        <input ref={ref} style={iStyle} type="number" min={0} max={area.total} value={occupied} onChange={e => setOccupied(e.target.value)}
          placeholder={`e.g. ${Math.min(30, area.total)}`} onKeyDown={e => { if (e.key === 'Enter') onConfirm(parseInt(occupied) || 0); }} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onCancel} style={{ ...btnBase, background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>Cancel</button>
        <button type="button" onClick={() => onConfirm(parseInt(occupied) || 0)} style={{ ...btnBase, background: '#10b981', color: '#000' }}>Save Occupancy →</button>
      </div>
    </ModalShell>
  );
}

// ─── Route Modal ─────────────────────────────────────────────────────────────
function RouteModal({ onConfirm, onCancel }) {
  const [name, setName] = useState('');
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <ModalShell title="🛣️ Name This Route" onClose={onCancel}>
      <div style={{ marginBottom: 22 }}>
        <label style={lStyle}>Route Name</label>
        <input ref={ref} style={iStyle} value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Main Road" onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()); }} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ ...btnBase, background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>Cancel</button>
        <button onClick={() => { if (name.trim()) onConfirm(name.trim()); }} style={{ ...btnBase, background: '#3b82f6', color: '#fff' }}>Save Route →</button>
      </div>
    </ModalShell>
  );
}

// ─── Gate Modal ───────────────────────────────────────────────────────────────
function GateModal({ onConfirm, onCancel }) {
  const [name, setName] = useState('');
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <ModalShell title="🚪 Name This Gate" onClose={onCancel}>
      <div style={{ marginBottom: 22 }}>
        <label style={lStyle}>Gate Name</label>
        <input ref={ref} style={iStyle} value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Main Gate" onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()); }} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ ...btnBase, background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>Cancel</button>
        <button onClick={() => { if (name.trim()) onConfirm(name.trim()); }} style={{ ...btnBase, background: '#10b981', color: '#000' }}>Place Gate →</button>
      </div>
    </ModalShell>
  );
}

// ─── Toolbar Button ───────────────────────────────────────────────────────────
function TBtn({ icon, label, active, onClick, color = '#3b82f6' }) {
  return (
    <button onClick={onClick} title={label} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 16, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
      background: active ? color : 'rgba(255,255,255,0.07)',
      color: active ? '#fff' : '#94a3b8',
      fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1,
      boxShadow: active ? `0 0 20px ${color}44` : 'none'
    }}>
      {icon} <span>{label}</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CampusMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const gateMarkersRef = useRef({});
  const userMarkerRef = useRef(null);
  const pendingDrawType = useRef(null);
  const fileInputRef = useRef(null);

  const { toasts, add: toast, remove: removeToast } = useToast();

  // ── Data State ────────────────────────────────────────────────────────────
  const [parkingAreas, setParkingAreas] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [gates, setGates] = useState([]);

  useEffect(() => {
    fetch('/mapData.json')
      .then(r => r.json())
      .then(data => {
        if (data.parkingAreas) setParkingAreas(data.parkingAreas);
        if (data.routes) setRoutes(data.routes);
        if (data.gates) setGates(data.gates);
      })
      .catch(err => console.error("Could not load initial map data", err));
  }, []);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTool, setActiveTool] = useState('select');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [navTarget, setNavTarget] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [navInfo, setNavInfo] = useState({ dist: 0, durationSeconds: 0, direction: 'STRAIGHT' });
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());
  const [userLocation, setUserLocation] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Google Maps-style Search State ───────────────────────────────────────
  const [gmSearch, setGmSearch] = useState({ fromText: 'Your Location', toText: '', toArea: null, showDropdown: false, showFromDropdown: false, travelMode: 'driving' });
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [navSteps, setNavSteps] = useState([]);
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  const fromGeoTimerRef = useRef(null);

  // ── Hybrid Navigation State ───────────────────────────────────────────────
  // navPhase: null | 'outside' (Mapbox Directions) | 'inside' (custom drawn routes)
  const [navPhase, setNavPhase] = useState(null);
  // Added state manager requested by product flow.
  const [navigationState, setNavigationState] = useState(null);
  // officialRoute: the GeoJSON coords returned from Mapbox Directions API
  const [officialRoute, setOfficialRoute] = useState(null);
  // officialAlternatives: summary of Mapbox alternative routes (outside campus)
  const [officialAlternatives, setOfficialAlternatives] = useState([]);
  // proximity watch interval ref (polls every 5s for phase transition)
  const proximityWatchRef = useRef(null);

  // Modals
  const [modal, setModal] = useState(null); // { type: 'parking'|'route'|'gate', feature?, lngLat? }

  useEffect(() => {
    if (navPhase === 'outside') setNavigationState(NAVIGATION_STATE.EXTERNAL_NAVIGATION);
    else if (navPhase === 'inside') setNavigationState(NAVIGATION_STATE.INTERNAL_NAVIGATION);
    else if (navPhase === 'both') setNavigationState(NAVIGATION_STATE.HYBRID_NAVIGATION);
    else setNavigationState(null);
  }, [navPhase]);

  // ── Event Listeners for Map Popups ─────────────────────────────────────────
  const parkingAreasRef = useRef(parkingAreas);
  useEffect(() => { parkingAreasRef.current = parkingAreas; }, [parkingAreas]);

  const handleParkingNavClickRef = useRef(null);

  useEffect(() => {
    const handleUpdate = (e) => {
      const area = parkingAreasRef.current.find(p => p.id === e.detail);
      if (area) setModal({ type: 'update-occupancy', area });
    };
    const handleNavClick = (e) => {
      const area = parkingAreasRef.current.find(p => p.id === e.detail);
      if (area && handleParkingNavClickRef.current) handleParkingNavClickRef.current(area);
    };

    window.addEventListener('update-parking', handleUpdate);
    window.addEventListener('navigate-parking', handleNavClick);
    return () => {
      window.removeEventListener('update-parking', handleUpdate);
      window.removeEventListener('navigate-parking', handleNavClick);
    };
  }, []);

  // ── Init Map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!TOKEN || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 30,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right');

    // Draw plugin - custom styles
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      modes: {
        ...MapboxDraw.modes,
        draw_rectangle: DrawRectangle
      },
      styles: [
        { id: 'gl-draw-polygon-fill-inactive', type: 'fill', filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'fill-color': '#10b981', 'fill-outline-color': '#10b981', 'fill-opacity': 0.25 } },
        { id: 'gl-draw-polygon-fill-active', type: 'fill', filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']], paint: { 'fill-color': '#10b981', 'fill-outline-color': '#10b981', 'fill-opacity': 0.35 } },
        { id: 'gl-draw-polygon-stroke-inactive', type: 'line', filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'line-color': '#10b981', 'line-width': 2.5 } },
        { id: 'gl-draw-polygon-stroke-active', type: 'line', filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']], paint: { 'line-color': '#10b981', 'line-width': 3 } },
        { id: 'gl-draw-polygon-midpoint', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']], paint: { 'circle-radius': 4, 'circle-color': '#10b981' } },
        { id: 'gl-draw-polygon-and-line-vertex-stroke-inactive', type: 'circle', filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']], paint: { 'circle-radius': 7, 'circle-color': '#fff' } },
        { id: 'gl-draw-polygon-and-line-vertex-inactive', type: 'circle', filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']], paint: { 'circle-radius': 5, 'circle-color': '#10b981' } },
        { id: 'gl-draw-line-inactive', type: 'line', filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString'], ['!=', 'mode', 'static']], paint: { 'line-color': '#3b82f6', 'line-width': 12, 'line-opacity': 0.7 } },
        { id: 'gl-draw-line-active', type: 'line', filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'LineString']], paint: { 'line-color': '#fbbf24', 'line-width': 14, 'line-opacity': 0.9 } },
        { id: 'gl-draw-point-point-inactive', type: 'circle', filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']], paint: { 'circle-radius': 8, 'circle-color': '#10b981', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } },
        { id: 'gl-draw-point-point-active', type: 'circle', filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Point'], ['==', 'meta', 'feature']], paint: { 'circle-radius': 10, 'circle-color': '#10b981', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } },
      ]
    });

    map.addControl(draw, 'top-right');
    drawRef.current = draw;

    map.on('load', () => {
      mapRef.current = map;
      renderAllLayers(map);
    });

    // When user finishes drawing
    map.on('draw.create', e => {
      const feature = e.features[0];
      const type = pendingDrawType.current;
      if (!feature || !type) return;
      pendingDrawType.current = null;

      if (type === 'parking' && feature.geometry.type === 'Polygon') {
        setModal({ type: 'parking', feature });

      } else if (type === 'route' && feature.geometry.type === 'LineString') {
        setModal({ type: 'route', feature });

      }
      // Remove from draw manager after saving to our state
    });

    map.on('draw.update', e => {
      // Allow live editing of shapes by updating state when active
      if (!isEditMode) return;
      e.features.forEach(f => {
        if (f.geometry.type === 'LineString') {
          setRoutes(prev => prev.map(r => r.id === f.id ? { ...r, coords: f.geometry.coordinates } : r));
        } else if (f.geometry.type === 'Polygon') {
          setParkingAreas(prev => prev.map(p => p.id === f.id ? { ...p, coords: f.geometry.coordinates } : p));
        }
      });
    });

    // Click on map for gate placement or entry point
    map.on('click', e => {
      if (pendingDrawType.current === 'gate') {
        const { lng, lat } = e.lngLat;
        setModal({ type: 'gate', lngLat: { lng, lat } });
        pendingDrawType.current = null;
        mapContainer.current.style.cursor = '';
      } else if (pendingDrawType.current && pendingDrawType.current.startsWith('entry-point-')) {
        const parkingId = pendingDrawType.current.replace('entry-point-', '');
        const { lng, lat } = e.lngLat;
        setParkingAreas(prev => prev.map(p => p.id === parkingId ? { ...p, entryPoint: { lng, lat } } : p));
        pendingDrawType.current = null;
        mapContainer.current.style.cursor = '';
        setActiveTool('select');
        toast('Parking entry point set!', 'success');
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, []);

  // ── Helper: clip a polygon to a percentage (left-to-right fill) ──────────
  const clipPolygonToPercent = useCallback((coords, pct) => {
    try {
      const polygon = turf.polygon(coords);
      const bbox = turf.bbox(polygon);
      const [minX, minY, maxX, maxY] = bbox;
      const fillX = minX + (maxX - minX) * Math.min(Math.max(pct, 0), 1);

      // Create clip rectangle covering the filled portion (left side)
      const pad = 0.0001;
      const clipRect = turf.polygon([[
        [minX - pad, minY - pad],
        [fillX, minY - pad],
        [fillX, maxY + pad],
        [minX - pad, maxY + pad],
        [minX - pad, minY - pad]
      ]]);

      const clipped = turf.intersect(turf.featureCollection([polygon, clipRect]));
      return clipped ? clipped.geometry.coordinates : null;
    } catch (e) {
      return null;
    }
  }, []);

  // ── Render all layers whenever data changes ───────────────────────────────
  const renderAllLayers = useCallback((m) => {
    const map = m || mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // =============================================
    // 1. ROUTES FIRST (bottom z-layer) — Premium Road Presentation
    // =============================================
    const routeGeoJSON = {
      type: 'FeatureCollection',
      features: routes.map(r => ({
        type: 'Feature', id: r.id,
        properties: { id: r.id, name: r.name },
        geometry: { type: 'LineString', coordinates: r.coords }
      }))
    };

    // Generate arrow point features along routes for directional indicators
    const arrowFeatures = [];
    routes.forEach(r => {
      if (r.coords.length < 2) return;
      for (let i = 0; i < r.coords.length - 1; i++) {
        const a = r.coords[i], b = r.coords[i + 1];
        const midLng = (a[0] + b[0]) / 2;
        const midLat = (a[1] + b[1]) / 2;
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * (180 / Math.PI);
        arrowFeatures.push({
          type: 'Feature',
          properties: { bearing: 90 - angle },
          geometry: { type: 'Point', coordinates: [midLng, midLat] }
        });
      }
    });
    const arrowGeoJSON = { type: 'FeatureCollection', features: arrowFeatures };

    if (map.getSource('routes-src')) {
      map.getSource('routes-src').setData(routeGeoJSON);
    } else {
      map.addSource('routes-src', { type: 'geojson', data: routeGeoJSON });
      // Road outer shadow (gives the road depth)
      map.addLayer({
        id: 'routes-shadow', type: 'line', source: 'routes-src',
        paint: { 'line-color': '#000000', 'line-width': 28, 'line-blur': 6, 'line-opacity': 0.4 },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
      // Road surface (dark asphalt)
      map.addLayer({
        id: 'routes-bg', type: 'line', source: 'routes-src',
        paint: { 'line-color': '#1a2535', 'line-width': 22, 'line-blur': 0, 'line-opacity': 0.95 },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
      // Road edge lines (curb indicator)
      map.addLayer({
        id: 'routes-edge', type: 'line', source: 'routes-src',
        paint: { 'line-color': '#334155', 'line-width': 24, 'line-blur': 0, 'line-opacity': 0.6, 'line-gap-width': 0 },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
      // Subtle neon glow along road
      map.addLayer({
        id: 'routes-glow', type: 'line', source: 'routes-src',
        paint: { 'line-color': '#14b8a6', 'line-width': 18, 'line-blur': 12, 'line-opacity': 0.18 },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
      // Center lane dashes (white lane markings)
      map.addLayer({
        id: 'routes-lane', type: 'line', source: 'routes-src',
        paint: { 'line-color': '#475569', 'line-width': 1.5, 'line-dasharray': [4, 6], 'line-opacity': 0.6 },
        layout: { 'line-cap': 'butt', 'line-join': 'round' }
      });
      // Bright accent line on top (subtle teal highlight)
      map.addLayer({
        id: 'routes-line', type: 'line', source: 'routes-src',
        paint: { 'line-color': '#2dd4bf', 'line-width': 2, 'line-dasharray': [1, 4], 'line-opacity': 0.35 },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
      // Route name labels
      map.addLayer({
        id: 'routes-label', type: 'symbol', source: 'routes-src',
        layout: {
          'text-field': ['get', 'name'], 'text-size': 11,
          'symbol-placement': 'line', 'text-offset': [0, -1.6],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-allow-overlap': false, 'text-ignore-placement': false
        },
        paint: { 'text-color': '#a5f3fc', 'text-halo-color': '#0f172a', 'text-halo-width': 2.5 }
      });
    }

    // Directional arrows along routes
    if (map.getSource('routes-arrows-src')) {
      map.getSource('routes-arrows-src').setData(arrowGeoJSON);
    } else {
      map.addSource('routes-arrows-src', { type: 'geojson', data: arrowGeoJSON });
      map.addLayer({
        id: 'routes-arrows', type: 'symbol', source: 'routes-arrows-src',
        layout: {
          'text-field': '▸',
          'text-size': 18,
          'text-rotate': ['get', 'bearing'],
          'text-rotation-alignment': 'map',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold']
        },
        paint: { 'text-color': '#14b8a6', 'text-opacity': 0.5 }
      });
    }

    // =============================================
    // 2. PARKING AREAS ON TOP (above routes)
    // =============================================
    const parkingGeoJSON = {
      type: 'FeatureCollection',
      features: parkingAreas.map(z => ({
        type: 'Feature', id: z.id,
        properties: {
          id: z.id, name: z.name,
          color: statusColor(z.occupied, z.total),
          borderColor: statusColor(z.occupied, z.total),
          occupied: z.occupied, total: z.total,
          pct: z.total ? Math.round(z.occupied / z.total * 100) : 0
        },
        geometry: { type: 'Polygon', coordinates: z.coords }
      }))
    };

    const filledFeatures = parkingAreas.map(z => {
      const pct = z.total ? z.occupied / z.total : 0;
      if (pct <= 0) return null;
      const clippedCoords = clipPolygonToPercent(z.coords, pct);
      if (!clippedCoords) return null;
      return {
        type: 'Feature',
        properties: { color: statusColor(z.occupied, z.total) },
        geometry: { type: 'Polygon', coordinates: clippedCoords }
      };
    }).filter(Boolean);
    const filledGeoJSON = { type: 'FeatureCollection', features: filledFeatures };

    if (map.getSource('parking-src')) {
      map.getSource('parking-src').setData(parkingGeoJSON);
    } else {
      map.addSource('parking-src', { type: 'geojson', data: parkingGeoJSON });
      map.addLayer({
        id: 'parking-bg', type: 'fill', source: 'parking-src',
        paint: { 'fill-color': '#1a2332', 'fill-opacity': 0.85 }
      });
      map.addLayer({
        id: 'parking-border', type: 'line', source: 'parking-src',
        paint: { 'line-color': ['get', 'borderColor'], 'line-width': 2.5, 'line-opacity': 0.8 }
      });

      map.on('click', 'parking-bg', e => {
        if (!e.features?.[0]) return;
        const p = e.features[0].properties;
        new mapboxgl.Popup({ closeButton: false, className: 'park-popup' })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="color:#000;padding:6px 8px;font-family:sans-serif;min-width:140px;">
            <b style="font-size:14px">${p.name}</b><br/>
            <div style="margin:4px 0;">${p.occupied} / ${p.total} occupied — <b>${p.pct}% full</b></div>
            <button onclick="window.dispatchEvent(new CustomEvent('update-parking', {detail: '${p.id}'}))" 
              style="margin-top:6px; width:100%; padding:6px; font-size:12px; cursor:pointer; background:#10b981; border:none; border-radius:6px; color:#fff; font-weight:bold;">
              Update Slots
            </button>
            <button onclick="window.dispatchEvent(new CustomEvent('navigate-parking', {detail: '${p.id}'}))" 
              style="margin-top:4px; width:100%; padding:6px; font-size:12px; cursor:pointer; background:#f59e0b; border:none; border-radius:6px; color:#000; font-weight:bold;">
              Navigate Here
            </button>
          </div>`)
          .addTo(map);
      });
    }

    if (map.getSource('parking-fill-src')) {
      map.getSource('parking-fill-src').setData(filledGeoJSON);
    } else {
      map.addSource('parking-fill-src', { type: 'geojson', data: filledGeoJSON });
      map.addLayer({
        id: 'parking-fill-level', type: 'fill', source: 'parking-fill-src',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.75 }
      });
    }

    if (!map.getSource('parking-label-src')) {
      map.addSource('parking-label-src', { type: 'geojson', data: parkingGeoJSON });
      map.addLayer({
        id: 'parking-label', type: 'symbol', source: 'parking-label-src',
        layout: {
          'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'pct']], '%'],
          'text-size': 11, 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-transform': 'uppercase', 'text-letter-spacing': 0.05,
          'text-line-height': 1.4, 'text-anchor': 'center', 'text-allow-overlap': true
        },
        paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 2.5 }
      });
    } else {
      map.getSource('parking-label-src').setData(parkingGeoJSON);
    }

    // ── Parking Entry Points ───────────────────────────────────────────────
    const pointsGeoJSON = {
      type: 'FeatureCollection',
      features: parkingAreas.filter(p => p.entryPoint).map(p => ({
        type: 'Feature', id: `ep-${p.id}`, properties: {},
        geometry: { type: 'Point', coordinates: [p.entryPoint.lng, p.entryPoint.lat] }
      }))
    };
    if (map.getSource('pts-src')) {
      map.getSource('pts-src').setData(pointsGeoJSON);
    } else {
      map.addSource('pts-src', { type: 'geojson', data: pointsGeoJSON });
      map.addLayer({
        id: 'pts-layer', type: 'circle', source: 'pts-src',
        paint: { 'circle-radius': 6, 'circle-color': '#f59e0b', 'circle-stroke-width': 2, 'circle-stroke-color': '#000' }
      });
    }

  }, [parkingAreas, routes, clipPolygonToPercent]);

  // Re-render layers when data changes
  useEffect(() => {
    if (mapRef.current?.isStyleLoaded()) renderAllLayers();
    // Synchronize mapbox-gl-draw items if edit mode is active
    if (isEditMode && drawRef.current) {
      // We only add features that don't exist yet to prevent overwriting during drag/edit
      const draw = drawRef.current;
      const currentIds = new Set(draw.getAll().features.map(f => f.id));

      parkingAreas.forEach(p => {
        if (!currentIds.has(p.id)) {
          draw.add({ id: p.id, type: 'Feature', geometry: { type: 'Polygon', coordinates: p.coords } });
        }
      });
      routes.forEach(r => {
        if (!currentIds.has(r.id)) {
          draw.add({ id: r.id, type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords } });
        }
      });
    } else if (!isEditMode && drawRef.current) {
      drawRef.current.deleteAll();
    }
  }, [parkingAreas, routes, renderAllLayers, isEditMode]);

  // ── Gate Markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    Object.values(gateMarkersRef.current).forEach(m => m.remove());
    gateMarkersRef.current = {};

    gates.forEach(g => {
      const isSelected = selectedEntry?.id === g.id;
      const el = document.createElement('div');
      el.className = 'gate-dot';
      el.style.cssText = `
        width:${isSelected ? 22 : 16}px; height:${isSelected ? 22 : 16}px;
        border-radius:50%; cursor:pointer;
        background:${isSelected ? '#3b82f6' : '#0f172a'};
        border:3px solid ${isSelected ? '#93c5fd' : '#3b82f6'};
        box-shadow: 0 0 0 0 rgba(59,130,246,0.7);
        animation: gatePulse 2s infinite;
        transition: all 0.3s;
      `;

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false, className: 'gate-popup' })
        .setHTML(`<div style="color:#000;padding:4px 8px;font-size:12px;font-weight:700">${g.name} — Entry Gate</div>`);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([g.lng, g.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', e => {
        e.stopPropagation();
        if (!isEditMode) handleGateClick(g);
      });

      gateMarkersRef.current[g.id] = marker;
    });
  }, [gates, selectedEntry, isEditMode]);

  // ══════════════════════════════════════════════════════════════════════════
  // ── HYBRID NAVIGATION HELPERS ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * detectMainEntrance — returns the gate whose name contains "Main" (case-insensitive)
   * or the first gate if no such gate exists. Returns null when no gates are defined.
   */
  const detectMainEntrance = useCallback((gateList) => {
    if (!gateList || gateList.length === 0) return null;
    const main = gateList.find(g => /main/i.test(g.name));
    return main || gateList[0];
  }, []);

  /**
   * removeOfficialRouteLayers — removes Mapbox Directions route layers + sources
   * from the map in a null-safe, order-safe manner.
   */
  const removeOfficialRouteLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    ['official-route-glow', 'official-route-line'].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource('official-route-src')) map.removeSource('official-route-src');
  }, []);

  /**
   * startCustomNavigation — Phase 2 hand-off.
   * Hides the official road route, then runs the existing custom route logic
   * (findShortestDrawnPath) from the nearest gate to the best parking area.
   *
   * KEY FIX: Raw GPS coordinates often don't snap onto drawn campus routes,
   * causing Dijkstra to fall back to a straight aerial line. To prevent this,
   * we always start routing from the nearest gate's coordinates — gates are
   * placed on the drawn route network and are guaranteed to snap cleanly.
   * The user's live blue dot still shows their actual GPS position.
   */
  const startCustomNavigation = useCallback(
    (userLng, userLat, currentGates, currentRoutes, currentParking, overrideEntry = null, overrideParking = null, keepExternalRoute = false) => {
    if (!keepExternalRoute) removeOfficialRouteLayers();
    setNavPhase(keepExternalRoute ? 'both' : 'inside');

    // ── Determine routing origin ──────────────────────────────────────────────
    // Prefer nearest gate as start (it's on the drawn route graph).
    // Fall back to raw GPS only when no gates are defined at all.
    let startPt = [userLng, userLat];
    let nearestGate = null;

    if (overrideEntry) {
      nearestGate = overrideEntry;
    }

    if (!overrideEntry && currentGates.length > 0) {
      nearestGate = currentGates.reduce((best, g) => {
        const d = lngLatDist([userLng, userLat], [g.lng, g.lat]);
        return d < best.dist ? { gate: g, dist: d } : best;
      }, { gate: null, dist: Infinity }).gate;
    }

    if (nearestGate) {
      startPt = [nearestGate.lng, nearestGate.lat];
      // Highlight the chosen entry gate in the sidebar so user knows their start
      setSelectedEntry(nearestGate);
    }

    // ── Rank all parking areas by score (occupancy + route distance) ──────────
    const ranked = currentParking.map(z => {
      let center = centroidOfPolygon(z.coords);
      if (z.entryPoint) center = [z.entryPoint.lng, z.entryPoint.lat];
      else if (z.entryGate) {
        const eg = currentGates.find(g => g.id === z.entryGate);
        if (eg) center = [eg.lng, eg.lat];
      }
      const path = findShortestDrawnPath(startPt, center, currentRoutes);
      let dist = 0;
      for (let i = 0; i < path.length - 1; i++) dist += lngLatDist(path[i], path[i + 1]);
      const score = (z.occupied / (z.total || 1)) * 1000 + dist / 10;
      return { ...z, score, dist: Math.round(dist) };
    }).sort((a, b) => a.score - b.score);

    if (ranked.length > 0) {
      const best = ranked[0];
      const finalTarget = overrideParking
        ? (ranked.find(z => z.id === overrideParking.id) || best)
        : best;

      const baseTop = ranked.slice(0, 3);
      const recommendationsTop = baseTop.some(z => z.id === finalTarget.id)
        ? baseTop
        : [finalTarget, ...ranked.filter(z => z.id !== finalTarget.id)].slice(0, 3);

      setRecommendations(recommendationsTop);
      setNavTarget(finalTarget);

      // Build inside step-by-step (from drawn campus paths) so the directions panel
      // always works for "location -> parking" navigation.
      try {
        let center = centroidOfPolygon(finalTarget.coords);
        if (finalTarget.entryPoint) center = [finalTarget.entryPoint.lng, finalTarget.entryPoint.lat];
        else if (finalTarget.entryGate) {
          const eg = currentGates.find(g => g.id === finalTarget.entryGate);
          if (eg) center = [eg.lng, eg.lat];
        }

        const path = findShortestDrawnPath(startPt, center, currentRoutes);
        if (path && path.length > 1) {
          const steps = [];
          let accumulated = 0;

          for (let i = 0; i < path.length - 1; i++) {
            const segDist = Math.round(lngLatDist(path[i], path[i + 1]));
            accumulated += segDist;

            let bearing = 0;
            if (i > 0) {
              const v1x = path[i][0] - path[i - 1][0];
              const v1y = path[i][1] - path[i - 1][1];
              const v2x = path[i + 1][0] - path[i][0];
              const v2y = path[i + 1][1] - path[i][1];
              const cross = v1x * v2y - v1y * v2x;
              const dot = v1x * v2x + v1y * v2y;
              bearing = Math.atan2(cross, dot) * (180 / Math.PI);
            }

            let turn = 'Continue straight';
            if (i === 0) turn = 'Start heading to destination';
            else if (bearing > 20) turn = 'Turn left';
            else if (bearing < -20) turn = 'Turn right';

            if (i === 0 || Math.abs(bearing) > 20 || i === path.length - 2) {
              steps.push({
                instruction: i === path.length - 2 ? `Arrive at ${finalTarget.name}` : turn,
                dist: accumulated
              });
              accumulated = 0;
            }
          }

          if (steps.length === 0) {
            steps.push({
              instruction: `Head to ${finalTarget.name}`,
              dist: Math.round(lngLatDist(startPt, center))
            });
          }

          setNavSteps(steps);
          setDirectionsOpen(true);
          setNavInfo({ dist: Math.round(finalTarget.dist || 0), durationSeconds: 0, direction: 'STRAIGHT' });
        }
      } catch (e) {
        console.warn('[HybridNav] Could not build inside steps:', e);
      }
    }

    const gateName = nearestGate ? nearestGate.name : 'campus entry';
    toast(`🏫 Campus navigation from ${gateName}`, 'success');
  }, [removeOfficialRouteLayers, toast]);

  /**
   * getOfficialRouteToEntrance — Phase 1.
   * Calls Mapbox Directions API (driving) from user location to target gate.
   * On success, draws the blue glow + line layers and stores coords in state.
   * On failure, gracefully falls back to custom navigation.
   */
  const getOfficialRouteToEntrance = useCallback(async (userLng, userLat, entranceGate, targetOverride = null) => {
    const coordStr = `${userLng},${userLat};${entranceGate.lng},${entranceGate.lat}`;
    const profile = gmSearch.travelMode === 'walking' ? 'walking' : 'driving-traffic';
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordStr}` +
      `?geometries=geojson&overview=full&alternatives=true&steps=true&language=en&access_token=${TOKEN}`;

    let routeCoords;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.routes || json.routes.length === 0) throw new Error('No routes returned');

      // store alternatives summary (for UI only)
      const routes = json.routes;
      setOfficialAlternatives(
        routes.slice(0, 3).map(r => ({
          distance: r.distance,
          duration: r.duration
        }))
      );

      const best = routes[0];
      routeCoords = best.geometry.coordinates; // [[lng,lat], ...]

      // Build step-by-step from Mapbox so the user gets a full navigation experience
      const mbSteps = best.legs?.[0]?.steps || [];
      const stripHtml = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '') : '');
      const steps = mbSteps.map((s) => ({
        instruction: stripHtml(s?.maneuver?.instruction) || stripHtml(s?.name) || 'Continue',
        dist: Math.round(s?.distance || 0)
      }));
      if (steps.length > 0) setNavSteps(steps);
      setDirectionsOpen(true);

      // Summary values
      setNavInfo({
        dist: Math.round(best.distance || 0),
        durationSeconds: Math.round(best.duration || 0),
        direction: 'STRAIGHT'
      });
    } catch (err) {
      console.warn('[HybridNav] Mapbox Directions failed, falling back to custom nav:', err);
      toast('Road route unavailable, using campus paths directly', 'warning');
      // Fallback: skip Phase 1, jump straight to Phase 2
      startCustomNavigation(userLng, userLat, gates, routes, parkingAreas, entranceGate, targetOverride || navTarget);
      return;
    }

    // ── Draw official Mapbox route (blue glow) ────────────────────────────────
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Remove any stale layers first
    removeOfficialRouteLayers();

    const routeGeoJSON = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: routeCoords }
    };

    map.addSource('official-route-src', { type: 'geojson', data: routeGeoJSON });
    // Outer glow — wide + blurred blue
    map.addLayer({
      id: 'official-route-glow',
      type: 'line',
      source: 'official-route-src',
      paint: {
        'line-color': '#3b82f6',
        'line-width': 20,
        'line-blur': 14,
        'line-opacity': 0.45
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' }
    });
    // Main blue line on top
    map.addLayer({
      id: 'official-route-line',
      type: 'line',
      source: 'official-route-src',
      paint: {
        'line-color': '#60a5fa',
        'line-width': 4,
        'line-opacity': 1
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' }
    });

    setOfficialRoute(routeCoords);
    setNavPhase('outside');

    // ── Also draw Phase 2 (internal campus route) simultaneously ─────────────
    // This gives the full trip visualization: Source → Gate → Parking
    // We use keepExternalRoute=true so the blue Phase 1 road is NOT cleared
    const finalTarget = targetOverride || navTarget;
    if (finalTarget) {
      setTimeout(() => {
        startCustomNavigation(
          entranceGate.lng, entranceGate.lat,
          gates, routes, parkingAreas,
          entranceGate, finalTarget,
          true /* keepExternalRoute — keep the blue road visible */
        );
      }, 200);
    }

    // Fit map to show full combined route (external road + campus area)
    const allLngs = routeCoords.map(c => c[0]);
    const allLats = routeCoords.map(c => c[1]);
    // Also include campus gate coords so map fits both routes
    allLngs.push(entranceGate.lng);
    allLats.push(entranceGate.lat);
    map.fitBounds(
      [[Math.min(...allLngs) - 0.003, Math.min(...allLats) - 0.003],
       [Math.max(...allLngs) + 0.003, Math.max(...allLats) + 0.003]],
      { padding: 80, duration: 1400 }
    );
  }, [TOKEN, toast, startCustomNavigation, removeOfficialRouteLayers, gates, routes, parkingAreas, gmSearch.travelMode, navTarget]);

  const applyUserLocation = useCallback((lng, lat, isLiveGps = true) => {
    setUserLocation({ lng, lat });
    // Keep current target or clear if it's just a general locate
    // Actually the original locateUser clears them, then startCustomNavigation re-sets them
    // So we preserve the original logic of clearing and resetting inside startCustomNavigation
    const currentNavTarget = navTarget;
    const currentSelectedEntry = selectedEntry;

    // Place pulsing blue marker
    if (userMarkerRef.current) userMarkerRef.current.remove();
    const el = document.createElement('div');
    el.style.cssText = [
      'width:22px', 'height:22px', 'border-radius:50%',
      'background:#3b82f6', 'border:3px solid #fff',
      'box-shadow:0 0 0 6px rgba(59,130,246,0.28)',
      'animation:locPulse 1.5s infinite'
    ].join(';');
    userMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);

    // Check proximity to gates
    if (gates.length === 0) {
      toast(isLiveGps ? '📍 Location found! No gates defined — routing on campus paths.' : '📍 Address located! Routing...', 'info');
      startCustomNavigation(lng, lat, gates, routes, parkingAreas, null, currentNavTarget);
      return;
    }

    const minGateDist = Math.min(...gates.map(g => lngLatDist([lng, lat], [g.lng, g.lat])));
    const CAMPUS_THRESHOLD_M = 750;

    if (minGateDist <= CAMPUS_THRESHOLD_M) {
      toast(isLiveGps ? '📍 Location found! You\'re near campus — starting internal navigation…' : '📍 Address located near campus — starting internal nav…', 'success');
      startCustomNavigation(lng, lat, gates, routes, parkingAreas, currentSelectedEntry, currentNavTarget);
    } else {
      const entrance = currentSelectedEntry || detectMainEntrance(gates);
      if (!entrance) {
        toast('No entrance gate found, routing on campus paths…', 'warning');
        startCustomNavigation(lng, lat, gates, routes, parkingAreas, currentSelectedEntry, currentNavTarget);
      } else {
        toast(`🚗 Following real roads to ${entrance.name}…`, 'info');
        getOfficialRouteToEntrance(lng, lat, entrance, currentNavTarget);
      }

      // Proximity polling for automatic Phase 2 switch (only if using Live GPS)
      if (proximityWatchRef.current) clearInterval(proximityWatchRef.current);
      if (isLiveGps && navigator.geolocation) {
        proximityWatchRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(innerPos => {
            const { longitude: iLng, latitude: iLat } = innerPos.coords;
            const nearestGateDist = Math.min(...gates.map(g => lngLatDist([iLng, iLat], [g.lng, g.lat])));
            if (nearestGateDist <= CAMPUS_THRESHOLD_M) {
              clearInterval(proximityWatchRef.current);
              proximityWatchRef.current = null;
              userMarkerRef.current?.setLngLat([iLng, iLat]);
              setUserLocation({ lng: iLng, lat: iLat });
              startCustomNavigation(iLng, iLat, gates, routes, parkingAreas, currentSelectedEntry, currentNavTarget);
            }
          }, () => {});
        }, 5000);
      }
    }
  }, [toast, parkingAreas, gates, routes, detectMainEntrance, getOfficialRouteToEntrance, startCustomNavigation, selectedEntry, navTarget]);

  const locateUser = useCallback(() => {
    if (!navigator.geolocation) { toast('Geolocation not supported', 'warning'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      applyUserLocation(pos.coords.longitude, pos.coords.latitude, true);
    }, () => toast('Could not get location. Please allow location access.', 'error'));
  }, [applyUserLocation, toast]);

  const handleStartNavigation = useCallback(async () => {
    if (!navTarget) return;

    if (!gmSearch.fromText || gmSearch.fromText.trim().toLowerCase() === 'your location') {
      locateUser();
      return;
    }

    try {
      toast('Locating address...', 'info');
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(gmSearch.fromText)}.json?access_token=${TOKEN}&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (!data.features || data.features.length === 0) {
        toast('Address not found. Please try another.', 'error');
        return;
      }
      
      const [lng, lat] = data.features[0].center;
      applyUserLocation(lng, lat, false);
    } catch (err) {
      toast('Error finding address.', 'error');
    }
  }, [navTarget, gmSearch.fromText, locateUser, applyUserLocation, toast]);

  // ── Navigation Route on Map ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    ['nav-glow', 'nav-dash', 'nav-dots', 'nav-target-area-fill', 'nav-target-area-line'].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource('nav-src')) map.removeSource('nav-src');
    if (map.getSource('nav-target-src')) map.removeSource('nav-target-src');

    // External route mode: show only the optimized road route (blue line),
    // and suppress internal campus dashed path rendering.
    if (navPhase === 'outside') return;

    if (!navTarget || (!selectedEntry && !userLocation)) return;

    // Build simple route from start to target
    let startPt = selectedEntry ? [selectedEntry.lng, selectedEntry.lat] : [userLocation.lng, userLocation.lat];

    let targetCenter = centroidOfPolygon(navTarget.coords);
    if (navTarget.entryPoint) {
      targetCenter = [navTarget.entryPoint.lng, navTarget.entryPoint.lat];
    } else if (navTarget.entryGate) {
      const eg = gates.find(g => g.id === navTarget.entryGate);
      if (eg) targetCenter = [eg.lng, eg.lat];
    }

    // Calculate perfect direction using only the drawn premises routes
    const navCoords = findShortestDrawnPath(startPt, targetCenter, routes);

    const navGeoJSON = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: navCoords } };
    const dist = Math.round(navCoords.reduce((acc, pt, i) => i === 0 ? acc : acc + lngLatDist(navCoords[i - 1], pt), 0));
    setNavInfo({ dist, direction: 'STRAIGHT' });

    map.addSource('nav-src', { type: 'geojson', data: navGeoJSON });
    // Yellow/amber glow underneath (blinking)
    map.addLayer({ id: 'nav-glow', type: 'line', source: 'nav-src', paint: { 'line-color': '#fbbf24', 'line-width': 22, 'line-blur': 12, 'line-opacity': 0.4 } });
    // Yellow/amber dotted navigation line
    map.addLayer({
      id: 'nav-dash', type: 'line', source: 'nav-src', paint: {
        'line-color': '#fbbf24',
        'line-width': 5, 'line-opacity': 1,
        'line-dasharray': [0.5, 2]
      }, layout: { 'line-cap': 'round', 'line-join': 'round' }
    });

    // Highlight target parking area (orange/amber contour)
    const targetGeoJSON = {
      type: 'Feature', geometry: { type: 'Polygon', coordinates: navTarget.coords }
    };
    map.addSource('nav-target-src', { type: 'geojson', data: targetGeoJSON });
    map.addLayer({
      id: 'nav-target-area-fill', type: 'fill', source: 'nav-target-src',
      paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.25 }
    });
    map.addLayer({
      id: 'nav-target-area-line', type: 'line', source: 'nav-target-src',
      paint: { 'line-color': '#fbbf24', 'line-width': 4, 'line-opacity': 1 }
    });

    // Fly to fit
    const lngs = navCoords.map(c => c[0]), lats = navCoords.map(c => c[1]);
    map.fitBounds([[Math.min(...lngs) - 0.001, Math.min(...lats) - 0.001], [Math.max(...lngs) + 0.001, Math.max(...lats) + 0.001]], { padding: 80, duration: 1200 });
  }, [selectedEntry, navTarget, routes, navPhase]);

  // Animate nav dash and twinkle glow
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let step = 0;
    const animate = () => {
      step = (step + 1) % 120;
      const pulse = Math.abs(Math.sin(step * 0.1));
      // Yellow glow blink effect
      if (map.getLayer('nav-glow')) {
        map.setPaintProperty('nav-glow', 'line-opacity', 0.15 + 0.45 * pulse);
        map.setPaintProperty('nav-glow', 'line-width', 18 + 12 * Math.sin(step * 0.12));
      }
      // Nav dash blink
      if (map.getLayer('nav-dash')) {
        map.setPaintProperty('nav-dash', 'line-opacity', 0.7 + 0.3 * pulse);
      }
      // Target area blink
      if (map.getLayer('nav-target-area-line')) {
        map.setPaintProperty('nav-target-area-line', 'line-opacity', 0.5 + 0.5 * pulse);
        map.setPaintProperty('nav-target-area-line', 'line-width', 3 + 2 * pulse);
      }
      if (map.getLayer('nav-target-area-fill')) {
        map.setPaintProperty('nav-target-area-fill', 'fill-opacity', 0.1 + 0.2 * pulse);
      }
      reqRef.current = requestAnimationFrame(animate);
    };
    const reqRef = { current: requestAnimationFrame(animate) };
    return () => cancelAnimationFrame(reqRef.current);
  }, []);

  // ── Live occupancy updates ─────────────────────────────────────────────────
  // (Randomization disabled as per user request to allow manual updating)
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date().toLocaleTimeString());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleGateClick = useCallback(gate => {
    setSelectedEntry(gate);
    const ranked = parkingAreas.map(z => {
      let center = centroidOfPolygon(z.coords);
      if (z.entryPoint) center = [z.entryPoint.lng, z.entryPoint.lat];
      else if (z.entryGate) {
        const eg = gates.find(g => g.id === z.entryGate);
        if (eg) center = [eg.lng, eg.lat];
      }
      const path = findShortestDrawnPath([gate.lng, gate.lat], center, routes);
      let dist = 0;
      for (let i = 0; i < path.length - 1; i++) dist += lngLatDist(path[i], path[i + 1]);
      const score = (z.occupied / z.total) * 1000 + dist / 10;
      return { ...z, score, dist: Math.round(dist) };
    }).sort((a, b) => a.score - b.score);
    setRecommendations(ranked.slice(0, 3));
    setNavTarget(ranked[0]);
    toast(`Routing from ${gate.name}`, 'success');
  }, [parkingAreas, toast, gates, routes]);

  // Navigate to a specific parking area (when clicked from sidebar or map popup)
  const handleParkingNavClick = useCallback((area) => {
    // Use selected gate, or default to first gate
    let entry = selectedEntry;
    if (!entry && gates.length > 0) {
      entry = gates[0];
      setSelectedEntry(entry);
    }
    if (!entry && !userLocation) {
      toast('Please select an entrance gate first', 'warning');
      return;
    }
    setNavTarget(area);
    // Build recommendations from all parking areas
    const startPt = entry ? [entry.lng, entry.lat] : [userLocation.lng, userLocation.lat];
    const ranked = parkingAreas.map(z => {
      let center = centroidOfPolygon(z.coords);
      if (z.entryPoint) center = [z.entryPoint.lng, z.entryPoint.lat];
      if (z.entryGate) {
        const eg = gates.find(g => g.id === z.entryGate);
        if (eg) center = [eg.lng, eg.lat];
      }
      const path = findShortestDrawnPath(startPt, center, routes);
      let dist = 0;
      for (let i = 0; i < path.length - 1; i++) dist += lngLatDist(path[i], path[i + 1]);
      const score = (z.occupied / z.total) * 1000 + dist / 10;
      return { ...z, score, dist: Math.round(dist) };
    }).sort((a, b) => a.score - b.score);
    setRecommendations(ranked.slice(0, 5));
    toast(`Navigating to ${area.name}`, 'success');
  }, [selectedEntry, userLocation, gates, parkingAreas, routes, toast]);

  handleParkingNavClickRef.current = handleParkingNavClick;

  const resetNav = () => {
    setSelectedEntry(null);
    setNavTarget(null);
    setRecommendations([]);
    setNavPhase(null);
    setOfficialRoute(null);
    setOfficialAlternatives([]);
    setDirectionsOpen(false);
    setNavSteps([]);
    setGmSearch(s => ({ ...s, toText: '', toArea: null, showDropdown: false, showFromDropdown: false }));
    setFromSuggestions([]);
    // Clear proximity polling
    if (proximityWatchRef.current) {
      clearInterval(proximityWatchRef.current);
      proximityWatchRef.current = null;
    }
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      // Remove custom nav layers
      ['nav-glow', 'nav-dash', 'nav-dots', 'nav-target-area-fill', 'nav-target-area-line'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource('nav-src')) map.removeSource('nav-src');
      if (map.getSource('nav-target-src')) map.removeSource('nav-target-src');
      // Remove official Mapbox route layers
      removeOfficialRouteLayers();
    }
  };

  // ── Google Maps search handlers ───────────────────────────────────────────

  // handleFromInput: debounced Mapbox geocoding for the FROM address field
  const handleFromInput = useCallback((text) => {
    setGmSearch(s => ({ ...s, fromText: text, showFromDropdown: true }));
    if (fromGeoTimerRef.current) clearTimeout(fromGeoTimerRef.current);
    if (!text || text.length < 2) { setFromSuggestions([]); return; }
    if (text.toLowerCase().includes('your') || text.toLowerCase().includes('current')) {
      setFromSuggestions([{ id: '__gps__', place_name: 'Your Current Location (GPS)', center: null }]);
      return;
    }
    fromGeoTimerRef.current = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${TOKEN}&limit=5&types=place,address,locality,neighborhood,poi`;
        const res = await fetch(url);
        const data = await res.json();
        setFromSuggestions(data.features || []);
      } catch { setFromSuggestions([]); }
    }, 350);
  }, [TOKEN]);

  // handleGmSelectDestination: Only sets the parking destination — does NOT start navigation
  const handleGmSelectDestination = useCallback((area) => {
    setGmSearch(s => ({ ...s, toText: area.name, toArea: area, showDropdown: false }));
    toast(`📍 Destination set: ${area.name}. Now click Get Directions.`, 'info');
  }, [toast]);

  const handleGmLocate = useCallback(() => {
    setGmSearch(s => ({ ...s, fromText: 'Your Location', showFromDropdown: false }));
    setFromSuggestions([]);
  }, []);

  // Resolve campus parking navigation endpoint priority:
  // 1) area.entryPoint
  // 2) area.entryGate
  // 3) polygon centroid
  const getParkingNavigationPoint = useCallback((area) => {
    if (!area) return null;
    if (area.entryPoint) return [area.entryPoint.lng, area.entryPoint.lat];
    if (area.entryGate) {
      const gate = gates.find(g => g.id === area.entryGate);
      if (gate) return [gate.lng, gate.lat];
    }
    return centroidOfPolygon(area.coords);
  }, [gates]);

  // Draw a real-world road-following route from source to selected parking entrance.
  // Returns true on success; false lets existing fallback logic continue.
  const getRealRoadRouteToParking = useCallback(async (srcLng, srcLat, destinationArea) => {
    // Optimized road route should end at selected parking entrance/point.
    // Fallback to campus main gate only if destination metadata is missing.
    const target = getParkingNavigationPoint(destinationArea) || MAIN_GATE_COORDS;
    if (!target) return false;

    const profile = gmSearch.travelMode === 'walking' ? 'walking' : 'driving-traffic';
    const coordStr = `${srcLng},${srcLat};${target[0]},${target[1]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordStr}` +
      `?geometries=geojson&overview=full&alternatives=true&steps=true&language=en&access_token=${TOKEN}`;

    let routeCoords = null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.routes || data.routes.length === 0) throw new Error('No routes returned');

      // Explicitly choose the optimized route:
      // 1) minimum duration, 2) minimum distance.
      const sortedRoutes = [...data.routes].sort((a, b) => {
        const durA = Number(a?.duration || Infinity);
        const durB = Number(b?.duration || Infinity);
        if (durA !== durB) return durA - durB;
        return Number(a?.distance || Infinity) - Number(b?.distance || Infinity);
      });

      const best = sortedRoutes[0];
      routeCoords = best.geometry.coordinates;

      setOfficialAlternatives(
        sortedRoutes.slice(0, 3).map(r => ({ distance: r.distance, duration: r.duration }))
      );

      const mbSteps = best.legs?.[0]?.steps || [];
      const stripHtml = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '') : '');
      const steps = mbSteps.map((s) => ({
        instruction: stripHtml(s?.maneuver?.instruction) || stripHtml(s?.name) || 'Continue',
        dist: Math.round(s?.distance || 0)
      }));
      if (steps.length > 0) {
        setNavSteps(steps);
        setDirectionsOpen(true);
      }

      setNavInfo({
        dist: Math.round(best.distance || 0),
        durationSeconds: Math.round(best.duration || 0),
        direction: 'STRAIGHT'
      });
    } catch (err) {
      console.warn('[RoadRoute] Failed to build direct road route:', err);
      return false;
    }

    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !routeCoords) return false;

    removeOfficialRouteLayers();

    const routeGeoJSON = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: routeCoords }
    };
    map.addSource('official-route-src', { type: 'geojson', data: routeGeoJSON });
    map.addLayer({
      id: 'official-route-glow',
      type: 'line',
      source: 'official-route-src',
      paint: {
        'line-color': '#3b82f6',
        'line-width': 20,
        'line-blur': 14,
        'line-opacity': 0.45
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' }
    });
    map.addLayer({
      id: 'official-route-line',
      type: 'line',
      source: 'official-route-src',
      paint: {
        'line-color': '#60a5fa',
        'line-width': 4,
        'line-opacity': 1
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' }
    });

    setOfficialRoute(routeCoords);
    setNavPhase('outside');

    const allLngs = routeCoords.map(c => c[0]);
    const allLats = routeCoords.map(c => c[1]);
    map.fitBounds(
      [[Math.min(...allLngs) - 0.003, Math.min(...allLats) - 0.003],
       [Math.max(...allLngs) + 0.003, Math.max(...allLats) + 0.003]],
      { padding: 80, duration: 1200 }
    );

    return true;
  }, [TOKEN, gmSearch.travelMode, getParkingNavigationPoint, removeOfficialRouteLayers]);

  const clearRoadRoute = useCallback(() => {
    removeOfficialRouteLayers();
    setOfficialRoute(null);
    setOfficialAlternatives([]);
    toast('Road route cleared', 'info');
  }, [removeOfficialRouteLayers, toast]);

  // handleGetDirections: Main orchestrator for full 2-phase navigation
  // Flow: Source (geocoded address or GPS) → Campus Gate (Mapbox road) → Parking (internal Dijkstra)
  const handleGetDirections = useCallback(async () => {
    const destination = gmSearch.toArea;
    if (!destination) {
      toast('Please select a parking destination first', 'warning');
      toInputRef.current?.focus();
      return;
    }

    let srcLng, srcLat;
    const fromText = (gmSearch.fromText || '').trim();
    const isCurrentLocation = !fromText ||
      fromText.toLowerCase() === 'your location' ||
      fromText.toLowerCase() === 'current location' ||
      fromText.toLowerCase().includes('your current');

    if (isCurrentLocation) {
      if (!navigator.geolocation) { toast('Geolocation not supported in this browser', 'warning'); return; }
      toast('📍 Getting your location...', 'info');
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000 }));
        srcLng = pos.coords.longitude;
        srcLat = pos.coords.latitude;
        setGmSearch(s => ({ ...s, fromText: 'Your Location' }));
      } catch {
        toast('Could not get your location. Please allow location access or type an address.', 'error');
        return;
      }
    } else {
      toast('📍 Finding your address...', 'info');
      try {
        const geoUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fromText)}.json?access_token=${TOKEN}&limit=1`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        if (!geoData.features?.length) {
          toast('Source address not found. Try using a more specific address or use GPS.', 'error');
          return;
        }
        [srcLng, srcLat] = geoData.features[0].center;
        setGmSearch(s => ({ ...s, fromText: geoData.features[0].place_name || fromText }));
      } catch {
        toast('Error finding source address.', 'error');
        return;
      }
    }

    // ── Reset previous nav state ──────────────────────────────────────────────
    setNavPhase(null);
    setOfficialRoute(null);
    setOfficialAlternatives([]);

    // ── Place user marker at source point ─────────────────────────────────────
    setUserLocation({ lng: srcLng, lat: srcLat });
    if (userMarkerRef.current) userMarkerRef.current.remove();
    const el = document.createElement('div');
    el.style.cssText = [
      'width:22px', 'height:22px', 'border-radius:50%',
      'background:#3b82f6', 'border:3px solid #fff',
      'box-shadow:0 0 0 6px rgba(59,130,246,0.28)',
      'animation:locPulse 1.5s infinite'
    ].join(';');
    userMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([srcLng, srcLat])
      .addTo(mapRef.current);

    // ── Set selected destination first
    setNavTarget(destination);

    // ── NEW: Try direct real road route from source -> parking entrance
    const directRoadOk = await getRealRoadRouteToParking(srcLng, srcLat, destination);
    if (directRoadOk) {
      toast('🛣️ Real road route ready', 'success');
      return;
    }

    // ── Find the best campus gate ─────────────────────────────────────────────
    const entrance = detectMainEntrance(gates);

    if (!entrance || gates.length === 0) {
      toast('No campus gates defined. Routing directly on campus paths...', 'warning');
      startCustomNavigation(srcLng, srcLat, gates, routes, parkingAreas, null, destination, false);
      return;
    }

    const distToGate = lngLatDist([srcLng, srcLat], [entrance.lng, entrance.lat]);
    const CAMPUS_THRESHOLD_M = 750;
    setSelectedEntry(entrance);

    if (distToGate <= CAMPUS_THRESHOLD_M) {
      // ── User already near campus: Phase 2 only ────────────────────────────
      toast(`📍 You're near ${entrance.name}! Starting campus navigation...`, 'success');
      startCustomNavigation(srcLng, srcLat, gates, routes, parkingAreas, entrance, destination, false);
    } else {
      // ── Full 2-phase: Phase 1 (road to gate) + Phase 2 (campus to parking) ──
      // getOfficialRouteToEntrance will draw the blue road route AND
      // then call startCustomNavigation with keepExternalRoute=true for the yellow campus route
      toast(`🚗 Phase 1: Real road route → ${entrance.name}`, 'info');
      getOfficialRouteToEntrance(srcLng, srcLat, entrance, destination);

      // Proximity polling: auto-switch if user actually travels (GPS only)
      if (isCurrentLocation && navigator.geolocation) {
        if (proximityWatchRef.current) clearInterval(proximityWatchRef.current);
        proximityWatchRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(innerPos => {
            const { longitude: iLng, latitude: iLat } = innerPos.coords;
            const nearestDist = Math.min(...gates.map(g => lngLatDist([iLng, iLat], [g.lng, g.lat])));
            if (nearestDist <= CAMPUS_THRESHOLD_M) {
              clearInterval(proximityWatchRef.current);
              proximityWatchRef.current = null;
              userMarkerRef.current?.setLngLat([iLng, iLat]);
              setUserLocation({ lng: iLng, lat: iLat });
              toast('🏫 Arrived at campus! Switching to internal navigation...', 'success');
              startCustomNavigation(iLng, iLat, gates, routes, parkingAreas, entrance, destination, false);
            }
          }, () => {});
        }, 5000);
      }
    }
  }, [gmSearch, TOKEN, gates, routes, parkingAreas, detectMainEntrance, getOfficialRouteToEntrance, startCustomNavigation, getRealRoadRouteToParking, toast]);

  // ── Tool Activation ────────────────────────────────────────────────────────
  const activateTool = useCallback((tool) => {
    setActiveTool(tool);
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map) return;

    if (tool === 'draw-parking') {
      pendingDrawType.current = 'parking';
      draw.changeMode('draw_polygon');
      toast('Click on map to draw parking area polygon. Double-click to finish.', 'info');
    } else if (tool === 'draw-rect') {
      pendingDrawType.current = 'parking';
      draw.changeMode('draw_rectangle');
      toast('Click first corner, then click opposite corner to draw rectangle parking area.', 'info');
    } else if (tool === 'draw-route') {
      pendingDrawType.current = 'route';
      draw.changeMode('draw_line_string');
      toast('Click on map to draw route. Double-click to finish.', 'info');
    } else if (tool === 'add-gate') {
      pendingDrawType.current = 'gate';
      draw.changeMode('static');
      mapContainer.current.style.cursor = 'crosshair';
      toast('Click on the map to place a gate.', 'info');
    } else {
      pendingDrawType.current = null;
      draw.changeMode('simple_select');
      mapContainer.current.style.cursor = '';
    }
  }, [toast]);

  // ── Transform Parking Areas (expand, flip, rotate) ─────────────────────────
  const transformParking = useCallback((id, transformFn) => {
    setParkingAreas(prev => prev.map(p => {
      if (p.id !== id) return p;
      const newCoords = transformFn(p.coords);
      // Also update in MapboxDraw if edit mode
      if (drawRef.current) {
        try { drawRef.current.delete([id]); } catch(e) {}
        drawRef.current.add({ id, type: 'Feature', geometry: { type: 'Polygon', coordinates: newCoords } });
      }
      return { ...p, coords: newCoords };
    }));
  }, []);

  // ── Modal Confirm Handlers ────────────────────────────────────────────────
  const confirmUpdateOccupancy = useCallback((newOccupied) => {
    if (!modal?.area) return;
    const { area } = modal;
    const validOccupied = Math.min(area.total, Math.max(0, newOccupied));
    setParkingAreas(prev => prev.map(p => p.id === area.id ? { ...p, occupied: validOccupied } : p));
    setModal(null);
    toast(`Updated occupancy for ${area.name} to ${validOccupied}`, 'success');
  }, [modal, toast]);

  const confirmParking = useCallback(({ name, totalSlots, entryGate, exitGate }) => {
    const feature = modal?.feature;
    if (!feature) return;
    const id = feature.id || `pa-${Date.now()}`;
    setParkingAreas(prev => [...prev.filter(p => p.id !== id), { id, name, coords: feature.geometry.coordinates, total: totalSlots, occupied: 0, entryGate, exitGate }]);
    drawRef.current?.add(feature);
    setModal(null);
    setActiveTool('select');
    drawRef.current?.changeMode('simple_select');
    toast(`Parking "${name}" added!`, 'success');
  }, [modal, toast]);

  const confirmRoute = useCallback((name) => {
    const feature = modal?.feature;
    if (!feature) return;
    const id = feature.id || `rt-${Date.now()}`;
    setRoutes(prev => [...prev.filter(r => r.id !== id), { id, name, coords: feature.geometry.coordinates }]);
    drawRef.current?.add(feature);
    setModal(null);
    setActiveTool('select');
    drawRef.current?.changeMode('simple_select');
    toast(`Route "${name}" added!`, 'success');
  }, [modal, toast]);

  const confirmGate = useCallback((name) => {
    const { lng, lat } = modal?.lngLat || {};
    if (!lng) return;
    const id = `g-${Date.now()}`;
    setGates(prev => [...prev, { id, name, lng, lat }]);
    setModal(null);
    setActiveTool('select');
    toast(`Gate "${name}" placed!`, 'success');
  }, [modal, toast]);

  const deleteParking = id => { setParkingAreas(p => p.filter(z => z.id !== id)); drawRef.current?.delete([id]); toast('Parking area deleted', 'warning'); };
  const deleteRoute = id => { setRoutes(p => p.filter(r => r.id !== id)); drawRef.current?.delete([id]); toast('Route deleted', 'warning'); };
  const deleteGate = id => { setGates(p => p.filter(g => g.id !== id)); toast('Gate deleted', 'warning'); };

  const saveMapData = () => {
    const data = { parkingAreas, routes, gates };
    downloadData(data, 'mapData.json');
    toast('Map data downloaded as JSON!', 'success');
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.parkingAreas) setParkingAreas(data.parkingAreas);
        if (data.routes) setRoutes(data.routes);
        if (data.gates) setGates(data.gates);

        if (drawRef.current) {
          drawRef.current.deleteAll();
          if (data.parkingAreas) {
            data.parkingAreas.forEach(p => {
              drawRef.current.add({ id: p.id, type: 'Feature', geometry: { type: 'Polygon', coordinates: p.coords } });
            });
          }
          if (data.routes) {
            data.routes.forEach(r => {
              drawRef.current.add({ id: r.id, type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords } });
            });
          }
        }

        toast('Map data uploaded successfully!', 'success');
      } catch (err) {
        console.error('Error parsing JSON:', err);
        toast('Invalid JSON file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const totals = parkingAreas.reduce((acc, z) => { acc.total += z.total; acc.occ += z.occupied; return acc; }, { total: 0, occ: 0 });
  const pct = totals.total ? Math.round(totals.occ / totals.total * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: '#0a0f1e', color: '#e2e8f0', fontFamily: 'Inter,system-ui,sans-serif', overflow: 'hidden' }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div style={{
        width: sidebarCollapsed ? 0 : (isEditMode ? 300 : 380),
        minWidth: sidebarCollapsed ? 0 : (isEditMode ? 300 : 380),
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: '#0f172a',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        position: 'relative', zIndex: 10
      }}>

        {/* Header */}
        <div style={{ padding: '24px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111827', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ background: isEditMode ? '#f59e0b' : '#3b82f6', borderRadius: 12, padding: 8, display: 'flex' }}>
              {isEditMode ? <Settings2 size={20} /> : <Compass size={20} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, color: isEditMode ? '#fbbf24' : '#60a5fa' }}>
                {isEditMode ? 'Map Editor' : 'Smart GPS'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#10b981', fontWeight: 700, marginTop: 2 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                LIVE · {lastUpdate}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px', scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>

          {!isEditMode ? (
            /* ── GPS Panel ─────────────────────────────────────────────── */
            <div>
              {/* Locate Me */}
              <button onClick={locateUser} style={{ width: '100%', padding: '12px', marginBottom: 16, borderRadius: 14, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <LocateFixed size={15} /> LOCATE MY POSITION
              </button>

              {/* Start Navigation */}
              <button
                onClick={handleGetDirections}
                disabled={!gmSearch.toArea}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginBottom: 16,
                  borderRadius: 14,
                  border: '1px solid rgba(16,185,129,0.35)',
                  background: !gmSearch.toArea ? 'rgba(255,255,255,0.03)' : 'rgba(16,185,129,0.12)',
                  color: !gmSearch.toArea ? '#64748b' : '#34d399',
                  fontWeight: 900,
                  fontSize: 12,
                  cursor: !gmSearch.toArea ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <ArrowRight size={15} /> START NAVIGATION
              </button>

              {/* Global stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>{totals.total - totals.occ}</div>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Free Slots</div>
                </div>
                <div style={{ background: `rgba(${pct > 80 ? '239,68,68' : pct > 60 ? '245,158,11' : '16,185,129'},0.08)`, border: `1px solid rgba(${pct > 80 ? '239,68,68' : pct > 60 ? '245,158,11' : '16,185,129'},0.2)`, borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#10b981' }}>{pct}%</div>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Occupied</div>
                </div>
              </div>

              {/* Gate selector removed from user flow: navigation is now source -> selected destination */}

              {/* Navigation Summary — Phase-aware */}
              {navTarget && (selectedEntry || userLocation || navPhase) && (
                <div style={{ animation: 'slideUp 0.4s ease-out' }}>

                  {/* Phase banner */}
                  {navPhase === 'outside' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12, padding: '8px 12px', marginBottom: 10 }}>
                      <span style={{ fontSize: 14 }}>🚗</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>Phase 1 — Following real roads to campus gate</span>
                    </div>
                  )}
                  {navPhase === 'both' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: '6px 10px' }}>
                        <span style={{ fontSize: 12 }}>🚗</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa' }}>Phase 1: Road route → Gate (blue)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, padding: '6px 10px' }}>
                        <span style={{ fontSize: 12 }}>🏫</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>Phase 2: Campus path → Parking (yellow)</span>
                      </div>
                    </div>
                  )}
                  {navPhase === 'inside' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '8px 12px', marginBottom: 10 }}>
                      <span style={{ fontSize: 14 }}>🏫</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>Phase 2 — Campus internal navigation</span>
                    </div>
                  )}

                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '2px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '20px 18px', marginBottom: 12, boxShadow: '0 0 30px rgba(16,185,129,0.1)' }}>
                    <div style={{ fontSize: 10, color: '#10b981', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                      {navPhase === 'outside' ? 'Heading to Entrance' : 'Now Routing To'}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 16, letterSpacing: -0.5 }}>{navTarget.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <Milestone size={18} style={{ color: '#10b981' }} />
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>~{navInfo.dist}m away</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <ArrowUpCircle size={18} style={{ color: '#3b82f6' }} />
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#94a3b8' }}>
                        {navTarget.total - navTarget.occupied} slots available
                        {navTarget.total > 0 ? ` (${Math.round(navTarget.occupied / navTarget.total * 100)}% full)` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Recommendation list — only shown in Phase 2 (custom nav) */}
                  {navPhase !== 'outside' && recommendations.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Nearby Options</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                        {recommendations.map((z, i) => (
                          <button key={z.id} onClick={() => setNavTarget(z)} style={{
                            padding: '12px 14px', borderRadius: 14, border: `1px solid ${navTarget?.id === z.id ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.07)'}`,
                            background: navTarget?.id === z.id ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                            color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, transition: 'all 0.2s'
                          }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(z.occupied, z.total), display: 'inline-block' }} />
                              {i === 0 ? '⭐ ' : ''}{z.name}
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{z.total - z.occupied} free</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <button onClick={resetNav} style={{ width: '100%', padding: '12px', borderRadius: 14, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    Cancel Navigation
                  </button>
                </div>
              )}

              {!selectedEntry && !navPhase && (
                <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.3 }}>
                  <Navigation2 size={60} style={{ margin: '0 auto 16px', color: '#3b82f6' }} />
                  <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, lineHeight: 1.6 }}>Tap a gate on the map<br />or locate yourself to start routing</p>
                </div>
              )}
            </div>
          ) : (
            /* ── Edit Panel ─────────────────────────────────────────────── */
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>Parking Areas ({parkingAreas.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {parkingAreas.map(z => (
                  <div key={z.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 14, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{z.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{z.total} slots</div>
                      <button onClick={() => deleteParking(z.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><Trash2 size={14} /></button>
                    </div>

                    {/* ── Transform Controls: Expand / Shrink / Flip / Rotate ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                      <div style={{ fontSize: 9, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, width: '100%', marginBottom: 4 }}>Transform</div>
                      {[
                        { icon: <Plus size={12} />, tip: 'Expand 10%', fn: () => transformParking(z.id, (c) => scalePolygon(c, 1.1)), color: '#10b981' },
                        { icon: <Minus size={12} />, tip: 'Shrink 10%', fn: () => transformParking(z.id, (c) => scalePolygon(c, 0.9)), color: '#f59e0b' },
                        { icon: <FlipHorizontal2 size={12} />, tip: 'Flip H', fn: () => transformParking(z.id, flipHorizontal), color: '#3b82f6' },
                        { icon: <FlipVertical2 size={12} />, tip: 'Flip V', fn: () => transformParking(z.id, flipVertical), color: '#8b5cf6' },
                        { icon: <RotateCcw size={12} />, tip: 'Rotate -15°', fn: () => transformParking(z.id, (c) => rotatePolygon(c, -15)), color: '#ec4899' },
                        { icon: <RotateCw size={12} />, tip: 'Rotate +15°', fn: () => transformParking(z.id, (c) => rotatePolygon(c, 15)), color: '#14b8a6' },
                      ].map((b, i) => (
                        <button key={i} title={b.tip} onClick={b.fn} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          padding: '5px 8px', borderRadius: 8, border: `1px solid ${b.color}33`,
                          background: `${b.color}15`, color: b.color, cursor: 'pointer',
                          fontSize: 10, fontWeight: 700, transition: 'all 0.15s'
                        }}>
                          {b.icon}
                          <span style={{ fontSize: 9 }}>{b.tip}</span>
                        </button>
                      ))}
                    </div>

                    {/* Inline edit for precise Entry Point */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <label style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', width: 65 }}>Entry Pt:</label>
                      <button
                        onClick={() => {
                          pendingDrawType.current = `entry-point-${z.id}`;
                          if (mapContainer.current) mapContainer.current.style.cursor = 'crosshair';
                          setActiveTool(`entry-point-${z.id}`);
                          toast('Click on the map to place the entry point for this parking.', 'info');
                        }}
                        style={{ flex: 1, background: z.entryPoint ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.06)', border: `1px solid ${z.entryPoint ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 6, padding: '4px 8px', color: z.entryPoint ? '#10b981' : '#fff', fontSize: 11, cursor: 'pointer', textAlign: 'center' }}
                      >
                        {z.entryPoint ? '📍 Point Set (Click to replace)' : '📍 Pick Point on Map'}
                      </button>
                    </div>
                    {/* Inline edit for entry and exit gate */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <label style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', width: 65 }}>Gate In:</label>
                      <select
                        value={z.entryGate || ''}
                        onChange={e => {
                          const newGate = e.target.value;
                          setParkingAreas(prev => prev.map(p => p.id === z.id ? { ...p, entryGate: newGate } : p));
                          toast(`Updated entry gate for ${z.name}`, 'success');
                        }}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', color: '#fff', fontSize: 11, outline: 'none' }}
                      >
                        <option value="">None (Use Center)</option>
                        {gates.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <label style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', width: 65 }}>Gate Out:</label>
                      <select
                        value={z.exitGate || ''}
                        onChange={e => {
                          const newGate = e.target.value;
                          setParkingAreas(prev => prev.map(p => p.id === z.id ? { ...p, exitGate: newGate } : p));
                          toast(`Updated exit gate for ${z.name}`, 'success');
                        }}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', color: '#fff', fontSize: 11, outline: 'none' }}
                      >
                        <option value="">None (Use Center)</option>
                        {gates.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>Routes ({routes.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {routes.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{r.name}</div>
                    <button onClick={() => deleteRoute(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>Gates ({gates.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {gates.map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)' }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{g.name}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{g.lat.toFixed(4)}, {g.lng.toFixed(4)}</div>
                    <button onClick={() => deleteGate(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Map Area ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>

        {/* ── Google Maps-style Search Bar ─────────────────────────────── */}
        {!isEditMode && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 30, width: 440, maxWidth: 'calc(100vw - 420px)',
            pointerEvents: 'auto'
          }}>
            <div style={{
              background: 'rgba(10,14,28,0.96)', backdropFilter: 'blur(24px)',
              borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
              overflow: 'visible', position: 'relative'
            }}>
              {/* Trip waypoints strip: Source → Gate → Parking */}
              <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
                <span style={{ color: '#3b82f6' }}>📍 From</span>
                <span>──▶──</span>
                {gates.length > 0 && <><span style={{ color: '#f59e0b' }}>🚪 {detectMainEntrance(gates)?.name || 'Gate'}</span><span>──▶──</span></>}
                <span style={{ color: '#10b981' }}>🅿️ Parking</span>
              </div>

              {/* FROM row with geocoding dropdown */}
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 6px', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', border: '2px solid #93c5fd', boxShadow: '0 0 8px rgba(59,130,246,0.6)' }} />
                    <div style={{ width: 1.5, height: 20, background: 'linear-gradient(to bottom, #3b82f6, #10b981)', opacity: 0.6 }} />
                  </div>
                  <input
                    ref={fromInputRef}
                    value={gmSearch.fromText}
                    onChange={e => handleFromInput(e.target.value)}
                    onFocus={e => { e.target.style.borderColor = 'rgba(59,130,246,0.6)'; if (gmSearch.fromText && gmSearch.fromText !== 'Your Location') setGmSearch(s => ({ ...s, showFromDropdown: true })); }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; setTimeout(() => setGmSearch(s => ({ ...s, showFromDropdown: false })), 200); }}
                    placeholder="Type home address, city, or landmark..."
                    style={{
                      flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10, padding: '8px 12px', color: '#f1f5f9', fontSize: 13, fontWeight: 600,
                      outline: 'none', transition: 'border-color 0.2s'
                    }}
                  />
                  <button onClick={handleGmLocate} title="Use GPS location" style={{
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: 10, padding: '7px 10px', color: '#60a5fa', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'all 0.2s'
                  }}>
                    <LocateFixed size={15} />
                  </button>
                </div>

                {/* FROM geocoding autocomplete dropdown */}
                {gmSearch.showFromDropdown && fromSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: 'rgba(10,14,28,0.99)', backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '0 0 16px 16px',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.8)', overflow: 'hidden'
                  }}>
                    <div style={{ padding: '6px 16px 4px', fontSize: 10, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Suggested Locations</div>
                    {fromSuggestions.map((s, i) => (
                      <button key={s.id || i} onMouseDown={() => {
                        if (s.id === '__gps__') {
                          handleGmLocate();
                        } else {
                          setGmSearch(prev => ({ ...prev, fromText: s.place_name, showFromDropdown: false }));
                          setFromSuggestions([]);
                        }
                      }} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 16px', background: 'transparent', border: 'none',
                        cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.15s', textAlign: 'left'
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: s.id === '__gps__' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {s.id === '__gps__' ? <LocateFixed size={13} color="#3b82f6" /> : <MapPin size={13} color="#64748b" />}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.place_name?.split(',')[0] || s.place_name}
                          </div>
                          {s.place_name?.includes(',') && (
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {s.place_name.split(',').slice(1).join(',').trim()}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* TO row — campus parking search */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px 10px', gap: 12, position: 'relative' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', border: '2px solid #6ee7b7', transform: 'rotate(45deg)', marginLeft: 0, flexShrink: 0, boxShadow: '0 0 8px rgba(16,185,129,0.6)' }} />
                <input
                  ref={toInputRef}
                  value={gmSearch.toText}
                  onChange={e => { setGmSearch(s => ({ ...s, toText: e.target.value, showDropdown: true, toArea: null })); }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(16,185,129,0.6)'; setGmSearch(s => ({ ...s, showDropdown: true })); }}
                  placeholder="Search campus parking areas…"
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, padding: '8px 12px', color: '#f1f5f9', fontSize: 13, fontWeight: 600,
                    outline: 'none', transition: 'border-color 0.2s'
                  }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; setTimeout(() => setGmSearch(s => ({ ...s, showDropdown: false })), 200); }}
                />
                {gmSearch.toText && (
                  <button onClick={() => setGmSearch(s => ({ ...s, toText: '', toArea: null, showDropdown: false }))} style={{
                    background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: '6px 8px',
                    color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center'
                  }}><X size={14} /></button>
                )}
              </div>

              {/* Travel Mode + ── GET DIRECTIONS CTA ── */}
              <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px 12px', gap: 6, alignItems: 'center' }}>
                {[{ mode: 'driving', icon: <Car size={14} />, label: 'Drive' }, { mode: 'walking', icon: <PersonStanding size={14} />, label: 'Walk' }].map(m => (
                  <button key={m.mode} onClick={() => setGmSearch(s => ({ ...s, travelMode: m.mode }))} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20,
                    border: gmSearch.travelMode === m.mode ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    background: gmSearch.travelMode === m.mode ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                    color: gmSearch.travelMode === m.mode ? '#93c5fd' : '#64748b',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                  }}>
                    {m.icon} {m.label}
                  </button>
                ))}
                <button
                  onClick={handleGetDirections}
                  disabled={!gmSearch.toArea}
                  style={{
                    marginLeft: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: '1px solid rgba(16,185,129,0.35)',
                    background: !gmSearch.toArea ? 'rgba(255,255,255,0.04)' : 'rgba(16,185,129,0.16)',
                    color: !gmSearch.toArea ? '#64748b' : '#34d399',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: !gmSearch.toArea ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <ArrowRight size={13} />
                  Get Directions
                </button>
                <button
                  onClick={clearRoadRoute}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 20,
                    border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.08)',
                    color: '#fca5a5',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <X size={12} />
                  Clear Route
                </button>
                {gmSearch.toArea && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                    <Target size={12} />
                    ~{navInfo.dist}m · {navInfo.durationSeconds ? Math.round(navInfo.durationSeconds / 60) : Math.round(navInfo.dist / (gmSearch.travelMode === 'walking' ? 80 : 250))} min
                  </div>
                )}
              </div>

              {/* Autocomplete dropdown */}
              {gmSearch.showDropdown && parkingAreas.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', maxHeight: 240, overflowY: 'auto' }}>
                  <div style={{ padding: '6px 16px 4px', fontSize: 10, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Parking Areas</div>
                  {parkingAreas
                    .filter(p => !gmSearch.toText || p.name.toLowerCase().includes(gmSearch.toText.toLowerCase()))
                    .map(p => {
                      const pct = p.total ? Math.round(p.occupied / p.total * 100) : 0;
                      const free = p.total - p.occupied;
                      const color = statusColor(p.occupied, p.total);
                      return (
                        <button key={p.id} onMouseDown={() => handleGmSelectDestination(p)} style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 16px', background: 'transparent',
                          border: 'none', cursor: 'pointer', transition: 'background 0.15s',
                          borderBottom: '1px solid rgba(255,255,255,0.04)'
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}22`, border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <MapPin size={14} color={color} />
                          </div>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{free} free of {p.total} · {pct}% full</div>
                          </div>
                          <div style={{ width: 36, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                        </button>
                      );
                    })
                  }
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Directions Step Panel ─────────────────────────────────────── */}
        {directionsOpen && navSteps.length > 0 && (
          <div style={{
            position: 'absolute', top: 160, left: 16, zIndex: 25, width: 300,
            background: 'rgba(10,14,28,0.97)', backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            overflow: 'hidden', animation: 'slideInLeft 0.35s cubic-bezier(0.34,1.56,0.64,1)',
            pointerEvents: 'auto'
          }}>
            {/* Header */}
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: 6, display: 'flex' }}>
                <CornerDownRight size={14} color="#10b981" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9', letterSpacing: 0.3 }}>Directions</div>
                <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, marginTop: 1 }}>
                  {gmSearch.fromText} → {gmSearch.toArea?.name}
                </div>
              </div>
              <button onClick={() => setDirectionsOpen(false)} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '4px 6px', color: '#64748b', cursor: 'pointer', display: 'flex' }}>
                <X size={13} />
              </button>
            </div>

            {/* Summary bar */}
            <div style={{ padding: '10px 16px', background: 'rgba(16,185,129,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>{navInfo.dist}m</div>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Distance</div>
              </div>
              <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b' }}>{Math.max(1, navInfo.durationSeconds ? Math.round(navInfo.durationSeconds / 60) : Math.round(navInfo.dist / (gmSearch.travelMode === 'walking' ? 80 : 250)))} min</div>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>ETA</div>
              </div>
              <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#3b82f6' }}>{navTarget ? navTarget.total - navTarget.occupied : '–'}</div>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Slots</div>
              </div>
            </div>

            {/* Alternative routes summary (Mapbox outside phase) */}
            {officialAlternatives && officialAlternatives.length > 1 && (
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  Alternatives
                </div>
                {officialAlternatives.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#e2e8f0', display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0' }}>
                    <span style={{ fontWeight: 800 }}>{i + 1}.</span>
                    <span style={{ color: '#94a3b8', fontWeight: 700 }}>
                      {r.distance ? `${(Math.round(r.distance / 10) / 100).toFixed(1)} km` : '–'} · {r.duration ? `${Math.max(1, Math.round(r.duration / 60))} min` : '–'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Steps */}
            <div style={{ maxHeight: 280, overflowY: 'auto', padding: '6px 0', scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
              {navSteps.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, marginTop: 2 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: i === navSteps.length - 1 ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.15)',
                      border: `1.5px solid ${i === navSteps.length - 1 ? 'rgba(16,185,129,0.5)' : 'rgba(59,130,246,0.4)'}`,
                      color: i === navSteps.length - 1 ? '#10b981' : '#60a5fa', fontSize: 10, fontWeight: 800
                    }}>
                      {i === navSteps.length - 1 ? <Target size={12} /> : (i + 1)}
                    </div>
                    {i < navSteps.length - 1 && (
                      <div style={{ width: 1.5, height: 16, background: 'rgba(59,130,246,0.25)', marginTop: 3 }} />
                    )}
                  </div>
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4 }}>{step.instruction}</div>
                    {step.dist > 0 && (
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, fontWeight: 600 }}>{step.dist}m</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Cancel button */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={resetNav} style={{ width: '100%', padding: '9px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <X size={13} /> Cancel Navigation
              </button>
            </div>
          </div>
        )}

        {/* Top HUD */}
        <div style={{ position: 'absolute', top: 20, left: 20, right: 20, zIndex: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none' }}>

          {/* Left: Title + Edit Toolbar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, pointerEvents: 'auto' }}>
            {/* Title badge */}
            <div style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: isEditMode ? '#f59e0b' : '#3b82f6', borderRadius: 10, padding: 8, display: 'flex' }}>
                {isEditMode ? <Edit3 size={18} /> : <Activity size={18} />}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#f1f5f9', letterSpacing: 0.5 }}>{isEditMode ? 'Map Architect' : 'ParkBy Live'}</div>
                <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: 1 }}>
                  <span style={{ animation: 'pulse 2s infinite', display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10b981', marginRight: 5 }} />
                  LIVE · {lastUpdate}
                </div>
              </div>
            </div>

            {/* Edit tools */}
            {isEditMode && (
              <div style={{ background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', animation: 'slideDown 0.3s ease-out' }}>
                <TBtn icon={<MousePointer2 size={16} />} label="Select" active={activeTool === 'select'} onClick={() => activateTool('select')} color="#64748b" />
                <TBtn icon={<PlusCircle size={16} />} label="Polygon" active={activeTool === 'draw-parking'} onClick={() => activateTool('draw-parking')} color="#10b981" />
                <TBtn icon={<Square size={16} />} label="Rectangle" active={activeTool === 'draw-rect'} onClick={() => activateTool('draw-rect')} color="#22d3ee" />
                <TBtn icon={<Route size={16} />} label="Route" active={activeTool === 'draw-route'} onClick={() => activateTool('draw-route')} color="#3b82f6" />
                <TBtn icon={<MapPin size={16} />} label="Gate" active={activeTool === 'add-gate'} onClick={() => activateTool('add-gate')} color="#f59e0b" />
                <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />
                <TBtn icon={<Save size={16} />} label="Download" active={false} onClick={saveMapData} color="#8b5cf6" />
                <TBtn icon={<UploadCloud size={16} />} label="Upload" active={false} onClick={triggerUpload} color="#ec4899" />
                <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
                <TBtn icon={<Trash2 size={16} />} label="Clear All" active={false} onClick={() => {
                  if (window.confirm('Are you sure you want to delete all parking areas, routes, and gates? This cannot be undone.')) {
                    // ── Clear data state ────────────────────────────────────────
                    setParkingAreas([]); setRoutes([]); setGates([]);

                    // ── Clear draw plugin features ──────────────────────────────
                    if (drawRef.current) drawRef.current.deleteAll();

                    // ── Clear ALL map layers & sources (nav + official route) ───
                    // resetNav clears nav state + nav layers on the map;
                    // removeOfficialRouteLayers clears the Mapbox Directions layer.
                    const map = mapRef.current;
                    if (map && map.isStyleLoaded()) {
                      ['nav-glow', 'nav-dash', 'nav-dots', 'nav-target-area-fill', 'nav-target-area-line'].forEach(id => {
                        if (map.getLayer(id)) map.removeLayer(id);
                      });
                      if (map.getSource('nav-src')) map.removeSource('nav-src');
                      if (map.getSource('nav-target-src')) map.removeSource('nav-target-src');
                      ['official-route-glow', 'official-route-line'].forEach(id => {
                        if (map.getLayer(id)) map.removeLayer(id);
                      });
                      if (map.getSource('official-route-src')) map.removeSource('official-route-src');
                    }

                    // ── Reset all navigation state ──────────────────────────────
                    setNavTarget(null);
                    setSelectedEntry(null);
                    setRecommendations([]);
                    setNavPhase(null);
                    setOfficialRoute(null);
                    setUserLocation(null);
                    if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null; }
                    if (proximityWatchRef.current) { clearInterval(proximityWatchRef.current); proximityWatchRef.current = null; }

                    toast('All map data cleared', 'warning');
                  }
                }} color="#ef4444" />
                <TBtn icon={<CheckCircle size={16} />} label="Done" active={false} onClick={() => { setIsEditMode(false); setActiveTool('select'); activateTool('select'); }} color="#10b981" />
              </div>
            )}
          </div>

          {/* Right: Occupancy + Mode toggle */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', pointerEvents: 'auto' }}>
            {!isEditMode && (
              <button onClick={() => { setIsEditMode(true); toast('Edit mode on. Use tools to draw areas, routes and gates.', 'info'); }} style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '10px 18px', color: '#cbd5e1', fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}>
                Edit Map
              </button>
            )}
            <div style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '12px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Occupancy</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#10b981', lineHeight: 1.1 }}>{pct}%</div>
            </div>
            <button onClick={() => setSidebarCollapsed(c => !c)} style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 14px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={18} style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
            </button>
          </div>
        </div>

        {/* Locate button bottom-left */}
        <div style={{ position: 'absolute', bottom: 80, left: 20, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
          <button onClick={locateUser} style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(59,130,246,0.4)', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(59,130,246,0.2)' }}>
            <LocateFixed size={18} />
          </button>
        </div>

        {/* Instruction banner when tool active */}
        {isEditMode && activeTool !== 'select' && (
          <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 14, padding: '10px 24px', color: '#10b981', fontWeight: 700, fontSize: 13, backdropFilter: 'blur(12px)', whiteSpace: 'nowrap', animation: 'slideUp 0.3s ease-out' }}>
            {activeTool === 'draw-parking' && '📐 Click to draw polygon → double-click to finish'}
            {activeTool === 'draw-rect' && '⬜ Click first corner → click opposite corner to create rectangle area'}
            {activeTool === 'draw-route' && '🛣️ Click to add points → double-click to finish route'}
            {activeTool === 'add-gate' && '🚪 Click anywhere on the map to place a gate'}
          </div>
        )}

        {/* Mapbox Container */}
        <div ref={mapContainer} style={{ flex: 1, width: '100%' }} />
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {modal?.type === 'update-occupancy' && <UpdateOccupancyModal area={modal.area} onConfirm={confirmUpdateOccupancy} onCancel={() => { setModal(null); setActiveTool('select'); }} />}
      {modal?.type === 'parking' && <ParkingModal gates={gates} onConfirm={confirmParking} onCancel={() => { drawRef.current?.delete([modal.feature?.id]); setModal(null); setActiveTool('select'); }} />}
      {modal?.type === 'route' && <RouteModal onConfirm={confirmRoute} onCancel={() => { drawRef.current?.delete([modal.feature?.id]); setModal(null); setActiveTool('select'); }} />}
      {modal?.type === 'gate' && <GateModal onConfirm={confirmGate} onCancel={() => { setModal(null); setActiveTool('select'); }} />}

      {/* ── Toasts ──────────────────────────────────────────────────────────── */}
      <Toast toasts={toasts} remove={removeToast} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes gatePulse {
          0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,0.6); }
          50% { box-shadow:0 0 0 10px rgba(59,130,246,0); }
        }
        @keyframes locPulse {
          0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,0.6); }
          60% { box-shadow:0 0 0 12px rgba(59,130,246,0); }
        }
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:0.5; transform:scale(1.3); }
        }
        @keyframes slideToast {
          from { transform:translateX(80px); opacity:0; }
          to { transform:translateX(0); opacity:1; }
        }
        @keyframes scaleIn {
          from { transform:scale(0.88); opacity:0; }
          to { transform:scale(1); opacity:1; }
        }
        @keyframes slideUp {
          from { transform:translate(-50%, 16px); opacity:0; }
          to { transform:translate(-50%, 0); opacity:1; }
        }
        @keyframes slideDown {
          from { transform:translateY(-12px); opacity:0; }
          to { transform:translateY(0); opacity:1; }
        }
        @keyframes slideInLeft {
          from { transform:translateX(-24px); opacity:0; }
          to { transform:translateX(0); opacity:1; }
        }
        .mapboxgl-ctrl-group { display:none !important; }
        .mapboxgl-ctrl-attrib { display:none !important; }
        .mapboxgl-ctrl-bottom-right .mapboxgl-ctrl { display:flex !important; }
        .gate-popup .mapboxgl-popup-content { border-radius:10px; padding:0; }
        .park-popup .mapboxgl-popup-content { border-radius:10px; padding:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background: rgba(51,65,85,0.8); border-radius:4px; }
      `}</style>
    </div>
  );
}
