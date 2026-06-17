import { describe, expect, it } from 'vitest';
import type { Map } from 'maplibre-gl';
import { createLinePlacements } from '../../../../src/decorators/line/placement/index.ts';

const mapStub = {
  getCenter: () => ({ lng: 0, lat: 0 }),
  project: ({ lng, lat }: { lng: number; lat: number }) => ({
    x: lng * 1000,
    y: lat * -1000,
  }),
  unproject: ([x, y]: [number, number]) => ({
    lng: x / 1000,
    lat: y / -1000,
  }),
} as unknown as Map;

describe('createLinePlacements', () => {
  it('creates endonly placement with a line bearing', () => {
    const placements = createLinePlacements({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
      placement: { frequency: 'endonly' },
    });

    expect(placements).toHaveLength(1);
    expect(placements[0].index).toBe(0);
    expect(placements[0].point.lng).toBeCloseTo(1);
    expect(placements[0].bearing).toBeCloseTo(90);
  });

  it('creates numeric frequency placements', () => {
    const placements = createLinePlacements({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [2, 0],
        ],
      },
      placement: { frequency: 4 },
    });

    expect(placements).toHaveLength(4);
  });

  it('returns no placements when meter spacing exceeds line length', () => {
    const placements = createLinePlacements({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [0, 0.0005],
        ],
      },
      placement: { frequency: '5000m' },
    });

    expect(placements).toHaveLength(0);
  });

  it('returns no placements for zero meter or pixel spacing', () => {
    const line = {
      type: 'LineString' as const,
      coordinates: [
        [0, 0],
        [1, 0],
      ],
    };

    expect(
      createLinePlacements({
        map: mapStub,
        line,
        placement: { frequency: '0m' },
      }),
    ).toEqual([]);

    expect(
      createLinePlacements({
        map: mapStub,
        line,
        placement: { frequency: '0px' },
      }),
    ).toEqual([]);
  });

  it('applies start and end offsets', () => {
    const placements = createLinePlacements({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [0, 1],
        ],
      },
      placement: {
        frequency: 'endonly',
        offsets: { end: '100m' },
      },
    });

    expect(placements).toHaveLength(1);
    expect(placements[0].point.lat).toBeLessThan(1);
  });

  it('places a single symbol on the requested segment anchor', () => {
    const placements = createLinePlacements({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
      },
      placement: {
        frequency: 'single',
        segment: 'last',
        anchor: 'front',
        offsetPercent: 25,
      },
    });

    expect(placements).toHaveLength(1);
    expect(placements[0].point.lng).toBeCloseTo(1.25);
    expect(placements[0].point.lat).toBeCloseTo(0);
  });

  it('places one symbol on every segment when segment target is all', () => {
    const placements = createLinePlacements({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
      },
      placement: {
        frequency: 'single',
        segment: 'all',
        anchor: 'middle',
        offsetPercent: 0,
      },
    });

    expect(placements.map((placement) => placement.point.lng)).toEqual([0.5, 1.5]);
  });

  it('applies pixel distance perpendicular to the target segment', () => {
    const placements = createLinePlacements({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
      placement: {
        frequency: 'single',
        segment: 'first',
        anchor: 'middle',
        lineOffsetPx: 10,
      },
    });

    expect(placements).toHaveLength(1);
    expect(placements[0].point.lng).toBeCloseTo(0.5);
    expect(placements[0].point.lat).toBeCloseTo(-0.01);
  });

  it('falls back to zero for non-finite single placement offsets', () => {
    const placements = createLinePlacements({
      map: mapStub,
      line: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
      placement: {
        frequency: 'single',
        segment: 'first',
        anchor: 'middle',
        offsetPercent: Number.POSITIVE_INFINITY,
        lineOffsetPx: Number.NaN,
      },
    });

    expect(placements).toHaveLength(1);
    expect(placements[0].point.lng).toBeCloseTo(0.5);
    expect(placements[0].point.lat).toBeCloseTo(0);
  });

  it('creates single placements for every MultiLineString part', () => {
    const placements = createLinePlacements({
      map: mapStub,
      line: {
        type: 'MultiLineString',
        coordinates: [
          [
            [0, 0],
            [1, 0],
          ],
          [
            [10, 0],
            [11, 0],
          ],
        ],
      },
      placement: {
        frequency: 'single',
        segment: 'first',
        anchor: 'middle',
      },
    });

    expect(placements.map((placement) => placement.point.lng)).toEqual([0.5, 10.5]);
  });
});
