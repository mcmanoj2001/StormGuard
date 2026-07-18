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

const USGS_IV = 'https://waterservices.usgs.gov/nwis/iv/';
const TTL_S = 5 * 60;

// Default area of interest: Louisiana / lower Mississippi (riverine flood
// scenario). minLon,minLat,maxLon,maxLat — overridable per call for region
// selection.
export const DEFAULT_BBOX = [-93.5, 28.5, -88.0, 32.5];

// TODO(R3): replace fixed thresholds with real per-gauge NWS flood stages
// (action/minor/moderate/major) from the NWPS gauge metadata API. Fixed
// thresholds misclassify gauges whose datum puts normal pool at high stage.
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

export function getGauges(bbox = DEFAULT_BBOX) {
  const key = `gauges:${isTestMode()}:${bbox.join(',')}`;
  return cached(key, TTL_S, async () => {
    if (isTestMode()) return loadFixture('gauges');

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

    const gauges = [...bySite.values()].map((g) => ({
      ...g,
      severity: classifySeverity(g.stage_ft),
      trend: classifyTrend(g.rate_ft_per_hr),
    }));

    return { source: 'usgs-iv', updated: new Date().toISOString(), gauges };
  });
}
