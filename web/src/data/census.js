// U.S. Census population by tract, for the affected-population point-in-
// polygon estimate (CONTEXT's self-declared differentiator). Two
// independent federal sources, joined client-side by GEOID:
//
//  - TIGERweb (tigerweb.geo.census.gov) — tract polygon geometry + county
//    names. No API key needed; verified live. Louisiana has ~1,388 tracts,
//    which at full polygon precision is 10+MB — far too heavy for a
//    browser-only app with no backend to cache/compress it. Fetched instead
//    with server-side simplification (maxAllowableOffset), which brings one
//    county from 1.15MB down to ~26KB — confirmed live, extrapolates to
//    roughly 300-350KB statewide. An approximate centroid is computed
//    client-side from the simplified outer ring (a plain vertex average,
//    not an area-weighted centroid) — adequate for a population ESTIMATE,
//    not survey-grade geography, consistent with how the rest of this app
//    treats its numbers.
//  - Census ACS 5-year (api.census.gov) — actual population per tract
//    (B01003_001E). REQUIRES an API key as of this vintage: Census has
//    tightened keyless access since this repo's own .env.example was
//    written ("works without a key at low volume" is no longer accurate —
//    confirmed live, every unkeyed request returns an HTML "Missing Key"
//    page, not throttled JSON). Get a free key at
//    https://api.census.gov/data/key_signup.html and set
//    VITE_CENSUS_API_KEY. Without one, this still returns real tract
//    boundaries with population left unset, so the point-in-polygon
//    geometry itself can be demoed even without a key — only the actual
//    headcount needs it.
//
// State-scoped by the user's selected region (see regions.js) — Census/
// TIGERweb queries are inherently per-state, so a region spanning more than
// one state (the default AOI also touches southern Mississippi, for the
// Pearl River AHPS gauges) only gets population data for its primary state.
// A known, documented scope limit, not an oversight (see the About modal).

import { fetchJson } from '../fetchJson.js';
import { cached } from '../cache.js';
import { isTestMode, loadFixture } from '../testmode.js';
import { DEFAULT_REGION } from './regions.js';

const TIGERWEB_TRACTS =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/4/query';
const TIGERWEB_COUNTIES =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query';
const ACS_BASE = 'https://api.census.gov/data/2022/acs/acs5';
const TTL_S = 24 * 3600;

// Plain average of the outer ring's vertices — not area-weighted, but
// cheap and good enough for a point-in-polygon population estimate.
function approxCentroid(rings) {
  const ring = rings?.[0];
  if (!ring?.length) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return { x: sx / ring.length, y: sy / ring.length };
}

// TIGERweb serves Web Mercator (EPSG:3857) by default; alert/flood GeoJSON
// is WGS84 lat/lon. Convert so tract centroids and alert polygons share one
// coordinate space for point-in-polygon and map rendering.
function mercatorToLatLon(x, y) {
  const lon = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return { lat, lon };
}

async function fetchCountyNames(stateFips) {
  const url = new URL(TIGERWEB_COUNTIES);
  url.searchParams.set('where', `STATE='${stateFips}'`);
  url.searchParams.set('outFields', 'COUNTY,NAME');
  url.searchParams.set('returnGeometry', 'false');
  url.searchParams.set('f', 'json');

  const raw = await fetchJson(url.toString());
  const byFips = new Map();
  for (const f of raw.features ?? []) {
    byFips.set(f.attributes?.COUNTY, f.attributes?.NAME);
  }
  return byFips;
}

async function fetchTractGeometry(stateFips) {
  const url = new URL(TIGERWEB_TRACTS);
  url.searchParams.set('where', `STATE='${stateFips}'`);
  url.searchParams.set('outFields', 'GEOID,COUNTY');
  url.searchParams.set('returnGeometry', 'true');
  url.searchParams.set('maxAllowableOffset', '500');
  url.searchParams.set('geometryPrecision', '3');
  url.searchParams.set('f', 'json');

  const raw = await fetchJson(url.toString());
  return (raw.features ?? []).map((f) => {
    const centroidMerc = approxCentroid(f.geometry?.rings);
    const centroid = centroidMerc ? mercatorToLatLon(centroidMerc.x, centroidMerc.y) : null;
    return {
      geoid: f.attributes?.GEOID,
      countyFips: f.attributes?.COUNTY,
      lat: centroid?.lat ?? null,
      lon: centroid?.lon ?? null,
    };
  });
}

