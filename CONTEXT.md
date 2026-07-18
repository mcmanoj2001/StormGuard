# IEEE Response Quest 2026 — Project Working Document
 
> **Goal: First place ($30,000).** Every decision in this project optimizes rubric score across all five equally-weighted categories. This document is the single source of truth.
 
---
 
## 1. Scoring — What Winning Requires
 
Five categories, equal weight, 1–5 scale. Max possible: 25 points. Same rubric applies to both Phase 2 (concept) and Phase 3 (product), with rising expectations.
 
### R1 — Timeliness, Real-Time Responsiveness & Technical Reliability
 
| 5 (Exceeding) | 4 (Strong) | 3 (Adequate) | 2 (Limited) | 1 (Minimal) |
|---|---|---|---|---|
| Near real-time performance with minimal latency and a reliable, well-structured technical foundation | Timely updates with minor delays; solid technical implementation | Periodic updates; basic but functional technical execution | Slow or inconsistent updates; fragile or unclear technical foundation | No meaningful real-time capability or nonfunctional execution |
 
**How we score a 5:**
- USGS gauge data polled every 15 min (source cadence — matching it is the ceiling)
- NWS alerts displayed within seconds of issuance via live API call
- Every data layer shows a "last updated" timestamp — never let the user wonder if data is stale
- Graceful degradation when APIs are unavailable (cached data + staleness indicator)
- Test data injection works reliably for demo when live data is absent
 
### R2 — Comprehensiveness, Use of Available Data & Novel Data Discovery
 
| 5 (Exceeding) | 4 (Strong) | 3 (Adequate) | 2 (Limited) | 1 (Minimal) |
|---|---|---|---|---|
| Integrates multiple relevant data sources, clearly explains limitations, and meaningfully incorporates new or underutilized data | Uses several relevant sources with some exploration of novel data | Uses one or two meaningful sources with limited novelty | Minimal integration; no exploration of new or unconventional data | Little or no relevant data; no awareness of data gaps |
 
**How we score a 5:**
- 5+ distinct data source categories (hydrology, weather, infrastructure, population, flood zones)
- Explicitly document known data gaps (no real-time power outage API exists — explain what we use instead)
- Novel angle: Census tract + FEMA NFHL + gauge data joined to estimate affected population per flood zone — underutilized and directly actionable
 
### R3 — Integration, Synthesis Quality & Responsible Data Handling
 
| 5 (Exceeding) | 4 (Strong) | 3 (Adequate) | 2 (Limited) | 1 (Minimal) |
|---|---|---|---|---|
| Combines data seamlessly into coherent insights with strong ethical safeguards and transparent data handling | Good integration and generally responsible data practices | Basic integration with limited articulation of ethical considerations | Weak integration; unclear or insufficient data-handling safeguards | No meaningful integration or responsible data practices |
 
**How we score a 5:**
- Synthesize data into a single actionable status per gauge: normal / watch / warning / major / critical
- Show relationships between sources: upstream precipitation + current stage + forecast crest = estimated time to action stage
- All data is public federal data, no PII — document source attribution on every layer
- Acknowledge uncertainty: forecast crests have confidence intervals — show them
 
### R4 — Usability, Clarity & Operational Readiness for Emergency Responders
 
| 5 (Exceeding) | 4 (Strong) | 3 (Adequate) | 2 (Limited) | 1 (Minimal) |
|---|---|---|---|---|
| Intuitive, easy to learn, aligned with responder workflows; well-documented and safe for operational use | Generally easy to use with minor documentation or clarity gaps | Usable but requires training; documentation incomplete | Confusing or cluttered; technical or ethical ambiguities | Poor usability; unclear or unsafe for responders |
 
**How we score a 5:**
- A responder answers three questions within 10 seconds: Where is flooding? How bad? Getting worse?
- Color-coded severity requiring zero training (green/yellow/orange/red)
- Map IS the interface — not a tab within it
- Works on a tablet in the field (responsive, touch-friendly, no tiny tap targets)
- No login, no setup, no configuration required
- Demo video shows a non-technical person navigating it cold
 
### R5 — Scenario Fit, Insightfulness, Innovation & Technical/Data Creativity
 
| 5 (Exceeding) | 4 (Strong) | 3 (Adequate) | 2 (Limited) | 1 (Minimal) |
|---|---|---|---|---|
| Strong alignment to the chosen scenario; provides high-value insights and demonstrates innovative technical and data approaches | Good alignment with useful insights and some innovative elements | Scenario defined with basic insights and limited innovation | Weak alignment; shallow insights; minimal creativity | Scenario missing or mismatched; little insight or innovation |
 
