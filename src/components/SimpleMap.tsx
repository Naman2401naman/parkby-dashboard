import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

type SimpleGate = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type SimpleParking = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  total: number;
  occupied: number;
};

interface SimpleMapProps {
  parking: SimpleParking[];
  gates: SimpleGate[];
  selectedGateId: string | null;
}

const token = import.meta.env.VITE_MAPBOX_TOKEN;

function getColor(percent: number) {
  if (percent < 40) return '#22c55e'; // green
  if (percent < 80) return '#facc15'; // yellow
  return '#ef4444'; // red
}

export function SimpleMap({ parking, gates, selectedGateId }: SimpleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;

    mapboxgl.accessToken = token;

    const centerGate = gates[0];
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: centerGate ? [centerGate.lng, centerGate.lat] : [79.0615, 21.1775],
      zoom: 16
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [gates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // gates
    gates.forEach((g) => {
      const el = document.createElement('div');
      el.style.width = '10px';
      el.style.height = '10px';
      el.style.borderRadius = '999px';
      el.style.border = '2px solid #38bdf8';
      el.style.backgroundColor = selectedGateId === g.id ? '#0ea5e9' : '#020617';
      markersRef.current.push(
        new mapboxgl.Marker({ element: el })
          .setLngLat([g.lng, g.lat])
          .addTo(map)
      );
    });

    // parking areas
    parking.forEach((p) => {
      if (p.lat == null || p.lng == null) return;
      const percent = p.total ? Math.round((p.occupied / p.total) * 100) : 0;
      const el = document.createElement('div');
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.borderRadius = '4px';
      el.style.backgroundColor = getColor(percent);
      el.style.boxShadow = '0 0 8px rgba(0,0,0,0.6)';
      markersRef.current.push(
        new mapboxgl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .addTo(map)
      );
    });
  }, [parking, gates, selectedGateId]);

  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-xs text-slate-400">
        Add <code className="bg-slate-800 px-1 rounded">VITE_MAPBOX_TOKEN</code> in <code>.env</code> to see the map.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    />
  );
}

