import React, { useState, useMemo } from 'react';

// ── Campus node positions (SVG 280×200 viewBox) ───────────────────────────────
const GATES = {
  MAIN_GATE:   { id: 'MAIN_GATE',   label: 'Main Gate',   sx: 140, sy: 188 },
  MANDIR_GATE: { id: 'MANDIR_GATE', label: 'Mandir Gate', sx: 18,  sy: 120 },
};

const PARK_NODES = [
  { key: 'IT_PARKING',                label: 'IT Parking',        x: 52,  y: 35  },
  { key: 'DT_PARKING',                label: 'DT Parking',        x: 130, y: 48  },
  { key: 'MCA_PARKING',               label: 'MCA Parking',       x: 220, y: 35  },
  { key: 'MBA_PARKING',               label: 'MBA Parking',       x: 248, y: 92  },
  { key: 'UPPER_1ST_YEAR_PARKING',    label: 'Upper 1st Year',    x: 195, y: 138 },
  { key: 'LOWER_1ST_YEAR_PARKING',    label: 'Lower 1st Year',    x: 195, y: 175 },
  { key: 'RESERVE_PARKING',           label: 'Reserve',           x: 95,  y: 138 },
  { key: 'IT_SQUARE_TEACHER_PARKING', label: 'IT Sq. Teachers',   x: 48,  y: 88  },
  { key: 'GIRLS_HOSTEL_PARKING',      label: "Girls' Hostel",     x: 262, y: 48  },
  { key: 'WORKSHOP_PARKING',          label: 'Workshop',          x: 108, y: 90  },
  { key: 'EN_PARKING',                label: "EN Teachers'",      x: 162, y: 108 },
];

// Road graph edges
const ROADS = [
  ['MAIN_GATE',   'LOWER_1ST_YEAR_PARKING'],
  ['MAIN_GATE',   'EN_PARKING'],
  ['MANDIR_GATE', 'IT_SQUARE_TEACHER_PARKING'],
  ['MANDIR_GATE', 'RESERVE_PARKING'],
  ['IT_SQUARE_TEACHER_PARKING', 'IT_PARKING'],
  ['IT_PARKING',  'DT_PARKING'],
  ['DT_PARKING',  'MCA_PARKING'],
  ['MCA_PARKING', 'GIRLS_HOSTEL_PARKING'],
  ['MCA_PARKING', 'MBA_PARKING'],
  ['MBA_PARKING', 'UPPER_1ST_YEAR_PARKING'],
  ['UPPER_1ST_YEAR_PARKING', 'LOWER_1ST_YEAR_PARKING'],
  ['RESERVE_PARKING', 'WORKSHOP_PARKING'],
  ['WORKSHOP_PARKING', 'EN_PARKING'],
  ['EN_PARKING',  'DT_PARKING'],
  ['EN_PARKING',  'UPPER_1ST_YEAR_PARKING'],
  ['LOWER_1ST_YEAR_PARKING', 'UPPER_1ST_YEAR_PARKING'],
];

function getXY(key) {
  if (GATES[key]) return { x: GATES[key].sx, y: GATES[key].sy };
  const n = PARK_NODES.find(p => p.key === key);
  return n ? { x: n.x, y: n.y } : { x: 140, y: 100 };
}

// BFS shortest path
function bfs(from, to) {
  if (from === to) return [from];
  const adj = {};
  [...Object.keys(GATES), ...PARK_NODES.map(p => p.key)].forEach(k => { adj[k] = []; });
  ROADS.forEach(([a, b]) => { adj[a]?.push(b); adj[b]?.push(a); });
  const visited = new Set([from]);
  const queue = [[from, [from]]];
  while (queue.length) {
    const [cur, path] = queue.shift();
    for (const nb of (adj[cur] || [])) {
      if (!visited.has(nb)) {
        visited.add(nb);
        const np = [...path, nb];
        if (nb === to) return np;
        queue.push([nb, np]);
      }
    }
  }
  return null;
}

// Human-readable turn directions
function turnLabel(from, to) {
  const a = getXY(from), b = getXY(to);
  const dx = b.x - a.x, dy = b.y - a.y; // SVG y grows down
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const dist = Math.round(Math.sqrt(dx * dx + dy * dy) * 14); // scale to "metres"
  let arrow = '→';
  if (angle > -22.5  && angle <= 22.5)  arrow = '→';
  else if (angle > 22.5  && angle <= 67.5) arrow = '↘';
  else if (angle > 67.5  && angle <= 112.5) arrow = '↓';
  else if (angle > 112.5 && angle <= 157.5) arrow = '↙';
  else if (angle > 157.5 || angle <= -157.5) arrow = '←';
  else if (angle > -157.5 && angle <= -112.5) arrow = '↖';
  else if (angle > -112.5 && angle <= -67.5)  arrow = '↑';
  else arrow = '↗';
  return { arrow, dist };
}

