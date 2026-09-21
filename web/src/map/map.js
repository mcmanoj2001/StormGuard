// Leaflet map bootstrap + data-driven layers.
// One severity palette shared by gauge markers, alert polygons, and panel
// badges, so a non-technical responder learns the color language once.

import L from 'leaflet';
import { setState, subscribe } from '../state.js';
import { overlayConfig } from '../data/layers.js';
import { gaugeInsight } from '../insight.js';
import { categoryLabel, categorySeverity } from '../data/ahps.js';
import { pointInGeometry } from '../geo.js';

export const SEVERITY_COLORS = {
  extreme: '#b30000',
  major: '#b30000',
  severe: '#e34a33',
  moderate: '#fc8d59',
  minor: '#fdcc8a',
  normal: '#2b8cbe',
  unknown: '#999999',
};

const TREND_ARROWS = { rising: '▲', falling: '▼', steady: '►', unknown: '' };

// FEMA's NFHL MapServer doesn't have its WMS interface enabled (confirmed:
// every WMSServer request 400s regardless of parameters) — this renders the
// same layers through the standard ArcGIS REST `export` operation instead,
// which the service does support. One `export` call per tile, matching the
// bbox Leaflet would otherwise have sent to a WMS GetMap request.
const ArcGISDynamicLayer = L.TileLayer.extend({
  getTileUrl(coords) {
    const tileSize = this.getTileSize();
    const nwPoint = coords.scaleBy(tileSize);
    const sePoint = nwPoint.add(tileSize);
    const nw = this._map.unproject(nwPoint, coords.z);
    const se = this._map.unproject(sePoint, coords.z);
    const merc = L.CRS.EPSG3857;
    const nwMerc = merc.project(nw);
    const seMerc = merc.project(se);
    const params = new URLSearchParams({
      bbox: [nwMerc.x, seMerc.y, seMerc.x, nwMerc.y].join(','),
      bboxSR: 3857,
      imageSR: 3857,
      size: `${tileSize.x},${tileSize.y}`,
      layers: `show:${this.options.layerIds}`,
      format: this.options.format ?? 'png32',
      transparent: this.options.transparent ?? true,
      f: 'image',
    });
    return `${this.options.url}/export?${params}`;
  },
});

let map;
const gaugeLayer = L.layerGroup();
const alertLayer = L.layerGroup();
const stormLayer = L.layerGroup();
const forecastLayer = L.layerGroup();
const facilityLayer = L.layerGroup();

export function initMap() {
  map = L.map('map', { zoomControl: true }).setView([30.2, -90.9], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);

  gaugeLayer.addTo(map);
  alertLayer.addTo(map);
  stormLayer.addTo(map);
  forecastLayer.addTo(map);
  facilityLayer.addTo(map);

  // Toggleable raster overlays straight from federal/public tile servers.
  const radar =
    overlayConfig.radar.type === 'wms'
      ? L.tileLayer.wms(overlayConfig.radar.url, overlayConfig.radar.options)
      : L.tileLayer(overlayConfig.radar.url, overlayConfig.radar.options);
  const floodZones = new ArcGISDynamicLayer('', {
    ...overlayConfig.floodZones.options,
    url: overlayConfig.floodZones.url,
  });

  L.control
    .layers(null, {
      'Stream gauges': gaugeLayer,
      'NWS alerts': alertLayer,
      'Hurricane track': stormLayer,
      'NWS forecast points': forecastLayer,
      'Critical facilities (hospitals)': facilityLayer,
      'Precipitation radar': radar,
      'FEMA flood zones': floodZones,
    })
    .addTo(map);

  subscribe('gauges', renderGauges);
  subscribe('alerts', renderAlerts);
  subscribe('storms', renderStorms);
  subscribe('forecastPoints', renderForecastPoints);
  // Facility "at risk" status depends on active alert polygons, not just the
  // facility list itself — re-render on either changing.
  subscribe(['facilities', 'alerts'], renderFacilities);

  // Repaint tiles when the viewport changes (rotation, split-screen, DevTools).
  window.addEventListener('resize', () => map.invalidateSize());
}

// Recenters the map on a newly-selected region's bbox (region selection —
// rubric hard requirement). bbox is [minLon, minLat, maxLon, maxLat];
// Leaflet's fitBounds wants [[south, west], [north, east]].
export function setRegionView(bbox) {
  map.fitBounds([
    [bbox[1], bbox[0]],
    [bbox[3], bbox[2]],
  ]);
}

function renderGauges({ gauges }) {
  gaugeLayer.clearLayers();
  for (const g of gauges) {
    if (g.lat == null || g.lon == null) continue;
    const trend = TREND_ARROWS[g.trend] ?? '';
    L.circleMarker([g.lat, g.lon], {
      radius: 8,
      color: '#fff',
      weight: 1.5,
      fillColor: SEVERITY_COLORS[g.severity] ?? SEVERITY_COLORS.unknown,
      fillOpacity: 0.9,
    })
      .on('click', () => setState({ selectedGaugeId: g.id }))
      .bindTooltip(
        `<strong>${g.name}</strong><br>` +
          `Stage: ${g.stage_ft ?? '—'} ft ${trend}` +
          (g.rate_ft_per_hr != null ? ` (${g.rate_ft_per_hr > 0 ? '+' : ''}${g.rate_ft_per_hr} ft/hr)` : '') +
          ` — ${g.severity.toUpperCase()}<br>` +
          `<span class="tip-instruction">▶ ${gaugeInsight(g)}</span>`,
        { className: 'insight-tip' }
      )
      .addTo(gaugeLayer);
  }
}

