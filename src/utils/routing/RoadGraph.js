import { haversineDistance, projectPointOntoSegment } from './spatial';

/**
 * Parses the raw route geometries from the JSON string into an Adjacency List graph structure.
 * Graph Nodes: id(lon_lat), location([lon, lat])
 * Graph Edges: To, Weight(Meter Distance), routeId
 */
export class RoadGraph {
    constructor() {
        this.adjacencyList = new Map(); // Map<nodeId, Array<{to: nodeId, weight: number, routeId: string}>>
        this.nodes = new Map(); // Map<nodeId, {lon, lat}>
        this.routes = [];
    }

    // Generate deterministic ID from coordinate float
    static getCoordId(coord) {
        return `${coord[0].toFixed(7)}_${coord[1].toFixed(7)}`;
    }

    /**
     * Builds the graph from the given routes data parsed directly from JSON
     */
    buildRoadGraph(routes) {
        this.adjacencyList.clear();
        this.nodes.clear();
        this.routes = routes || [];

        // Helper to register node
        const addNode = (coord) => {
            const id = RoadGraph.getCoordId(coord);
            if (!this.nodes.has(id)) {
                this.nodes.set(id, coord);
                this.adjacencyList.set(id, []);
            }
            return id;
        };

        // Helper to register bi-directional edge
        const addEdge = (id1, id2, dist, routeId) => {
            if (id1 === id2) return; // Ignore zero-length edges
            this.adjacencyList.get(id1).push({ to: id2, weight: dist, routeId });
            this.adjacencyList.get(id2).push({ to: id1, weight: dist, routeId });
        };

        // 1. Plot all segments explicitly defined in the map data
        for (const route of this.routes) {
            if (!route.coords || route.coords.length < 2) continue;

            let prevId = addNode(route.coords[0]);

            for (let i = 1; i < route.coords.length; i++) {
                const currCoord = route.coords[i];
                const currId = addNode(currCoord);

                const dist = haversineDistance(route.coords[i - 1], currCoord);
                addEdge(prevId, currId, dist, route.id);

                prevId = currId;
            }
        }

        // 2. Implicit snapping for slightly disconnected route nodes (tolerate 12 meters)
        const allNodeIds = Array.from(this.nodes.keys());
        for (let i = 0; i < allNodeIds.length; i++) {
            for (let j = i + 1; j < allNodeIds.length; j++) {
                const id1 = allNodeIds[i];
                const id2 = allNodeIds[j];
                const p1 = this.nodes.get(id1);
                const p2 = this.nodes.get(id2);

                const dist = haversineDistance(p1, p2);
                if (dist > 0 && dist < 12) {
                    addEdge(id1, id2, dist, 'implicit-connection');
                }
            }
        }
    }

    /**
     * Snaps an arbitrary arbitrary coordinate (lat, lng) to the nearest edge on the graph
     * and essentially inserts a temporary node onto that geometric edge. 
     * @param {number} lat
     * @param {number} lng
     * @returns {Object} Temporary Node Id representing the snapped point
     */
    findNearestNode(lat, lng) {
        const targetPoint = [lng, lat];
        let minDistance = Infinity;
        let bestSnappedPoint = null;
        let closestEdgeNodes = null; // { u: id, v: id }

        for (const route of this.routes) {
            if (!route.coords) continue;

            for (let i = 0; i < route.coords.length - 1; i++) {
                const a = route.coords[i];
                const b = route.coords[i + 1];

                const { snappedCoord, dist } = projectPointOntoSegment(targetPoint, a, b);

                if (dist < minDistance) {
                    minDistance = dist;
                    bestSnappedPoint = snappedCoord;
                    closestEdgeNodes = {
                        u: RoadGraph.getCoordId(a),
                        v: RoadGraph.getCoordId(b)
                    };
                }
            }
        }

        if (!bestSnappedPoint) {
            // Fallback if no routes exist
            return RoadGraph.getCoordId(targetPoint);
        }

        // Generate unique ID for this dynamic snapped point
        const snappedId = RoadGraph.getCoordId(bestSnappedPoint);

        // If it perfectly overlaps an existing node, just return that node
        if (this.nodes.has(snappedId)) {
            return snappedId;
        }

        // Insert temp node into Graph
        this.nodes.set(snappedId, bestSnappedPoint);
        this.adjacencyList.set(snappedId, []);

        // Connect temp node to the nodes of the edge it landed on
        if (closestEdgeNodes) {
            const { u, v } = closestEdgeNodes;

            const distU = haversineDistance(bestSnappedPoint, this.nodes.get(u));
            const distV = haversineDistance(bestSnappedPoint, this.nodes.get(v));

            this.adjacencyList.get(snappedId).push({ to: u, weight: distU, routeId: 'temp-snap' });
            this.adjacencyList.get(u).push({ to: snappedId, weight: distU, routeId: 'temp-snap' });

            this.adjacencyList.get(snappedId).push({ to: v, weight: distV, routeId: 'temp-snap' });
            this.adjacencyList.get(v).push({ to: snappedId, weight: distV, routeId: 'temp-snap' });
        }

        return snappedId;
    }
}
