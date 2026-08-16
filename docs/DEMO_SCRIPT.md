# Phase 3 demo video script

Recording-ready walkthrough against the actual current build (not the
aspirational feature list) — expands [CONTEXT.md](../CONTEXT.md) §7's
generic table with real steps and honest caveats so the presenter never
promises something on camera that isn't wired up yet.

Target length: 3 minutes. Run `npm run dev`, load `http://localhost:5173`
in a real browser before recording (Chrome/Edge/Safari/Firefox all work —
no setup, no login).

## Steps

| Time | Action | What it proves |
|---|---|---|
| 0:00–0:20 | Cold open on the live map. No login, no config. Point out color-coded gauge markers already on screen. | R4 — zero training, map IS the interface. |
| 0:20–0:45 | Hover a red or orange gauge marker (don't click yet). Tooltip shows stage, trend, severity, **and** the plain-language action line. | R4/R5 — critical insight surfaced automatically, no click required. |
| 0:45–1:15 | Click that same gauge. Gauge tab opens: stage, flood threshold context, rate of change, reading time, USGS site ID. | R1 — real-time sensor data, transparent sourcing. |
| 1:15–1:45 | Switch to the Actions tab. Show the prioritized plain-language responder actions (rising gauges outrank falling ones at the same stage). | R3/R5 — synthesis into a single actionable recommendation, trajectory-aware. |
| 1:45–2:15 | Open **ⓘ About**. Scroll the data source table and legend — narrate: "every source here is free federal data, and we document what's live versus not yet wired up." | R2 — comprehensiveness + honest limitation disclosure (explicit Phase 3 requirement). |
| 2:15–2:40 | Click **"▶ See it in action"** inside the About modal. Map repopulates with the injected historical scenario live on camera. | Phase 3 hard requirement — test data injection when live data is unavailable. |
| 2:40–3:00 | Resize the window to tablet width (or open on an actual tablet). Same functionality, responsive layout, touch-sized tap targets. | R4 — works on a tablet in the field. |

## Do NOT claim on camera (not yet live)

- FEMA flood-zone overlay — WMS layer ID unconfirmed, may not render.
- NWS AHPS/NWPS forecast crest ("expected to crest at X ft in Y hours") —
  not implemented; don't narrate a crest time that isn't shown on screen.
- Population impact numbers — the Population tab is honest about showing
  nothing until Census ACS integration lands; don't state a person count
  that isn't displayed.

If any of the above ship before the October deadline, add a step here and
move the corresponding row out of this section — keep this file in sync
with the actual build, not the roadmap.

## Pre-submission self-check (from CONTEXT.md §7)

- [ ] R1: Gauge data refreshes every 15 min? Timestamp shown? Graceful degradation?
- [ ] R2: 5+ data source categories used? Limitations documented (now in-app via About)?
- [ ] R3: Multi-source synthesis producing a single insight, not just separate layers?
- [ ] R4: Someone who never saw this navigates to a critical flood within 10 seconds?
- [ ] R5: Something a judge hasn't seen before — something that makes them say "that's clever"?
