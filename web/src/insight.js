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
