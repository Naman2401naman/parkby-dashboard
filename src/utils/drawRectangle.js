/**
 * Custom MapboxDraw mode: draw_rectangle
 * Click first corner, move mouse to see preview, click second corner to finish.
 * Result is a Polygon feature (rectangle).
 */

const DrawRectangle = {};

DrawRectangle.onSetup = function () {
  const rectangle = this.newFeature({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[]]
    }
  });
  this.addFeature(rectangle);
  this.clearSelectedFeatures();
  this.updateUIClasses({ mouse: 'add' });
  this.setActionableState({ trash: true });
  return {
    rectangle,
    startPoint: null,
    endPoint: null
  };
};

DrawRectangle.onClick = function (state, e) {
  if (!state.startPoint) {
    // First click — set origin corner
    state.startPoint = [e.lngLat.lng, e.lngLat.lat];
  } else {
    // Second click — finish rectangle
    state.endPoint = [e.lngLat.lng, e.lngLat.lat];
    const coords = buildRectCoords(state.startPoint, state.endPoint);
    state.rectangle.setCoordinates([coords]);
    this.map.fire('draw.create', { features: [state.rectangle.toGeoJSON()] });
    this.changeMode('simple_select');
  }
};

DrawRectangle.onMouseMove = function (state, e) {
  if (state.startPoint) {
    // Live preview
    const coords = buildRectCoords(state.startPoint, [e.lngLat.lng, e.lngLat.lat]);
    state.rectangle.setCoordinates([coords]);
  }
};

DrawRectangle.onTap = DrawRectangle.onClick;

DrawRectangle.onKeyUp = function (state, e) {
  if (e.keyCode === 27) { // Escape
    this.deleteFeature([state.rectangle.id], { silent: true });
    this.changeMode('simple_select');
  }
};

DrawRectangle.onStop = function (state) {
  this.updateUIClasses({ mouse: 'none' });
  this.activateUIButton();
  if (!state.endPoint) {
    this.deleteFeature([state.rectangle.id], { silent: true });
  }
};

DrawRectangle.toDisplayFeatures = function (state, geojson, display) {
  display(geojson);
};

DrawRectangle.onTrash = function (state) {
  this.deleteFeature([state.rectangle.id], { silent: true });
  this.changeMode('simple_select');
};

function buildRectCoords(start, end) {
  return [
    [start[0], start[1]],
    [end[0], start[1]],
    [end[0], end[1]],
    [start[0], end[1]],
    [start[0], start[1]]
  ];
}

export default DrawRectangle;

/**
 * Geometry utilities for expanding and flipping rectangles (polygons).
 */

/**
 * Scale a polygon uniformly from its centroid.
 * factor > 1 = expand, factor < 1 = shrink.
 */
export function scalePolygon(coords, factor) {
  const ring = coords[0].slice(0, -1); // exclude closing point
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const scaled = ring.map(([x, y]) => [
    cx + (x - cx) * factor,
    cy + (y - cy) * factor
  ]);
  scaled.push([...scaled[0]]);
  return [scaled];
}

/**
 * Flip polygon horizontally (mirror around vertical center axis).
 */
export function flipHorizontal(coords) {
  const ring = coords[0].slice(0, -1);
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const flipped = ring.map(([x, y]) => [cx + (cx - x), y]);
  flipped.push([...flipped[0]]);
  return [flipped];
}

/**
 * Flip polygon vertically (mirror around horizontal center axis).
 */
export function flipVertical(coords) {
  const ring = coords[0].slice(0, -1);
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const flipped = ring.map(([x, y]) => [x, cy + (cy - y)]);
  flipped.push([...flipped[0]]);
  return [flipped];
}

/**
 * Rotate polygon by angle (degrees) around its centroid.
 */
export function rotatePolygon(coords, angleDeg) {
  const ring = coords[0].slice(0, -1);
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const rad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const rotated = ring.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    return [
      cx + dx * cosA - dy * sinA,
      cy + dx * sinA + dy * cosA
    ];
  });
  rotated.push([...rotated[0]]);
  return [rotated];
}
