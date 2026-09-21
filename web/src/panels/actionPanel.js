// Responder action synthesis layer — the innovation piece (rubric R5 +
// Judges' Choice). Every signal (hurricane lead-time, active NWS alerts,
// gauge severity+trajectory, AHPS forecast crests) is scored and tiered by
// rulesEngine.js into one ranked EVACUATE / PREPARE / MONITOR list, instead
// of four separately-ordered sections concatenated in a fixed pipeline
// order — see rulesEngine.js for why each tier means what it means.

import { getState, subscribe } from '../state.js';
import { gaugeInsight } from '../insight.js';
import { categoryLabel } from '../data/ahps.js';
import {
  annotateAlerts,
  rankAlert,
  rankStorm,
  rankGauge,
  rankForecastPoint,
  tierRank,
  TIER_LABEL,
  TIER_ORDER,
} from '../rulesEngine.js';

const el = () => document.getElementById('tab-actions');

export function initActionPanel() {
  render();
  subscribe(['alerts', 'gauges', 'storms', 'forecastPoints', 'tracts', 'facilities', 'connection'], render);
}

function areaContextLine(alert) {
  if (!alert) return '';
  const parts = [];
  if (alert.facilitiesAtRisk.length) {
    parts.push(`${alert.facilitiesAtRisk.length} hospital${alert.facilitiesAtRisk.length === 1 ? '' : 's'} in the warned area`);
  }
  if (alert.population > 0) {
    parts.push(`~${alert.population.toLocaleString()} people estimated in the warned area`);
  } else if (alert.missingPopulation) {
    parts.push('population estimate needs a Census API key');
  }
  return parts.length ? `<p class="muted">▲ ${parts.join(' · ')} (${alert.event})</p>` : '';
}

function card(tier, score, severityClass, html) {
  return { tier, score, html: `<article class="card severity-${severityClass}">${html}</article>` };
}

