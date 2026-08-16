import { getGauges } from './data/usgs.js';
import { getAlerts } from './data/nws.js';
import { getHurricane } from './data/nhc.js';
import { getPopulation } from './data/census.js';
import { setState, subscribe } from './state.js';
import { setTestMode } from './testmode.js';
import { initMap } from './map/map.js';
import { initGaugePanel } from './panels/gaugePanel.js';
import { initActionPanel } from './panels/actionPanel.js';
import { initPopulationPanel } from './panels/populationPanel.js';
import { initAboutPanel } from './panels/aboutPanel.js';

const POLL_MS = 60_000;

initMap();
initGaugePanel();
initActionPanel();
initPopulationPanel();
initAboutPanel();
wireTabs();
wireTestToggle();
refresh();
setInterval(refresh, POLL_MS);

async function refresh() {
  const badge = document.getElementById('status-badge');
  try {
    // NHC feed is non-fatal: no active storm (or a dead endpoint) must never
    // blank the flood picture.
    const [gauges, alerts, hurricane, population] = await Promise.all([
      getGauges(),
      getAlerts(),
      getHurricane().catch(() => ({ storms: [] })),
      getPopulation(),
    ]);
    const stale = [gauges, alerts].some((r) => r.cache === 'stale');
    setState({
      gauges: gauges.gauges ?? [],
      alerts: alerts.alerts ?? [],
      storms: hurricane.storms ?? [],
      tracts: population.tracts ?? [],
      lastUpdated: new Date(),
      connection: stale ? 'stale' : 'live',
    });
    badge.textContent = stale
      ? `⚠ Data delayed · ${new Date().toLocaleTimeString()}`
      : `● Live · ${new Date().toLocaleTimeString()}`;
    badge.className = `topbar-status ${stale ? 'stale' : 'live'}`;
  } catch (err) {
    console.error('refresh failed', err);
    setState({ connection: 'error' });
    badge.textContent = '○ Offline — retrying';
    badge.className = 'topbar-status error';
  }
}

function wireTabs() {
  const buttons = document.querySelectorAll('.panel-tabs button');
  buttons.forEach((btn) =>
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab').forEach((t) => {
        t.classList.toggle('active', t.id === `tab-${btn.dataset.tab}`);
      });
    })
  );

  // Selecting a gauge on the map jumps to the gauge tab.
  subscribe('selectedGaugeId', () => {
    document.querySelector('[data-tab="gauge"]').click();
  });
}

function wireTestToggle() {
  const toggle = document.getElementById('test-mode-toggle');
  toggle.addEventListener('change', () => {
    setTestMode(toggle.checked);
    setState({ testMode: toggle.checked });
    refresh();
  });
}
