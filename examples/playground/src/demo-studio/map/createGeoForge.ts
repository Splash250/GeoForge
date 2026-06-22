import { GeoForge, SOURCES, type PartialLayerStyle } from 'maplibre-geoforge';
import type { Map } from 'maplibre-gl';

const demoLineStyle: PartialLayerStyle[] = [
  {
    type: 'line',
    paint: {
      'line-color': '#67d6ff',
      'line-opacity': 0.9,
      'line-width': 5,
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
  },
];

export function createDemoGeoForge(map: Map) {
  return new GeoForge(map, {
    layerStyles: {
      line: {
        [SOURCES.main]: demoLineStyle,
        [SOURCES.temporary]: demoLineStyle,
      },
    },
  });
}
