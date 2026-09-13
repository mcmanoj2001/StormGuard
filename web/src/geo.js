// Shared point-in-polygon geometry test (even-odd ray casting), used by
// anything that needs to know whether a lat/lon falls inside a GeoJSON
// polygon — the population panel (tract centroids vs. alert polygons) and
// the infrastructure layer (facility risk vs. alert polygons).

// Even-odd ray-casting test for a single ring (array of [lon, lat] pairs).
function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// A polygon's rings are XORed together (rather than only testing the outer
// ring) so interior rings work correctly as holes regardless of winding
// order, which GeoJSON doesn't guarantee.
function pointInPolygonCoords(lon, lat, polygonCoords) {
  let inside = false;
  for (const ring of polygonCoords) {
    if (pointInRing(lon, lat, ring)) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(lon, lat, geometry) {
  if (!geometry) return false; // NWS alerts without polygon geometry (UGC-only) can't be tested
  if (geometry.type === 'Polygon') return pointInPolygonCoords(lon, lat, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly) => pointInPolygonCoords(lon, lat, poly));
  }
  return false;
}
