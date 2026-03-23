import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// ─── Constants ────────────────────────────────────────────────────────────────
const FLASK_BASE = import.meta.env.VITE_FLASK_URL || 'http://localhost:5000';
const TOTAL_PARKING_CAPACITY = 2885;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtNumber = (v) => {
  try {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : String(v ?? '');
  } catch {
    return String(v ?? '');
  }
};

const formatDate = (d) =>
  d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

const formatTime = (d) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

// Format parking area display name
const formatParkingTitle = (name) => {
  if (!name) return '';
  const n = name.replace(/_/g, ' ');
  if (n.includes("IT SQUARE TEACHERS")) return "IT SQ TEACHERS' PARKING";
  if (n.includes("GIRLS") && n.includes("HOSTEL")) return "GIRLS' HOSTEL PARKING";
  if (n.includes("EN TEACHERS")) return "EN TEACHERS' PARKING";
  return n;
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid #e2e8f0',
      boxShadow: '0 6px 18px rgba(15,23,42,0.08)',
      padding: '12px 10px',
      borderTop: `5px solid ${color}`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: '#64748b',
        textAlign: 'center',
      }}>{label}</div>
      <div style={{
        fontSize: 28,
        fontWeight: 900,
        color: '#0f172a',
        textAlign: 'center',
        lineHeight: 1,
      }}>{value}</div>
    </div>
  );
}