**How we score a 5:**
- Innovation is the decision layer: synthesizing data into responder actions — evacuate now / prepare / monitor
- Show trajectory, not just current state — a gauge at 80% of flood stage rising fast is more dangerous than one at 90% falling
- Novel data: affected population count joined to flood zone polygons clipped to gauge levels
 
---
 
## 2. Strategic Decisions
 
### What this project is
 
A single-page web application that calls free federal APIs from the browser, renders a map with real-time flood data, and synthesizes that data into clear responder actions.
 
### What this project is NOT
 
A backend data pipeline, a hosted infrastructure system, a database, or a production-grade platform. The rubric does not score infrastructure complexity, hosting cost, or backend architecture. A browser-based prototype scoring 5s on all five rubric categories wins over an over-engineered system that is confusing to use.
 
### Build target
 
- Single HTML/JS/CSS application (or lightweight React/Vite app)
- Leaflet.js for mapping (free, no API key, OSM tiles)
- All API calls made from browser directly to free federal endpoints
- Deployable to GitHub Pages at $0/month
- Test data injection via UI toggle replacing live API responses with pre-built scenario dataset
 
### Judges' Choice angle ($10,000)
 
Qualitative award for "excellence not captured by scoring rubric." Our angle: a UI so clear and fast that it could genuinely replace what responders use today. Prioritize the demo video — show a real person making a real decision in under 60 seconds.
 
---
 
## 3. Chosen Scenario: Floods
 
Floods are the most frequent and costly natural disaster in the United States. The core data source — USGS stream gauges — is a sensor network publishing readings every 15 minutes via a well-documented, reliable, free REST API with 8,000+ stations.
 
The decision window for floods (hours to days) is long enough to make decision-support genuinely useful, unlike tornadoes (minutes) where a dashboard has no operational value.
 
**Flood-specific data points to display (from challenge requirements):**
- Water height vs established flood levels
- Rate of rise or fall (calculated from gauge time series)
- Expected crest and time (NWS AHPS forecast)
- Areas that can expect damage (FEMA NFHL flood zones at forecast level)
 
---
 
### Amendment (July 18, 2026) — hurricane data as proactive flood input

Floods remain the primary scenario, but hurricane datasets are IN scope as an
**upstream early-warning signal**: National Hurricane Center forecast track,
cone of uncertainty, and current position are ingested so inland riverine
impact can be anticipated *before* rain reaches the basins. The value is
pre-positioning lead time — a storm cone crossing the area of interest
triggers a proactive inland-preparation recommendation in the action panel
days before gauges move. Storm surge, coastal wind products, and full
hurricane-scenario coverage stay out of scope; NHC track/cone/position is the
only hurricane dataset used, in service of the flood mission.

---

## 4. Data Sources
 
All sources are free, require no paid API key unless noted, and are operated by US federal agencies.
 
### Layer 1 — Hydrology (core sensor feed)
 
| Source | Endpoint | Cadence | Key notes |
|--------|----------|---------|-----------|
| USGS Instantaneous Values | waterservices.usgs.gov/nwis/iv/ | 15 min | Primary RT sensor feed. Stage height + discharge. No key. |
| USGS Site Metadata | waterservices.usgs.gov/nwis/site/ | Static | Gauge lat/lon, datum, flood stage thresholds. Fetch once, cache. |
| NWS AHPS Forecast | water.weather.gov/ahps2/ | 6h update | River stage forecasts, predicted crest time/height. Critical for trajectory. |
 
### Layer 2 — Weather & atmospheric
 
| Source | Endpoint | Cadence | Key notes |
|--------|----------|---------|-----------|
| NWS Alerts API | api.weather.gov/alerts/active | Near RT | Flood watches, warnings, advisories. Filter by zone. Requires User-Agent header. |
| NWS QPF | api.weather.gov/gridpoints/{office}/{x},{y} | Hourly | Upstream rainfall forecast. Feeds "why is this flooding" context. |
| NOAA RIDGE2 Radar | opengeo.ncep.noaa.gov/geoserver (WMS) | 2–6 min | Precipitation radar tiles. SPOF — use Iowa Mesonet as fallback. |
 
### Layer 3 — Infrastructure & geography
 
