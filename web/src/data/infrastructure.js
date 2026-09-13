// Critical infrastructure (hospitals) from OpenStreetMap via the Overpass
// API — rubric item 11 ("infrastructure at risk"). CONTEXT.md's own Layer 3
// table warns to "pre-cache at startup — never query live during demo": this
// is a browser-only app with no build-time step, so the closest honest
// equivalent is a long TTL (24 h) through the existing localStorage-backed
// cache() helper. The first load of a given region still makes one live
// Overpass call (unavoidable without a backend), but a demo that switches
// regions, reloads, or runs again within the same day never re-queries —
// which is the actual failure mode the warning is guarding against (Overpass
// is a shared public instance that rate-limits or times out under load).
//
// Normalized shape per facility: { id, name, lat, lon }
// "At risk" (intersecting an active NWS warning polygon) is computed by the
// map layer, not here — this module only fetches locations.

import { fetchJson } from '../fetchJson.js';
import { cached } from '../cache.js';
import { isTestMode, loadFixture } from '../testmode.js';
import { DEFAULT_REGION } from './regions.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const TTL_S = 24 * 60 * 60;

export const DEFAULT_BBOX = DEFAULT_REGION.bbox;

// Overpass wants south,west,north,east — the opposite axis order from this
// app's [minLon, minLat, maxLon, maxLat] bbox convention everywhere else.
function buildQuery([minLon, minLat, maxLon, maxLat]) {
  const box = `${minLat},${minLon},${maxLat},${maxLon}`;
  return (
    `[out:json][timeout:40];` +
    `(node["amenity"="hospital"](${box});way["amenity"="hospital"](${box}););` +
    `out center;`
  );
}

function normalize(el) {
  const lat = el.type === 'node' ? el.lat : el.center?.lat;
  const lon = el.type === 'node' ? el.lon : el.center?.lon;
  if (lat == null || lon == null) return null;
  return {
    id: `${el.type}/${el.id}`,
    name: el.tags?.name ?? 'Unnamed hospital',
    lat,
    lon,
  };
}

export function getFacilities(bbox = DEFAULT_BBOX) {
  const key = `facilities:${isTestMode()}:${bbox.join(',')}`;
  return cached(key, TTL_S, async () => {
    if (isTestMode()) return loadFixture('facilities');

    const url = `${OVERPASS_URL}?data=${encodeURIComponent(buildQuery(bbox))}`;
    // A larger region (e.g. Texas) can take 30+ seconds on Overpass's public
    // instance — well past this app's usual 15 s default — so this call gets
    // its own longer timeout and fewer retries (retrying a slow request just
    // doubles the wait, it doesn't fix a rate limit).
    const raw = await fetchJson(url, { timeoutMs: 45_000, retries: 1 });
    const facilities = (raw.elements ?? []).map(normalize).filter(Boolean);

    return { source: 'osm-overpass', updated: new Date().toISOString(), facilities };
  });
}
