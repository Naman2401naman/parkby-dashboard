// src/data/campusConfig.js

export const CAMPUS_CONFIG = {
  name: "Ramdeobaba College of Engineering and Management",
  
  // IMPORTANT: Replace these with your ACTUAL GPS coordinates from Google Maps
  controlPoints: [
    { svg: [0, 0], gps: [21.178021, 79.059448] },        // Northwest
    { svg: [800, 0], gps: [21.178207, 79.063002] },      // Northeast  
    { svg: [0, 600], gps: [21.175706, 79.062316] },      // Southwest
    { svg: [800, 600], gps: [21.175281, 79.059298] }     // Southeast
  ],
  
  center: {
    lat: 21.1770551,  // Center of campus
    lng: 79.0611434
  },
  
  bounds: {
    southwest: { lat: 21.17570, lng: 79.06231 },
    northeast: { lat: 21.17823, lng: 79.06300 }
  },
  
  initialZoom: 17
};