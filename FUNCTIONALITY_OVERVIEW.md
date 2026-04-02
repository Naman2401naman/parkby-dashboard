# 🚗 ParkBy — Detailed Functionality Overview

> **Project:** Smart Campus Parking Management System  
> **Version:** 1.0.0 | **Stack:** React 19 + TypeScript + Mapbox GL JS + Node.js + MongoDB

---

## Table of Contents

1. [Live Dashboard (Overview Screen)](#1-live-dashboard-overview-screen)
2. [Interactive Campus Map](#2-interactive-campus-map)
3. [Map Drawing Tools](#3-map-drawing-tools)
4. [Hybrid Navigation System](#4-hybrid-navigation-system)
5. [Campus Nav Mini-Map](#5-campus-nav-mini-map)
6. [Search Bar](#6-search-bar)
7. [Statistics Dashboard](#7-statistics-dashboard)
8. [GPS Tracking](#8-gps-tracking)
9. [Real-Time Data Updates](#9-real-time-data-updates)
10. [Toast Notification System](#10-toast-notification-system)
11. [Help Panel & Keyboard Shortcuts](#11-help-panel--keyboard-shortcuts)
12. [Backend REST API](#12-backend-rest-api)
13. [Data Models](#13-data-models)
14. [Routing Engine (Internal Pathfinding)](#14-routing-engine-internal-pathfinding)

---

## 1. Live Dashboard (Overview Screen)

**File:** `src/components/LiveDashboard.jsx`

The main real-time monitoring screen designed for public display or admin oversight at Ramdeobaba University campus.

### 1.1 Header Bar
- Displays three logos: `rbu_logo.png`, `parkby_white.png`, `tbi_logo.png`
- Center title: "Ramdeobaba University — Smart Entrance & Parking Dashboard"
- Live clock (updates every 1 second) showing time + full date
- Connection status indicator pill:
  - 🟢 **Live** — WebSocket connected (pulsing green dot)
  - 🔴 **Polling** — fallback to REST polling

### 1.2 Stats Bar (6 cards)
| Card | Data Source | Color |
|---|---|---|
| Total Vehicles Today | ANPR `/api/anpr/stats` | Blue |
| Total 2-Wheelers | ANPR stats | Green |
| Total Cars | ANPR stats | Indigo |
| Last Hour Traffic | ANPR stats | Orange |
| Total Parking Capacity | Flask `/api/status` | Purple |
| Parking Occupancy % | Computed (vehicles/capacity) | Rose |

### 1.3 Parking Zone Grid (11 cards + 1 mini-map)
12-cell grid where each `ParkingCard` shows:
- **Zone name** (auto-formatted: underscore removal, title casing)
- **Parking number badge** (P1–P11)
- **Toggle dot**: click to manually mark zone as Full/Available (calls `POST /api/toggle`)
- **Big number** — available slots (or "FULL" in red)
- **Fill % progress bar** with colour coded fill:
  - 🟢 Green — open (>20 slots free)
  - 🟡 Yellow — filling fast (≤20 slots free)
  - 🔴 Red — full or emergency closed
- **Hover effect** — card lifts on mouse enter

### 1.4 Right Column Panels

#### Live Vehicle Log (`LiveLogPanel`)
- Shows **last 5 ANPR detections** from `/api/anpr/logs`
- Per row: Time · Plate (uppercase) · Snap image (`/anpr/crops/<file>`) · Vehicle type · Direction badge (ENTRY green / EXIT orange)
- Fixed 5 rows — empty rows padded with `—`
- Header shows ANPR online/offline status

#### Peak Hours Trend Chart (`PeakHoursPanel`)
- **Chart.js line chart** — 8 AM to 8 PM (13 hourly buckets)
- Two lines:
  - 🟠 **Traffic** (vehicles/hr) — from ANPR stats `graph_data[]`
  - 🟢 **Parked Vehicles** — computed internally from `parkedHistory[]` state, updated per-hour bucket
- Responsive canvas, legend at bottom
- Shows "LIVE" or "NO DATA" badge

### 1.5 Data Fetching Strategy
```
Socket.IO (VITE_FLASK_URL)  →  'parking_update' event    →  instant grid refresh
REST fallback               →  /api/status every 2s      →  parking zone data
REST fallback               →  /api/anpr/* every 3s      →  ANPR stats/logs/health
Clock                       →  setInterval 1s            →  live time + parkedHistory bucket
```

---

## 2. Interactive Campus Map

**File:** `src/components/CampusMap.jsx` (134 KB — the core engine)

The primary admin/editor interface for managing campus map data.

### 2.1 Map Initialisation
- **Mapbox GL JS** v3 map rendered with a custom dark style
- Center: campus coordinates (hardcoded lat/lon)
- Zoom, pitch, bearing defaults set on load
- Mapbox GL Draw plugin attached for shape drawing

### 2.2 Map Layers Rendered
| Layer | Type | Source |
|---|---|---|
| Parking area polygons | Fill + outline | MongoDB `/api/parking-areas` |
| Route lines | LineString | MongoDB `/api/routes` |
| Gate points | Circle markers | MongoDB `/api/gates` |
| Entry point markers | Custom HTML markers | MongoDB (entryPoints array) |
| Navigation route (Phase 1) | LineString | Mapbox Directions API |
| Navigation route (Phase 2) | LineString | Internal Dijkstra engine |
| User location dot | Custom pulsing circle | Browser Geolocation API |

### 2.3 Parking Area Rendering
- Each polygon = a GeoJSON `Feature<Polygon>`
- Fill colour based on `availability` field:
  - ≥ 60% → `#10b981` (emerald green)
  - 30–59% → `#f59e0b` (amber)
  - < 30% → `#ef4444` (red)
- Fill opacity = 0.4 (solid), outline opacity = 1.0
- **Labels** rendered as Mapbox symbol layers showing: name + availability% + slot count
- Entry points = glowing green dots (pulsing CSS animation)

### 2.4 Click Interactions
| What you click | What happens |
|---|---|
| Parking polygon | Opens info popup with name, slots, availability |
| Entry point marker | Shows which parking area it belongs to |
| Gate marker | Shows gate name and type |
| Empty map | Deselects everything |
| Map during draw mode | Places shape vertices |

### 2.5 Auto-Save
Every draw / edit / delete triggers an immediate API call:
- `POST /api/parking-areas` on draw complete
- `PUT /api/parking-areas/:id` on shape edit
- `DELETE /api/parking-areas/:id` on delete
- Same pattern for routes, gates, entry points

---

## 3. Map Drawing Tools

**Triggered by:** Floating toolbar buttons  
**Powered by:** `@mapbox/mapbox-gl-draw`

### 3.1 Available Tools

| Tool | Mode | Output |
|---|---|---|
| **Draw Parking Area** | `draw_polygon` | Polygon saved as ParkingArea |
| **Draw Route** | `draw_line_string` | LineString saved as Route |
| **Draw Gate** | `draw_point` | Point saved as Gate |
| **Draw Entry Point** | `draw_point` | Point saved as entryPoints[] on a ParkingArea |
| **Delete Selected** | selection | Removes current feature from DB |
| **Save Drawings** | — | Manual save trigger |

### 3.2 Post-Draw Modal (Parking Area)
After completing a polygon:
1. Modal opens asking for:
   - Building / zone name (text input)
   - Total parking slots (number input)
2. On confirm → POST to `/api/parking-areas` with geometry + metadata
3. Toast notification shown on success/failure

### 3.3 Rectangle Drawing Utility
**File:** `src/utils/drawRectangle.js`  
Helper to auto-generate a rectangle polygon from two corner clicks instead of free-form polygon drawing.

### 3.4 Keyboard Shortcuts for Drawing
| Shortcut | Action |
|---|---|
| `Ctrl + P` | Activate Draw Parking Area |
| `Ctrl + R` | Activate Draw Route |
| `Ctrl + G` | Activate Draw Gate |
| `Ctrl + E` | Activate Draw Entry Point |
| `Ctrl + S` | Save all drawings |
| `Delete` / `Backspace` | Delete selected feature |
| `Escape` | Cancel current draw |
| `?` | Toggle Help Panel |

---

## 4. Hybrid Navigation System

The most advanced feature — a two-phase routing engine.

### 4.1 Phase 1 — External Road Navigation (Mapbox Directions API)

**Trigger:** User enters a source address outside campus boundary

**Flow:**
1. User types source address → Mapbox Geocoding API resolves to `[lon, lat]`
2. System identifies **nearest campus gate** using Haversine distance
3. Calls `Mapbox Directions API` with `source → gate` route
4. Route rendered as dashed blue LineString on map
5. Turn-by-turn instruction panel shown

**Phase transition:** When user's GPS position comes within X meters of a campus gate → automatically switches to Phase 2 with toast notification.

### 4.2 Phase 2 — Internal Campus Navigation (Custom Dijkstra)

**Trigger:** User enters campus gate proximity or selects internal destination

**Flow:**
1. Load campus route geometries from `/api/routes`
2. Build weighted `RoadGraph` adjacency list from route coordinates
3. Snap user's current GPS position to nearest road edge (`findNearestNode`)
4. Snap destination (parking area entry point) to nearest road edge
5. Run `shortestPath()` (Dijkstra) from snapped start → snapped end
6. Render computed path as animated dashed line on map
7. Generate turn-by-turn directions from bearing angle changes

**Auto-fallback:** If selected parking zone is full → auto-suggests best available alternative zone.

### 4.3 `useNavigation.js` Hook
Manages navigation state:

```
State:
  targetZone        ← selected destination parking zone
  route             ← array of [lat, lon] waypoints
  instructions[]    ← generated turn-by-turn steps
  currentStep       ← active instruction index
  distanceRemaining ← meters to next waypoint

Behaviour:
  • Recalculates route whenever userLocation or targetZone changes
  • Advances currentStep when user is within 5m of current waypoint
  • cancelNavigation() clears all state
```

### 4.4 Turn Instruction Generation
`generateInstructions(path, targetZone)`:
- Iterates each path segment triplet (prev → current → next)
- Computes bearing change angle using `Math.atan2`
- If |angle| > 30°:
  - angle 30–150° → **Turn right** →
  - angle −30 to −150° → **Turn left** ←
  - else → **Continue** ↑
- Final step always: "Arrive at {zone name}" 🅿️

---

## 5. Campus Nav Mini-Map

**File:** `src/components/CampusNavMap.jsx`  
Embedded as the 12th cell of the LiveDashboard grid.

### 5.1 What It Shows
- Pure SVG map (280×200 viewBox) of the campus road network
- **11 parking zone nodes** as coloured circles (green/amber/red based on live availability)
- **2 gate triangles** (Main Gate, Mandir Gate)
- **All road edges** as grey lines (active route edges highlighted in amber)
- **Animated dashed route path** with `stroke-dashoffset` animation
- **Destination pin** with a bouncing animation (`animate attributeName="cy"`)
- **Pulsing ring** around the selected destination node

### 5.2 Gate Selector
Toggle buttons: **Main Gate** | **Mandir Gate**  
Clicking changes the routing start point and recalculates path immediately.

### 5.3 Destination Selector
Horizontal scrollable chip row with all 11 parking zones.  
Clicking any zone sets it as the destination and BFS re-runs.

### 5.4 BFS Pathfinding (Internal to Mini-Map)
`bfs(from, to)`:
- Adjacency list built from hardcoded `ROADS[]` edge array
- Standard breadth-first search
- Returns array of node keys (shortest hop count path)

### 5.5 Step-by-Step Directions Panel
Below the SVG map — horizontal scrollable direction chips:
- Each chip shows: direction arrow emoji + estimated distance in meters (SVG px × 14 scale) + destination label
- Final chip highlighted in green (arrival)

### 5.6 Auto-Suggest
If selected destination is full/emergency closed → automatically finds the zone with most available slots and reroutes to it.

---

## 6. Search Bar

**File:** `src/components/SearchBar.tsx`

### 6.1 Behaviour
- Controlled input with `query` state
- Filters `parkingAreas[]` prop in real-time as user types (case-insensitive `includes()` match)
- Dropdown opens only when results exist
- Clear (`✕`) button appears when input has text
- Dropdown auto-closes on selection

### 6.2 Result Card
Each result shows:
- Zone name (bold)
- `{availability}% Available` (color coded: emerald/amber/red)
- `{availableSlots}/{totalSlots} slots`
- Glowing status dot (green/amber/red)
- Optional **Navigate** button (compass icon) → triggers `onNavigate` callback

### 6.3 Callbacks
| Callback | Triggered By | Effect |
|---|---|---|
| `onSelect(area)` | Click on result | Map flies to area coordinates |
| `onNavigate(area)` | Click Navigate icon | Starts navigation to that area |

### 6.4 TypeScript Interface
```typescript
interface ParkingAreaSearchResult {
  id: string;
  name: string;
  availability: number;      // 0–100 percentage
  totalSlots: number;
  availableSlots: number;
  coordinates: [number, number]; // [lon, lat]
}
```

---

## 7. Statistics Dashboard

**File:** `src/components/StatsDashboard.tsx`

### 7.1 Stat Cards (2×2 grid)
| Card | Icon | Value |
|---|---|---|
| Total Spots | Car (blue) | `stats.totalSpots` |
| Available | MapPin (emerald) | `stats.availableSpots` |
| Occupied | Car (red) | `stats.occupiedSpots` |
| Parking Areas | MapPin (purple) | `stats.totalAreas` |

### 7.2 Occupancy Rate Section
- Large % value with TrendingUp/TrendingDown icon
- Colour: emerald (≤50%) → amber (50–75%) → red (>75%)
- **Animated gradient progress bar** that transitions colours as occupancy rises:
  - Green gradient → Amber gradient → Red gradient
  - Glow shadow matches current colour

### 7.3 Optional Fields
If provided, renders a 2-col grid:
- **Peak Hour** — e.g., "2:00 PM – 4:00 PM"
- **Avg. Stay Duration** — e.g., "45 min"

### 7.4 Interface
```typescript
interface ParkingStats {
  totalSpots: number;
  occupiedSpots: number;
  availableSpots: number;
  occupancyRate: number;         // 0–100
  totalAreas: number;
  peakHour?: string;             // optional
  averageStayDuration?: string;  // optional
}
```

---

## 8. GPS Tracking

**File:** `src/hooks/useGPSTracking.js`

### 8.1 How It Works
- Uses `navigator.geolocation.watchPosition()` for continuous tracking
- **Accuracy filter:** ignores readings with accuracy > 50m (low quality GPS)
- **Distance filter:** ignores update if position moved < 2m (default) since last update
- **Heading** captured for map rotation/compass arrow
- Returns both raw coordinates and **road-snapped coordinates**

### 8.2 Road Snapping
When `roadGraph` is provided:
1. On each location update → calls `roadGraph.findNearestNode(newLocation)`
2. Returns coordinate on the nearest road edge instead of raw GPS
3. Prevents the "floating off road" problem

### 8.3 Return Values
```javascript
{
  location,        // [lat, lon] raw GPS
  snappedLocation, // [lat, lon] snapped to nearest road
  heading,         // degrees (0–360) or null
  accuracy,        // meters
  error,           // error message string or null
  isTracking       // boolean
}
```

### 8.4 Cleanup
`clearWatch()` called on component unmount to stop battery drain.

---

## 9. Real-Time Data Updates

### 9.1 Socket.IO (Primary — LiveDashboard)
**File:** `src/components/LiveDashboard.jsx`
- Connects to Flask backend via Socket.IO (`VITE_FLASK_URL`)
- Transports: `['websocket', 'polling']` (websocket preferred)
- Reconnection: up to 10 attempts, 3s delay
- Event: `parking_update` → payload contains `{ groups[], total_capacity, total_vehicles }`
- On disconnect → falls back to REST polling

### 9.2 REST Polling (Fallback)
```
/api/status       → every 2 seconds  → parking zone availability data
/api/anpr/stats   → every 3 seconds  → vehicle counts, hourly chart data
/api/anpr/logs    → every 3 seconds  → last 5 vehicle detections
/api/anpr/health  → every 3 seconds  → camera online/offline
```

### 9.3 useRealTimeUpdates Hook (Dev Simulation)
**File:** `src/hooks/useRealTimeUpdates.ts`
- Used in CampusMap for development/demo when Flask is not connected
- `simulateOccupancyChange(parkingAreas)` — randomly changes ±1 to ±2 slots on a random area every tick
- Provides `startSimulation()` / `stopSimulation()` controls
- Each update has `{ parkingAreaId, occupiedSlots, timestamp }`

---

## 10. Toast Notification System

**Files:** `src/components/Toast.tsx`, `src/components/Toast.css`, `src/hooks/useToast.ts`

### 10.1 Toast Types
| Type | Colour | Use Case |
|---|---|---|
| `success` | Emerald green | Save success, draw complete |
| `error` | Red | API failure, validation error |
| `warning` | Amber | Low availability warning |
| `info` | Blue | Navigation guidance, phase switch |

### 10.2 Behaviour
- Toasts stack vertically (slide in from right)
- Auto-dismiss after configurable duration (default ~3–5s)
- Manual dismiss with `✕` button
- Non-blocking — does not freeze map interactions

### 10.3 useToast Hook API
```typescript
const { toasts, showToast, removeToast } = useToast();

showToast('Parking area saved!', 'success');
showToast('Connection lost', 'error');
showToast('Phase switching to campus navigation', 'info');
```

---

## 11. Help Panel & Keyboard Shortcuts

### 11.1 HelpPanel Component
**File:** `src/components/HelpPanel.tsx`
- Full-screen modal overlay with blur backdrop
- Three sections:
  1. **Keyboard Shortcuts** — dynamically renders from `shortcuts[]` prop
  2. **Mouse Controls** — static list (Left Click, Drag, Scroll, Ctrl+Drag)
  3. **Features Guide** — colour-coded feature descriptions

### 11.2 Keyboard Shortcuts System
**File:** `src/utils/keyboardShortcuts.ts`

`useKeyboardShortcuts(shortcuts[])` hook:
- Attaches `keydown` listener to `window`
- Matches: `ctrlKey/metaKey`, `shiftKey`, `altKey`, `key` (case-insensitive)
- Calls `event.preventDefault()` before firing action
- Cleans up listener on unmount

`getShortcutDisplay(shortcut)`:
- Returns human-readable string like `"Ctrl + P"` or `"Shift + Alt + D"`

### 11.3 Registered Shortcuts
| Shortcut | Description |
|---|---|
| `Ctrl + S` | Save drawings |
| `Ctrl + P` | Draw parking area |
| `Ctrl + R` | Draw route |
| `Ctrl + G` | Draw gate |
| `Ctrl + E` | Draw entry point |
| `Delete` | Delete selected shape |
| `Escape` | Cancel current action |
| `?` | Toggle help panel |

---

## 12. Backend REST API

**File:** `backend/src/server.ts`  
**Runtime:** Node.js + Express + TypeScript  
**Port:** 5000

### 12.1 Middleware
- `cors()` — allows all origins
- `express.json()` — JSON body parser
- Global error handler middleware → returns `{ error: string }` with 500

### 12.2 All Endpoints

#### Parking Areas
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/parking-areas` | Returns all parking areas (GeoJSON features) |
| `POST` | `/api/parking-areas` | Create new area (body: name, geometry, totalSlots) |
| `PUT` | `/api/parking-areas/:id` | Update area by MongoDB ID |
| `DELETE` | `/api/parking-areas/:id` | Delete area by ID |

#### Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/routes` | Returns all drawn campus routes |
| `POST` | `/api/routes` | Create new route |
| `PUT` | `/api/routes/:id` | Update route |
| `DELETE` | `/api/routes/:id` | Delete route |

#### Gates
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/gates` | Returns all gate points |
| `POST` | `/api/gates` | Create new gate |
| `PUT` | `/api/gates/:id` | Update gate |
| `DELETE` | `/api/gates/:id` | Delete gate |

#### Parking Metadata (Live Availability)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/parking-metadata` | Returns all live metadata records |
| `GET` | `/api/parking-metadata/name/:name` | Get metadata by parking area name |
| `POST` | `/api/parking-metadata` | Create metadata record |
| `PUT` | `/api/parking-metadata/:id` | Update availability data |

#### Bulk & Health
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/map-data` | Returns all map data in a single request (areas + routes + gates) |
| `GET` | `/health` | Returns `{ status: 'ok', message: '...' }` |

---

## 13. Data Models

### ParkingArea (`backend/src/models/ParkingArea.ts`)
```typescript
{
  name: string              // required, trimmed
  type: string              // default: 'parking'
  geometry: {
    type: 'Polygon'         // GeoJSON polygon
    coordinates: number[][][] // ring of [lon, lat] pairs
  }
  totalSlots: number        // required, min 0
  occupiedSlots: number     // default 0, min 0
  availability: number      // 0–100, auto-computed pre-save:
                            // round((totalSlots - occupiedSlots) / totalSlots × 100)
  entryPoints: number[][]   // array of [lon, lat] pairs
  createdAt: Date           // auto (timestamps: true)
  updatedAt: Date           // auto (timestamps: true)
}
```

### Route (`backend/src/models/Route.ts`)
```typescript
{
  name: string
  geometry: {
    type: 'LineString'
    coordinates: number[][] // array of [lon, lat]
  }
  isOneWay: boolean         // default false
}
```

### Gate (`backend/src/models/Gate.ts`)
```typescript
{
  name: string
  location: {
    type: 'Point'
    coordinates: number[]   // [lon, lat]
  }
  isEntrance: boolean       // true = entry, false = exit
}
```

### ParkingMetadata (`backend/src/models/ParkingMetadata.ts`)
```typescript
{
  areaName: string          // links to ParkingArea.name
  availableSlots: number    // live count
  lastUpdated: Date
}
```

---

## 14. Routing Engine (Internal Pathfinding)

### 14.1 RoadGraph (`src/utils/routing/RoadGraph.js`)

`buildRoadGraph(routes[])`:
1. Iterates all route geometries (LineString coordinates)
2. For each segment `[coord[i-1] → coord[i]]`:
   - Registers both endpoints as nodes (keyed by `lon.toFixed(7)_lat.toFixed(7)`)
   - Adds **bidirectional edge** with Haversine distance as weight
3. After all explicit edges: **implicit snapping** — pairs of nodes within 12m get auto-connected (handles slightly disconnected route endpoints)

`findNearestNode(lat, lng)`:
1. Iterates all route segments
2. Projects the query point onto each segment using `projectPointOntoSegment()`
3. Finds the minimum-distance projection across all segments
4. Inserts a **temporary node** at the snapped coordinate
5. Connects temp node to both endpoints of the parent edge
6. Returns the temp node ID

### 14.2 Dijkstra Engine (`src/utils/routing/engine.js`)

`shortestPath(startId, targetId, graph)`:
1. Initialise all node distances to `Infinity`, start = `0`
2. While unvisited nodes remain:
   - Pop minimum-distance unvisited node
   - For each neighbour: `altDist = currentDist + edgeWeight`
   - If `altDist < known distance` → update distance + record previous
3. Backtrack from target through `previous[]` map to assemble path
4. Returns empty array if target is unreachable (disconnected subgraph)

`computeRoute(startCoord, endCoord, routes)`:
- High-level API: builds graph → snaps both endpoints → runs Dijkstra
- Prepends/appends original coordinates to prevent gaps from snapping offset
- Returns `{ path: [lon,lat][], distance: number }` in meters

### 14.3 Spatial Utilities (`src/utils/routing/spatial.js`)

`haversineDistance(pointA, pointB)`:
- Accurate great-circle distance in meters between two `[lon, lat]` points
- Used for edge weights in graph and snapping distance comparison

`projectPointOntoSegment(p, a, b)`:
- Computes parametric `t` = projection of point `p` onto segment `[a, b]`
- Clamps `t` to `[0, 1]` → gives closest point on segment
- Returns `{ snappedCoord, dist, t }`

---

## Summary Table — All Functionalities

| # | Functionality | File(s) | Key Tech |
|---|---|---|---|
| 1 | Live Dashboard | `LiveDashboard.jsx` | Socket.IO, Chart.js, REST polling |
| 2 | Interactive Map | `CampusMap.jsx` | Mapbox GL JS |
| 3 | Drawing Tools | `CampusMap.jsx` | Mapbox GL Draw |
| 4 | Hybrid Navigation | `CampusMap.jsx`, `useNavigation.js`, `engine.js` | Mapbox Directions API + Dijkstra |
| 5 | Campus Mini-Map | `CampusNavMap.jsx` | SVG, BFS pathfinding |
| 6 | Search Bar | `SearchBar.tsx` | React controlled input |
| 7 | Stats Dashboard | `StatsDashboard.tsx` | Chart.js, Tailwind |
| 8 | GPS Tracking | `useGPSTracking.js` | Browser Geolocation API |
| 9 | Real-Time Updates | `useRealTimeUpdates.ts`, `LiveDashboard.jsx` | Socket.IO, setInterval |
| 10 | Toast Notifications | `Toast.tsx`, `useToast.ts` | CSS animations |
| 11 | Help Panel + Shortcuts | `HelpPanel.tsx`, `keyboardShortcuts.ts` | DOM keydown events |
| 12 | REST API | `backend/src/server.ts` + routes | Express.js |
| 13 | Data Models | `backend/src/models/*` | Mongoose + MongoDB |
| 14 | Routing Engine | `RoadGraph.js`, `engine.js`, `spatial.js` | Dijkstra, Haversine |

---

*Generated: April 2026 | ParkBy Technologies*
