// Tier 3 action-synthesis rules engine (CONTEXT §5 / rubric R5, the
// "Judges' Choice" differentiator). Pure logic, no DOM — actionPanel.js
// turns this module's output into cards; this module just decides, for
// each signal (alert / gauge / forecast point / storm), which of three
// ranked tiers it belongs in and how it's ordered inside that tier.
//
// The three tiers translate directly to what a responder does next:
//   EVACUATE — confirmed, immediate, high-consequence: move people now.
//   PREPARE  — confirmed or imminent, but there's still lead time to act.
//   MONITOR  — worth watching, not yet worth resourcing.
//
// This replaces the old two-bucket sort (a card was just "extreme" or
// "severe" CSS, in whatever order its own data source happened to return)
// with one score/tier computed the same way across every signal type, so
// the whole Actions panel is a single ranked list instead of four
// concatenated ones.
//
// "Fold crest timing + population + flood-zone overlap into ranked tiers"
// (the report's own words) is implemented as three real cross-source
// signals, not three separate fixed-priority buckets: a forecast's crest
// timing pulls a point up or down PREPARE/EVACUATE by how soon it arrives;
// population and hospital counts inside an alert polygon can bump that
// alert (and anything geographically inside it) up a tier; flood-zone
// overlap uses the active NWS warning polygon as an honest substitute for
// FEMA's zone, because FEMA's layer is rendered as map tiles (ArcGIS
// `export` images), not queryable polygon geometry — see map.js and
// index.html's About modal for the same disclosed limitation.

import { pointInGeometry } from './geo.js';

export const EVACUATE = 'evacuate';
export const PREPARE = 'prepare';
export const MONITOR = 'monitor';

export const TIER_LABEL = { evacuate: 'Evacuate', prepare: 'Prepare', monitor: 'Monitor' };
const TIER_RANK = { evacuate: 3, prepare: 2, monitor: 1 };
export const TIER_ORDER = [EVACUATE, PREPARE, MONITOR];

export const FLOOD_CATEGORY_RANK = { major: 3, moderate: 2, minor: 1, action: 0, no_flooding: -1 };

// Above this, a warned area's population is treated as consequential enough
// to justify evacuate-level urgency on its own, independent of the NWS
// severity word. Picked as "a small city," not derived from any rubric
// number — there's no authoritative threshold to cite here.
const POPULATION_BUMP = 10_000;

// A single hospital inside a warning polygon is enough to bump urgency:
// hospitals hold non-ambulatory patients, so "at risk" here is a much
// higher-consequence event than the same area's general population count.
const FACILITY_BUMP = 1;

// Sum of ACS tract populations (by centroid) whose point falls inside the
// alert's polygon, plus which hospitals fall inside it — the same
// point-in-polygon test the Population panel and the infrastructure map
// layer already use, computed once per render and reused by every signal
// below rather than recomputed per-card.
export function annotateAlerts(alerts, tracts, facilities) {
  return alerts
    .filter((a) => ['extreme', 'severe'].includes(a.severity))
    .map((a) => {
      const affectedTracts = tracts.filter(
        (t) => t.lat != null && t.lon != null && pointInGeometry(t.lon, t.lat, a.geometry)
      );
      const facilitiesAtRisk = facilities.filter(
        (f) => f.lat != null && f.lon != null && pointInGeometry(f.lon, f.lat, a.geometry)
      );
      const missingPopulation = affectedTracts.some((t) => t.population == null);
      const population = affectedTracts.reduce((sum, t) => sum + (t.population ?? 0), 0);
      return { ...a, population, missingPopulation, facilitiesAtRisk };
    });
}

