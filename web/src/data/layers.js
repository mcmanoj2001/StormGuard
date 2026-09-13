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
  // Layer id 28 ("Flood Hazard Zones") is confirmed correct — verified
  // against the service's own layer list at
  // https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=json
  // The WMS interface itself is NOT enabled on this service, though
  // (its `supportedExtensions` lists only WFSServer, not WMSServer — every
  // WMSServer request, with any parameters, returns the same generic
  // ArcGIS 400). type is 'arcgis-dynamic', not 'wms', for that reason — it
  // renders through the ArcGIS REST `export` operation instead, which is
  // confirmed working (returns a real PNG) against the same MapServer.
  floodZones: {
    type: 'arcgis-dynamic',
    url: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
    options: {
      layerIds: '28',
      format: 'png32',
      transparent: true,
      opacity: 0.45,
      attribution: 'FEMA National Flood Hazard Layer',
    },
  },
};
