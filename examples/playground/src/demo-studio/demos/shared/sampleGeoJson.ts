import type { FeatureCollection } from 'geojson';

export const sampleNetworkGeoJson: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'network-a',
      properties: { name: 'Network A' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [19.03, 47.49],
          [19.045, 47.498],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'network-b',
      properties: { name: 'Network B' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [19.047, 47.498],
          [19.065, 47.503],
        ],
      },
    },
  ],
};
