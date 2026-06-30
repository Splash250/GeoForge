// @vitest-environment jsdom

import { SOURCES } from '@/core/features/constants.ts';
import { Features } from '@/core/features/index.ts';
import type { BaseSource } from '@/core/map/base/source.ts';
import type { Geoman } from '@/main.ts';
import type { GeoJsonImportFeatureCollection } from '@/types/geojson.ts';
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
  } as unknown as Geoman;
  const features = new Features(geoman);
  const source = { id: SOURCES.main } as BaseSource;

  geoman.features = features;
  features.sources[SOURCES.main] = source;
  features.updateManager.updateSource = vi.fn();

  return { features };
}

function createFeatureCollection(): GeoJsonImportFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'owned-a',
        properties: { shape: 'marker' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
      {
        type: 'Feature',
        id: 'owned-b',
        properties: { shape: 'line' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      },
    ],
  };
}

describe('feature ownership lifecycle', () => {
  it('tags imported features with an owner and returns owner snapshots', () => {
    const { features } = createFeatures();

    const result = features.importGeoJson(createFeatureCollection(), {
      ownerId: 'demo:geometry-network',
    });

    expect(result.stats.success).toBe(2);
    expect(result.addedFeatures.map((feature) => feature.ownerId)).toEqual([
      'demo:geometry-network',
      'demo:geometry-network',
    ]);
    expect(features.getByOwner('demo:geometry-network').map((feature) => feature.id)).toEqual([
      'owned-a',
      'owned-b',
    ]);
    expect(features.getByOwner('other-owner')).toEqual([]);
  });

  it('deletes only features that belong to the requested owner', () => {
    const { features } = createFeatures();

    features.importGeoJson(createFeatureCollection(), {
      ownerId: 'demo:geometry-network',
    });
    features.importGeoJson(
      {
        type: 'Feature',
        id: 'unowned',
        properties: { shape: 'marker' },
        geometry: { type: 'Point', coordinates: [2, 2] },
      },
      { ownerId: 'demo:other' },
    );

    const deletedRefs = features.deleteByOwner('demo:geometry-network');

    expect(deletedRefs).toEqual([
      { sourceName: SOURCES.main, featureId: 'owned-a' },
      { sourceName: SOURCES.main, featureId: 'owned-b' },
    ]);
    expect(features.get(SOURCES.main, 'owned-a')).toBeNull();
    expect(features.get(SOURCES.main, 'owned-b')).toBeNull();
    expect(features.get(SOURCES.main, 'unowned')).not.toBeNull();
  });

  it('supports owner tagging for single-feature imports', () => {
    const { features } = createFeatures();

    const feature = features.importGeoJsonFeature(
      {
        type: 'Feature',
        id: 'single-owned',
        properties: { shape: 'marker' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
      { ownerId: 'demo:single' },
    );

    expect(feature?.ownerId).toBe('demo:single');
    expect(features.getByOwner('demo:single').map((ownedFeature) => ownedFeature.id)).toEqual([
      'single-owned',
    ]);
  });
});
