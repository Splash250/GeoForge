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

describe('generateArrowheads frequency handling', () => {
  it('uses numeric frequency', () => {
    const result = generateArrowheads({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [2, 0],
        ],
      },
      options: {
        frequency: 4,
      },
    });
    expect(result.features).toHaveLength(4);
  });

  it('uses metre frequency', () => {
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
        frequency: '100m',
      },
    });
    expect(result.features.length).toBeGreaterThan(0);
  });

  it('uses pixel frequency', () => {
    const result = generateArrowheads({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
      options: {
        frequency: '30px',
      },
    });
    expect(result.features.length).toBeGreaterThan(0);
  });

  it('returns zero arrowheads when spacing exceeds total length', () => {
    const result = generateArrowheads({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [0, 0.0005],
        ],
      },
      options: {
        frequency: '5000m',
      },
    });
    expect(result.features).toHaveLength(0);
  });
});
