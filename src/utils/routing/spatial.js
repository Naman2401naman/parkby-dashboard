/**
 * Utility functions for spatial calculations.
 */

/**
 * Calculate distance between two points using the Haversine formula.
 * @param {Array<number>} pointA - [longitude, latitude]
 * @param {Array<number>} pointB - [longitude, latitude]
 * @returns {number} distance in meters
 */
export function haversineDistance(pointA, pointB) {
    const [lon1, lat1] = pointA;
    const [lon2, lat2] = pointB;
    const R = 6371e3; // Earth's radius in meters
    const toRadian = angle => (Math.PI / 180) * angle;

    const dLat = toRadian(lat2 - lat1);
    const dLon = toRadian(lon2 - lon1);
    const lat1Rad = toRadian(lat1);
    const lat2Rad = toRadian(lat2);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Projects a point onto a line segment and calculates the snapped coordinate and distance.
 * @param {Array<number>} p - The point [lon, lat]
 * @param {Array<number>} a - Start of line segment [lon, lat]
 * @param {Array<number>} b - End of line segment [lon, lat]
 * @returns {Object} { snappedCoord: [lon, lat], dist: distance_in_meters, t: parametric_position }
 */
export function projectPointOntoSegment(p, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];

    // Point is the segment
    if (dx === 0 && dy === 0) {
        return { snappedCoord: a, dist: haversineDistance(p, a), t: 0 };
    }

    // Calculate projected segment percentage (t)
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);

    let snappedCoord;
    if (t < 0) {
        snappedCoord = a;
    } else if (t > 1) {
        snappedCoord = b;
    } else {
        snappedCoord = [a[0] + t * dx, a[1] + t * dy];
    }

    return {
        snappedCoord,
        dist: haversineDistance(p, snappedCoord),
        t: Math.max(0, Math.min(1, t)) // clamped t
    };
}
