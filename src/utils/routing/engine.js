import { RoadGraph } from './RoadGraph';

/**
 * Executes a Shortest Path algorithm (Dijkstra) over the RoadGraph instance.
 * @param {string} startId ID from findNearestNode
 * @param {string} targetId ID from findNearestNode
 * @param {RoadGraph} graph Instance
 * @returns {Array<{lon: number, lat: number}>} Array of coordinates 
 */
export function shortestPath(startId, targetId, graph) {
    if (!graph.adjacencyList.has(startId) || !graph.adjacencyList.has(targetId)) {
        return [];
    }

    // Priority queue tracking { id, dist }
    const distances = new Map();
    const previous = new Map();
    const unvisited = new Set();

    for (const nodeId of graph.nodes.keys()) {
        distances.set(nodeId, Infinity);
        previous.set(nodeId, null);
        unvisited.add(nodeId);
    }

    distances.set(startId, 0);

    while (unvisited.size > 0) {
        // 1. Get unvisited node with minimum distance
        let currentId = null;
        let minDist = Infinity;

        for (const nodeId of unvisited) {
            const dist = distances.get(nodeId);
            if (dist < minDist) {
                minDist = dist;
                currentId = nodeId;
            }
        }

        if (!currentId || currentId === targetId || minDist === Infinity) break;
        unvisited.delete(currentId);

        // 2. Compute path weight to neighboring edges
        const neighbors = graph.adjacencyList.get(currentId) || [];
        for (const neighbor of neighbors) {
            if (!unvisited.has(neighbor.to)) continue;

            const altDistance = distances.get(currentId) + neighbor.weight;
            if (altDistance < distances.get(neighbor.to)) {
                distances.set(neighbor.to, altDistance);
                previous.set(neighbor.to, currentId);
            }
        }
    }

    // Backtrack to assemble route
    const path = [];
    let curr = targetId;

    // Return early if isolated sub-graph and no connection
    if (previous.get(curr) === null && curr !== startId) {
        return [];
    }

    while (curr !== null) {
        path.unshift(graph.nodes.get(curr));
        curr = previous.get(curr);
    }

    return path;
}

/**
 * Front-end API implementation mapping the Start/End coords to snap+dijkstra
 * @param {Array<number>} startCoord - [lon, lat] 
 * @param {Array<number>} endCoord - [lon, lat]
 * @param {Array<Object>} routes - raw JSON parsed format
 * @returns {Object} { path: Array<[lon,lat]>, distance: number }
 */
export function computeRoute(startCoord, endCoord, routes) {
    const g = new RoadGraph();
    g.buildRoadGraph(routes);

    // Re-format coordinates from standard maps lng/lat inputs
    const startSnappedId = g.findNearestNode(startCoord[1], startCoord[0]);
    const endSnappedId = g.findNearestNode(endCoord[1], endCoord[0]);

    let pathData = shortestPath(startSnappedId, endSnappedId, g);

    // Insert original endpoints into the start & end to prevent gaps from snapping
    if (pathData.length > 0) {
        if (pathData[0][0] !== startCoord[0] || pathData[0][1] !== startCoord[1]) {
            pathData.unshift([...startCoord]);
        }
        const lastP = pathData[pathData.length - 1];
        if (lastP[0] !== endCoord[0] || lastP[1] !== endCoord[1]) {
            pathData.push([...endCoord]);
        }
    } else {
        pathData = [[...startCoord], [...endCoord]];
    }

    // Compute final Distance
    let finalDist = 0;
    for (let i = 0; i < pathData.length - 1; i++) {
        // We can recycle Haversine for the final segments
        const dx = pathData[i + 1][0] - pathData[i][0];
        const dy = pathData[i + 1][1] - pathData[i][1];
        finalDist += Math.sqrt(dx * dx + dy * dy) * 111000;
    }

    return {
        path: pathData,
        distance: finalDist
    };
}
