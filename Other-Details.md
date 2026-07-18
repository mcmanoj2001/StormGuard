# IEEE Response Quest Challenge — Official Details (reference)

Reference copy of the challenge organizers' published details. Strategy and
build decisions derived from this live in [CONTEXT.md](CONTEXT.md).

## Additional Information for Response Quest Participants

To help teams navigate the complexity of this challenge, six core sub-problems were identified during planning discussions:

- **Access** – locating and retrieving relevant disaster-related data
- **Storage** – managing and organizing data for timely use
- **Integration** – aligning and combining data from multiple sources and formats
- **User Interface** – An intuitive interface that allows users a simple way to visualize large amounts of information in one space
- **Decision-making** – enabling users to interpret data and take informed action for the protection of the public and safety of the disaster responders
- **Modeling** – using data to simulate or predict disaster scenarios and outcomes

These sub-problems offer a framework for submission design and evaluation. While teams may choose to focus on specific areas, integrated solutions that address multiple components are strongly encouraged.

Participants will be tasked with developing tools or systems that consolidate and visualize disaster-related data to support emergency response decision-making, specifically protection of the public and the safety of responders during disaster operations. Solutions may focus on specific disaster types (e.g., hurricanes, wildfires, floods) and must demonstrate how data integration leads to actionable insights. Real-time or near-real-time data processing and display are central to the challenge's intent, with emphasis on usability for emergency responders.

### Potential deliverables

- Single user interface that is accessible with standard internet browsers (i.e. Google Chrome, Microsoft Edge, Apple Safari, and Mozilla Firefox)
  - Should scale to desktop, tablet, and phone
  - Supports user ability to visualize and make decisions on currently changing data
- Interface must not require significant training for users (Must be Intuitive)
- Must be able to display data for a region selected by the user that could include a community, region/state, country or some combination of those
- Must be able to display critical infrastructure and its relationship to the disaster (Hospital, nursing homes, power plants, power substations, cell towers, radio towers, roads, train tracks, ...) [All elements are not required. Item placement can be automated or placed by user]
- Must be able to display current weather conditions and precipitation
  - Include any information relevant to disaster responders such as heat warnings, cold warnings, fog, wind warnings, ice warnings, thunderstorm warnings, ...
- Must display data in near-real-time. Consider hosting costs and operating costs when designing this system. Looking for the most current data at the minimum cost.

### Optional Disaster Targets

- Hurricanes/Typhoons/Cyclones (Track, current location, direction of travel, speed, intensity, storm surge)
- Wildfires (Track, current location, direction of travel, speed, intensity)
- Tornadoes (Track, current location, direction of travel, speed, intensity)
- Floods (Water height vs established flood levels, rate of rise/fall of water, expected crest and time, areas that can expect damage)
- Earthquakes (Location, Intensity, known faults in the area, area the earthquake shaking was felt, time since shaking started, duration of shaking, aftershocks data)
- Tsunamis (Areas that are expected to be impacted, wave height expected, expected time of arrival)

### Optional Information to Consider

- Calculate the number of people being impacted by the event and where they are located.
- Number of required shelters and the locations for sheltering those impacted
- Recommend areas that should be evacuated.
  - The best evacuation routes to minimize impact to the public
  - Estimate when evacuations should begin
- Based on available data — what areas need immediate attention from Emergency Responders?
- Based on available data, what future evacuations / Emergency Responder activity may be required over time? Is the event escalating, steady, or de-escalating?
- Identify areas that:
  - Do not have power
  - Do not have cell service
  - Do not have Radio/TV service
  - Do not have access by roads
- Identify areas/individuals that are trapped and needing help
- Identify how the current and/or predicted weather (precipitation, relative humidity, temperature, wind, ...) is impacting the disaster... good or bad. How will it impact emergency operations going forward?

## Phases

**Phase 1: Registration (mid-April to late May).** One Entrant per team; Entrants must be active IEEE members aged 18 or older. Each Entrant may submit only one Entry.

**Phase 2: Concept Submission (mid-April through early June).** Online form: clear description of proposed solution and disaster scenario; data sources and how they support near-real-time awareness; high-level approach to integrating, visualizing, and presenting information; outline of the user experience.

**Phase 3: Product Submission (late June through early October).** Working demonstration, preferably a short video showing a real person using the product. Requirements:

- Envisioned to be a GIS map-based interface, but not required
- Is expected to display the most recently available data (near real-time)
- Must identify all the data sources used and how to access them
- Would like to see current updated satellite data capturing the impacts of the disaster
- Must document algorithm descriptions for optional data generated by your system
- Must be able to inject test data into the system for testing and demonstrations if live disaster data is not available

**Evaluation and Prizes (mid-October through December).** Finalists announced end of year.

## Evaluation criteria (five, equally weighted, Phases 2 and 3)

1. **Timeliness & Real-Time Responsiveness** — acquire, process, and display disaster-related information in real or near-real time; low-latency updates and reliable performance.
2. **Comprehensiveness & Use of Data** — identify and use relevant data sources and clearly understand data limitations; innovative use of new or underutilized data encouraged.
3. **Integration & Synthesis Quality** — combine multiple data streams into a coherent, actionable picture; accurate, transparent, responsibly handled.
4. **Usability & Operational Readiness** — intuitive and practical for responders under pressure; minimal training; works across field devices.
5. **Scenario Fit, Insightfulness, & Innovation** — alignment with the chosen scenario; value of insights; creativity in technical design or data use.

## Prizes (US$100,000 total, awarded end of 2026)

| Award | Amount |
|-------|--------|
| 1st place | $30,000 |
| 2nd place | $20,000 |
| 3rd place | $15,000 |
| Judges' Choice | $10,000 |
| Honorary Mentions | Up to $25,000 total |

Questions: impactchallenge@ieee.org
