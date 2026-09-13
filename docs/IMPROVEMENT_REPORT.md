# StormGuard Improvement Report

Generated 2026-09-13 via a full-codebase review (CONTEXT.md, Other-Details.md, README.md, docs/ARCHITECTURE.md, all of `web/src/`, git history). Confirmed: no backend, no LLM/AI dependency anywhere — deterministic fetch/normalize/render pipeline, consistent with CONTEXT.md §2 ("What this project is NOT").

---

## 1. Rubric alignment (against CONTEXT.md §1 and Other-Details.md's official rubric text)

| Criterion | Status | Evidence |
|---|---|---|
| **R1** Timeliness/Reliability | Partial-strong on paper, weaker in practice | USGS polled at 5-min TTL (`web/src/data/usgs.js:16`, tighter than the 15-min source cadence CONTEXT calls "the ceiling"), NWS at 60s, timestamps and a live/stale/offline badge exist (`web/src/main.js:45-53`). But the "graceful degradation" claim in `docs/ARCHITECTURE.md` is only true when a cache entry already exists — see the architecture bug in §2, which undermines the R1=5 bullet "Graceful degradation when APIs are unavailable." |
| **R2** Comprehensiveness | Partial | Only 3 of 7 listed sources are genuinely live end-to-end (USGS, NWS, NHC); NEXRAD is a raw tile layer (no fetch/normalize); FEMA NFHL WMS layer id is explicitly unconfirmed (`web/src/data/layers.js:19`); AHPS/NWPS forecast crest — named three separate times in CONTEXT as core to R1/R2/R3 — has no module at all; Census is a 5-line stub (`web/src/data/census.js:14-25`). The data-gap disclosure (power outages, cell/radio) is done well and documented in-app via the About modal. |
| **R3** Integration/Synthesis | Partial | Real synthesis exists: severity classification + trajectory (`usgs.js`), shared insight text (`insight.js`) driving both map tooltips and the Actions panel. But CONTEXT's own R3=5 bullet — "forecast crests have confidence intervals — show them" — is unaddressed since crest forecasting doesn't exist yet. The Population panel's "synthesis" is presently fake: it sums *all* tracts on any severe/extreme alert rather than doing point-in-polygon (`web/src/panels/populationPanel.js:5-6` admits this in a comment). |
| **R4** Usability | Genuinely strong | Map-first, single-tab-set UI, no login, 44px touch targets on panel tabs (`web/src/styles/main.css:128`), hover tooltips surface action text without a click, About modal covers in-app source transparency (a literal Phase 3 requirement per `Other-Details.md`). Minor gaps: About button is only 32px tall (`main.css:51`, inconsistent with the 44px standard elsewhere), and `role="tablist"` is set but tab buttons/panels lack `role="tab"`/`role="tabpanel"`/`aria-selected` (`web/index.html:26-33`). |
| **R5** Innovation/Scenario fit | Partial | The trajectory-aware action ranking (rising outranks falling at same stage) and the hurricane-cone-as-early-warning idea (`web/src/panels/actionPanel.js:27-41`) are genuinely clever and match CONTEXT's stated differentiator. But the "Tier 3 rules engine" is currently just two severity buckets sorted by rate — not the crest-timing + population + flood-zone-overlap synthesis CONTEXT explicitly describes as the target. |

**Bottom line:** closer to a 3–4 than a 5 on R2/R3/R5 specifically because the two features CONTEXT itself names as the biggest point-scorers (forecast crest, real population×flood-zone synthesis) are the two least-built things in the repo.

---

## 2. Architecture soundness (browser-only, multi-API, no-backend shape)

### The most important finding: a bulkhead-isolation bug that contradicts the architecture doc's own claims

