import type { MapInstanceWithGeoman } from '@/main.ts';
import { Geoman } from '@/main.ts';
import { registerExternalInspectorTool } from '@/dev/tools/externalInspectorTool.ts';
import { registerLineEndpointTool } from '@/dev/tools/lineEndpointTool.ts';
import { registerSegmentLengthTool } from '@/dev/tools/segmentLengthTool.ts';
import { registerSingleFeatureEditTool } from '@/dev/tools/singleFeatureEditTool.ts';
import * as geojsonUtils from '@/utils/geojson.ts';
import log from 'loglevel';
import ml from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

log.setLevel('debug');

// Expose utilities for testing
window.geomanUtils = geojsonUtils;

// Expose Geoman class for testing destroy/reinit
window.GeomanClass = Geoman;

// Hide dev panels in test mode - they take up space and interfere with tests
const leftPanel = document.getElementById('dev-left-panel');
const rightPanel = document.getElementById('dev-right-panel');
if (leftPanel) leftPanel.style.display = 'none';
if (rightPanel) rightPanel.style.display = 'none';

const emptyStyle: ml.StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [],
};

const map = new ml.Map({
  container: 'dev-map',
  style: emptyStyle,
  center: [0, 51],
  zoom: 5,
  fadeDuration: 50,
});

// Expose the map instance for testing
window.mapInstance = map;

const windowWithCustomData = window as Window & {
  customData?: { eventResults?: Record<string, unknown>; map?: MapInstanceWithGeoman };
};
windowWithCustomData.customData ??= { eventResults: {} };

const geoman = new Geoman(map);
windowWithCustomData.customData.map = map as unknown as MapInstanceWithGeoman;

map.on('load', () => {
  window.geoman = geoman;
  registerSingleFeatureEditTool(geoman);
  registerSegmentLengthTool(geoman, map);
  registerLineEndpointTool(geoman, map);
  registerExternalInspectorTool(geoman);
});
