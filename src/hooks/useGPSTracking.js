// src/hooks/useGPSTracking.js

import { useState, useEffect, useRef } from 'react';

export const useGPSTracking = (options = {}) => {
  const { enableHighAccuracy = true, distanceFilter = 2, roadGraph = null } = options;

  const [location, setLocation] = useState(null);
  const [snappedLocation, setSnappedLocation] = useState(null);
  const [heading, setHeading] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  const watchId = useRef(null);
  const lastPosition = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    setIsTracking(true);

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, heading } = position.coords;
        
        if (accuracy > 50) {
          console.warn(`Low GPS accuracy: ${accuracy}m`);
          return;
        }

        const newLocation = [latitude, longitude];

        if (lastPosition.current) {
          const distance = getDistance(lastPosition.current, newLocation);
          if (distance < distanceFilter) return;
        }

        setLocation(newLocation);
        setAccuracy(accuracy);
        setHeading(heading);
        lastPosition.current = newLocation;

        if (roadGraph) {
          const nearestNode = roadGraph.findNearestNode(newLocation);
          if (nearestNode) {
            const snapped = roadGraph.graph[nearestNode].position;
            setSnappedLocation(snapped);
          } else {
            setSnappedLocation(newLocation);
          }
        } else {
          setSnappedLocation(newLocation);
        }

        setError(null);
      },
      (err) => {
        console.error('GPS error:', err);
        setError(err.message);
        setIsTracking(false);
      },
      { enableHighAccuracy, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [enableHighAccuracy, distanceFilter, roadGraph]);

  return { location, snappedLocation, heading, accuracy, error, isTracking };
};

function getDistance([lat1, lng1], [lat2, lng2]) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}