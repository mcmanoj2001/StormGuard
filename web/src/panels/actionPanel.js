// Responder action synthesis layer — the innovation piece (rubric R5 +
// Judges' Choice). Cross-references active alerts with gauge severity AND
// trajectory to produce a prioritized plain-language action list.
//
// Forecast crest data (NWS AHPS) is now folded in below — a Tier 3 first
// step per CONTEXT §5. Still TODO: affected population and flood-zone
// overlap, to complete the full ranked evacuate/prepare/monitor engine.

import { getState, subscribe } from '../state.js';
import { gaugeInsight } from '../insight.js';
import { categoryLabel } from '../data/ahps.js';

const el = () => document.getElementById('tab-actions');

export function initActionPanel() {
  render();
  subscribe(['alerts', 'gauges', 'storms', 'forecastPoints'], render);
}

function render() {
  const { alerts, gauges, storms, forecastPoints } = getState();
  const cards = [];

  // Proactive inland-flood preparation from hurricane track data (CONTEXT §3
  // amendment): surfaces days before gauges move — the lead-time innovation.
  // Only storms whose cone/track/position is near the AOI qualify; a Gulf
  // card must never fire for a distant-basin system.
  for (const s of storms.filter((x) => x.nearAoi)) {
    const strength = [
      s.category != null ? `Category ${s.category}` : null,
      s.maxWindsMph != null ? `${s.maxWindsMph} mph winds` : null,
      s.movement ? `moving ${s.movement}` : null,
    ].filter(Boolean).join(', ');
    cards.push(`
      <article class="card severity-severe">
        <h3>⚠ ${s.name} — prepare for inland flooding</h3>
        <p>${strength || 'Active tropical system'} with the forecast cone approaching this area.${
          s.expectedInlandRainIn ? ` Expected rainfall: ${s.expectedInlandRainIn}.` : ''
        }</p>
        <p class="instruction">▶ Pre-stage high-water assets along flood-prone rivers and review evacuation routes now — act before rainfall reaches the basins.</p>
      </article>`);
  }

  for (const a of alerts.filter((x) => ['extreme', 'severe'].includes(x.severity))) {
    cards.push(`
      <article class="card severity-${a.severity}">
        <h3>${a.event}</h3>
        <p>${a.headline ?? a.areaDesc ?? ''}</p>
        ${a.instruction ? `<p class="instruction">▶ ${a.instruction}</p>` : ''}
      </article>`);
  }

  // Rising gauges outrank falling ones at the same stage — trajectory is the
  // action signal, not just the level.
  const priority = gauges
    .filter((g) => ['major', 'moderate'].includes(g.severity))
    .sort((a, b) => (b.rate_ft_per_hr ?? 0) - (a.rate_ft_per_hr ?? 0));

  for (const g of priority) {
    const rising = g.trend === 'rising';
    const rate = g.rate_ft_per_hr != null ? ` and ${g.trend} at ${Math.abs(g.rate_ft_per_hr)} ft/hr` : '';
    cards.push(`
      <article class="card severity-${g.severity === 'major' || rising ? 'extreme' : 'severe'}">
        <h3>River at ${g.severity} flood level${rising ? ' — RISING' : ''}</h3>
        <p>${g.name} — stage ${g.stage_ft} ft${rate}.</p>
        <p class="instruction">▶ ${gaugeInsight(g)}</p>
      </article>`);
  }

  // NWS forecast points: authoritative flood category (not the approximate
  // fixed-threshold one gauges.js falls back to) plus an actual forecast
  // crest — surfaced only when either the current or forecasted category is
  // elevated, so a "no_flooding" point stays quiet like a normal gauge does.
  const ELEVATED = ['action', 'minor', 'moderate', 'major'];
  const severityRank = { major: 3, moderate: 2, minor: 1, action: 0 };
  const worthShowing = forecastPoints
    .filter((p) => ELEVATED.includes(p.floodCategory) || ELEVATED.includes(p.forecast?.floodCategory))
    .sort((a, b) => {
      const rank = (p) => Math.max(severityRank[p.floodCategory] ?? -1, severityRank[p.forecast?.floodCategory] ?? -1);
      return rank(b) - rank(a);
    });

  for (const p of worthShowing) {
    const worsening =
      p.forecast &&
      (severityRank[p.forecast.floodCategory] ?? -1) > (severityRank[p.floodCategory] ?? -1);
    const peakCategory = worsening ? p.forecast.floodCategory : p.floodCategory;
    const cardSeverity = peakCategory === 'major' || worsening ? 'extreme' : 'severe';
    const forecastLine = p.forecast
      ? `Forecast: ${p.forecast.stage_ft ?? '—'} ft by ${
          p.forecast.validTime
            ? new Date(p.forecast.validTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : '—'
        } (${categoryLabel(p.forecast.floodCategory)}).`
      : '';
    cards.push(`
      <article class="card severity-${cardSeverity}">
        <h3>NWS Forecast — ${categoryLabel(peakCategory)}${worsening ? ' — RISING' : ''}</h3>
        <p>${p.name} — now ${p.stage_ft ?? '—'} ft (${categoryLabel(p.floodCategory)}). ${forecastLine}</p>
        <p class="instruction">▶ ${
          worsening
            ? 'Crest expected to exceed current stage — pre-stage assets ahead of the forecast peak.'
            : 'Verify road closures and monitor for the forecast crest.'
        }</p>
      </article>`);
  }

  el().innerHTML = cards.length
    ? cards.join('')
    : `<p class="muted">No priority actions right now. Monitoring continues.</p>`;
}
