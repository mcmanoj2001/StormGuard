// Leaflet map bootstrap + data-driven layers.
// One severity palette shared by gauge markers, alert polygons, and panel
// badges, so a non-technical responder learns the color language once.

import L from 'leaflet';
import { setState, subscribe } from '../state.js';
import { overlayConfig } from '../data/layers.js';
import { gaugeInsight } from '../insight.js';

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

let map;
const gaugeLayer = L.layerGroup();
const alertLayer = L.layerGroup();
const stormLayer = L.layerGroup();

export function initMap() {
  map = L.map('map', { zoomControl: true }).setView([30.2, -90.9], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);

  gaugeLayer.addTo(map);
  alertLayer.addTo(map);
  stormLayer.addTo(map);

  // Toggleable raster overlays straight from federal/public tile servers.
  const radar =
    overlayConfig.radar.type === 'wms'
      ? L.tileLayer.wms(overlayConfig.radar.url, overlayConfig.radar.options)
      : L.tileLayer(overlayConfig.radar.url, overlayConfig.radar.options);
  const floodZones = L.tileLayer.wms(overlayConfig.floodZones.url, overlayConfig.floodZones.options);

  L.control
    .layers(null, {
      'Stream gauges': gaugeLayer,
      'NWS alerts': alertLayer,
      'Hurricane track': stormLayer,
      'Precipitation radar': radar,
      'FEMA flood zones': floodZones,
    })
    .addTo(map);

  subscribe('gauges', renderGauges);
  subscribe('alerts', renderAlerts);
  subscribe('storms', renderStorms);

  // Repaint tiles when the viewport changes (rotation, split-screen, DevTools).
  window.addEventListener('resize', () => map.invalidateSize());
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
    if (!a.geometry) continue; // TODO: resolve UGC zones to polygons
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
