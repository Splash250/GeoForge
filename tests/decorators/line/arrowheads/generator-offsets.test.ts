import { describe, expect, it } from 'vitest';
import { generateArrowheads } from '../../../../src/decorators/line/arrowheads/index.ts';
import type { Feature, Position } from 'geojson';
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

function getArrowTipCoordinate(feature: Feature): Position {
  const { geometry } = feature;

  if (geometry.type === 'LineString') {
    return geometry.coordinates[1];
  }

  if (geometry.type === 'Polygon') {
    return geometry.coordinates[0][1];
  }

  throw new Error(`Unexpected arrowhead geometry: ${geometry.type}`);
}

describe('generateArrowheads with offsets', () => {
  it('respects start and end offsets in metres', () => {
    const result = generateArrowheads({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [0, 1],
          [0, 2],
        ],
      },
      options: {
        frequency: 'allvertices',
        offsets: {
          start: '50m',
          end: '50m',
        },
      },
    });

    expect(result.features).toHaveLength(2);
    const [first, second] = result.features;
    const firstCoord = getArrowTipCoordinate(first);
    const secondCoord = getArrowTipCoordinate(second);
    expect(firstCoord[1]).toBeGreaterThan(0);
    expect(secondCoord[1]).toBeLessThan(2);
  });

  it('respects pixel-based offsets', () => {
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
        frequency: 'endonly',
        size: '10px',
        offsets: {
          start: '10px',
          end: '10px',
        },
      },
    });

    expect(result.features).toHaveLength(1);
    const feature = result.features[0];
    const coord = getArrowTipCoordinate(feature);
    expect(coord[0]).toBeLessThan(1);
  });
});
