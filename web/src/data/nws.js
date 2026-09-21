// National Weather Service active alerts (api.weather.gov, CORS-enabled),
// normalized to a flat severity/event/headline shape for the map + action
// layer. Browsers send their own User-Agent, which the NWS API accepts.

import { fetchJson } from '../fetchJson.js';
import { cached } from '../cache.js';
import { isTestMode, loadFixture } from '../testmode.js';
import { getZoneGeometry, mergeZoneGeometries } from './zones.js';

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

    const alerts = await Promise.all(
      (raw.features ?? []).map(async (f) => {
        // Most active alerts carry no embedded polygon — only a list of UGC
        // zone URLs (properties.affectedZones). Resolve those to real
        // boundaries so every alert can be drawn/hovered/point-tested, not
        // just the minority that ship geometry inline. Zone geometry is
        // cached for 30 days (zones.js), so this only costs real fetches the
        // first time each zone is seen, never on every 60s alert refresh.
        let geometry = f.geometry;
        if (!geometry && f.properties?.affectedZones?.length) {
          const zoneGeoms = await Promise.all(
            f.properties.affectedZones.map((zoneUrl) => getZoneGeometry(zoneUrl).catch(() => null))
          );
          geometry = mergeZoneGeometries(zoneGeoms);
        }

        return {
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
          geometry, // still may be null if affectedZones was empty or every zone lookup failed
        };
      })
    );

    return { source: 'nws-alerts', updated: new Date().toISOString(), alerts };
  });
}
