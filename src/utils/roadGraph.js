// src/utils/roadGraph.js

export class RoadGraph {
  constructor(roads) {
    this.roads = roads;
    this.graph = {};
    this.buildGraph();
  }

  buildGraph() {
    const SNAP_TOLERANCE = 0.00002;

    const getNodeKey = ([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

    const snapToExisting = (point) => {
      const candidates = Object.keys(this.graph);
      for (const key of candidates) {
        const [existLat, existLng] = key.split(',').map(Number);
        const dist = Math.hypot(existLat - point[0], existLng - point[1]);
        if (dist < SNAP_TOLERANCE) return key;
      }
      return getNodeKey(point);
    };

    this.roads.forEach(road => {
      road.points.forEach((point, i) => {
        const nodeKey = snapToExisting(point);
        
        if (!this.graph[nodeKey]) {
          this.graph[nodeKey] = { position: point, neighbors: [] };
        }

        if (i > 0) {
          const prevKey = snapToExisting(road.points[i - 1]);
          if (nodeKey !== prevKey) {
            if (!this.graph[nodeKey].neighbors.includes(prevKey)) {
              this.graph[nodeKey].neighbors.push(prevKey);
            }
            if (!this.graph[prevKey].neighbors.includes(nodeKey)) {
              this.graph[prevKey].neighbors.push(nodeKey);
            }
          }
        }
      });
    });
  }

  findNearestNode(latLng) {
    let minDist = Infinity;
    let nearest = null;

    Object.entries(this.graph).forEach(([key, node]) => {
      const dist = Math.hypot(node.position[0] - latLng[0], node.position[1] - latLng[1]);
      if (dist < minDist) {
        minDist = dist;
        nearest = key;
      }
    });

    return nearest;
  }

  // YOUR EXISTING BFS LOGIC - UNCHANGED!
  findPath(startLatLng, endLatLng) {
    const startNode = this.findNearestNode(startLatLng);
    const endNode = this.findNearestNode(endLatLng);

    if (!startNode || !endNode) return null;

    const queue = [[startNode]];
    const visited = new Set([startNode]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      if (current === endNode) {
        return path.map(key => this.graph[key].position);
      }

      this.graph[current].neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      });
    }

    return null;
  }
}