function zoneColor(group) {
  if (!group || group.emergency_closed || group.available <= 0) return '#e11d48';
  if (group.available <= 20) return '#f59e0b';
  return '#10b981';
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CampusNavMap({ parkingGroups = [] }) {
  const [gate, setGate] = useState('MAIN_GATE');
  const [dest, setDest] = useState('DT_PARKING');

  const groupMap = useMemo(() => {
    const m = {};
    parkingGroups.forEach(g => { m[g.key] = g; });
    return m;
  }, [parkingGroups]);

  // Auto-suggest best available if dest is closed/full
  const effectiveDest = useMemo(() => {
    const g = groupMap[dest];
    if (g && !g.emergency_closed && g.available > 0) return dest;
    // fall back to best available
    let best = dest, bestAvail = -1;
    PARK_NODES.forEach(p => {
      const gr = groupMap[p.key];
      if (gr && !gr.emergency_closed && gr.available > bestAvail) {
        bestAvail = gr.available;
        best = p.key;
      }
    });
    return best;
  }, [dest, groupMap]);

  const route = useMemo(() => bfs(gate, effectiveDest) || [], [gate, effectiveDest]);

  // Edges on the active route
  const pathEdges = new Set();
  route.forEach((node, i) => {
    if (i < route.length - 1) {
      pathEdges.add(`${node}|${route[i + 1]}`);
      pathEdges.add(`${route[i + 1]}|${node}`);
    }
  });

  // Step-by-step directions (skip gate itself)
  const steps = useMemo(() => {
    if (route.length < 2) return [];
    return route.slice(0, -1).map((from, i) => {
      const to = route[i + 1];
      const { arrow, dist } = turnLabel(from, to);
      const toLabel = GATES[to]?.label || PARK_NODES.find(p => p.key === to)?.label || to;
      return { arrow, dist, toLabel, isLast: i === route.length - 2 };
    });
  }, [route]);

  const destNode  = PARK_NODES.find(p => p.key === effectiveDest);
  const destGroup = groupMap[effectiveDest];
  const gateInfo  = GATES[gate];

  return (
    <div style={{
      background: 'linear-gradient(155deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
      border: '1px solid #3730a3',
      borderRadius: 14,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      boxShadow: '0 8px 32px rgba(79,70,229,0.3)',
    }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(90deg, #4338ca, #6d28d9)',
        padding: '6px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>🧭</span>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Campus Navigation
          </span>
        </div>
        {/* Live dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#34d399',
            boxShadow: '0 0 6px #34d399', display: 'inline-block',
            animation: 'navpulse 1.5s infinite',
          }} />
          <span style={{ fontSize: 8, fontWeight: 900, color: '#a5f3fc', letterSpacing: '0.1em' }}>LIVE</span>
        </div>
      </div>

      {/* ── Gate Picker ── */}
      <div style={{ display: 'flex', gap: 5, padding: '6px 8px 2px', flexShrink: 0 }}>
        {Object.values(GATES).map(g => (
          <button key={g.id} onClick={() => setGate(g.id)} style={{
            flex: 1, padding: '5px 4px', borderRadius: 8, border: 'none',
            cursor: 'pointer', fontSize: 9, fontWeight: 900,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            background: gate === g.id
              ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
              : 'rgba(255,255,255,0.07)',
            color: gate === g.id ? '#fff' : '#818cf8',
            boxShadow: gate === g.id ? '0 4px 14px rgba(99,102,241,0.45)' : 'none',
            transition: 'all 150ms ease',
          }}>
            🚪 {g.label}
          </button>
        ))}
      </div>

      {/* ── SVG Map (main focus) ── */}
      <div style={{ flex: 1, minHeight: 0, padding: '2px 6px' }}>
        <svg viewBox="0 0 280 200"
          style={{ width: '100%', height: '100%', display: 'block' }}
          preserveAspectRatio="xMidYMid meet">

          {/* Campus boundary */}
          <rect x="8" y="8" width="264" height="184" rx="10"
            fill="rgba(15,23,42,0.7)" stroke="#3730a3" strokeWidth="1" />

          {/* All roads — dim */}
          {ROADS.map(([a, b], i) => {
            const pa = getXY(a), pb = getXY(b);
            const active = pathEdges.has(`${a}|${b}`);
            return (
              <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke={active ? '#fbbf24' : '#1e3a5f'}
                strokeWidth={active ? 2.5 : 1.2}
                strokeLinecap="round"
                opacity={active ? 1 : 0.6}
              />
            );
          })}

          {/* Animated route overlay */}
          {route.length > 1 && (() => {
            const pts = route.map(k => getXY(k));
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
            return (
              <path d={d} fill="none" stroke="#fbbf24" strokeWidth="3"
                strokeDasharray="6 4" strokeLinecap="round">
                <animate attributeName="stroke-dashoffset"
                  from="0" to="-20" dur="0.7s" repeatCount="indefinite" />
              </path>
            );
          })()}

          {/* Parking zone dots */}
          {PARK_NODES.map(node => {
            const g = groupMap[node.key];
            const col = zoneColor(g);
            const isActive = route.includes(node.key);
            const isDest = node.key === effectiveDest;

            return (
              <g key={node.key} style={{ cursor: 'pointer' }}
                onClick={() => setDest(node.key)}>
                {isDest && (
                  <circle cx={node.x} cy={node.y} r={13} fill="none"
                    stroke="#fbbf24" strokeWidth="1.5" opacity="0.4">
                    <animate attributeName="r" from="11" to="18"
                      dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.5" to="0"
                      dur="1.2s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={node.x} cy={node.y}
                  r={isDest ? 9 : isActive ? 7 : 5.5}
                  fill={isDest ? '#fbbf24' : col}
                  stroke={isDest ? '#fff' : isActive ? '#fff' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={isDest ? 2 : 1}
                />
                {/* Short label only on route nodes */}
                {(isActive || isDest) && (
                  <text x={node.x}
                    y={node.y + (node.y < 100 ? -12 : 18)}
                    textAnchor="middle" fontSize="5.5" fill="#e0e7ff" fontWeight="900"
                    style={{ pointerEvents: 'none' }}>
                    {node.label.split(' ').slice(0, 2).join(' ')}
                  </text>
                )}
                {/* Tiny dot only for non-route nodes */}
                {!isActive && !isDest && (
                  <text x={node.x} y={node.y + 2}
                    textAnchor="middle" fontSize="4" fill="rgba(255,255,255,0.4)"
                    style={{ pointerEvents: 'none' }}>P</text>
                )}
              </g>
            );
          })}

          {/* Gate markers */}
          {Object.values(GATES).map(g => {
            const isActive = g.id === gate;
            return (
              <g key={g.id}>
                <polygon
                  points={`${g.sx},${g.sy - 9} ${g.sx + 8},${g.sy + 4} ${g.sx - 8},${g.sy + 4}`}
                  fill={isActive ? '#6366f1' : '#1e1b4b'}
                  stroke={isActive ? '#818cf8' : '#4338ca'}
                  strokeWidth="1.5"
                />
                <text x={g.sx} y={g.sy + 14}
                  textAnchor="middle" fontSize="5" fill="#c7d2fe" fontWeight="900">
                  {g.label}
                </text>
              </g>
            );
          })}

          {/* Destination pin */}
          {destNode && (
            <g>
              <line x1={destNode.x} y1={destNode.y - 9}
                    x2={destNode.x} y2={destNode.y - 18}
                stroke="#fbbf24" strokeWidth="1.5" />
              <circle cx={destNode.x} cy={destNode.y - 21} r={4} fill="#fbbf24">
                <animate attributeName="cy"
                  values={`${destNode.y - 23};${destNode.y - 18};${destNode.y - 23}`}
                  dur="0.8s" repeatCount="indefinite" calcMode="ease-in-out" />
              </circle>
            </g>
          )}
        </svg>
      </div>

      {/* ── Directions ── */}
      <div style={{
        flexShrink: 0,
        background: 'rgba(0,0,0,0.4)',
        borderTop: '1px solid #312e81',
        padding: '5px 8px',
      }}>
        {/* Destination summary */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 4,
        }}>
          <span style={{ fontSize: 8, fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            📍 {gateInfo?.label} → {destNode?.label}
          </span>
          {destGroup && (
            <span style={{
              fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 999,
              background: destGroup.available <= 0 ? 'rgba(225,29,72,0.2)' : 'rgba(16,185,129,0.2)',
              color: destGroup.available <= 0 ? '#fca5a5' : '#6ee7b7',
              border: `1px solid ${destGroup.available <= 0 ? '#e11d48' : '#10b981'}`,
            }}>
              {destGroup.emergency_closed ? 'CLOSED' : destGroup.available <= 0 ? 'FULL' : `${destGroup.available} free`}
            </span>
          )}
        </div>

        {/* Steps — horizontal scrollable for space */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              flexShrink: 0,
              background: step.isLast ? 'rgba(16,185,129,0.15)' : 'rgba(79,70,229,0.15)',
              border: `1px solid ${step.isLast ? '#059669' : '#4338ca'}`,
              borderRadius: 7, padding: '3px 7px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>{step.arrow}</span>
              <span style={{ fontSize: 6.5, fontWeight: 900, color: '#c7d2fe', whiteSpace: 'nowrap' }}>
                {step.dist}m
              </span>
              <span style={{ fontSize: 6, color: step.isLast ? '#6ee7b7' : '#818cf8', fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 52, textAlign: 'center', lineHeight: 1.1 }}>
                {step.toLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Destination Selector ── */}
      <div style={{
        flexShrink: 0, display: 'flex', gap: 3,
        padding: '4px 8px 6px', overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {PARK_NODES.map(node => {
          const g = groupMap[node.key];
          const col = zoneColor(g);
          const isSel = node.key === effectiveDest;
          return (
            <button key={node.key} onClick={() => setDest(node.key)} style={{
              flexShrink: 0, border: isSel ? `1.5px solid ${col}` : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '2px 7px',
              background: isSel ? `${col}18` : 'rgba(255,255,255,0.04)',
              color: isSel ? col : '#64748b',
              fontSize: 7.5, fontWeight: 900, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              transition: 'all 120ms ease',
            }}>
              {node.label.split(' ').slice(0, 2).join(' ')}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes navpulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:0.5; transform:scale(1.4); }
        }
      `}</style>
    </div>
  );
}
