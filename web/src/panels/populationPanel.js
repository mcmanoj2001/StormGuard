// Affected population estimate — sums ACS tract populations whose centroids
// fall inside active alert polygons, via real point-in-polygon (ray
// casting), not a stub that sums every tract in the state whenever any
// alert is active.

import { getState, subscribe } from '../state.js';
import { pointInGeometry } from '../geo.js';

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

  const affected = tracts.filter(
    (t) => t.lat != null && t.lon != null && active.some((a) => pointInGeometry(t.lon, t.lat, a.geometry))
  );

  if (!affected.length) {
    el().innerHTML = `<p class="muted">No population currently estimated to be in warned areas.</p>`;
    return;
  }

  const missingPopulation = affected.some((t) => t.population == null);
  const total = affected.reduce((sum, t) => sum + (t.population ?? 0), 0);
  const byCounty = {};
  for (const t of affected) {
    byCounty[t.county] = (byCounty[t.county] ?? 0) + (t.population ?? 0);
  }

  el().innerHTML = `
    <h2>~${total.toLocaleString()} people</h2>
    <p class="muted">estimated inside active warning areas (ACS 5-yr) — ${affected.length} tract${affected.length === 1 ? '' : 's'} intersected</p>
    ${
      missingPopulation
        ? `<p class="muted">⚠ Census API key not configured — tract boundaries are real, but population counts are unavailable. See About → Data sources.</p>`
        : ''
    }
    <dl>
      ${Object.entries(byCounty)
        .sort((a, b) => b[1] - a[1])
        .map(([county, pop]) => `<dt>${county}</dt><dd>${pop.toLocaleString()}</dd>`)
        .join('')}
    </dl>
  `;
}
