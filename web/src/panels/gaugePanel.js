// Gauge detail panel — the responder's drill-down: current level, trajectory,
// and freshness for the selected gauge.
// TODO(Tier 2): flood-stage threshold line + NWS forecast crest ("expected to
// crest at 18.2 ft in ~6 h") once NWPS metadata/forecast feeds are wired.

import { getState, subscribe } from '../state.js';

const el = () => document.getElementById('tab-gauge');

const TREND_LABELS = {
  rising: '▲ Rising',
  falling: '▼ Falling',
  steady: '► Steady',
  unknown: '—',
};

export function initGaugePanel() {
  render();
  subscribe(['selectedGaugeId', 'gauges'], render);
}

function render() {
  const { gauges, selectedGaugeId } = getState();
  const g = gauges.find((x) => x.id === selectedGaugeId);
  if (!g) {
    el().innerHTML = `<p class="muted">Tap a gauge on the map to see details.</p>`;
    return;
  }
  const rate =
    g.rate_ft_per_hr != null
      ? ` (${g.rate_ft_per_hr > 0 ? '+' : ''}${g.rate_ft_per_hr} ft/hr)`
      : '';
  el().innerHTML = `
    <h2>${g.name}</h2>
    <p class="badge badge-${g.severity}">${g.severity.toUpperCase()}</p>
    <dl>
      <dt>Stage</dt><dd>${g.stage_ft ?? '—'} ft</dd>
      <dt>Trend</dt><dd>${TREND_LABELS[g.trend] ?? '—'}${rate}</dd>
      <dt>Discharge</dt><dd>${g.discharge_cfs?.toLocaleString() ?? '—'} cfs</dd>
      <dt>Reading time</dt><dd>${g.time ? new Date(g.time).toLocaleString() : '—'}</dd>
      <dt>USGS site</dt><dd>${g.id}</dd>
    </dl>
  `;
}
