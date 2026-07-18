# StormGuard architecture

```
 Browser (Leaflet SPA — the whole system)
┌──────────────────────────────────────────────┐
│ data modules (fetch → normalize)             │──▶ USGS IV (15-min gauges + 4h series)
│  usgs · nws · nhc · census                   │──▶ NWS active alerts
│ cache.js: TTL + stale-on-error (localStorage)│──▶ NHC track/cone (ArcGIS REST)
│ testmode.js: fixture injection               │──▶ Census ACS 5-yr (planned)
│ map layers                                   │──▶ NEXRAD radar tiles (Mesonet)
│  gauges · alerts · radar · NFHL WMS          │──▶ FEMA NFHL WMS
│ panels: actions · gauge · population         │
└──────────────────────────────────────────────┘
        Deploys as static files → GitHub Pages ($0/month)
```

## Key decisions

- **No backend — by strategy, not accident** (CONTEXT §2): the rubric does
  not score infrastructure; all six federal sources are free, keyless (or
  free-key), and CORS-enabled, so the browser calls them directly. Hosting
  cost is $0 (GitHub Pages), which also answers the challenge's "minimum
  cost" requirement.
- **Stale-on-error caching, persisted to localStorage**
  ([web/src/cache.js](../web/src/cache.js)): if an upstream dies mid-event,
  the map keeps the last good data with a "data delayed" badge — even across
  a page reload. Rubric R1 reliability.
- **Test-data injection sits at the data-module layer**, not a UI mock:
  flipping the toggle swaps fixtures inside the same cache → normalize →
  render pipeline the live path uses, so demos exercise the real code.
- **Trajectory is computed, not just displayed**: gauges are fetched with a
  4-hour window and rate-of-rise (ft/hr) is derived client-side. A rising
  gauge below flood stage outranks a falling one above it in the action
  panel (rubric R5).
- **One severity palette** shared by gauge markers, alert polygons, and
  panel badges — a responder learns the color language once.
- **No frontend framework**: vanilla JS + a 40-line pub/sub store. Small
  bundle for degraded field networks, nothing to learn, nothing to break.

## Next implementation steps (build order per CONTEXT §5)

1. **Real flood-stage thresholds** (Tier 1): NWS NWPS per-gauge
   action/minor/moderate/major stages to replace placeholder fixed
   thresholds in [usgs.js](../web/src/data/usgs.js) — fixes misclassified
   reservoirs/high-datum gauges.
2. **Forecast crest panel** (Tier 2): NWS AHPS/NWPS forecast — "expected to
   crest at 18.2 ft (major) in ~6 hours".
3. **Alert zone geometry**: many NWS alerts carry only UGC zone codes —
   resolve to polygons via api.weather.gov/zones (client-side, cached).
4. **Census ACS live**: tract populations + centroids for AOI counties;
   point-in-polygon against alert/flood geometries in the population panel.
5. **FEMA NFHL**: confirm WMS layer id renders; add legend.
6. **Infrastructure at risk** (Tier 2): hospitals/critical facilities from
   OpenStreetMap Overpass, pre-cached at startup, highlighted inside flood
   zones.
7. **Action synthesis rules engine** (Tier 3): fold crest timing, affected
   population, and flood-zone overlap into ranked evacuate/prepare/monitor
   recommendations — the Judges' Choice differentiator.
8. **Region selection**: geolocation + state picker to move the AOI beyond
   the Louisiana default.
