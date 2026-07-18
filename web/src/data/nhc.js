// National Hurricane Center GIS — forecast track, cone of uncertainty, and
// current position from the NOAA tropical MapServer (CORS-enabled ArcGIS
// REST). Used as a proactive upstream signal for inland riverine flooding
// (CONTEXT §3 amendment): a cone approaching the AOI triggers preparation
// recommendations days before gauges move.
//
// Service structure (verified 2026-07-18): storms occupy fixed slots — AT1-5
// (Atlantic), EP1-5 / CP1-5 (Pacific) — each with "Forecast Points/Track/
// Cone" sublayers whose ids we discover by name at runtime. Only Atlantic
// slots matter for the Gulf flood mission. Forecast Points fields include
// stormname, stormtype, ssnum (Saffir-Simpson), maxwind (kt), tcdir/tcspd,
// tau (forecast hour; 0 = current advisory position).

import { fetchJson } from '../fetchJson.js';
import { cached } from '../cache.js';
import { isTestMode, loadFixture } from '../testmode.js';
import { DEFAULT_BBOX } from './usgs.js';

const NHC_BASE =
  'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer';
const TTL_S = 10 * 60;
// A cone within this many degrees of the AOI counts as "approaching" —
// generous on purpose: the whole point is lead time.
const AOI_MARGIN_DEG = 3;

const queryLayer = (id) =>
  fetchJson(`${NHC_BASE}/${id}/query?where=1%3D1&outFields=*&f=geojson`);

function geomBbox(geom) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      box[0] = Math.min(box[0], c[0]);
      box[1] = Math.min(box[1], c[1]);
      box[2] = Math.max(box[2], c[0]);
      box[3] = Math.max(box[3], c[1]);
    } else c.forEach(walk);
  };
  if (geom?.coordinates) walk(geom.coordinates);
  return box;
}

const bboxesIntersect = (a, b) =>
  a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

async function fetchSlot(layers, slot, aoi) {
  const childId = (suffix) => layers.find((l) => l.name === `${slot.name} ${suffix}`)?.id;

  const pointsId = childId('Forecast Points');
  if (pointsId == null) return null;
  const points = await queryLayer(pointsId).catch(() => null);
  if (!points?.features?.length) return null; // slot inactive

  const current = points.features.reduce((best, f) =>
    (f.properties?.tau ?? 999) < (best.properties?.tau ?? 999) ? f : best
  );
  const p = current.properties ?? {};

  const [track, cone] = await Promise.all(
    ['Forecast Track', 'Forecast Cone'].map((suffix) => {
      const id = childId(suffix);
      return id == null ? null : queryLayer(id).catch(() => null);
    })
  );

  const storm = {
    id: `${p.basin ?? 'AL'}${p.stormnum ?? ''}` || slot.name,
    name: [p.stormtype, p.stormname].filter(Boolean).join(' ') || slot.name,
    category: p.ssnum ?? null,
    maxWindsMph: p.maxwind != null ? Math.round(p.maxwind * 1.151) : null,
    movement:
      p.tcdir != null && p.tcspd != null ? `toward ${p.tcdir}° at ${p.tcspd} kt` : null,
    position:
      current.geometry?.type === 'Point'
        ? { lat: current.geometry.coordinates[1], lon: current.geometry.coordinates[0] }
        : null,
    // Kept as GeoJSON FeatureCollections — L.geoJSON renders them directly.
    track: track?.features?.length ? track : null,
    cone: cone?.features?.length ? cone : null,
  };

  const geoms = [storm.cone, storm.track].flatMap(
    (fc) => fc?.features?.map((f) => f.geometry) ?? []
  );
  if (storm.position) {
    geoms.push({ type: 'Point', coordinates: [storm.position.lon, storm.position.lat] });
  }
  storm.nearAoi = geoms.some((g) => bboxesIntersect(geomBbox(g), aoi));
  return storm;
}

export function getHurricane(bbox = DEFAULT_BBOX) {
  // v2: cache key bumped when the slot-based parser replaced name-guessing.
  return cached(`hurricane:v2:${isTestMode()}`, TTL_S, async () => {
    if (isTestMode()) return loadFixture('hurricane');

    const meta = await fetchJson(`${NHC_BASE}?f=json`);
    const layers = meta.layers ?? [];
    const atlanticSlots = layers.filter((l) => /^AT\d$/.test(l.name));
    const aoi = [
      bbox[0] - AOI_MARGIN_DEG,
      bbox[1] - AOI_MARGIN_DEG,
      bbox[2] + AOI_MARGIN_DEG,
      bbox[3] + AOI_MARGIN_DEG,
    ];

    const storms = (
      await Promise.all(atlanticSlots.map((slot) => fetchSlot(layers, slot, aoi)))
    ).filter(Boolean);

    return { source: 'nhc-gis', updated: new Date().toISOString(), storms };
  });
}
