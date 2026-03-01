import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { Square, Trash2, Save, Route as RouteIcon } from 'lucide-react';
import { getRoute } from '../data/routeData';

type Gate = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type ParkingArea = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  total: number;
  occupied: number;
  bounds?: [[number, number], [number, number]]; // [[west, south], [east, north]]
};

interface EnhancedMapProps {
  parking: ParkingArea[];
  gates: Gate[];
  selectedGateId: string | null;
  onParkingUpdate?: (id: string, updates: Partial<ParkingArea>) => void;
  recommendedParkingId?: string;
}

const token = import.meta.env.VITE_MAPBOX_TOKEN;

function getColor(percent: number) {
  if (percent < 40) return '#10b981'; // emerald
  if (percent < 80) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

export function EnhancedMap({
  parking,
  gates,
  selectedGateId,
  onParkingUpdate,
  recommendedParkingId
}: EnhancedMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [drawMode, setDrawMode] = useState<'none' | 'parking' | 'route'>('none');

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;

    mapboxgl.accessToken = token;

    const centerGate = gates[0];
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: centerGate ? [centerGate.lng, centerGate.lat] : [79.0615, 21.1775],
      zoom: 16,
      pitch: 45,
      bearing: 0
    });

    // Add drawing controls
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      styles: [
        // Polygon fill
        {
          id: 'gl-draw-polygon-fill',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.3
          }
        },
        // Polygon outline
        {
          id: 'gl-draw-polygon-stroke',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'line-color': '#10b981',
            'line-width': 3
          }
        },
        // Polygon vertices
        {
          id: 'gl-draw-polygon-vertices',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
          paint: {
            'circle-radius': 6,
            'circle-color': '#10b981',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }
        },
        // Line
        {
          id: 'gl-draw-line',
          type: 'line',
          filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 3,
            'line-dasharray': [2, 2]
          }
        }
      ]
    });

    map.addControl(draw, 'top-left');
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    mapRef.current = map;
    drawRef.current = draw;

    // Handle draw events
    map.on('draw.create', (e: any) => {
      console.log('Created feature:', e.features);
    });

    map.on('draw.update', (e: any) => {
      console.log('Updated feature:', e.features);
    });

    map.on('draw.delete', (e: any) => {
      console.log('Deleted feature:', e.features);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [gates]);

  // Draw parking areas as rectangles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Remove existing parking layers
    if (map.getLayer('parking-fills')) map.removeLayer('parking-fills');
    if (map.getLayer('parking-borders')) map.removeLayer('parking-borders');
    if (map.getLayer('parking-labels')) map.removeLayer('parking-labels');
    if (map.getSource('parking-areas')) map.removeSource('parking-areas');

    // Create GeoJSON features for parking areas
    const features = parking.map((p) => {
      const percent = p.total ? Math.round((p.occupied / p.total) * 100) : 0;

      // Create rectangle bounds
      let bounds = p.bounds;
      if (!bounds) {
        // Default rectangle size
        const size = 0.0003;
        bounds = [
          [p.lng - size, p.lat - size],
          [p.lng + size, p.lat + size]
        ];
      }

      return {
        type: 'Feature',
        id: p.id,
        properties: {
          id: p.id,
          name: p.name,
          percent,
          color: getColor(percent),
          occupied: p.occupied,
          total: p.total,
          isRecommended: p.id === recommendedParkingId
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [bounds[0][0], bounds[0][1]], // SW
            [bounds[1][0], bounds[0][1]], // SE
            [bounds[1][0], bounds[1][1]], // NE
            [bounds[0][0], bounds[1][1]], // NW
            [bounds[0][0], bounds[0][1]]  // close
          ]]
        }
      };
    });

    map.addSource('parking-areas', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: features as any
      }
    });

    // Add fill layer
    map.addLayer({
      id: 'parking-fills',
      type: 'fill',
      source: 'parking-areas',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': [
          'case',
          ['get', 'isRecommended'],
          0.6,
          0.4
        ]
      }
    });

    // Add border layer
    map.addLayer({
      id: 'parking-borders',
      type: 'line',
      source: 'parking-areas',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': [
          'case',
          ['get', 'isRecommended'],
          4,
          2
        ]
      }
    });

    // Add labels
    map.addLayer({
      id: 'parking-labels',
      type: 'symbol',
      source: 'parking-areas',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 2
      }
    });

    // Add click handler for editing
    map.on('click', 'parking-fills', (e) => {
      if (e.features && e.features[0]) {
        const feature = e.features[0];
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="color: #000; padding: 4px;">
              <strong>${feature.properties?.name}</strong><br/>
              ${feature.properties?.occupied}/${feature.properties?.total} occupied<br/>
              ${feature.properties?.percent}% full
            </div>
          `)
          .addTo(map);
      }
    });

    map.on('mouseenter', 'parking-fills', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'parking-fills', () => {
      map.getCanvas().style.cursor = '';
    });

  }, [parking, recommendedParkingId]);

  // Add pulsing animation for recommended spot
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !recommendedParkingId) return;

    // Add pulsing circle layer
    if (!map.getSource('recommended-pulse')) {
      const recommended = parking.find(p => p.id === recommendedParkingId);
      if (!recommended) return;

      map.addSource('recommended-pulse', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [recommended.lng, recommended.lat]
          }
        }
      });

      map.addLayer({
        id: 'recommended-pulse-layer',
        type: 'circle',
        source: 'recommended-pulse',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15, 20,
            18, 40
          ],
          'circle-color': '#10b981',
          'circle-opacity': 0.4,
          'circle-blur': 0.5
        }
      });
    }

    return () => {
      if (map.getLayer('recommended-pulse-layer')) {
        map.removeLayer('recommended-pulse-layer');
      }
      if (map.getSource('recommended-pulse')) {
        map.removeSource('recommended-pulse');
      }
    };
  }, [recommendedParkingId, parking]);

  // Visualize routes from selected gate to parking areas
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedGateId || !map.isStyleLoaded()) return;

    // Remove existing route layers
    if (map.getLayer('routes-layer')) map.removeLayer('routes-layer');
    if (map.getLayer('routes-arrows')) map.removeLayer('routes-arrows');
    if (map.getSource('routes')) map.removeSource('routes');

    // Get routes from selected gate to all parking areas
    const routeFeatures = parking
      .filter(p => p.total > p.occupied) // Only show routes to available parking
      .map(p => {
        const route = getRoute(selectedGateId, p.id);
        if (!route) return null;

        return {
          type: 'Feature',
          properties: {
            parkingId: p.id,
            parkingName: p.name,
            distance: route.distance,
            isRecommended: p.id === recommendedParkingId
          },
          geometry: {
            type: 'LineString',
            coordinates: route.coordinates
          }
        };
      })
      .filter(Boolean);

    if (routeFeatures.length === 0) return;

    map.addSource('routes', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: routeFeatures as any
      }
    });

    // Add route lines
    map.addLayer({
      id: 'routes-layer',
      type: 'line',
      source: 'routes',
      paint: {
        'line-color': [
          'case',
          ['get', 'isRecommended'],
          '#10b981', // green for recommended
          '#3b82f6'  // blue for others
        ],
        'line-width': [
          'case',
          ['get', 'isRecommended'],
          4,
          2
        ],
        'line-opacity': 0.8,
        'line-dasharray': [2, 1]
      }
    });

    return () => {
      if (map.getLayer('routes-layer')) map.removeLayer('routes-layer');
      if (map.getLayer('routes-arrows')) map.removeLayer('routes-arrows');
      if (map.getSource('routes')) map.removeSource('routes');
    };
  }, [selectedGateId, parking, recommendedParkingId]);

  // Update gate markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    gates.forEach((g) => {
      const el = document.createElement('div');
      el.className = 'gate-marker';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.border = '3px solid #3b82f6';
      el.style.backgroundColor = selectedGateId === g.id ? '#3b82f6' : '#020617';
      el.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.8)';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([g.lng, g.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<div style="color: #000;"><strong>${g.name}</strong></div>`)
        )
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [gates, selectedGateId]);

  const startDrawParking = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;

    draw.changeMode('draw_polygon');
    setDrawMode('parking');
  }, []);

  const startDrawRoute = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;

    draw.changeMode('draw_line_string');
    setDrawMode('route');
  }, []);

  const deleteSelected = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;

    const selected = draw.getSelected();
    if (selected.features.length > 0) {
      const ids = selected.features.map((f: any) => f.id as string);
      draw.delete(ids);
    }
  }, []);

  const saveDrawings = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;

    const data = draw.getAll();
    console.log('Saved drawings:', JSON.stringify(data, null, 2));
    alert('Drawings saved to console!');
  }, []);

  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-xs text-slate-400">
        Add <code className="bg-slate-800 px-1 rounded">VITE_MAPBOX_TOKEN</code> in <code>.env</code> to see the map.
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Drawing controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
        <button
          onClick={startDrawParking}
          className={`px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-bold transition ${drawMode === 'parking'
            ? 'bg-emerald-500 text-white'
            : 'bg-slate-900/90 text-slate-200 hover:bg-emerald-500/20 border border-white/10'
            }`}
          title="Draw Parking Area"
        >
          <Square size={16} />
          Draw Parking
        </button>

        <button
          onClick={startDrawRoute}
          className={`px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-bold transition ${drawMode === 'route'
            ? 'bg-blue-500 text-white'
            : 'bg-slate-900/90 text-slate-200 hover:bg-blue-500/20 border border-white/10'
            }`}
          title="Draw Route"
        >
          <RouteIcon size={16} />
          Draw Route
        </button>

        <button
          onClick={deleteSelected}
          className="px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-bold bg-slate-900/90 text-red-400 hover:bg-red-500/20 border border-white/10 transition"
          title="Delete Selected"
        >
          <Trash2 size={16} />
          Delete
        </button>

        <button
          onClick={saveDrawings}
          className="px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-bold bg-slate-900/90 text-blue-400 hover:bg-blue-500/20 border border-white/10 transition"
          title="Save Drawings"
        >
          <Save size={16} />
          Save
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-slate-900/90 border border-white/10 rounded-xl p-3 text-xs">
        <div className="font-bold text-slate-200 mb-2">Occupancy</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }} />
            <span className="text-slate-300">&lt; 40%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }} />
            <span className="text-slate-300">40-80%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }} />
            <span className="text-slate-300">&gt; 80%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
