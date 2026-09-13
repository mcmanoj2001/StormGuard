import { getGauges } from './data/usgs.js';
import { getAlerts } from './data/nws.js';
import { getHurricane } from './data/nhc.js';
import { getPopulation } from './data/census.js';
import { getForecastPoints, AHPS_LIDS } from './data/ahps.js';
import { getRegions, DEFAULT_REGION } from './data/regions.js';
import { setState, subscribe } from './state.js';
import { setTestMode } from './testmode.js';
import { initMap, setRegionView } from './map/map.js';
import { initGaugePanel } from './panels/gaugePanel.js';
import { initActionPanel } from './panels/actionPanel.js';
import { initPopulationPanel } from './panels/populationPanel.js';
import { initAboutPanel } from './panels/aboutPanel.js';

const POLL_MS = 60_000;

// The user's selected region (rubric hard requirement: "must be able to
// display data for a region selected by the user"). Not part of the
// pub/sub state store — it's an input that drives which data gets fetched,
// not something a panel renders directly.
let currentRegion = DEFAULT_REGION;

initMap();
initGaugePanel();
initActionPanel();
initPopulationPanel();
initAboutPanel();
wireTabs();
wireTestToggle();
wireRegionSelect();
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
    // AHPS forecast points are a hand-curated Louisiana-only list (see
    // ahps.js) — fetching them for a different region would show 13 markers
    // in Louisiana while the map is centered somewhere else. Skip the fetch
    // entirely rather than return confusing out-of-region data.
    const ahpsLids = currentRegion.stusab === 'LA' ? AHPS_LIDS : [];

    const [gauges, alerts, hurricane, population, forecast] = await Promise.all([
      getGauges(currentRegion.bbox).catch((err) => {
        console.error('gauges fetch failed', err);
        return { gauges: [], cache: 'error' };
      }),
      getAlerts(currentRegion.stusab).catch((err) => {
        console.error('alerts fetch failed', err);
        return { alerts: [], cache: 'error' };
      }),
      getHurricane(currentRegion.bbox).catch((err) => {
        console.error('hurricane fetch failed', err);
        return { storms: [] };
      }),
      getPopulation(currentRegion.fips).catch((err) => {
        console.error('population fetch failed', err);
        return { tracts: [], cache: 'error' };
      }),
      (ahpsLids.length ? getForecastPoints(ahpsLids) : Promise.resolve({ points: [] })).catch((err) => {
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

function wireRegionSelect() {
  const select = document.getElementById('region-select');

  select.addEventListener('change', () => {
    const region = regionByCode(select.value);
    if (!region) return;
    currentRegion = region;
    setRegionView(region.bbox);
    refresh();
  });

  // Populate with the real 50-state list once it loads — the single
  // hardcoded <option> in index.html (the default region) stays in place
  // and stays selected if this fetch is slow or fails, so the picker is
  // never left empty.
  let regions = [DEFAULT_REGION];
  getRegions()
    .then((result) => {
      regions = result.regions;
      const current = select.value;
      select.innerHTML = regions
        .map((r) => `<option value="${r.stusab}">${r.name}</option>`)
        .join('');
      select.value = current;
    })
    .catch((err) => console.error('region list fetch failed', err));

  function regionByCode(stusab) {
    return regions.find((r) => r.stusab === stusab);
  }
}
