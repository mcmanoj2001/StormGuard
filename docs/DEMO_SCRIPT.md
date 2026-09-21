# Phase 3 demo video script

Recording-ready walkthrough against the actual current build (not the
aspirational feature list) — expands [CONTEXT.md](../CONTEXT.md) §7's
generic table with real steps and honest caveats so the presenter never
promises something on camera that isn't wired up yet. Target: 2-5 minutes
(Phase 3 allows up to 5; a tight 3-3:30 covers everything below).

## Before recording

1. `npm run dev`, load `http://localhost:5173` in a real browser — no
   setup, no login required for anything below.
2. **Get a free Census API key** at
   https://api.census.gov/data/key_signup.html and set
   `VITE_CENSUS_API_KEY` in `web/.env` (copy `.env.example`). Without it,
   the Population tab will show "Census API key not configured" live on
   camera instead of real headcounts — tract boundaries still work, but
   the numbers won't. **This is the one setup step that actually blocks a
   clean recording right now.**
3. Pick a moment when Louisiana (the default region) has at least one
   active NWS alert if you want the Actions/Population tabs to show
   real content without switching to Test Scenario — otherwise lead
   with Test Scenario for those two tabs instead, and note on camera that
   you're demonstrating with injected historical data by design (Phase 3
   explicitly requires this capability, so showing it isn't a weakness).

## Steps

| Time | Action | What it proves |
|---|---|---|
| 0:00–0:20 | Cold open on the live map, default Louisiana region. No login, no config. Point out color-coded gauge markers already on screen. | R4 — zero training, map IS the interface. |
| 0:20–0:40 | Open the region picker and switch states. Map re-centers and re-fetches gauges/alerts/population for the new region. | Official deliverable — "must display data for a region selected by the user." |
| 0:40–1:05 | Hover a red or orange gauge marker (don't click yet). Tooltip shows stage, trend, severity, **and** the plain-language action line. | R4/R5 — critical insight surfaced automatically, no click required. |
| 1:05–1:35 | Click that same gauge. Gauge tab opens: stage, trend, discharge, reading time, USGS site ID. If it's one of the curated AHPS forecast points, point out the forecast crest marker on the map instead — narrate why they're separate (no reliable USGS-site-to-NWS-LID crosswalk exists; see gaugePanel.js). | R1/R3 — real-time sensor data + genuine forecast crest, transparent about the join limitation rather than faking one. |
| 1:35–2:15 | Switch to the Actions tab. Show the ranked EVACUATE / PREPARE / MONITOR list — point out a card citing hospital count and estimated population inside a warned area, and a hurricane-cone card if a storm is active. | R3/R5 — this is the actual "judges' choice" differentiator: cross-source synthesis (alert + gauge trajectory + forecast crest + population + hospitals) into one ranked list, not four separate sections. |
| 2:15–2:35 | Switch to the Population tab. Show the real tract-level estimate with county breakdown (requires the Census key from step 2 above). | R2/R5 — the "novel data" angle CONTEXT.md names: population × warned-area geometry, not a stub. |
| 2:35–3:00 | Open **ⓘ About**. Scroll the data source table (live/stub status for every source) and the Known Limitations section — narrate one limitation out loud (e.g. the LiDAR-sensor gap, or the FEMA-zone-is-raster-tiles substitution) to show awareness, not just a feature list. | R2 — comprehensiveness + honest limitation disclosure (explicit Phase 3 requirement to document data sources and how they're accessed). |
| 3:00–3:20 | Click **"▶ See it in action"** inside the About modal. Map repopulates with the injected historical scenario live on camera. | Phase 3 hard requirement — test data injection when live data is unavailable. |
| 3:20–3:35 | Resize to tablet width (or open on an actual tablet). Same functionality, responsive layout, touch-sized tap targets. | R4 — works on a tablet in the field. |

## Known, deliberate scope limits — name these, don't hide them

Naming a limitation out loud reads as engineering maturity to judges (per
CONTEXT.md's own R2/R3 scoring notes); don't let these surface as
unexplained gaps if a judge pokes at them instead:

- **FEMA flood-zone layer is raster map tiles, not queryable polygons** —
  the Actions/Population synthesis uses the active NWS warning polygon as
  an honest substitute for "is this location in a flood zone," documented
  in `rulesEngine.js` and the About modal.
- **Severity thresholds are fixed absolute stage heights**, not each
  gauge's real NWS flood stage (a datum limitation, documented in
  `usgs.js` and the About modal) — calibrated to look right for the
  default Louisiana AOI; a gauge in a newly-selected region may show an
  odd severity color for this reason.
- **Population/TIGERweb data is scoped to the region's primary state** —
  a region straddling a state line (the default AOI touches southern
  Mississippi) only gets population for its primary state.
- **No real evacuation routing** — recommendations are plain-language
  ("pre-stage assets," "verify road closures"), not turn-by-turn routes.
  This was a deliberate strategic choice (CONTEXT.md §2), not an oversight
  — say so if asked.
- **LiDAR-based real-time stage sensors** were researched and explicitly
  documented as a known, currently non-integrable gap (About modal +
  CONTEXT.md §4) — a good example of R2's "explain data limitations"
  bullet if you want a concrete beat to hit.

## Pre-submission self-check (from CONTEXT.md §7)

- [x] R1: Gauge data refreshes on a 5-min cache TTL (tighter than the
      15-min source cadence). Timestamp + live/stale/error badge shown.
      Per-source error isolation confirmed (one dead upstream no longer
      blanks the others).
- [x] R2: 8+ distinct source categories now live or genuinely wired
      (USGS, NWS alerts+zones, NHC, NEXRAD, FEMA, AHPS crest, Census,
      OSM infrastructure). Limitations documented in-app via About modal
      and in CONTEXT.md §4.
- [x] R3: Actions panel is one ranked list from `rulesEngine.js`
      synthesizing alert + gauge trajectory + forecast crest + population
      + facilities — not separate concatenated sections.
- [ ] R4: **Needs an actual test** — put the app in front of someone who
      has never seen it and time how long it takes them to find the most
      critical flood on screen. Nothing in the code can substitute for
      this; do it before recording, not after.
- [ ] R5: **Judgment call, not a checkbox** — the ranked action engine and
      the hurricane-cone-as-early-warning signal are the strongest
      candidates for "something a judge hasn't seen before." Make sure
      the demo video's Actions-tab moment (1:35–2:15 above) is not rushed,
      since that's the beat carrying this criterion.
