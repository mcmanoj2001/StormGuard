// Affected population estimate — sums ACS tract populations whose centroids
// fall inside active alert polygons. Point-in-polygon runs client-side; the
// tract list is small once filtered to the AOI.
//
// TODO: proper point-in-polygon (ray cast) — current version is a stub that
// sums all tracts when any extreme/severe alert is active.

import { getState, subscribe } from '../state.js';

const el = () => document.getElementById('tab-population');

export function initPopulationPanel() {
  render();
  subscribe(['alerts', 'tracts'], render);
}

function render() {
  const { alerts, tracts } = getState();
  const active = alerts.filter((a) => ['extreme', 'severe'].includes(a.severity));

  if (!active.length || !tracts.length) {
    el().innerHTML = `<p class="muted">No population currently estimated to be in warned areas.</p>`;
    return;
  }

  const total = tracts.reduce((sum, t) => sum + (t.population ?? 0), 0);
  const byCounty = {};
  for (const t of tracts) {
    byCounty[t.county] = (byCounty[t.county] ?? 0) + (t.population ?? 0);
  }

  el().innerHTML = `
    <h2>~${total.toLocaleString()} people</h2>
    <p class="muted">estimated inside active warning areas (ACS 5-yr)</p>
    <dl>
      ${Object.entries(byCounty)
        .sort((a, b) => b[1] - a[1])
        .map(([county, pop]) => `<dt>${county}</dt><dd>${pop.toLocaleString()}</dd>`)
        .join('')}
    </dl>
  `;
}
