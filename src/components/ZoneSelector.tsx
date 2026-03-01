// src/components/ZoneSelector.tsx

import { useMemo } from 'react';
import { Navigation } from 'lucide-react';

interface ZoneSelectorProps {
  zones: {
    id: string;
    name: string;
    total: number;
    occupied: number;
    hasCapacity: boolean;
    [key: string]: any;
  }[];
  /** Selected gate id (or null if none). */
  activeGateId: string | null;
  /** Hard‑coded distance matrix gateId -> zoneId -> meters. */
  distances: Record<string, Record<string, number>>;
  onSelect: (zone: any) => void;
}

export const ZoneSelector = ({ zones, activeGateId, distances, onSelect }: ZoneSelectorProps) => {
  const recommendations = useMemo(() => {
    if (!activeGateId || !zones || !zones.length) return [];

    return zones
      .filter(z => z.hasCapacity && z.occupied < z.total)
      .map(z => {
        const distM = distances[activeGateId]?.[z.id];
        const dist = typeof distM === 'number' && !isNaN(distM) ? Math.round(distM) : Infinity;
        const occupancyScore = z.total > 0 ? z.occupied / z.total : 0;
        const score = occupancyScore * 100 + dist / 10;
        return { ...z, distance: dist, score };
      })
      .filter(z => z.distance !== Infinity)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }, [zones, activeGateId, distances]);

  if (!recommendations.length) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 bg-black/90 backdrop-blur-xl rounded-3xl p-6 text-white z-20">
      <div className="text-xs text-slate-400 mb-4 uppercase tracking-wider">
        Recommended Parking
      </div>

      <div className="space-y-3">
        {recommendations.map((zone, idx) => {
          const occupancy = zone.occupied / zone.total;
          const available = zone.total - zone.occupied;

          return (
            <button
              key={zone.id}
              onClick={() => onSelect(zone)}
              className="w-full bg-white/5 hover:bg-blue-600 border-2 border-white/10 hover:border-blue-400 rounded-2xl p-4 transition-all group text-left"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {idx === 0 && (
                      <span className="text-xs bg-green-500 px-2 py-1 rounded-full font-bold">
                        BEST
                      </span>
                    )}
                    <h3 className="font-black text-lg">{zone.name}</h3>
                  </div>
                  
                  <div className="text-sm text-slate-400 mb-2">
                    {available} spots • {typeof zone.distance === 'number' && !isNaN(zone.distance) ? `${zone.distance} m away` : '—'}
                  </div>

                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        occupancy < 0.7 ? 'bg-green-400' :
                        occupancy < 0.9 ? 'bg-amber-400' :
                        'bg-red-400'
                      }`}
                      style={{ width: `${occupancy * 100}%` }}
                    />
                  </div>
                </div>

                <Navigation 
                  size={24} 
                  className="text-slate-400 group-hover:text-white ml-4" 
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};