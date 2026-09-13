// NWS AHPS/NWPS forecast points — river gauges NWS forecasts explicitly
// (not just observes), fetched from api.water.noaa.gov (CORS-enabled). This
// is the CONTEXT §5 Tier 3 / rubric R1+R3 piece: unlike USGS's raw stage
// readings, each point carries a real forecast (stage + valid time) AND a
// floodCategory computed by NWS from that site's own actual flood-stage
// thresholds — not the fixed-threshold approximation classifySeverity() in
// usgs.js has to use for the broader USGS gauge set (see the KNOWN
// LIMITATION comment there). For these specific points, severity is
// authoritative, not estimated.
//
// Discovery note: the NWPS gauges list endpoint (bbox/state-filtered) is
// unreliable — bbox params are accepted but silently ignored (always
// returns the same 2 unrelated gauges regardless of bbox), and a state
// filter causes the request to hang/fail outright. The single-gauge detail
// endpoint (/gauges/{lid}) is reliable, so this module uses a small, curated
// list of real LIDs for the app's Louisiana/lower-Mississippi AOI instead of
// live discovery — each one verified against the live API before being
// added here, not guessed. Extend this list by finding more LIDs (e.g. via
// a WFO river page like weather.gov/lix/rivers or water.noaa.gov/gauges/
// search) and verifying each with a single GET before adding it.
//
// Normalized shape per point:
// { lid, name, lat, lon, stage_ft, floodCategory, categories,
//   forecast: { stage_ft, validTime, floodCategory } | null }

import { fetchJson } from '../fetchJson.js';
import { cached } from '../cache.js';
import { isTestMode, loadFixture } from '../testmode.js';

const NWPS_BASE = 'https://api.water.noaa.gov/nwps/v1/gauges';
const TTL_S = 6 * 60 * 60; // CONTEXT: AHPS forecasts update on a 6h cadence

// Curated, individually-verified LIDs covering the major rivers in the
// default AOI: Mississippi mainstem, Pearl, Atchafalaya, Red, Calcasieu.
export const AHPS_LIDS = [
  'BTRL1', // Mississippi River at Baton Rouge
  'RRLL1', // Mississippi River at Red River Landing
  'JACM6', // Pearl River at Jackson, MS
  'ROCM6', // Pearl River near Rockport, MS
  'MTCM6', // Pearl River near Monticello, MS
  'CLMM6', // Pearl River near Columbia, MS
  'BXAL1', // Pearl River near Bogalusa, LA
  'PERL1', // Pearl River near Pearl River, LA
  'PRBL1', // Pearl River above Slidell, LA
  'MCGL1', // Atchafalaya River at Morgan City
  'BLRL1', // Atchafalaya River above Butte La Rose
  'AEXL1', // Red River at Alexandria
  'KDRL1', // Calcasieu River near Kinder
];

// NWS's own category vocabulary reused as-is (rather than remapped into
// classifySeverity's approximate scheme) so a forecast card can honestly
// say "NWS-verified", not "estimated". 'action' renders with its own label
// rather than being folded into 'minor' — it's stage-above-normal but
// below official flood stage, a distinct concept worth keeping visible.
const CATEGORY_LABEL = {
  no_flooding: 'Normal',
  action: 'Action stage',
  minor: 'Minor flood stage',
  moderate: 'Moderate flood stage',
  major: 'Major flood stage',
};

// Maps onto the app's existing severity CSS classes/marker colors for
// visual consistency with USGS gauges, without pretending the underlying
// number is the same kind of thing.
const CATEGORY_SEVERITY = {
  no_flooding: 'normal',
  action: 'minor',
  minor: 'minor',
  moderate: 'moderate',
  major: 'major',
};

export function categoryLabel(cat) {
  return CATEGORY_LABEL[cat] ?? 'Unknown';
}

export function categorySeverity(cat) {
  return CATEGORY_SEVERITY[cat] ?? 'unknown';
}

async function fetchPoint(lid) {
  const raw = await fetchJson(`${NWPS_BASE}/${lid}`);
  const observed = raw.status?.observed;
  const forecastRaw = raw.status?.forecast;
  return {
    lid,
    name: raw.name,
    lat: raw.latitude,
    lon: raw.longitude,
    stage_ft: observed?.primary ?? null,
    floodCategory: observed?.floodCategory ?? 'unknown',
    categories: raw.flood?.categories ?? null,
    forecast: forecastRaw
      ? {
          stage_ft: forecastRaw.primary ?? null,
          validTime: forecastRaw.validTime ?? null,
          floodCategory: forecastRaw.floodCategory ?? 'unknown',
        }
      : null,
  };
}

export function getForecastPoints(lids = AHPS_LIDS) {
  const key = `ahps:${isTestMode()}:${lids.join(',')}`;
  return cached(key, TTL_S, async () => {
    if (isTestMode()) return loadFixture('ahps');

    // Each LID fetched (and caught) independently — the bulkhead pattern
    // from main.js's refresh(), applied here too: one dead forecast point
    // must never blank out the other twelve.
    const results = await Promise.all(
      lids.map((lid) =>
        fetchPoint(lid).catch((err) => {
          console.error(`AHPS point ${lid} fetch failed`, err);
          return null;
        })
      )
    );
    const points = results.filter(Boolean);

    return { source: 'nws-ahps', updated: new Date().toISOString(), points };
  });
}