In `web/src/main.js:30-35`:
```js
const [gauges, alerts, hurricane, population] = await Promise.all([
  getGauges(),
  getAlerts(),
  getHurricane().catch(() => ({ storms: [] })),
  getPopulation(),
]);
```
Only `getHurricane()` is individually caught. `getGauges()`, `getAlerts()`, and `getPopulation()` are not. `cached()` (`web/src/cache.js:40-45`) only swallows an error if there's already a cached entry to fall back on — on first load, or on a cold outage with an empty cache (localStorage cleared, private browsing, or a brand-new region once region-selection exists), a single dead source throws through `Promise.all`, and the **whole refresh fails** — discarding a perfectly good NWS alerts response that resolved fine, and flipping the badge to "Offline — retrying" even though most sources are healthy. This is the opposite of the bulkhead isolation `docs/ARCHITECTURE.md` claims ("if an upstream dies mid-event, the map keeps the last good data"). That claim is only true *after* a first successful fetch has populated the cache.

**Fix:** apply the same `.catch()` pattern used for `getHurricane()` to the other three calls (~15 minutes), and don't gate a global "error" state on a single source's failure.

### Other findings

- **Timeouts**: `fetchJson` (`web/src/fetchJson.js:4-29`) does the right thing — `AbortController` with a 15s timeout, so a hung request can't block the UI indefinitely. Good.
- **Retries**: capped at 2 with exponential backoff (`500 * 2^attempt`), 429/503 responses honor `Retry-After` or fall back to `2^attempt` seconds. Sound — won't hammer a rate-limited federal API. Trade-off: worst case ~45-60s for one source across 3 attempts, and because everything sits behind one `Promise.all`, a slow source delays the *entire* UI update including the fast 60s-TTL NWS alerts. No per-source independent render path — only one monolithic `setState()` after all four resolve.
- **Raster/WMS layers bypass the whole pipeline.** `web/src/data/layers.js`'s radar and FEMA NFHL layers are raw `L.tileLayer`/`L.tileLayer.wms` calls wired directly in `map.js:40-44` — never go through `fetchJson`/`cache.js`. No timeout, no retry, no staleness detection, no user-facing signal if the WMS server is down or the layer id is wrong — tiles just silently don't paint. Given the FEMA layer id is explicitly flagged unconfirmed, this is currently invisible-failure territory: a judge toggling "FEMA flood zones" live could see a blank layer with zero explanation.
- **Stale-on-error caching is sound** — TTL + localStorage persistence + a `cache: 'hit'|'miss'|'stale'` tag on every result (`cache.js:26-46`), survives reloads. Gap is *granularity* of the signal: `main.js:36` collapses gauges+alerts staleness into one global badge boolean — a responder can't tell *which* layer is stale, and storms/population/radar/WMS have no staleness indicator at all.
- **`nhc.js` is the best-isolated data module in the codebase** — N+1 fetches (metadata + per-slot points/track/cone), each sub-fetch wrapped in its own `.catch(() => null)` (`nhc.js:51,62`), so one dead sublayer degrades gracefully within the module itself. This pattern should be the template applied to the top-level `main.js` orchestration, not just within individual modules.

---

## 3. Code quality

- **Strong, consistent per-source module shape**: fetch → normalize → cache-wrap → test-fixture branch, repeated identically across `usgs.js`, `nws.js`, `nhc.js`, `census.js`. Genuine strength — easy to read, easy to extend (e.g., AHPS) by copying the pattern.
- **Acknowledged-but-real correctness gap**: `classifySeverity()` in `usgs.js:26-32` uses fixed absolute stage-height thresholds (≥30ft = major, ≥20 = moderate, ≥12 = minor) across *all* gauges regardless of local datum. The code comment itself flags this — but it's live code, and it will produce visibly wrong severity colors for real USGS sites whose local flood stage differs from these numbers. Currently masked because the default AOI (Louisiana) happens to look reasonable; becomes a real live-demo risk the moment region selection is added or the AOI is panned.
- **Population panel's algorithm doesn't match its own UI claim** — labels output "~N people ... estimated inside active warning areas" while actually summing every tract regardless of geometry (`populationPanel.js:5-6, 26`). Low risk today (fixture-only), needs fixing before live Census data lands.
- **Error handling is silent to the user** beyond the top-bar badge — `console.error('refresh failed', err)` gives no indication of *which* source failed.
- **Minor a11y gaps**: no `role="tab"`/`aria-selected` on tab buttons despite `role="tablist"` being present; About button is 32px vs. the 44px standard elsewhere; no custom `:focus` styling in `main.css`.
- **No test files anywhere.** Reasonable for a hackathon timeline, but the severity-threshold bug above is exactly what a unit test on `classifySeverity`/`rateOfChange` would have caught.
- Nothing resembling dead code; module boundaries are clean; no framework bloat (vanilla JS + a 40-line pub/sub store in `state.js`, as advertised).

