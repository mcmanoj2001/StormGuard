// Raster overlays consumed by Leaflet directly from federal/public tile
// endpoints — image tiles need no normalization or proxying.

export const overlayConfig = {
  // Precipitation radar. CONTEXT §4 names NOAA RIDGE2 (opengeo.ncep.noaa.gov)
  // as primary but flags it as a single point of failure; the Iowa
  // Environmental Mesonet mirror is the dependable default.
  // TODO: try RIDGE2 first, fall back to Mesonet automatically.
  radar: {
    type: 'tile',
    url: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',
    options: {
      opacity: 0.55,
      attribution: 'NEXRAD via Iowa Environmental Mesonet',
    },
  },

  // FEMA National Flood Hazard Layer — official 100yr/500yr flood zones.
  // TODO: confirm WMS layer id 28 ("Flood Hazard Zones") renders as expected.
  floodZones: {
    type: 'wms',
    url: 'https://hazards.fema.gov/arcgis/services/public/NFHL/MapServer/WMSServer',
    options: {
      layers: '28',
      format: 'image/png',
      transparent: true,
      opacity: 0.45,
      attribution: 'FEMA National Flood Hazard Layer',
    },
  },
};
