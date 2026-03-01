// src/utils/coordinateTransformer.js

export class CoordinateTransformer {
  constructor(controlPoints) {
    this.controlPoints = controlPoints;
    this.matrix = this.calculateTransformMatrix();
  }

  calculateTransformMatrix() {
    const points = this.controlPoints;
    
    const scaleX = (points[1].gps[1] - points[0].gps[1]) / (points[1].svg[0] - points[0].svg[0]);
    const scaleY = (points[2].gps[0] - points[0].gps[0]) / (points[2].svg[1] - points[0].svg[1]);
    
    return {
      scaleX,
      scaleY,
      originLat: points[0].gps[0],
      originLng: points[0].gps[1],
      originX: points[0].svg[0],
      originY: points[0].svg[1]
    };
  }

  svgToGPS(x, y) {
    const m = this.matrix;
    const dx = x - m.originX;
    const dy = y - m.originY;
    const lng = m.originLng + (dx * m.scaleX);
    const lat = m.originLat - (dy * m.scaleY);
    return [lat, lng];
  }

  gpsToSVG(lat, lng) {
    const m = this.matrix;
    const dLng = lng - m.originLng;
    const dLat = m.originLat - lat;
    const x = m.originX + (dLng / m.scaleX);
    const y = m.originY + (dLat / m.scaleY);
    return [x, y];
  }

  getDistanceMeters(latLng1, latLng2) {
    const R = 6371000;
    const lat1 = latLng1[0] * Math.PI / 180;
    const lat2 = latLng2[0] * Math.PI / 180;
    const dLat = (latLng2[0] - latLng1[0]) * Math.PI / 180;
    const dLng = (latLng2[1] - latLng1[1]) * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * R;
  }
}