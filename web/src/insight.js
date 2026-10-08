// Plain-language per-gauge action line — single source of truth shared by
// the map hover tooltip and the Actions panel, so the two never drift.

export function gaugeInsight(g) {
  if (g.severity === 'unknown') return 'Stage reading unavailable.';
  if (g.severity === 'normal') return 'Within normal range — monitoring only.';
  const rising = g.trend === 'rising';
  if (g.severity === 'minor') {
    return rising
      ? 'Watch for continued rise; no action needed yet.'
      : 'Below action stage; monitoring continues.';
  }
  // moderate or major
  return rising
    ? 'Pre-stage high-water assets now; conditions worsening on this reach.'
    : 'Verify road closures and monitor for renewed rise on this reach.';
}

// Stable id for an alert, shared by the map (click -> focus) and the Actions
// panel (card id) so a click on a polygon finds its own card.
export const alertKey = (a) => `alert:${a.id ?? a.event + a.areaDesc}`;

// Which NWS events count as flood impact. This is a flood tool: a Red Flag
// Warning (fire weather) or a Heat Advisory still draws on the map as weather
// context, but must not add its population to "people at risk" or push a
// hospital to "at risk" — about 270k of a 392k live total came from one Red
// Flag Warning before this filter.
// A Tropical Storm / Hurricane Warning is a WIND product, so it is excluded
// here: counting it made every wind warning over the same zones produce a
// second, duplicate "people at risk" card for a flooding tool. The storm
// itself still drives its own proactive "prepare for inland flooding" card.
const FLOOD_EVENT = /flood|storm surge|tsunami|dam break|levee/i;
export const isFloodRelevant = (a) => FLOOD_EVENT.test(a.event ?? '');