// ─── Parking Zone Card ────────────────────────────────────────────────────────
function ParkingCard({ group, index, onToggle }) {
  const available = Math.max(0, group.available ?? 0);
  const capacity = group.capacity || 1;
  const percent = Math.min(100, Math.round(((capacity - available) / capacity) * 100));
  const isFull = available <= 0 || group.emergency_closed;
  const isYellow = !isFull && available <= 20;

  let headerColor = '#059669';
  let textColor = '#059669';
  if (isFull) { headerColor = '#e11d48'; textColor = '#e11d48'; }
  else if (isYellow) { headerColor = '#f59e0b'; textColor = '#d97706'; }

  const dotColor = isFull ? '#059669' : '#e11d48';
  const cardBg = isFull ? '#fff1f2' : isYellow ? '#fffbeb' : '#ffffff';

  return (
    <div style={{
      background: cardBg,
      border: '1px solid #e2e8f0',
      borderRadius: 14,
      boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'transform 120ms ease, box-shadow 120ms ease',
      minHeight: 0,
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(15,23,42,0.12)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.08)'; }}
    >
      {/* Card Header */}
      <div style={{ background: headerColor, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.2, flex: 1 }}>
          {formatParkingTitle(group.name)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 7px', borderRadius: 999, background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.35)' }}>
            P{index + 1}
          </span>
          <button
            onClick={() => onToggle(group.key)}
            title={isFull ? 'Click to mark as available' : 'Click to mark as full'}
            style={{
              width: 14, height: 14, borderRadius: '50%',
              background: dotColor,
              border: '2px solid rgba(255,255,255,0.9)',
              boxShadow: '0 0 0 2px rgba(15,23,42,0.25)',
              cursor: 'pointer', flexShrink: 0,
            }}
          />
        </div>
      </div>

      {/* Card Body */}
      <div style={{ padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, minHeight: 80 }}>
        {isFull ? (
          <div style={{ fontSize: 32, fontWeight: 900, color: '#e11d48' }}>FULL</div>
        ) : (
          <>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: textColor }}>{available}</div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8' }}>Available</div>
          </>
        )}
      </div>

      {/* Progress Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: cardBg, borderTop: '1px solid #e2e8f0' }}>
        <div style={{ flex: 1, height: 14, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
          <div style={{ height: '100%', width: `${percent}%`, background: headerColor, transition: 'width 300ms ease', borderRadius: 10 }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', minWidth: 40, textAlign: 'right' }}>{percent}%</span>
      </div>
    </div>
  );
}

// ─── Legend Card ──────────────────────────────────────────────────────────────
function LegendCard() {
  return (
    <div style={{
      border: '2px dashed #fdba74',
      background: '#fff7ed',
      borderRadius: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      padding: 14,
      boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>Status Legend</div>
      {[
        { color: '#059669', label: 'Open' },
        { color: '#f59e0b', label: 'Filling Fast (<20)' },
        { color: '#e11d48', label: 'Full' },
      ].map(({ color, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
          {label}
        </div>
      ))}
    </div>
  );
}

// ─── Live Log Table ───────────────────────────────────────────────────────────
function LiveLogPanel({ logs, anprOnline }) {
  const fixed = [...(logs || []).slice(0, 5)];
  while (fixed.length < 5) fixed.push({});

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }}>
      {/* Panel Header */}
      <div style={{ background: '#f97316', color: '#fff', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Live Vehicle Log (Last 5)</span>
        <span style={{
          fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.18)', color: '#fff', whiteSpace: 'nowrap'
        }}>
          {anprOnline ? '🟢 ANPR ONLINE' : '🔴 ANPR OFFLINE'}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Time', 'Plate', 'Snap', 'Type', 'Dir'].map(h => (
                <th key={h} style={{
                  position: 'sticky', top: 0, background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0', padding: '7px 8px',
                  textAlign: 'left', fontSize: 9, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: '#94a3b8', fontWeight: 900, zIndex: 1,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fixed.map((log, i) => (
              <tr key={i}>
                <td style={{ border: 'none', borderBottom: '1px solid #f1f5f9', padding: '7px 8px', fontSize: 11, fontWeight: 700, color: '#0f172a', verticalAlign: 'middle' }}>
                  {log.timestamp || '—'}
                </td>
                <td style={{ border: 'none', borderBottom: '1px solid #f1f5f9', padding: '7px 8px', fontSize: 12, fontWeight: 900, letterSpacing: '0.04em', verticalAlign: 'middle' }}>
                  {(log.plate || '').toUpperCase()}
                </td>
                <td style={{ border: 'none', borderBottom: '1px solid #f1f5f9', padding: '7px 8px', verticalAlign: 'middle' }}>
                  {log.crop_file ? (
                    <img
                      src={`/anpr/crops/${log.crop_file}`}
                      alt="snap"
                      style={{ width: 54, height: 30, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f1f5f9', display: 'block' }}
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : <span style={{ color: '#64748b', fontWeight: 700 }}>—</span>}
                </td>
                <td style={{ border: 'none', borderBottom: '1px solid #f1f5f9', padding: '7px 8px', fontSize: 11, color: '#64748b', fontWeight: 700, verticalAlign: 'middle' }}>
                  {log.vehicle_type || ''}
                </td>
                <td style={{ border: 'none', borderBottom: '1px solid #f1f5f9', padding: '7px 8px', verticalAlign: 'middle' }}>
                  {log.direction ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 900, border: '1px solid',
                      ...(String(log.direction).toUpperCase() === 'ENTRY'
                        ? { background: '#ecfdf5', color: '#059669', borderColor: '#bbf7d0' }
                        : { background: '#fff7ed', color: '#ea580c', borderColor: '#fed7aa' })
                    }}>
                      {String(log.direction).toUpperCase()}
                    </span>
                  ) : <span style={{ color: '#64748b', fontWeight: 700 }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Peak Hours Chart Panel ───────────────────────────────────────────────────
function PeakHoursPanel({ anprStats, parkedHistory }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const labels = Array.from({ length: 13 }, (_, i) => {
      const h = 8 + i;
      if (h === 12) return '12 PM';
      if (h > 12) return `${h - 12} PM`;
      return `${h} AM`;
    });

    const trafficData = (anprStats && Array.isArray(anprStats.graph_data) && anprStats.graph_data.length === 13)
      ? anprStats.graph_data
      : Array(13).fill(0);

    const parkedData = (parkedHistory || Array(13).fill(0)).map(v => Math.max(0, Math.round(Number(v) || 0)));

    const maxY = Math.max(1, ...trafficData.map(v => Number(v) || 0), ...parkedData);
    const suggestedMax = Math.ceil(maxY * 1.15);

    if (!chartRef.current) {
      chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Traffic (vehicles/hr)',
              data: trafficData,
              borderColor: '#f97316',
              backgroundColor: 'rgba(249,115,22,0.14)',
              borderWidth: 3,
              tension: 0.35,
              fill: true,
              pointRadius: 2,
              pointBackgroundColor: '#f97316',
            },
            {
              label: 'Parked Vehicles',
              data: parkedData,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16,185,129,0.10)',
              borderWidth: 2,
              tension: 0.35,
              fill: false,
              pointRadius: 2,
              pointBackgroundColor: '#10b981',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 10 } } } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 9 } } },
            y: { beginAtZero: true, grid: { color: '#f1f5f9' }, suggestedMax, ticks: { font: { size: 9 } } },
          },
        },
      });
    } else {
      chartRef.current.data.datasets[0].data = trafficData;
      chartRef.current.data.datasets[1].data = parkedData;
      chartRef.current.options.scales.y.suggestedMax = suggestedMax;
      chartRef.current.update('none');
    }

    return () => {};
  }, [anprStats, parkedHistory]);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 12px rgba(15,23,42,0.08)', flex: 1 }}>
      <div style={{ background: '#f97316', color: '#fff', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Peak Hours Trends</span>
        <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.18)' }}>
          {anprStats ? 'LIVE' : 'NO DATA'}
        </span>
      </div>
      <div style={{ padding: '10px 12px', flex: 1, position: 'relative', minHeight: 0 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}

// ─── Main LiveDashboard Component ─────────────────────────────────────────────
export default function LiveDashboard() {
  const [data, setData] = useState({ groups: [], total_capacity: 0, total_vehicles: 0 });
  const [anprStats, setAnprStats] = useState(null);
  const [anprLogs, setAnprLogs] = useState({ logs: [] });
  const [anprHealth, setAnprHealth] = useState({ online: false });
  const [now, setNow] = useState(new Date());
  const [parkedHistory, setParkedHistory] = useState(() => Array(13).fill(0));
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef(null);

  // ── Computed ────────────────────────────────────────────────────────────────
  const totalSlots = data.total_capacity || 0;
  const totalVehicles = data.total_vehicles || 0;
  const occupancyRate = totalSlots > 0 ? Math.round((totalVehicles / totalSlots) * 100) : 0;

  const parkedNow = React.useMemo(() => {
    if (!data || !Array.isArray(data.groups)) return 0;
    let occ = 0;
    for (const g of data.groups) {
      if (g?.emergency_closed) continue;
      occ += Math.max(0, (g?.capacity || 0) - (g?.available || 0));
    }
    return Math.max(0, Math.round(occ));
  }, [data]);

  const occupancyRateForParked = TOTAL_PARKING_CAPACITY > 0
    ? Math.round((parkedNow / TOTAL_PARKING_CAPACITY) * 100)
    : 0;

  const totalVehiclesToday = anprStats?.total_vehicles ?? 0;
  const total2W = anprStats?.total_2w ?? 0;
  const totalCars = anprStats?.total_cars ?? 0;
  const lastHourTraffic = anprStats?.last_hour ?? 0;

  const stats = [
    { label: 'Total Vehicles Today', value: fmtNumber(totalVehiclesToday), color: '#3b82f6' },
    { label: 'Total 2-Wheelers', value: fmtNumber(total2W), color: '#10b981' },
    { label: 'Total Cars', value: fmtNumber(totalCars), color: '#6366f1' },
    { label: 'Last Hour Traffic', value: fmtNumber(lastHourTraffic), color: '#f97316' },
    { label: 'Total Parking', value: fmtNumber(totalSlots || TOTAL_PARKING_CAPACITY), color: '#a855f7' },
    { label: 'Parking Occupancy', value: `${occupancyRate || occupancyRateForParked}%`, color: '#f43f5e' },
  ];

  // ── Fetch parking status ────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) setData(await res.json());
    } catch { /* Flask might be offline */ }
  }, []);

  // ── Fetch ANPR data ─────────────────────────────────────────────────────────
  const fetchAnpr = useCallback(async () => {
    try {
      const [h, s, l] = await Promise.all([
        fetch('/api/anpr/health').then(r => r.ok ? r.json() : { online: false }),
        fetch('/api/anpr/stats').then(r => r.ok ? r.json() : null),
        fetch('/api/anpr/logs').then(r => r.ok ? r.json() : { logs: [] }),
      ]);
      setAnprHealth(h || { online: false });
      setAnprStats(s && !s.offline ? s : null);
      setAnprLogs(l || { logs: [] });
    } catch {
      setAnprHealth({ online: false });
    }
  }, []);

  // ── WebSocket for real-time pushes ──────────────────────────────────────────
  useEffect(() => {
    // Use the Flask server URL directly for socket.io (proxy doesn't support WS upgrades well)
    const socket = io(FLASK_BASE, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setWsConnected(true);
    });
    socket.on('disconnect', () => setWsConnected(false));
    socket.on('parking_update', (payload) => {
      if (payload && Array.isArray(payload.groups)) setData(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ── Polling fallback (every 2s for status, 3s for ANPR) ──────────────────
  useEffect(() => {
    fetchStatus();
    fetchAnpr();
    const t1 = setInterval(fetchStatus, 2000);
    const t2 = setInterval(fetchAnpr, 3000);
    const t3 = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  }, [fetchStatus, fetchAnpr]);

  // ── Update parked history time bucket ──────────────────────────────────────
  useEffect(() => {
    const idx = now.getHours() - 6; // 6 AM → index 0
    if (idx < 0 || idx > 12) return;
    setParkedHistory(prev => {
      if (prev[idx] === parkedNow) return prev;
      const next = prev.slice();
      next[idx] = parkedNow;
      return next;
    });
  }, [now, parkedNow]);

  // ── Toggle handler ──────────────────────────────────────────────────────────
  const handleToggle = useCallback(async (key) => {
    try {
      await fetch('/api/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      fetchStatus();
    } catch { /* offline */ }
  }, [fetchStatus]);

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100%',
      height: '100vh',
      background: '#e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      overflow: 'hidden',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      {/* ── Main Container ── */}
      <div style={{
        width: '100%',
        maxWidth: 1600,
        height: '100%',
        background: '#f4f7f9',
        border: '1px solid #cbd5e1',
        borderRadius: 18,
        boxShadow: '0 20px 50px rgba(15,23,42,0.18)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 20px 14px',
        gap: 14,
      }}>

        {/* ── Top Header ── */}
        <header style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 72, flexShrink: 0 }}>
          {/* Left: Logos */}
          <div style={{ position: 'absolute', left: 0, top: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
            {['rbu_logo.png', 'parkby_white.png', 'tbi_logo.png'].map((file, i) => (
              <img
                key={i}
                src={`/logos/${file}`}
                alt={file.replace('.png', '')}
                style={{ height: 52, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(15,23,42,0.1))' }}
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
            ))}
          </div>

          {/* Center: Title */}
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#1e2a5e', textTransform: 'uppercase', lineHeight: 1.05 }}>
              Ramdeobaba University
            </h1>
            <h2 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 900, color: '#f97316', textTransform: 'uppercase', lineHeight: 1.05 }}>
              Smart Entrance &amp; Parking Dashboard
            </h2>
            <span style={{
              display: 'inline-flex', marginTop: 6,
              background: '#4f46e5', color: '#fff',
              fontSize: 9, fontWeight: 900, letterSpacing: '0.10em', textTransform: 'uppercase',
              padding: '4px 12px', borderRadius: 999,
              boxShadow: '0 8px 16px rgba(79,70,229,0.22)',
            }}>
              Developed by ParkBy Technologies
            </span>
          </div>

          {/* Right: Status + Clock */}
          <div style={{ position: 'absolute', right: 0, top: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: wsConnected ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${wsConnected ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: 999, padding: '5px 12px',
              boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: wsConnected ? '#10b981' : '#ef4444',
                boxShadow: wsConnected ? '0 0 0 0 rgba(16,185,129,0.65)' : 'none',
                animation: wsConnected ? 'livepulse 1.4s infinite' : 'none',
                display: 'inline-block',
              }} />
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: wsConnected ? '#047857' : '#b91c1c' }}>
                {wsConnected ? 'Live' : 'Polling'}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#f97316', lineHeight: 1 }}>
                {formatTime(now)}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1e2a5e' }}>
                {formatDate(now)}
              </div>
            </div>
          </div>
        </header>

        {/* ── Stats Bar ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 12, flexShrink: 0 }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* ── Main Grid ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr', gap: 12 }}>

          {/* Parking Zones: 8 columns × 3 rows */}
          <div style={{ gridColumn: '1 / 9', gridRow: '1 / 4', display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gridTemplateRows: 'repeat(3,minmax(0,1fr))', gap: 10, minHeight: 0 }}>
            {data.groups.map((g, idx) => (
              <ParkingCard key={g.key || idx} group={g} index={idx} onToggle={handleToggle} />
            ))}
            {/* Fill with placeholders if fewer than 11 areas loaded yet */}
            {Array.from({ length: Math.max(0, 11 - data.groups.length) }).map((_, i) => (
              <div key={`placeholder-${i}`} style={{ borderRadius: 14, background: '#f1f5f9', border: '1px solid #e2e8f0', animation: 'shimmer 2s infinite' }} />
            ))}
            {/* 12th cell: Legend */}
            <LegendCard />
          </div>

          {/* Right Column: Log + Chart — 4 columns × 3 rows */}
          <div style={{ gridColumn: '9 / 13', gridRow: '1 / 4', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            <LiveLogPanel logs={anprLogs?.logs} anprOnline={anprHealth?.online} />
            <PeakHoursPanel anprStats={anprStats} parkedHistory={parkedHistory} />
          </div>
        </div>
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes livepulse {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.55); }
          70%  { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
