// @vitest-environment jsdom

import { SOURCES } from '@/core/features/constants.ts';
import { Features } from '@/core/features/index.ts';
import type { BaseSource } from '@/core/map/base/source.ts';
import type { Geoman } from '@/main.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { FeatureShape, FeatureSourceName } from '@/types/features.ts';
import type { GeoJsonShapeFeature } from '@/types/geojson.ts';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/options/layers/style.ts', () => ({ default: {} }));
vi.mock('@/main.ts', () => ({
  includesWithType: (value: unknown, items: readonly unknown[]) => items.includes(value),
  typedKeys: Object.keys,
}));

function createFeatures() {
  const geoman = {
    options: {
      settings: {
        throttlingDelay: 0,
        idGenerator: null,
      },
      layerStyles: {},
    },
    history: { record: vi.fn() },
    mapAdapter: {
      queryFeaturesByScreenCoordinates: vi.fn(() => []),
      coordBoundsToScreenBounds: vi.fn(),
    },
    events: { fire: vi.fn() },
    isFeatureEditable: vi.fn((featureData: FeatureData) => featureData.id !== 'locked-line'),
  } as unknown as Geoman;
  const features = new Features(geoman);

  geoman.features = features;
  features.sources[SOURCES.main] = { id: SOURCES.main } as BaseSource;
  features.sources[SOURCES.temporary] = { id: SOURCES.temporary } as BaseSource;
  features.updateManager.updateSource = vi.fn();

  return { features, geoman };
}

function addFeature(
  features: Features,
  {
    id,
    shape,
    sourceName = SOURCES.main,
    ownerId,
  }: {
    id: string | number;
    shape: FeatureShape;
    sourceName?: FeatureSourceName;
    ownerId?: string | number;
  },
) {
  return features.createFeature({
    featureId: id,
    ownerId,
    sourceName,
    shapeGeoJson: createShapeGeoJson(shape),
  });
}

function createShapeGeoJson(shape: FeatureShape): GeoJsonShapeFeature {
  const geometry =
    shape === 'line'
      ? {
          type: 'LineString' as const,
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        }
      : shape === 'polygon'
        ? {
            type: 'Polygon' as const,
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          }
        : {
            type: 'Point' as const,
            coordinates: [0, 0],
          };

  return {
    type: 'Feature',
    properties: { shape },
    geometry,
  };
}

describe('Features query API', () => {
  it('excludes temporary features by default and includes them when requested', () => {
    const { features } = createFeatures();
    addFeature(features, { id: 'main-marker', shape: 'marker' });
    addFeature(features, {
      id: 'temporary-marker',
      shape: 'marker',
      sourceName: SOURCES.temporary,
    });

    expect(features.query().map((feature) => feature.id)).toEqual(['main-marker']);
    expect(features.query({ includeTemporary: true }).map((feature) => feature.id)).toEqual([
      'main-marker',
      'temporary-marker',
    ]);
  });

  it('filters by source, shape, owner, and id with string-compatible id matching', () => {
    const { features } = createFeatures();
    addFeature(features, { id: 'main-line', shape: 'line', ownerId: 'owner-a' });
    addFeature(features, { id: 42, shape: 'polygon', ownerId: 'owner-a' });
    addFeature(features, { id: 'other-marker', shape: 'marker', ownerId: 'owner-b' });
    addFeature(features, {
      id: 'temporary-line',
      shape: 'line',
      ownerId: 'owner-a',
      sourceName: SOURCES.temporary,
    });

    const result = features.query({
      sourceNames: [SOURCES.main],
      shapes: ['line', 'polygon'],
      ownerId: 'owner-a',
      ids: ['42', 'missing-id'],
    });

    expect(result.map((feature) => feature.id)).toEqual([42]);
  });

  it('can filter to editable features only', () => {
    const { features, geoman } = createFeatures();
    addFeature(features, { id: 'editable-line', shape: 'line' });
    addFeature(features, { id: 'locked-line', shape: 'line' });

    expect(features.query({ editableOnly: true }).map((feature) => feature.id)).toEqual([
      'editable-line',
    ]);
    expect(geoman.isFeatureEditable).toHaveBeenCalledTimes(2);
  });

  it('counts with the same filters as query', () => {
    const { features } = createFeatures();
    addFeature(features, { id: 'line-a', shape: 'line', ownerId: 'owner-a' });
    addFeature(features, { id: 'line-b', shape: 'line', ownerId: 'owner-b' });
    addFeature(features, { id: 'polygon-a', shape: 'polygon', ownerId: 'owner-a' });
    addFeature(features, {
      id: 'temporary-line-a',
      shape: 'line',
      ownerId: 'owner-a',
      sourceName: SOURCES.temporary,
    });

    const options = {
      shapes: ['line'] as const,
      ownerId: 'owner-a',
      includeTemporary: true,
    };

    expect(features.query(options).map((feature) => feature.id)).toEqual([
      'line-a',
      'temporary-line-a',
    ]);
    expect(features.count(options)).toBe(2);
  });

  it('returns an array snapshot instead of the internal feature store map', () => {
    const { features } = createFeatures();
    const first = addFeature(features, { id: 'first', shape: 'marker' });

    const result = features.query();
    addFeature(features, { id: 'second', shape: 'marker' });

    expect(result).toEqual([first]);
    result.pop();

    expect(features.count()).toBe(2);
    expect(result).not.toBe(features.featureStore);
  });
});
