// U.S. Geological Survey Instantaneous Values — 15-minute stream gauge
// readings, fetched directly from waterservices.usgs.gov (CORS-enabled).
// Requests the last 4 hours so we can compute trajectory (rate of rise/fall),
// not just current state — a gauge rising fast below flood stage is more
// dangerous than one falling above it (rubric R5).
//
// Normalized shape per gauge:
// { id, name, lat, lon, stage_ft, discharge_cfs, rate_ft_per_hr, trend,
//   time, severity }

import { fetchJson } from '../fetchJson.js';
import { cached } from '../cache.js';
import { isTestMode, loadFixture } from '../testmode.js';
import { DEFAULT_REGION } from './regions.js';

const USGS_IV = 'https://waterservices.usgs.gov/nwis/iv/';
const TTL_S = 5 * 60;

// Default area of interest — re-exported from regions.js's single source of
// truth so this and nhc.js's fallback never drift from the actual default
// region a user can also select from the UI. minLon,minLat,maxLon,maxLat.
export const DEFAULT_BBOX = DEFAULT_REGION.bbox;

// KNOWN LIMITATION (R3): these are fixed absolute stage-height thresholds,
// not real per-gauge flood stage. A gauge's actual flood category depends on
// its local datum — the same 20ft reading is "moderate" on one river and
// "normal pool" on another. Calibrated to look reasonable for the default
// Louisiana / lower-Mississippi AOI only; expanding past that AOI (or
// enabling region selection) will misclassify gauges elsewhere. Surfaced to
// the user in the About modal's Known Limitations section rather than left
// as a silent assumption.
//
// Investigated two paths to real per-gauge thresholds and shelved both for
// now rather than ship something unreliable:
//   - NWS NWPS/AHPS (api.water.noaa.gov/nwps/v1/gauges/{lid}) DOES have real
//     flood.categories.{major,moderate,minor}.stage per site — but it's
//     keyed by NWS Location ID (LID), not USGS site number, and the list
//     endpoint doesn't reliably return a usgsId to cross-reference (tested:
//     empty on every gauge checked, and its bbox filter didn't work either).
//     Needs a proper USGS-site-to-NWS-LID crosswalk, not a live lookup.
//   - USGS's own site metadata service (waterservices.usgs.gov/nwis/site/)
//     does NOT publish flood-stage thresholds despite CONTEXT.md's Layer 1
//     table listing that — confirmed by fetching a real site's expanded
//     output and finding no flood/stage columns at all. That field simply
//     isn't there; worth fixing in CONTEXT.md separately.
// Real fix: build the LID crosswalk once (as static/cached data, not a
// live per-gauge call) as part of the NWS AHPS forecast-crest integration —
// that work needs the same crosswalk anyway, so solve it once, not twice.
function classifySeverity(stageFt) {
  if (stageFt == null) return 'unknown';
  if (stageFt >= 30) return 'major';
  if (stageFt >= 20) return 'moderate';
  if (stageFt >= 12) return 'minor';
  return 'normal';
}

function classifyTrend(rate) {
  if (rate == null) return 'unknown';
  if (rate > 0.1) return 'rising';
  if (rate < -0.1) return 'falling';
  return 'steady';
}

// Rate of change in ft/hr: latest stage vs the reading closest to 1 h prior.
function rateOfChange(points) {
  if (!points || points.length < 2) return null;
  const latest = points.at(-1);
  const target = new Date(latest.dateTime).getTime() - 3600_000;
  let prior = points[0];
  for (const p of points) {
    if (Math.abs(new Date(p.dateTime).getTime() - target) <
        Math.abs(new Date(prior.dateTime).getTime() - target)) prior = p;
  }
  const hours = (new Date(latest.dateTime) - new Date(prior.dateTime)) / 3600_000;
  if (hours <= 0) return null;
  return (Number(latest.value) - Number(prior.value)) / hours;
}

