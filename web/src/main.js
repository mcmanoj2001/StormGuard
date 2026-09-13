import { getGauges } from './data/usgs.js';
import { getAlerts } from './data/nws.js';
import { getHurricane } from './data/nhc.js';
import { getPopulation } from './data/census.js';
import { getForecastPoints } from './data/ahps.js';
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
    // Every source is caught independently: one dead upstream (no active
    // storm, a rate-limited gauge feed, a Census outage) must never blank
    // the whole picture when the others are healthy. A source with no prior
    // cache to fall back on degrades to an empty result tagged 'error'
    // instead of throwing through Promise.all and killing the refresh.
    const [gauges, alerts, hurricane, population, forecast] = await Promise.all([
      getGauges().catch((err) => {
        console.error('gauges fetch failed', err);
        return { gauges: [], cache: 'error' };
      }),
      getAlerts().catch((err) => {
        console.error('alerts fetch failed', err);
        return { alerts: [], cache: 'error' };
      }),
      getHurricane().catch((err) => {
        console.error('hurricane fetch failed', err);
        return { storms: [] };
      }),
      getPopulation().catch((err) => {
        console.error('population fetch failed', err);
        return { tracts: [], cache: 'error' };
      }),
      getForecastPoints().catch((err) => {
        console.error('AHPS forecast fetch failed', err);
        return { points: [], cache: 'error' };
      }),
    ]);
    const degraded = [gauges, alerts, population, forecast].some(
      (r) => r.cache === 'stale' || r.cache === 'error'
    );
    setState({
      gauges: gauges.gauges ?? [],
      alerts: alerts.alerts ?? [],
      storms: hurricane.storms ?? [],
      tracts: population.tracts ?? [],
      forecastPoints: forecast.points ?? [],
      lastUpdated: new Date(),
      connection: degraded ? 'stale' : 'live',
    });
    badge.textContent = degraded
      ? `⚠ Data delayed · ${new Date().toLocaleTimeString()}`
      : `● Live · ${new Date().toLocaleTimeString()}`;
    badge.className = `topbar-status ${degraded ? 'stale' : 'live'}`;
  } catch (err) {
    // Only reachable now for something outside the four fetches themselves
    // (e.g. setState throwing) — each data source already degrades on its
    // own above rather than reaching this block.
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
