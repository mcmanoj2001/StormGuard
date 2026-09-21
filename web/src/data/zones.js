// Resolves NWS UGC forecast-zone URLs (from an alert's `affectedZones`) to
// their boundary polygons via api.weather.gov/zones/*/{id}. Most active
// alerts carry no embedded geometry at all — only a list of zone URLs — so
// without this, those alerts can't be drawn on the map, hovered, or tested
// against tract centroids in the population panel's point-in-polygon.
//
// Zone boundaries are static geography (they don't change event-to-event),
// so they're cached far longer than the 60s alert-refresh cadence: once a
// zone has been resolved, every later refresh reuses it from cache instead
// of re-fetching, keeping the fan-out cost one-time rather than per-poll.

import { fetchJson } from '../fetchJson.js';
import { cached } from '../cache.js';

const TTL_S = 30 * 24 * 3600; // 30 days — zone boundaries are effectively static

export function getZoneGeometry(zoneUrl) {
  return cached(`zone-geom:${zoneUrl}`, TTL_S, async () => {
    const raw = await fetchJson(zoneUrl);
    return { geometry: raw.geometry ?? null };
  }).then((r) => r.geometry);
}

// Combines several zone polygons into one geometry so an alert spanning
// multiple zones still renders/tests as a single shape. Rings are just
// concatenated, not unioned — fine for both Leaflet rendering and
// point-in-polygon (a point inside any one zone's ring set still counts).
export function mergeZoneGeometries(geometries) {
  const polygons = [];
  for (const g of geometries) {
    if (!g) continue;
    if (g.type === 'Polygon') polygons.push(g.coordinates);
    else if (g.type === 'MultiPolygon') polygons.push(...g.coordinates);
  }
  return polygons.length ? { type: 'MultiPolygon', coordinates: polygons } : null;
}
