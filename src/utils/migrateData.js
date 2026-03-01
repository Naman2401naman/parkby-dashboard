// src/utils/migrateData.js

export function migrateToGPS(parkingData, paths, entryPoints, transformer) {
  // Migrate parking zones
  const gpsZones = parkingData.map(zone => {
    const centerX = zone.x + zone.w / 2;
    const centerY = zone.y + zone.h / 2;
    const [centerLat, centerLng] = transformer.svgToGPS(centerX, centerY);

    // Convert corners to GPS polygon
    const corners = [
      [zone.x, zone.y],
      [zone.x + zone.w, zone.y],
      [zone.x + zone.w, zone.y + zone.h],
      [zone.x, zone.y + zone.h],
      [zone.x, zone.y]
    ];

    const gpsCorners = corners.map(([x, y]) => transformer.svgToGPS(x, y));

    // Convert entry points
    const gpsEntryPoints = (zone.entryPoints || []).map(([x, y]) => 
      transformer.svgToGPS(x, y)
    );

    return {
      id: zone.id,
      name: zone.name,
      total: zone.total,
      occupied: zone.occupied,
      type: zone.type,
      hasCapacity: zone.hasCapacity,
      center: [centerLat, centerLng],
      polygon: gpsCorners,
      entryPoints: gpsEntryPoints,
      svgData: { x: zone.x, y: zone.y, w: zone.w, h: zone.h, r: zone.r }
    };
  });

  // Migrate roads
  const gpsRoads = paths.map(path => ({
    id: path.id,
    points: path.points.map(([x, y]) => transformer.svgToGPS(x, y)),
    svgPoints: path.points
  }));

  // Migrate entry gates
  const gpsGates = entryPoints.map(entry => ({
    id: entry.id,
    name: entry.name,
    position: transformer.svgToGPS(entry.x, entry.y),
    svgPosition: [entry.x, entry.y]
  }));

  return {
    zones: gpsZones,
    roads: gpsRoads,
    gates: gpsGates
  };
}