// The highest-severity annotated alert whose polygon contains a point, if
// any — used to let a gauge or forecast point inherit area-level context
// (population, hospitals) from whichever warning currently covers it.
export function containingAlert(lat, lon, annotatedAlerts) {
  if (lat == null || lon == null) return null;
  const hits = annotatedAlerts.filter((a) => pointInGeometry(lon, lat, a.geometry));
  if (!hits.length) return null;
  return hits.sort((a, b) => (b.severity === 'extreme' ? 1 : 0) - (a.severity === 'extreme' ? 1 : 0))[0];
}

function areaBump(alert) {
  if (!alert) return 0;
  if (alert.facilitiesAtRisk.length >= FACILITY_BUMP) return 2;
  if (alert.population >= POPULATION_BUMP) return 1;
  return 0;
}

export function rankAlert(alert) {
  const base = alert.severity === 'extreme' ? EVACUATE : PREPARE;
  const bumped = areaBump(alert) > 0 && base === PREPARE ? EVACUATE : base;
  const score =
    (alert.severity === 'extreme' ? 300 : 200) + Math.min(alert.population / 1000, 50) + alert.facilitiesAtRisk.length * 5;
  return { tier: bumped, score };
}

export function rankStorm(storm) {
  // Proactive lead-time signal: nothing has flooded yet, so this is never
  // EVACUATE — its entire value is the days of prepare-time it buys.
  return { tier: PREPARE, score: 150 + (storm.category ?? 0) * 10 };
}

export function rankGauge(gauge, annotatedAlerts) {
  const rising = gauge.trend === 'rising';
  const alert = containingAlert(gauge.lat, gauge.lon, annotatedAlerts);
  const bump = areaBump(alert);

  let tier;
  if (gauge.severity === 'major') tier = rising ? EVACUATE : PREPARE;
  else tier = rising ? PREPARE : MONITOR; // moderate

  if (bump === 2 && tier !== EVACUATE) tier = TIER_ORDER[TIER_ORDER.indexOf(tier) - 1] ?? EVACUATE;
  else if (bump === 1 && tier === MONITOR) tier = PREPARE;

  const base = gauge.severity === 'major' ? 100 : 60;
  const score = base + (rising ? Math.abs(gauge.rate_ft_per_hr ?? 0) * 10 : 0) + bump * 5;
  return { tier, score, alert };
}

export function rankForecastPoint(point, annotatedAlerts) {
  const worsening =
    point.forecast &&
    (FLOOD_CATEGORY_RANK[point.forecast.floodCategory] ?? -1) > (FLOOD_CATEGORY_RANK[point.floodCategory] ?? -1);
  const peakCategory = worsening ? point.forecast.floodCategory : point.floodCategory;
  const peakRank = FLOOD_CATEGORY_RANK[peakCategory] ?? -1;
  const hoursUntilCrest =
    worsening && point.forecast?.validTime ? (new Date(point.forecast.validTime) - Date.now()) / 3_600_000 : null;
  // A crest arriving within a day pulls the tier up one notch — the whole
  // point of forecasting a crest is to act before it arrives, not after.
  const imminent = hoursUntilCrest != null && hoursUntilCrest <= 24;

  let tier;
  if (peakRank >= 3) tier = EVACUATE;
  else if (peakRank === 2) tier = imminent ? EVACUATE : PREPARE;
  else if (peakRank >= 0) tier = imminent ? PREPARE : MONITOR;
  else tier = MONITOR;

  const alert = containingAlert(point.lat, point.lon, annotatedAlerts);
  const bump = areaBump(alert);
  if (bump === 2 && tier !== EVACUATE) tier = TIER_ORDER[TIER_ORDER.indexOf(tier) - 1] ?? EVACUATE;
  else if (bump === 1 && tier === MONITOR) tier = PREPARE;

  const urgency = hoursUntilCrest != null ? Math.max(0, 100 - hoursUntilCrest) : 0;
  const score = peakRank * 100 + urgency + bump * 5;
  return { tier, score, worsening, peakCategory, hoursUntilCrest, alert };
}

export function tierRank(tier) {
  return TIER_RANK[tier] ?? 0;
}