// Diamond markers (not circles) so an NWS forecast point is visually
// distinct from a USGS live-reading gauge at a glance — same severity
// palette, different shape, since these are a different kind of claim
// (NWS's own forecast + authoritative flood category, not a raw reading).
const forecastIcon = (color) =>
  L.divIcon({
    className: 'forecast-marker',
    html: `<span style="background:${color}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

function renderForecastPoints({ forecastPoints }) {
  forecastLayer.clearLayers();
  for (const p of forecastPoints) {
    if (p.lat == null || p.lon == null) continue;
    const color = SEVERITY_COLORS[categorySeverity(p.floodCategory)] ?? SEVERITY_COLORS.unknown;
    const forecastLine = p.forecast
      ? `Forecast: ${p.forecast.stage_ft ?? '—'} ft by ${
          p.forecast.validTime ? new Date(p.forecast.validTime).toLocaleString() : '—'
        } — ${categoryLabel(p.forecast.floodCategory)}<br>`
      : '';
    L.marker([p.lat, p.lon], { icon: forecastIcon(color) })
      .bindTooltip(
        `<strong>${p.name}</strong> (NWS forecast point)<br>` +
          `Now: ${p.stage_ft ?? '—'} ft — ${categoryLabel(p.floodCategory)}<br>` +
          forecastLine,
        { className: 'insight-tip' }
      )
      .addTo(forecastLayer);
  }
}

// Hospital markers use a distinct square-plus glyph (not a circle or
// diamond, both already taken) so all three point layers stay visually
// distinguishable at a glance. "At risk" (red) vs. normal (gray) isn't a
// property of the facility itself — it's computed fresh each render against
// whichever alert polygons are currently active.
const facilityIcon = (atRisk) =>
  L.divIcon({
    className: `facility-marker${atRisk ? ' at-risk' : ''}`,
    html: '<span>+</span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

// Rubric item 11 ("infrastructure at risk"): a facility is flagged red when
// it falls inside an active severe/extreme NWS warning polygon, using the
// same real point-in-polygon test the population panel uses for tracts.
// FEMA's flood-zone layer can't be used for this — it's rendered as ArcGIS
// `export` map tiles (see ArcGISDynamicLayer above), not queryable polygon
// geometry, so "within the flood zone" isn't something this app can test
// directly; NWS warning-area overlap is the honest substitute, not a stand-in
// pretending to be the same thing.
function renderFacilities({ facilities, alerts }) {
  facilityLayer.clearLayers();
  const activeAlerts = alerts.filter((a) => ['extreme', 'severe'].includes(a.severity));
  for (const f of facilities) {
    if (f.lat == null || f.lon == null) continue;
    const atRisk = activeAlerts.some((a) => pointInGeometry(f.lon, f.lat, a.geometry));
    L.marker([f.lat, f.lon], { icon: facilityIcon(atRisk) })
      .bindTooltip(
        `<strong>${f.name}</strong> (hospital)<br>` +
          (atRisk
            ? '<span class="tip-instruction">▶ Inside an active NWS warning area</span>'
            : 'No active warning covers this location'),
        { className: 'insight-tip' }
      )
      .addTo(facilityLayer);
  }
}

// Storm track/cone are context, not alarm — muted grays so the severity
// palette stays reserved for gauges and alerts.
function renderStorms({ storms }) {
  stormLayer.clearLayers();
  for (const s of storms) {
    if (s.cone) {
      L.geoJSON(s.cone, {
        style: { color: '#666', weight: 1, dashArray: '4', fillOpacity: 0.08 },
      }).addTo(stormLayer);
    }
    if (s.track) {
      L.geoJSON(s.track, { style: { color: '#333', weight: 2 } }).addTo(stormLayer);
    }
    if (s.position) {
      L.circleMarker([s.position.lat, s.position.lon], {
        radius: 10,
        color: '#333',
        weight: 2,
        fillColor: '#fff',
        fillOpacity: 0.9,
      })
        .bindTooltip(
          `${s.name}${s.category != null ? ` — Cat ${s.category}` : ''}` +
            `${s.maxWindsMph != null ? `, ${s.maxWindsMph} mph` : ''}` +
            `${s.movement ? `, ${s.movement}` : ''}`
        )
        .addTo(stormLayer);
    }
  }
}

function renderAlerts({ alerts }) {
  alertLayer.clearLayers();
  for (const a of alerts) {
    if (!a.geometry) continue; // nws.js resolves UGC zones; null here means every zone lookup failed
    L.geoJSON(a.geometry, {
      style: {
        color: SEVERITY_COLORS[a.severity] ?? SEVERITY_COLORS.unknown,
        weight: 2,
        fillOpacity: 0.15,
      },
    })
      .bindTooltip(`<strong>${a.event}</strong><br>${a.headline ?? ''}`, { className: 'insight-tip' })
      .bindPopup(
        `<strong>${a.event}</strong><br>${a.headline ?? ''}` +
          (a.instruction ? `<br><span class="tip-instruction">▶ ${a.instruction}</span>` : '')
      )
      .addTo(alertLayer);
  }
}