---

## 4. Product/demo competitiveness

`docs/DEMO_SCRIPT.md` is honest and well-scoped — explicitly lists what not to claim on camera, a mature practice.

Highest-leverage gaps, weighed against actual rubric language:

- **NWS AHPS/NWPS forecast crest** — the single most explicitly-named missing feature: appears in the official challenge deliverables ("expected crest and time," `Other-Details.md:38`), in CONTEXT's R1/R3 scoring bullets, and in CONTEXT's own Tier 2 build order (#8). Not started at all. **Biggest rubric-dollar gap in the repo.**
- **Census ACS + real point-in-polygon** — CONTEXT's self-described "novel angle" (R2/R5: population × NFHL × gauge join, "underutilized and directly actionable," `CONTEXT.md:33`). Currently the least-built module. Moderate effort — Census's REST API is simple, and `.env.example` already scaffolds `VITE_CENSUS_API_KEY`.
- **Region selection** is not a nice-to-have — it's a hard requirement in the official challenge text ("Must be able to display data for a region selected by the user," `Other-Details.md:27`) and an unchecked item in CONTEXT's own Phase 3 checklist. `DEFAULT_BBOX` is hardcoded to Louisiana with zero UI to change it. Sequence *after* the severity-threshold fix, since exposing arbitrary regions will surface that bug immediately.
- **FEMA NFHL WMS** — low effort to de-risk: confirm layer id `28` renders, or find the right id. A 15-30 minute task that removes a live-demo failure mode.
- **Infrastructure-at-risk (OSM Overpass hospitals)** — named in the official rubric, but appropriately lower priority than crest/population per CONTEXT's own tiering.
- **Evacuation routing** — CONTEXT deliberately keeps this to text recommendations rather than real routing, and that's the right call. Don't chase this.

---

## 5. Prioritized next steps

Ranked by (rubric/demo impact) × (inverse effort):

1. **Fix the `Promise.all` bulkhead bug** (`web/src/main.js:30-35`) — wrap the other three calls in `.catch()` like `getHurricane()` already is. ~15-30 min. Repairs a claim in `docs/ARCHITECTURE.md` that's currently false on cold failures — exactly what a technically-literate judge reading the source would flag first.
2. **Verify the FEMA NFHL WMS layer id** (`web/src/data/layers.js:19`) actually renders; fix/replace if not. ~30 min. Removes a known live-demo failure mode already self-flagged in code and the About modal.
3. **Fix `classifySeverity()`** (`web/src/data/usgs.js:26-32`) — at minimum, document the fixed-threshold limitation loudly before expanding the AOI. Real fix (per-gauge NWS flood-stage thresholds) is larger, see #6.
4. **Build NWS AHPS/NWPS forecast crest integration** — new module mirroring `usgs.js`/`nws.js`, plus a crest panel. Highest rubric-value gap, currently nonexistent. Moderate-to-large effort.
5. **Wire real Census ACS 5-yr data + real point-in-polygon** in `census.js`/`populationPanel.js`. CONTEXT's self-declared differentiator, currently the weakest module. Moderate effort.
6. **Add region selection UI** to satisfy the official "region selected by the user" requirement — currently entirely absent. Sequence after #3.
7. **Infrastructure-at-risk layer** (OSM Overpass hospitals, pre-cached per CONTEXT's own caution against live-querying during a demo) — named in the rubric, appropriately lower priority than #4/#5.
8. **Tier 3 action-synthesis rules engine** (fold crest timing + population + flood-zone overlap into ranked tiers, replacing the current two-bucket sort in `web/src/panels/actionPanel.js`) — the "Judges' Choice" differentiator, but depends on #4 and #5 landing first.

**Skip/deprioritize:** full evacuation routing (CONTEXT correctly scoped this out); ARIA tab-role completeness and per-layer staleness UI polish are worth a pass but cosmetic relative to items 1-6.
