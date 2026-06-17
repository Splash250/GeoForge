import { describe, expect, it } from 'vitest';
import { generateArrowheads } from '../../../../src/decorators/line/arrowheads/index.ts';
import type { Feature, LineString, Position } from 'geojson';
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
  getCenter: () => ({ lng: 0, lat: 0 }),
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

describe('generateArrowheads parity scenarios', () => {
  it('defaults to pixel spacing that yields multiple arrowheads on long lines', () => {
    const line: LineString = {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [0.5, 0],
        [1, 0],
        [1.5, 0],
      ],
    };

    const result = generateArrowheads({
      map: mapStub,
      line,
      options: {},
    });

    expect(result.features.length).toBeGreaterThan(1);
    expect(result.features[0]?.properties?.size).toBe('8px');
  });

  it('honours explicit allvertices placement', () => {
    const line: LineString = {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [0.5, 0],
        [1, 0],
      ],
    };

    const result = generateArrowheads({
      map: mapStub,
      line,
      options: {
        frequency: 'allvertices',
      },
    });

    expect(result.features).toHaveLength(line.coordinates.length - 1);
  });

  it('supports filled pixel-sized arrowheads with per-arrow overrides', () => {
    const result = generateArrowheads({
      map: mapStub,
      line: {
        type: 'MultiLineString',
        coordinates: [
          [
            [0, 0],
            [0.5, 0.25],
            [1, 0.5],
          ],
          [
            [1, 0.5],
            [1.25, 0.75],
          ],
        ],
      },
      options: {
        fill: true,
        size: '15px',
        frequency: '50px',
        yawn: 30,
        perArrowheadOptions: (index) =>
          index % 2 === 0
            ? {
                color: '#1d4ed8',
              }
            : {
                fillColor: '#9333ea',
                fillOpacity: 0.75,
              },
      },
    });

    expect(result.features.length).toBeGreaterThan(0);
    result.features.forEach((feature) => {
      expect(feature.geometry.type).toBe('Polygon');
      expect(feature.properties?.fill).toBe(true);
    });
    const coloredFeatures = result.features.filter(
      (feature) => feature.properties?.color === '#1d4ed8',
    );
    const filledOverrides = result.features.filter(
      (feature) => feature.properties?.fillColor === '#9333ea',
    );
    expect(coloredFeatures.length).toBeGreaterThan(0);
    expect(filledOverrides.length).toBeGreaterThan(0);
  });

  it('honours start and end offsets in metres', () => {
    const result = generateArrowheads({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [0, 0.1],
        ],
      },
      options: {
        frequency: '1000m',
        offsets: {
          start: '500m',
          end: '500m',
        },
      },
    });

    expect(result.features.length).toBeGreaterThan(0);
    const firstArrow = result.features[0];
    const firstCoordinate = getArrowTipCoordinate(firstArrow);

    expect(firstCoordinate[1]).toBeGreaterThan(0.0001);
  });
});
