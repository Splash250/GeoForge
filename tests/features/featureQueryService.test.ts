import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureData } from '../../src/core/features/feature-data.ts';
import type { FeatureSourceName } from '../../src/main.ts';

const { getGeoJsonBounds, isMapPointerEvent } = vi.hoisted(() => {
  return {
    getGeoJsonBounds: vi.fn(() => [
      [19, 47],
      [21, 48],
    ]),
    isMapPointerEvent: vi.fn((event: unknown) => {
      return !!(
        event &&
        typeof event === 'object' &&
        'lngLat' in event &&
        'point' in event &&
        'type' in event &&
        'originalEvent' in event
      );
    }),
  };
});

vi.mock('../../src/utils/geojson.ts', () => ({
  getGeoJsonBounds,
}));

vi.mock('../../src/utils/guards/map.ts', () => ({
  isMapPointerEvent,
}));

const { FeatureQueryService } = await import('../../src/core/features/featureQueryService.ts');

function createPointerEvent(point = { x: 10, y: 20 }) {
  return {
    lngLat: { lng: 19, lat: 47 },
    originalEvent: {},
    point,
    type: 'click',
  };
}

describe('FeatureQueryService', () => {
  beforeEach(() => {
    getGeoJsonBounds.mockClear();
    isMapPointerEvent.mockClear();
  });

  it('returns the first queried feature for a map pointer event', () => {
    const feature = { id: 'feature-1' } as FeatureData;
    const queryFeaturesByScreenCoordinates = vi.fn(() => [feature]);
    const service = new FeatureQueryService({
      mapAdapter: {
        queryFeaturesByScreenCoordinates,
      } as never,
    });

    const result = service.getFeatureByMouseEvent({
      event: createPointerEvent() as never,
      sourceNames: ['gm_main'] as Array<FeatureSourceName>,
    });

    expect(result).toBe(feature);
    expect(isMapPointerEvent).toHaveBeenCalledWith(createPointerEvent(), { warning: true });
    expect(queryFeaturesByScreenCoordinates).toHaveBeenCalledWith({
      queryCoordinates: [10, 20],
      sourceNames: ['gm_main'],
    });
  });

  it('returns null for an invalid pointer event', () => {
    const queryFeaturesByScreenCoordinates = vi.fn();
    const service = new FeatureQueryService({
      mapAdapter: {
        queryFeaturesByScreenCoordinates,
      } as never,
    });

    const result = service.getFeatureByMouseEvent({
      event: { point: { x: 10, y: 20 } } as never,
      sourceNames: ['gm_main'] as Array<FeatureSourceName>,
    });

    expect(result).toBeNull();
    expect(isMapPointerEvent).toHaveBeenCalledWith({ point: { x: 10, y: 20 } }, { warning: true });
    expect(queryFeaturesByScreenCoordinates).not.toHaveBeenCalled();
  });

  it('queries features by screen bounds', () => {
    const features = [{ id: 'feature-1' }] as Array<FeatureData>;
    const queryFeaturesByScreenCoordinates = vi.fn(() => features);
    const service = new FeatureQueryService({
      mapAdapter: {
        queryFeaturesByScreenCoordinates,
      } as never,
    });
    const bounds: [[number, number], [number, number]] = [
      [10, 20],
      [30, 40],
    ];

    const result = service.getFeaturesByScreenBounds({
      bounds,
      sourceNames: ['gm_main'] as Array<FeatureSourceName>,
    });

    expect(result).toBe(features);
    expect(queryFeaturesByScreenCoordinates).toHaveBeenCalledWith({
      queryCoordinates: bounds,
      sourceNames: ['gm_main'],
    });
  });

  it('converts GeoJSON bounds before querying screen bounds', () => {
    const features = [{ id: 'feature-1' }] as Array<FeatureData>;
    const queryFeaturesByScreenCoordinates = vi.fn(() => features);
    const coordBoundsToScreenBounds = vi.fn(() => [
      [10, 20],
      [30, 40],
    ]);
    const service = new FeatureQueryService({
      mapAdapter: {
        coordBoundsToScreenBounds,
        queryFeaturesByScreenCoordinates,
      } as never,
    });

    const result = service.getFeaturesByGeoJsonBounds({
      geoJson: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [19, 47],
              [21, 47],
              [21, 48],
              [19, 48],
              [19, 47],
            ],
          ],
        },
        properties: {},
      },
      sourceNames: ['gm_main'] as Array<FeatureSourceName>,
    });

    expect(result).toBe(features);
    expect(getGeoJsonBounds).toHaveBeenCalledWith({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [19, 47],
            [21, 47],
            [21, 48],
            [19, 48],
            [19, 47],
          ],
        ],
      },
      properties: {},
    });
    expect(coordBoundsToScreenBounds).toHaveBeenCalledWith([
      [19, 47],
      [21, 48],
    ]);
    expect(queryFeaturesByScreenCoordinates).toHaveBeenCalledWith({
      queryCoordinates: [
        [10, 20],
        [30, 40],
      ],
      sourceNames: ['gm_main'],
    });
  });
});
