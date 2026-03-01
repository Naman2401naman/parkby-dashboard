// src/hooks/useNavigation.js

import { useState, useEffect } from 'react';

export const useNavigation = (roadGraph, userLocation) => {
  const [targetZone, setTargetZone] = useState(null);
  const [route, setRoute] = useState(null);
  const [instructions, setInstructions] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [distanceRemaining, setDistanceRemaining] = useState(null);

  useEffect(() => {
    if (!userLocation || !targetZone || !roadGraph) return;

    const targetEntry = targetZone.entryPoints[0];
    const path = roadGraph.findPath(userLocation, targetEntry);

    if (path) {
      setRoute(path);
      const navInstructions = generateInstructions(path, targetZone);
      setInstructions(navInstructions);
      setCurrentStep(0);
    }
  }, [userLocation, targetZone, roadGraph]);

  useEffect(() => {
    if (!userLocation || !route || !instructions.length) return;

    const currentWaypoint = instructions[currentStep]?.waypoint;
    if (!currentWaypoint) return;

    const distToWaypoint = getDistance(userLocation, currentWaypoint);
    setDistanceRemaining(Math.round(distToWaypoint));

    if (distToWaypoint < 5 && currentStep < instructions.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [userLocation, route, instructions, currentStep]);

  const cancelNavigation = () => {
    setTargetZone(null);
    setRoute(null);
    setInstructions([]);
    setCurrentStep(0);
  };

  return {
    targetZone,
    route,
    instructions,
    currentStep,
    distanceRemaining,
    setTargetZone,
    cancelNavigation
  };
};

// YOUR EXISTING getAngle LOGIC!
function generateInstructions(path, targetZone) {
  const instructions = [];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const current = path[i];
    const next = path[i + 1];

    const angle = getAngle(prev, current, next);

    if (Math.abs(angle) > 30) {
      const distance = getDistance(prev, current);

      let direction = 'Continue';
      let icon = '↑';

      if (angle > 30 && angle < 150) {
        direction = 'Turn right';
        icon = '→';
      } else if (angle < -30 && angle > -150) {
        direction = 'Turn left';
        icon = '←';
      }

      instructions.push({
        text: `${direction} in ${Math.round(distance)}m`,
        icon,
        waypoint: current,
        distance: Math.round(distance)
      });
    }
  }

  instructions.push({
    text: `Arrive at ${targetZone.name}`,
    icon: '🅿️',
    waypoint: path[path.length - 1],
    distance: 0
  });

  return instructions;
}

function getAngle(p1, p2, p3) {
  const bearing1 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  const bearing2 = Math.atan2(p3[1] - p2[1], p3[0] - p2[0]);
  let angle = (bearing2 - bearing1) * (180 / Math.PI);
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

function getDistance([lat1, lng1], [lat2, lng2]) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}