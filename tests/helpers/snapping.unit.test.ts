import { SnappingHelper } from '@/modes/helpers/snapping.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { Geoman } from '@/main.ts';
import type { LngLatTuple, ScreenPoint } from '@/types/map/index.ts';
import { describe, expect, test, vi } from 'vitest';

const createFeature = (id: string, coordinates: Array<LngLatTuple>) =>
  ({
    id,
    sourceName: 'gm_main',
    temporary: false,
    shape: 'line',
    getGeoJson: vi.fn(() => ({
      type: 'Feature',
      id,
      properties: { shape: 'line' },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    })),
  }) as unknown as FeatureData;

const createGeoman = (features: Array<FeatureData>) =>
  ({
    markerPointer: { setSnapping: vi.fn() },
    features: {
      getFeaturesByScreenBounds: vi.fn(() => features),
    },
    geometry: {
      getNearestLineEndpoint: vi.fn((candidates: Iterable<FeatureData>, point: ScreenPoint) => {
        const candidateList = Array.from(candidates);
        const target = candidateList.find((feature) => feature.id === 'line-b');

        if (!target || point[0] > 200) {
          return null;
        }

        return {
          feature: target,
          featureId: target.id,
          sourceName: target.sourceName,
          endpoint: 'start',
          vertexIndex: 0,
          coordinate: [1.1, 0],
          nodeKey: '1.1,0',
          distancePixels: 2,
        };
      }),
    },
    mapAdapter: {
      project: vi.fn(([lng, lat]: LngLatTuple) => [lng * 100, lat * 100]),
      getEuclideanNearestLngLat: vi.fn(() => [0.5, 0]),
    },
  }) as unknown as Geoman;

describe('SnappingHelper line endpoint snapping', () => {
  test('uses opt-in line endpoint snapping before generic feature snapping', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1.1, 0],
      [2, 0],
    ]);
    const geoman = createGeoman([lineA, lineB]);
    const helper = new SnappingHelper(geoman);

    helper.configureLineEndpointSnapping({ enabled: true, maxPixelDistance: 14 });

    expect(helper.getSnappedLngLat([0, 0], [110, 0])).toEqual([1.1, 0]);
    expect(geoman.geometry.getNearestLineEndpoint).toHaveBeenCalledWith(
      [lineA, lineB],
      [110, 0],
      expect.objectContaining({ maxPixelDistance: 14 }),
    );
  });

  test('preserves default snapping behavior when line endpoint snapping is disabled', () => {
    const lineB = createFeature('line-b', [
      [1.1, 0],
      [2, 0],
    ]);
    const geoman = createGeoman([lineB]);
    const helper = new SnappingHelper(geoman);

    expect(helper.getSnappedLngLat([0, 0], [110, 0])).toEqual([1.1, 0]);
    expect(geoman.geometry.getNearestLineEndpoint).not.toHaveBeenCalled();
  });

  test('uses configured source names for line endpoint snapping candidates', () => {
    const lineB = createFeature('line-b', [
      [1.1, 0],
      [2, 0],
    ]);
    const geoman = createGeoman([lineB]);
    const helper = new SnappingHelper(geoman);

    helper.configureLineEndpointSnapping({
      enabled: true,
      maxPixelDistance: 14,
      sourceNames: ['gm_temporary'],
    });
    helper.getSnappedLngLat([0, 0], [110, 0]);

    expect(geoman.features.getFeaturesByScreenBounds).toHaveBeenCalledWith({
      bounds: [
        [92, -18],
        [128, 18],
      ],
      sourceNames: ['gm_temporary'],
    });
  });
});
