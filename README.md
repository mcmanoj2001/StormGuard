# ⛈ StormGuard

Real-time riverine-flood situational awareness for emergency responders.
Entry for the **IEEE Response Quest Challenge 2026** — see
[CONTEXT.md](CONTEXT.md) for the full strategy, rubric analysis, and build order.

A **browser-only** single-page app (Leaflet): every API call goes directly
from the browser to free federal endpoints — no backend, no database, no
hosting cost. Deployable to GitHub Pages. It answers three questions in
under 10 seconds: **Where is flooding? How bad? Getting worse?**

Hurricane data (NHC forecast track/cone) is used as a *proactive upstream
signal*: a storm cone over the area of interest triggers inland-preparation
recommendations days before river gauges move — see the scenario amendment
in [CONTEXT.md](CONTEXT.md).

## Quick start

```bash
npm install
npm run dev            # Vite dev server on :5173
```

Open http://localhost:5173. Flip **Test scenario** in the top bar to inject a
canned historical riverine-flood scenario (modeled on the August 2016
Louisiana flood) for demos when no real event is active.

## Structure

```
web/
  public/testdata/   injectable demo scenario fixtures (Phase 3 requirement)
  src/data/          one module per federal source, fetch → normalize in-browser
  src/map/           map bootstrap + severity-colored data layers
  src/panels/        gauge detail, action synthesis, population panels
  src/cache.js       TTL cache + stale-on-error fallback (localStorage-backed)
  src/testmode.js    test-data injection toggle
docs/                architecture notes
CONTEXT.md           project working document — the single source of truth
```

## Data sources (all free, browser-direct, CORS-enabled)

| Source | Module | Refresh | Status |
|---|---|---|---|
| USGS Instantaneous Values (stream gauges + trajectory) | `src/data/usgs.js` | 5 min cache | ✅ live |
| NWS Active Alerts | `src/data/nws.js` | 60 s cache | ✅ live |
| NHC forecast track/cone (proactive inland-flood signal) | `src/data/nhc.js` | 10 min cache | ✅ live (empty when no active storm) |
| NEXRAD precipitation radar (tiles) | `src/data/layers.js` | live tiles | ✅ live (Mesonet mirror) |
| FEMA NFHL flood zones (ArcGIS REST export — WMS isn't enabled on this service) | `src/data/layers.js` | live tiles | ✅ live (layer 28, verified) |
| NWS AHPS/NWPS forecast crest + flood stages | `src/data/ahps.js` | 6 h | ✅ live (13 curated forecast points; real per-site flood categories) |
| Census ACS 5-yr population | `src/data/census.js` | static | 🚧 stub (test fixture works) |

**Known data gap (documented deliberately, per rubric R2):** there is no
official federal real-time power-outage API; PowerOutage.us is the best
available substitute. Cell/radio outage data is similarly unavailable — we
show static FCC tower locations as infrastructure-at-risk instead.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design decisions.