| Source | Endpoint | Cadence | Key notes |
|--------|----------|---------|-----------|
| OpenStreetMap / Overpass | overpass-api.de/api/interpreter | Static | Hospitals, roads, bridges. Pre-cache at startup — never query live during demo. |
| FEMA NFHL | hazards.fema.gov/gis/nfhl/rest/services | Static | Official 100yr/500yr flood zone polygons. Map overlay. |
| Census TIGER/Line | tigerweb.geo.census.gov/arcgis/rest/services | Annual | Road network, county/tract boundaries. |
 
### Layer 4 — Population & impact
 
| Source | Endpoint | Cadence | Key notes |
|--------|----------|---------|-----------|
| Census ACS 5-Year | api.census.gov/data/{year}/acs/acs5 | Annual | Population by tract. Free key via census.gov. Elderly, mobile homes, disability counts. |
| FEMA Shelter API | gis.fema.gov/arcgis/rest/services/NSS | Live during events | Active shelters during declared disasters. Fallback to Red Cross data. |
 
### Layer 5 — Connectivity (document the gap)
 
| Source | Endpoint | Cadence | Key notes |
|--------|----------|---------|-----------|
| FCC Cell Tower data | opendata.fcc.gov | Semi-annual | Static cell tower locations. Shows infrastructure at risk, not real-time outages. |
| Power outage data | No official federal API | N/A | Document this gap explicitly. PowerOutage.us is best available. Stating limitations earns R2 points. |
 
---
 
## 5. Feature Scope — Build Order by Rubric Impact
 
### Tier 1 — Must-have (scores R1 + R4)
 
1. Map with USGS gauge markers, color-coded by flood stage (green/yellow/orange/red)
2. Click gauge to see: current level, flood threshold, rate of change, last updated time
3. NWS active flood alerts overlay (alert polygons on map with severity color, auto-refresh)
4. Data freshness timestamps on every layer
5. Test data injection toggle (loads pre-built historical flood scenario, e.g. Vermont 2023)
6. Responsive layout — desktop, tablet, mobile
 
### Tier 2 — High-value (scores R2 + R3 + R5)
 
7. Trajectory indicator per gauge — rising/falling/stable with rate ("+0.4 ft/hr")
8. Forecast crest panel — "Expected to crest at 18.2 ft (major flood stage) in ~6 hours"
9. FEMA flood zone overlay — toggleable 100yr/500yr flood plain layer
10. Affected population estimate — "~4,200 people in affected area" from Census + NFHL
11. Infrastructure at risk — hospitals/critical facilities within flood zone highlighted on map
 
### Tier 3 — Innovation differentiator (scores R5 + Judges' Choice)
 
12. Responder action summary panel — plain-language recommended actions synthesized from all active data: "3 gauges approaching major flood stage in [county]. Recommend evacuation pre-positioning for [roads]. Crest expected in 4–8 hours."
 
### Explicitly out of scope — do NOT build
 
- User authentication or accounts
- Backend server or database
- Historical data charting beyond 24h
- Social media integration
- Other disaster types (earthquake, hurricane, wildfire)
- Native mobile app (browser-responsive is sufficient)
 
---
 
## 6. Phase 2 — Concept Submission Guide
 
**Deadline: Early June 2026. Format: Online form.**
 
The form asks four things. Strategy for each:
 
### Q1: Proposed solution and disaster scenario
 
Lead with user outcome, not technology. Example framing:
 
"FloodWatch is a zero-training situational awareness tool for emergency managers responding to inland flooding. It answers three questions in under 10 seconds: Where is flooding happening? How bad is it? Is it getting worse? It synthesizes USGS stream gauge sensor data, NWS flood alerts, and FEMA flood zone maps into a single color-coded map with a plain-language responder action panel."
 
Scenario: Riverine flooding in the continental US, targeting county-level emergency managers and state EOCs.
 
### Q2: Data sources and near-real-time awareness
 
- Lead with USGS instantaneous values (15-min, 8,000+ gauges, most reliable free sensor network)
- NWS alerts (near-real-time) and AHPS forecasts (crest predictions)
- FEMA NFHL for flood zone context, Census ACS for population impact
- Explicitly name the data gap: no real-time federal power outage API — state how you handle it
- This combination = 5 on R2: multiple sources + novel synthesis + awareness of limitations
 
### Q3: Integration, visualization, and presentation approach
 
Three-layer synthesis:
1. Current state — gauge level vs thresholds = alert classification
2. Trajectory — rate of change + NWS crest forecast = time available
3. Impact — gauge level clipped to FEMA zone + Census population = who is affected
 
