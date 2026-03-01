import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Navigation, Navigation2, Compass, Activity, Edit3, Settings2,
  MapPin, Route, Trash2, Save, MousePointer2, PlusCircle,
  ChevronLeft, X, Clock, Milestone, ArrowUpCircle, ZoomIn, ZoomOut,
  CheckCircle, AlertTriangle, Info, MapPinned, LocateFixed
} from 'lucide-react';

// ─── Token ────────────────────────────────────────────────────────────────────
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// ─── Default campus center (Nagpur area) ──────────────────────────────────────
const DEFAULT_CENTER = [79.0615, 21.1775];
const DEFAULT_ZOOM = 17;

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
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <ModalShell title="🅿️ Name This Parking Area" onClose={onCancel}>
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onConfirm({ name: name.trim(), totalSlots: parseInt(slots) || 50, entryGate }); }}>
        <div style={{ marginBottom: 14 }}>
          <label style={lStyle}>Parking Area Name</label>
          <input ref={ref} style={iStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Block-A Parking" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lStyle}>Total Slots</label>
          <input style={iStyle} type="number" min={1} value={slots} onChange={e => setSlots(e.target.value)} placeholder="50" />
        </div>
        <div style={{ marginBottom: 22 }}>
          <label style={lStyle}>Entry Gate (Optional)</label>
          <select style={{ ...iStyle, appearance: 'menulist' }} value={entryGate} onChange={e => setEntryGate(e.target.value)}>
            <option value="">Select a Gate...</option>
            {gates.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onCancel} style={{ ...btnBase, background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>Cancel</button>
          <button type="submit" style={{ ...btnBase, background: '#10b981', color: '#000' }}>Save Area →</button>
        </div>
      </form>
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
  const [navInfo, setNavInfo] = useState({ dist: 0, direction: 'STRAIGHT' });
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());
  const [userLocation, setUserLocation] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Modals
  const [modal, setModal] = useState(null); // { type: 'parking'|'route'|'gate', feature?, lngLat? }

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

    // Click on map for gate placement
    map.on('click', e => {
      if (pendingDrawType.current === 'gate') {
        const { lng, lat } = e.lngLat;
        setModal({ type: 'gate', lngLat: { lng, lat } });
        pendingDrawType.current = null;
        mapContainer.current.style.cursor = '';
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, []);

  // ── Render all layers whenever data changes ───────────────────────────────
  const renderAllLayers = useCallback((m) => {
    const map = m || mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // ── Parking areas ──────────────────────────────────────────────────────
    const parkingGeoJSON = {
      type: 'FeatureCollection',
      features: parkingAreas.map(z => ({
        type: 'Feature', id: z.id,
        properties: { id: z.id, name: z.name, color: statusColor(z.occupied, z.total), occupied: z.occupied, total: z.total, pct: z.total ? Math.round(z.occupied / z.total * 100) : 0 },
        geometry: { type: 'Polygon', coordinates: z.coords }
      }))
    };

    if (map.getSource('parking-src')) {
      map.getSource('parking-src').setData(parkingGeoJSON);
    } else {
      map.addSource('parking-src', { type: 'geojson', data: parkingGeoJSON });
      map.addLayer({ id: 'parking-fill', type: 'fill', source: 'parking-src', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.3 } });
      map.addLayer({ id: 'parking-border', type: 'line', source: 'parking-src', paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'parking-label', type: 'symbol', source: 'parking-src', layout: { 'text-field': ['concat', ['get', 'name'], '\n', ['get', 'pct'], '%'], 'text-size': 12, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'] }, paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 2 } });

      map.on('click', 'parking-fill', e => {
        if (!e.features?.[0]) return;
        const p = e.features[0].properties;
        new mapboxgl.Popup({ closeButton: false, className: 'park-popup' })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="color:#000;padding:6px 8px;font-family:sans-serif"><b>${p.name}</b><br/>${p.occupied}/${p.total} occupied — <b>${p.pct}% full</b></div>`)
          .addTo(map);
      });
    }

    // ── Routes ─────────────────────────────────────────────────────────────
    const routeGeoJSON = {
      type: 'FeatureCollection',
      features: routes.map(r => ({
        type: 'Feature', id: r.id,
        properties: { id: r.id, name: r.name },
        geometry: { type: 'LineString', coordinates: r.coords }
      }))
    };

    if (map.getSource('routes-src')) {
      map.getSource('routes-src').setData(routeGeoJSON);
    } else {
      map.addSource('routes-src', { type: 'geojson', data: routeGeoJSON });
      // Road base
      map.addLayer({ id: 'routes-bg', type: 'line', source: 'routes-src', paint: { 'line-color': '#334155', 'line-width': 18, 'line-blur': 1, 'line-opacity': 0.9 } });
      // Road surface with dash
      map.addLayer({ id: 'routes-line', type: 'line', source: 'routes-src', paint: { 'line-color': '#94a3b8', 'line-width': 2, 'line-dasharray': [4, 4] } });
    }

    // ── Nav route ─────────────────────────────────────────────────────────
    // Handled separately in navigation effect

  }, [parkingAreas, routes]);

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

  // ── User Location ─────────────────────────────────────────────────────────
  const locateUser = useCallback(() => {
    if (!navigator.geolocation) { toast('Geolocation not supported', 'warning'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const { longitude: lng, latitude: lat } = pos.coords;
      setUserLocation({ lng, lat });
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 17, pitch: 30 });

      if (userMarkerRef.current) userMarkerRef.current.remove();
      const el = document.createElement('div');
      el.style.cssText = `width:20px;height:20px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,0.25);animation:locPulse 1.5s infinite;`;
      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
      toast('Live location found!', 'success');
    }, () => toast('Could not get location', 'error'));
  }, [toast]);

  // ── Navigation Route on Map ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    ['nav-glow', 'nav-dash', 'nav-dots'].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource('nav-src')) map.removeSource('nav-src');

    if (!selectedEntry || !navTarget) return;

    // Build simple route: gate → centroid of target parking
    let gatePt = [selectedEntry.lng, selectedEntry.lat];

    // If the parking area has a defined entry gate, calculate route from the user's gate to the parking's entry gate
    let targetCenter = centroidOfPolygon(navTarget.coords);
    if (navTarget.entryGate) {
      const eg = gates.find(g => g.id === navTarget.entryGate);
      if (eg) targetCenter = [eg.lng, eg.lat];
    }

    // If the user's location is known, start from there instead of the entry gate
    if (userLocation) {
      gatePt = [userLocation.lng, userLocation.lat];
    }

    // Find closest route point to connect through road network
    let closestOnRoute = null;
    let minD = Infinity;
    routes.forEach(r => {
      r.coords.forEach(pt => {
        const d = lngLatDist(gatePt, pt);
        if (d < minD) { minD = d; closestOnRoute = pt; }
      });
    });

    const navCoords = closestOnRoute
      ? [gatePt, closestOnRoute, ...routes[0]?.coords || [], targetCenter]
      : [gatePt, targetCenter];

    const navGeoJSON = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: navCoords } };
    const dist = Math.round(navCoords.reduce((acc, pt, i) => i === 0 ? acc : acc + lngLatDist(navCoords[i - 1], pt), 0));
    setNavInfo({ dist, direction: 'STRAIGHT' });

    map.addSource('nav-src', { type: 'geojson', data: navGeoJSON });
    map.addLayer({ id: 'nav-glow', type: 'line', source: 'nav-src', paint: { 'line-color': '#10b981', 'line-width': 16, 'line-blur': 8, 'line-opacity': 0.25 } });
    map.addLayer({
      id: 'nav-dash', type: 'line', source: 'nav-src', paint: {
        'line-color': ['interpolate', ['linear'], ['line-progress'], 0, '#3b82f6', 1, '#10b981'],
        'line-width': 5, 'line-opacity': 0.95,
        'line-dasharray': [0, 4, 3]
      }, layout: { 'line-cap': 'round', 'line-join': 'round' }
    });

    // Fly to fit
    const lngs = navCoords.map(c => c[0]), lats = navCoords.map(c => c[1]);
    map.fitBounds([[Math.min(...lngs) - 0.001, Math.min(...lats) - 0.001], [Math.max(...lngs) + 0.001, Math.max(...lats) + 0.001]], { padding: 80, duration: 1200 });
  }, [selectedEntry, navTarget, routes]);

  // Animate nav dash
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let step = 0;
    const animate = () => {
      step = (step + 1) % 32;
      if (map.getLayer('nav-dash')) {
        map.setPaintProperty('nav-dash', 'line-dasharray', [0.0001, 4 - (step * 0.05), 3 + (step * 0.05)]);
      }
      reqRef.current = requestAnimationFrame(animate);
    };
    const reqRef = { current: requestAnimationFrame(animate) };
    return () => cancelAnimationFrame(reqRef.current);
  }, []);

  // ── Live occupancy updates ─────────────────────────────────────────────────
  useEffect(() => {
    if (isEditMode) return;
    const interval = setInterval(() => {
      setParkingAreas(prev => prev.map(z => ({
        ...z, occupied: Math.min(z.total, Math.max(0, z.occupied + Math.floor(Math.random() * 3) - 1))
      })));
      setLastUpdate(new Date().toLocaleTimeString());
    }, 5000);
    return () => clearInterval(interval);
  }, [isEditMode]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleGateClick = useCallback(gate => {
    setSelectedEntry(gate);
    const ranked = parkingAreas.map(z => {
      const center = centroidOfPolygon(z.coords);
      const dist = lngLatDist([gate.lng, gate.lat], center);
      const score = (z.occupied / z.total) * 1000 + dist / 10;
      return { ...z, score, dist };
    }).sort((a, b) => a.score - b.score);
    setRecommendations(ranked.slice(0, 3));
    setNavTarget(ranked[0]);
    toast(`Routing from ${gate.name}`, 'success');
  }, [parkingAreas, toast]);

  const resetNav = () => {
    setSelectedEntry(null);
    setNavTarget(null);
    setRecommendations([]);
    const map = mapRef.current;
    if (map) {
      ['nav-glow', 'nav-dash'].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource('nav-src')) map.removeSource('nav-src');
    }
  };

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

  // ── Modal Confirm Handlers ────────────────────────────────────────────────
  const confirmParking = useCallback(({ name, totalSlots, entryGate }) => {
    const feature = modal?.feature;
    if (!feature) return;
    const id = feature.id || `pa-${Date.now()}`;
    setParkingAreas(prev => [...prev.filter(p => p.id !== id), { id, name, coords: feature.geometry.coordinates, total: totalSlots, occupied: 0, entryGate }]);
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

              {/* Gates */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Entry Gates</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {gates.map(g => (
                    <button key={g.id} onClick={() => handleGateClick(g)} style={{
                      width: '100%', padding: '14px 16px', borderRadius: 16, border: `2px solid ${selectedEntry?.id === g.id ? '#3b82f6' : 'rgba(255,255,255,0.06)'}`,
                      background: selectedEntry?.id === g.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                      color: selectedEntry?.id === g.id ? '#93c5fd' : '#94a3b8', fontSize: 14, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all 0.2s', boxShadow: selectedEntry?.id === g.id ? '0 0 20px rgba(59,130,246,0.2)' : 'none'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: selectedEntry?.id === g.id ? '#3b82f6' : '#10b981', animation: 'gatePulse 2s infinite', display: 'inline-block' }} />
                        {g.name}
                      </span>
                      <Navigation size={16} style={{ opacity: selectedEntry?.id === g.id ? 1 : 0.3, transform: selectedEntry?.id === g.id ? 'rotate(45deg)' : 'none', transition: 'all 0.3s' }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation Summary */}
              {selectedEntry && navTarget && (
                <div style={{ animation: 'slideUp 0.4s ease-out' }}>
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '2px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '20px 18px', marginBottom: 12, boxShadow: '0 0 30px rgba(16,185,129,0.1)' }}>
                    <div style={{ fontSize: 10, color: '#10b981', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Now Routing To</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 16, letterSpacing: -0.5 }}>{navTarget.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <Milestone size={18} style={{ color: '#10b981' }} />
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>~{navInfo.dist}m away</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <ArrowUpCircle size={18} style={{ color: '#3b82f6' }} />
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#94a3b8' }}>
                        {navTarget.total - navTarget.occupied} slots available ({Math.round(navTarget.occupied / navTarget.total * 100)}% full)
                      </span>
                    </div>
                  </div>

                  {/* Recommendation list */}
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

                  <button onClick={resetNav} style={{ width: '100%', padding: '12px', borderRadius: 14, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    Cancel Navigation
                  </button>
                </div>
              )}

              {!selectedEntry && (
                <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.3 }}>
                  <Navigation2 size={60} style={{ margin: '0 auto 16px', color: '#3b82f6' }} />
                  <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, lineHeight: 1.6 }}>Tap a gate on the map<br />or below to start routing</p>
                </div>
              )}
            </div>
          ) : (
            /* ── Edit Panel ─────────────────────────────────────────────── */
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>Parking Areas ({parkingAreas.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {parkingAreas.map(z => (
                  <div key={z.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{z.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{z.total} slots</div>
                      <button onClick={() => deleteParking(z.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><Trash2 size={14} /></button>
                    </div>
                    {/* Inline edit for entry gate */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <label style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Entry:</label>
                      <select
                        value={z.entryGate || ''}
                        onChange={e => {
                          const newGate = e.target.value;
                          setParkingAreas(prev => prev.map(p => p.id === z.id ? { ...p, entryGate: newGate } : p));
                          toast(`Updated entry gate for ${z.name}`, 'success');
                        }}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', color: '#fff', fontSize: 11, outline: 'none' }}
                      >
                        <option value="">Nearest point</option>
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
              <div style={{ background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 10, display: 'flex', gap: 8, alignItems: 'center', animation: 'slideDown 0.3s ease-out' }}>
                <TBtn icon={<MousePointer2 size={16} />} label="Select" active={activeTool === 'select'} onClick={() => activateTool('select')} color="#64748b" />
                <TBtn icon={<PlusCircle size={16} />} label="Parking" active={activeTool === 'draw-parking'} onClick={() => activateTool('draw-parking')} color="#10b981" />
                <TBtn icon={<Route size={16} />} label="Route" active={activeTool === 'draw-route'} onClick={() => activateTool('draw-route')} color="#3b82f6" />
                <TBtn icon={<MapPin size={16} />} label="Gate" active={activeTool === 'add-gate'} onClick={() => activateTool('add-gate')} color="#f59e0b" />
                <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />
                <TBtn icon={<Save size={16} />} label="Download JSON" active={false} onClick={saveMapData} color="#8b5cf6" />
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
            {activeTool === 'draw-route' && '🛣️ Click to add points → double-click to finish route'}
            {activeTool === 'add-gate' && '🚪 Click anywhere on the map to place a gate'}
          </div>
        )}

        {/* Mapbox Container */}
        <div ref={mapContainer} style={{ flex: 1, width: '100%' }} />
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
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
