// National Weather Service active alerts (api.weather.gov, CORS-enabled),
// normalized to a flat severity/event/headline shape for the map + action
// layer. Browsers send their own User-Agent, which the NWS API accepts.

import { fetchJson } from '../fetchJson.js';
import { cached } from '../cache.js';
import { isTestMode, loadFixture } from '../testmode.js';

const NWS_ALERTS = 'https://api.weather.gov/alerts/active';
const TTL_S = 60;

export function getAlerts(area = 'LA') {
  const key = `alerts:${isTestMode()}:${area}`;
  return cached(key, TTL_S, async () => {
    if (isTestMode()) return loadFixture('alerts');

    const url = new URL(NWS_ALERTS);
    url.searchParams.set('area', area);
    url.searchParams.set('status', 'actual');

    const raw = await fetchJson(url.toString(), {
      headers: { Accept: 'application/geo+json' },
    });

    const alerts = (raw.features ?? []).map((f) => ({
      id: f.properties?.id ?? f.id,
      event: f.properties?.event,
      severity: (f.properties?.severity ?? 'Unknown').toLowerCase(),
      urgency: f.properties?.urgency,
      headline: f.properties?.headline,
      description: f.properties?.description,
      instruction: f.properties?.instruction,
      areaDesc: f.properties?.areaDesc,
      onset: f.properties?.onset,
      expires: f.properties?.expires,
      geometry: f.geometry, // may be null — TODO resolve UGC zone polygons via api.weather.gov/zones
    }));

    return { source: 'nws-alerts', updated: new Date().toISOString(), alerts };
  });
}