All on a single map. No tabs, no drilling, no training.
 
### Q4: User experience — who and how
 
User: county emergency manager at an EOC, or field incident commander on a tablet.
 
Principles: map IS the interface; color means severity (globally consistent); critical info surfaced automatically; one-tap to "what should I do" panel.
 
---
 
## 7. Phase 3 — Prototype Scope
 
**Deadline: Early October 2026. Deliverable: 2–5 minute video of a real person using a working prototype.**
 
### What "working" means
 
A single-page app (GitHub Pages or local) that:
- Loads map centered on user-selected region
- Fetches live USGS gauge data, renders colored markers
- Fetches live NWS alerts, renders alert polygons
- Shows gauge detail panel on click (level, threshold, rate of change, forecast)
- Test data injection button loads a historical scenario
- Works in Chrome, Edge, Safari, Firefox — desktop and tablet
 
### Demo video script (target: 3 minutes)
 
| Time | What to show |
|------|-------------|
| 0:00–0:30 | Map loads. Multiple gauges visible. Some red, some orange. Immediate visual clarity. |
| 0:30–1:00 | Click red gauge. Detail: 19.4 ft, flood stage 17 ft, rising +0.6 ft/hr, crest 21.2 ft in 5h. |
| 1:00–1:30 | Toggle FEMA flood zone overlay. Show which areas are in 100yr flood plain at forecast level. |
| 1:30–2:00 | Responder action panel: "2 gauges in major flood. ~3,400 people affected. Crest in 4–6h. Recommend evacuation for Route 2 corridor." |
| 2:00–2:30 | Test data injection toggle — load historical event. |
| 2:30–3:00 | Show on tablet/mobile. Same functionality, responsive. |
 
### Pre-submission self-check
 
- [ ] R1: Gauge data refreshes every 15 min? Timestamp shown? Graceful degradation?
- [ ] R2: 5+ data source categories used? Limitations documented?
- [ ] R3: Multi-source synthesis producing a single insight (not just separate layers)?
- [ ] R4: Someone who never saw this navigates to a critical flood within 10 seconds?
- [ ] R5: Something a judge hasn't seen before — something that makes them say "that's clever"?
 
---
 
## 8. Timeline
 
| Date | Milestone | Action |
|------|-----------|--------|
| By May 29, 2026 | Phase 1 registration closes | Must be completed |
| Early June 2026 | Phase 2 concept due | Use Section 6 above |
| Late June 2026 | Phase 3 opens | Begin prototype build |
| July 2026 | Core build | Map + gauge layer + NWS alerts layer |
| August 2026 | Integration build | Forecast crest, FEMA overlay, trajectory indicator |
| September 2026 | Decision layer | Population impact, action panel, test data injection |
| Early October 2026 | Phase 3 due | Video + prototype submission |
| Oct–Dec 2026 | Evaluation | Finalist presentations, winners announced |
 
---
 
## 9. Original Challenge Reference
 
### Six sub-problems (challenge framework)
 
| Sub-problem | How this project addresses it |
|-------------|-------------------------------|
| Access | USGS, NWS, FEMA APIs — all free, no auth |
| Storage | Browser cache + IndexedDB for offline resilience |
| Integration | Gauge + alert + flood zone + population joined on geography |
| UI | Map-first, color-coded severity, zero training |
| Decision-making | Responder action panel synthesizes all layers |
| Modeling | Rate of change + NWS crest forecast = trajectory model |
 
### Deliverable requirements checklist
 
- [ ] Single UI in Chrome, Edge, Safari, Firefox
- [ ] Scales to desktop, tablet, phone
- [ ] Near-real-time data display
- [ ] Region selection (pan/zoom)
- [ ] Critical infrastructure display (hospitals, roads from OSM)
- [ ] Weather conditions and precipitation (NWS alerts + radar)
- [ ] Flood-specific: water height vs flood levels, rate of rise/fall, expected crest
- [ ] People impacted estimate (Census + FEMA NFHL)
- [ ] Evacuation route recommendations
- [ ] Test data injection for demo
 
### Prize structure
 
| Award | Amount |
|-------|--------|
| 1st place | $30,000 |
| 2nd place | $20,000 |
| 3rd place | $15,000 |
| Judges' Choice | $10,000 |
| Honorary Mentions | Up to $25,000 total |
 
### Contact
 
Questions: impactchallenge@ieee.org
