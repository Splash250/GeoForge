// @vitest-environment jsdom

import { FeatureData } from '@/core/features/feature-data.ts';
import { SOURCES } from '@/core/features/constants.ts';
import { Features } from '@/core/features/index.ts';
import type { BaseSource } from '@/core/map/base/source.ts';
import type { Geoman } from '@/main.ts';
import type { GeomanHistoryOperation } from '@/history/types.ts';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/options/layers/style.ts', () => ({ default: {} }));
vi.mock('@/main.ts', () => ({
  includesWithType: (value: unknown, items: readonly unknown[]) => items.includes(value),
  typedKeys: Object.keys,
}));

function createFeatureDataWithHistory() {
  const updateSource = vi.fn();
  const record = vi.fn();
  const geoman = {
    history: { record },
    features: {
      updateManager: { updateSource },
      getFeatureShapeByGeoJson: () => 'marker',
    },
  } as unknown as Geoman;
  const source = { id: SOURCES.main } as BaseSource;
  const feature = new FeatureData({
    gm: geoman,
    id: 'history-feature-1',
    source,
    parent: null,
    geoJsonShapeFeature: {
      type: 'Feature',
      id: 'history-feature-1',
      properties: { shape: 'marker' },
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
  });

  record.mockClear();

  return { feature, record };
}

function createFeaturesWithHistory() {
  const updateSource = vi.fn();
  const record = vi.fn();
  const geoman = {
    options: {
      settings: {
        throttlingDelay: 0,
        idGenerator: null,
      },
      layerStyles: {},
    },
    history: { record },
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
  features.updateManager.updateSource = updateSource;

  return { features, record };
}

describe('feature mutation records', () => {
  it('records immutable before and after snapshots for property updates', () => {
    const { feature, record } = createFeatureDataWithHistory();

    feature.updateProperties({ label: 'first' });
    feature.updateProperties({ label: 'second' });

    const firstOperation = record.mock.calls[0]?.[0]?.[0] as GeomanHistoryOperation;
    const secondOperation = record.mock.calls[1]?.[0]?.[0] as GeomanHistoryOperation;

    expect(firstOperation.ref).toEqual({
      sourceName: SOURCES.main,
      featureId: 'history-feature-1',
    });
    expect(firstOperation.before?.properties.label).toBeUndefined();
    expect(firstOperation.after?.properties.label).toBe('first');
    expect(secondOperation.before?.properties.label).toBe('first');
    expect(secondOperation.after?.properties.label).toBe('second');

    feature.updateProperties({ label: 'third' });

    expect(firstOperation.after?.properties.label).toBe('first');
    expect(secondOperation.after?.properties.label).toBe('second');
  });

  it('records source-aware create and delete operations', () => {
    const { features, record } = createFeaturesWithHistory();

    const feature = features.createFeature({
      featureId: 'created-feature',
      sourceName: SOURCES.main,
      shapeGeoJson: {
        type: 'Feature',
        id: 'created-feature',
        properties: { shape: 'marker' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    });
    features.delete({ sourceName: SOURCES.main, featureId: 'created-feature' });

    const createOperation = record.mock.calls[0]?.[0]?.[0] as GeomanHistoryOperation;
    const deleteOperation = record.mock.calls[1]?.[0]?.[0] as GeomanHistoryOperation;

    expect(feature).not.toBeNull();
    expect(createOperation).toMatchObject({
      kind: 'create',
      ref: { sourceName: SOURCES.main, featureId: 'created-feature' },
      before: null,
    });
    expect(createOperation.after?.id).toBe('created-feature');
    expect(deleteOperation).toMatchObject({
      kind: 'delete',
      ref: { sourceName: SOURCES.main, featureId: 'created-feature' },
      after: null,
    });
    expect(deleteOperation.before?.id).toBe('created-feature');
  });
});
