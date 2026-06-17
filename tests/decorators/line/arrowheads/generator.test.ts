import { describe, expect, it } from 'vitest';
import { generateArrowheads } from '../../../../src/decorators/line/arrowheads/index.ts';
import type { Map } from 'maplibre-gl';

const mapStub = {
  project: ({ lng, lat }: { lng: number; lat: number }) => ({
    x: lng * 1000,
    y: lat * -1000,
  }),
  unproject: ([x, y]: [number, number]) => ({
    lng: x / 1000,
    lat: y / -1000,
  }),
} as unknown as Map;

describe('generateArrowheads', () => {
  it('produces pixel-spaced arrowheads by default', () => {
    const result = generateArrowheads({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [-1, 51],
          [0, 51],
          [1, 51],
        ],
      },
      options: {},
    });

    expect(result.features.length).toBeGreaterThan(0);
    const first = result.features[0];
    expect(first.properties?.size).toBe('8px');
  });

  it('respects endonly frequency with metre size', () => {
    const result = generateArrowheads({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [0, 1],
        ],
      },
      options: {
        frequency: 'endonly',
        size: '100m',
      },
    });

    expect(result.features).toHaveLength(1);
    const feature = result.features[0];
    expect(feature.geometry.type).toBe('LineString');
    const coords = feature.geometry.type === 'LineString' ? feature.geometry.coordinates : [];
    expect(coords[1]).toEqual([0, 1]);
  });
});
