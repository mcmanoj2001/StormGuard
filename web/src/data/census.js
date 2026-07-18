// U.S. Census ACS 5-Year population by tract, used for the affected
// population estimate (tract centroids intersected with alert/flood
// polygons client-side).
//
// TODO(Tier 2): fetch B01003_001E (total population) for tracts in the AOI
// counties + tract centroids (Census Gazetteer/TIGERweb), then point-in-
// polygon against active alert geometries in the population panel.

import { cached } from '../cache.js';
import { isTestMode, loadFixture } from '../testmode.js';

const TTL_S = 24 * 3600;

export function getPopulation() {
  return cached(`population:${isTestMode()}`, TTL_S, async () => {
    if (isTestMode()) return loadFixture('population');

    return {
      source: 'census-acs5',
      updated: new Date().toISOString(),
      tracts: [],
      note: 'Live ACS integration not yet implemented — enable test mode to demo.',
    };
  });
}