// ACS variables per tract, all from one request (the API allows up to 50):
//   B01003_001E  total population
//   B01001 65+   male 020-025E + female 044-049E (age bands 65 and over)
//   B25044       households with no vehicle: owner 003E + renter 010E — the
//                evacuation-barrier signal (can't self-evacuate)
//   B25024_010E  mobile-home housing units — the most flood/wind-vulnerable stock
const AGE65_VARS = [
  'B01001_020E', 'B01001_021E', 'B01001_022E', 'B01001_023E', 'B01001_024E', 'B01001_025E',
  'B01001_044E', 'B01001_045E', 'B01001_046E', 'B01001_047E', 'B01001_048E', 'B01001_049E',
];
const ACS_VARS = ['B01003_001E', ...AGE65_VARS, 'B25044_003E', 'B25044_010E', 'B25024_010E'];

// Returns null (not an empty map) when no key is configured, so the caller
// can distinguish "population genuinely unavailable" from "zero people" —
// an empty tract population would otherwise silently read as "nobody home".
async function fetchTractPopulation(stateFips) {
  const key = import.meta.env.VITE_CENSUS_API_KEY;
  if (!key) return null;

  const url = new URL(ACS_BASE);
  url.searchParams.set('get', ACS_VARS.join(','));
  url.searchParams.set('for', 'tract:*');
  url.searchParams.set('in', `state:${stateFips}`);
  url.searchParams.set('key', key);

  const rows = await fetchJson(url.toString());
  const [header, ...data] = rows;
  const col = (name) => header.indexOf(name);
  const stateIdx = col('state');
  const countyIdx = col('county');
  const tractIdx = col('tract');
  // ACS uses large negative sentinels (e.g. -666666666) for "not available".
  const num = (row, name) => {
    const v = Number(row[col(name)]);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };

  const byGeoid = new Map();
  for (const row of data) {
    const geoid = `${row[stateIdx]}${row[countyIdx]}${row[tractIdx]}`;
    byGeoid.set(geoid, {
      population: num(row, 'B01003_001E'),
      age65: AGE65_VARS.reduce((sum, v) => sum + num(row, v), 0),
      noVehicleHH: num(row, 'B25044_003E') + num(row, 'B25044_010E'),
      mobileHomes: num(row, 'B25024_010E'),
    });
  }
  return byGeoid;
}

export function getPopulation(stateFips = DEFAULT_REGION.fips) {
  return cached(`population:v3:${isTestMode()}:${stateFips}`, TTL_S, async () => {
    if (isTestMode()) return loadFixture('population');

    // Geometry and population are independent federal sources — one being
    // down (or, for population, simply unconfigured) shouldn't block the
    // other, same bulkhead discipline as every other source in this app.
    const [geometry, population, countyNames] = await Promise.all([
      fetchTractGeometry(stateFips).catch((err) => {
        console.error('tract geometry fetch failed', err);
        return [];
      }),
      fetchTractPopulation(stateFips).catch((err) => {
        console.error('tract population fetch failed', err);
        return null;
      }),
      fetchCountyNames(stateFips).catch((err) => {
        console.error('county name fetch failed', err);
        return new Map();
      }),
    ]);

    const tracts = geometry
      .filter((t) => t.geoid && t.lat != null && t.lon != null)
      .map((t) => ({
        geoid: t.geoid,
        county: countyNames.get(t.countyFips) ?? `County ${t.countyFips}`,
        lat: t.lat,
        lon: t.lon,
        population: population?.get(t.geoid)?.population ?? null,
        age65: population?.get(t.geoid)?.age65 ?? null,
        noVehicleHH: population?.get(t.geoid)?.noVehicleHH ?? null,
        mobileHomes: population?.get(t.geoid)?.mobileHomes ?? null,
      }));

    return {
      source: 'census-acs5-tigerweb',
      updated: new Date().toISOString(),
      tracts,
    };
  });
}