// USGS's Instantaneous Values service rejects a bounding box past a certain
// size — confirmed live via its own error on a Texas-sized request: "Bounding
// Box too large [13.1x10.7 degrees]... must be <= 2.6 degrees at latitude
// 25.8 with requested height of 10.7 degrees" (implies a width*height cap
// around ~28 sq degrees). Louisiana's default bbox (~22 sq degrees) fits in
// one request; region selection can pick a state several times that size.
// SAFE_AREA is set comfortably under the observed ceiling so the default
// region keeps making exactly the one request it always has (no behavior
// change for the common case) while a larger region splits into a grid of
// smaller requests instead of silently returning nothing.
const SAFE_AREA_SQ_DEG = 24;
const TILE_MAX_DEG = 3;

function splitBbox([minLon, minLat, maxLon, maxLat]) {
  const width = maxLon - minLon;
  const height = maxLat - minLat;
  if (width * height <= SAFE_AREA_SQ_DEG) return [[minLon, minLat, maxLon, maxLat]];

  const cols = Math.max(1, Math.ceil(width / TILE_MAX_DEG));
  const rows = Math.max(1, Math.ceil(height / TILE_MAX_DEG));
  const tiles = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      tiles.push([
        minLon + (c * width) / cols,
        minLat + (r * height) / rows,
        minLon + ((c + 1) * width) / cols,
        minLat + ((r + 1) * height) / rows,
      ]);
    }
  }
  return tiles;
}

async function fetchGaugesInBbox(bbox) {
  const url = new URL(USGS_IV);
  url.searchParams.set('format', 'json');
  url.searchParams.set('bBox', bbox.map((n) => n.toFixed(4)).join(','));
  // 00065 = gage height (ft), 00060 = discharge (cfs)
  url.searchParams.set('parameterCd', '00065,00060');
  url.searchParams.set('siteStatus', 'active');
  url.searchParams.set('period', 'PT4H');

  const raw = await fetchJson(url.toString());

  const bySite = new Map();
  for (const series of raw.value?.timeSeries ?? []) {
    const site = series.sourceInfo;
    const id = site.siteCode?.[0]?.value;
    if (!id) continue;
    const entry = bySite.get(id) ?? {
      id,
      name: site.siteName,
      lat: site.geoLocation?.geogLocation?.latitude,
      lon: site.geoLocation?.geogLocation?.longitude,
      stage_ft: null,
      discharge_cfs: null,
      rate_ft_per_hr: null,
      time: null,
    };
    const param = series.variable?.variableCode?.[0]?.value;
    const points = series.values?.[0]?.value ?? [];
    const latest = points.at(-1);
    if (latest) {
      const num = Number(latest.value);
      if (param === '00065') {
        entry.stage_ft = num;
        const rate = rateOfChange(points);
        entry.rate_ft_per_hr = rate == null ? null : Math.round(rate * 100) / 100;
      }
      if (param === '00060') entry.discharge_cfs = num;
      entry.time = latest.dateTime;
    }
    bySite.set(id, entry);
  }
  return bySite;
}

export function getGauges(bbox = DEFAULT_BBOX) {
  const key = `gauges:${isTestMode()}:${bbox.join(',')}`;
  return cached(key, TTL_S, async () => {
    if (isTestMode()) return loadFixture('gauges');

    const tiles = splitBbox(bbox);
    // Each tile fetched (and caught) independently — the same bulkhead
    // pattern as everywhere else in this app: one oversized or briefly-
    // unlucky tile shouldn't blank out gauges from the rest of the region.
    const tileResults = await Promise.all(
      tiles.map((tile) =>
        fetchGaugesInBbox(tile).catch((err) => {
          console.error(`gauge tile fetch failed for bbox ${tile.join(',')}`, err);
          return new Map();
        })
      )
    );

    const bySite = new Map();
    for (const tileMap of tileResults) {
      for (const [id, entry] of tileMap) bySite.set(id, entry);
    }

    const gauges = [...bySite.values()].map((g) => ({
      ...g,
      severity: classifySeverity(g.stage_ft),
      trend: classifyTrend(g.rate_ft_per_hr),
    }));

    return { source: 'usgs-iv', updated: new Date().toISOString(), gauges };
  });
}
