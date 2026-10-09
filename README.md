# ⛈ StormGuard

Flood situational awareness for emergency responders. It pulls live federal
data into one map and answers three questions in seconds: **where is it
flooding, how bad is it, and what needs a response first?**

Entry for the IEEE Response Quest Challenge 2026 (flood scenario).

## What it does

- **Live map** of USGS river gauges colored by severity, with rate of rise or
  fall, NWS alerts, NWS river-crest forecasts, hurricane track and cone, radar,
  FEMA flood zones and hospitals.
- **Ranked actions:** every signal is sorted into **Respond now / Prepare /
  Monitor**. Each warning shows people in the area, age 65+, homes without a
  vehicle and hospitals inside it.
- **Click any event** on the map to see just its actions. Mark actions done;
  completed ones move to a Completed list.
- **Test scenario** toggle injects a sample flood-and-hurricane event for
  demonstrations when no disaster is active.
- **ⓘ About** lists every data source and its status, and the known limits.
- Works on desktop, tablet and phone. No login, no backend, no database.

## Run it

```bash
npm install
npm run dev        # open http://localhost:5173
```

The first live load can take up to a minute (the USGS service is slow); after
that data is cached. Population *counts* need a free Census key, everything
else works without one:

1. Get a key: https://api.census.gov/data/key_signup.html
2. Copy `.env.example` to `web/.env` and set `VITE_CENSUS_API_KEY=<your key>`.
3. Restart `npm run dev`. If the app already ran once without a key, clear
   localStorage for localhost:5173 (population is cached for 24 hours).

## Data sources and how to access them

All free, public, and called directly from the browser.

| Source | Endpoint | Refresh |
|---|---|---|
| USGS stream gauges | `waterservices.usgs.gov/nwis/iv/` | 5 min |
| NWS alerts and zone boundaries | `api.weather.gov/alerts/active`, `/zones` | 60 s |
| NWS river forecasts (13 curated points) | `api.water.noaa.gov/nwps/v1/gauges/{id}` | 6 h |
| NHC hurricane track and cone | `mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer` | 10 min |
| NEXRAD radar tiles | `mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/` | live |
| FEMA flood zones (layer 28) | `hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer` | tiles |
| Census population (ACS 5-year) | `api.census.gov/data/2022/acs/acs5` | 24 h |
| Census tract and state boundaries | `tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb` | 24 h |
| OpenStreetMap hospitals | `overpass-api.de/api/interpreter` | 24 h |

If a source fails, the last good data is shown and flagged "Data delayed";
sources fail independently.

## Known limits

- No evacuation orders: no federal feed carries them. "Respond now" means the
  highest-priority warning, not an evacuation order.
- Population figures count whole census tracts whose center is inside a
  warning, so they are upper-bound estimates.
- Gauge severity uses fixed stage thresholds, not each gauge's official flood
  stage, so some high-datum gauges (such as reservoirs) can read "major".
- Radar only: no satellite imagery. No real-time power or cell outage data (no
  federal API exists).
- LiDAR river-stage sensors exist but no public national feed does.

## More detail

- [docs/ALGORITHMS.md](docs/ALGORITHMS.md): how every derived number is computed
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): design decisions
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md): demo walkthrough
- [CONTEXT.md](CONTEXT.md): strategy and rubric notes

```
web/src/data/      one module per source (fetch, normalize, cache)
web/src/map/       map and layers
web/src/panels/    actions, gauge, population, about
web/src/rulesEngine.js   Respond now / Prepare / Monitor ranking
web/public/testdata/     test-scenario fixtures
```