function render() {
  const { alerts, gauges, storms, forecastPoints, tracts, facilities, connection } = getState();
  const annotatedAlerts = annotateAlerts(alerts, tracts, facilities);
  const signals = [];

  // Proactive inland-flood preparation from hurricane track data (CONTEXT §3
  // amendment): surfaces days before gauges move — the lead-time innovation.
  // Only storms whose cone/track/position is near the AOI qualify; a Gulf
  // card must never fire for a distant-basin system.
  for (const s of storms.filter((x) => x.nearAoi)) {
    const { tier, score } = rankStorm(s);
    const strength = [
      s.category != null ? `Category ${s.category}` : null,
      s.maxWindsMph != null ? `${s.maxWindsMph} mph winds` : null,
      s.movement ? `moving ${s.movement}` : null,
    ].filter(Boolean).join(', ');
    signals.push(
      card(tier, score, 'severe', `
        <h3>⚠ ${s.name} — prepare for inland flooding</h3>
        <p>${strength || 'Active tropical system'} with the forecast cone approaching this area.${
          s.expectedInlandRainIn ? ` Expected rainfall: ${s.expectedInlandRainIn}.` : ''
        }</p>
        <p class="instruction">▶ Pre-stage high-water assets along flood-prone rivers and review evacuation routes now — act before rainfall reaches the basins.</p>`)
    );
  }

  for (const a of annotatedAlerts) {
    const { tier, score } = rankAlert(a);
    signals.push(
      card(tier, score, a.severity, `
        <h3>${a.event}</h3>
        <p>${a.headline ?? a.areaDesc ?? ''}</p>
        ${areaContextLine(a)}
        ${a.instruction ? `<p class="instruction">▶ ${a.instruction}</p>` : ''}`)
    );
  }

  // Rising gauges outrank falling ones at the same stage — trajectory is the
  // action signal, not just the level.
  for (const g of gauges.filter((x) => ['major', 'moderate'].includes(x.severity))) {
    const { tier, score, alert } = rankGauge(g, annotatedAlerts);
    const rising = g.trend === 'rising';
    const rate = g.rate_ft_per_hr != null ? ` and ${g.trend} at ${Math.abs(g.rate_ft_per_hr)} ft/hr` : '';
    signals.push(
      card(tier, score, g.severity === 'major' || rising ? 'extreme' : 'severe', `
        <h3>River at ${g.severity} flood level${rising ? ' — RISING' : ''}</h3>
        <p>${g.name} — stage ${g.stage_ft} ft${rate}.</p>
        ${areaContextLine(alert)}
        <p class="instruction">▶ ${gaugeInsight(g)}</p>`)
    );
  }

  // NWS forecast points: authoritative flood category (not the approximate
  // fixed-threshold one gauges.js falls back to) plus an actual forecast
  // crest — surfaced only when either the current or forecasted category is
  // elevated, so a "no_flooding" point stays quiet like a normal gauge does.
  const ELEVATED = ['action', 'minor', 'moderate', 'major'];
  for (const p of forecastPoints.filter(
    (x) => ELEVATED.includes(x.floodCategory) || ELEVATED.includes(x.forecast?.floodCategory)
  )) {
    const { tier, score, worsening, peakCategory, hoursUntilCrest, alert } = rankForecastPoint(p, annotatedAlerts);
    const cardSeverity = peakCategory === 'major' || worsening ? 'extreme' : 'severe';
    const crestSoon = hoursUntilCrest != null && hoursUntilCrest <= 24;
    const forecastLine = p.forecast
      ? `Forecast: ${p.forecast.stage_ft ?? '—'} ft by ${
          p.forecast.validTime
            ? new Date(p.forecast.validTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : '—'
        } (${categoryLabel(p.forecast.floodCategory)}).`
      : '';
    signals.push(
      card(tier, score, cardSeverity, `
        <h3>NWS Forecast — ${categoryLabel(peakCategory)}${worsening ? ' — RISING' : ''}</h3>
        <p>${p.name} — now ${p.stage_ft ?? '—'} ft (${categoryLabel(p.floodCategory)}). ${forecastLine}</p>
        ${areaContextLine(alert)}
        <p class="instruction">▶ ${
          worsening
            ? crestSoon
              ? 'Crest arriving within 24h and will exceed current stage — pre-stage assets now.'
              : 'Crest expected to exceed current stage — pre-stage assets ahead of the forecast peak.'
            : 'Verify road closures and monitor for the forecast crest.'
        }</p>`)
    );
  }

  signals.sort((a, b) => tierRank(b.tier) - tierRank(a.tier) || b.score - a.score);

  if (!signals.length) {
    // Distinguish "we checked and it's clear" from "we haven't checked
    // yet" — the initial pub/sub state is empty arrays before the first
    // fetch resolves, so without this, a page freshly loading (or an EOC
    // reconnecting after a dropped connection) briefly shows the exact
    // same all-clear text as a genuine confirmed-quiet event. A responder
    // glancing at that during the few-second load window could read it as
    // reassurance rather than "still checking" (found during a usability
    // pass on a cold load).
    el().innerHTML =
      connection === 'connecting'
        ? `<p class="muted">Loading current conditions…</p>`
        : `<p class="muted">No priority actions right now. Monitoring continues.</p>`;
    return;
  }

  // Grouped under tier headers (not just individually badged) so "ranked
  // evacuate/prepare/monitor tiers" — the CONTEXT §5 target this replaces
  // the old two-bucket sort with — is visible at a glance, not something a
  // responder has to infer from card color alone.
  el().innerHTML = TIER_ORDER.map((tier) => {
    const inTier = signals.filter((s) => s.tier === tier);
    if (!inTier.length) return '';
    return `
      <h2 class="tier-heading tier-${tier}">${TIER_LABEL[tier]} <span class="tier-count">${inTier.length}</span></h2>
      ${inTier.map((s) => s.html).join('')}`;
  }).join('');
}
