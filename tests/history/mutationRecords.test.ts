// @vitest-environment jsdom

import { FeatureData } from '@/core/features/feature-data.ts';
import { SOURCES } from '@/core/features/constants.ts';
import { Features } from '@/core/features/index.ts';
import type { BaseSource } from '@/core/map/base/source.ts';
import type { Geoman } from '@/main.ts';
import { GeomanHistorySubsystem } from '@/history/geomanHistorySubsystem.ts';
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

function createFeaturesWithRealHistory() {
  const updateSource = vi.fn();
  const fire = vi.fn();
  const geoman = {
    options: {
      settings: {
        throttlingDelay: 0,
        idGenerator: null,
        history: {
          enabled: true,
          maxEntries: 100,
        },
      },
      layerStyles: {},
    },
    mapAdapter: {
      queryFeaturesByScreenCoordinates: vi.fn(() => []),
      coordBoundsToScreenBounds: vi.fn(),
      getMapInstance: () => ({ fire }),
    },
    events: { fire: vi.fn() },
  } as unknown as Geoman;
  const features = new Features(geoman);
  const history = new GeomanHistorySubsystem({ geoman });
  const source = { id: SOURCES.main } as BaseSource;

  geoman.features = features;
  geoman.history = history;
  features.sources[SOURCES.main] = source;
  features.updateManager.updateSource = updateSource;

  return { features, history };
}

function createMarkerFeature(features: Features, featureId: string) {
  return features.createFeature({
    featureId,
    sourceName: SOURCES.main,
    shapeGeoJson: {
      type: 'Feature',
      id: featureId,
      properties: { shape: 'marker' },
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
  });
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

  it('suppresses history for create and delete operations when history is false', () => {
    const { features, record } = createFeaturesWithHistory();

    const feature = features.createFeature({
      featureId: 'quiet-feature',
      sourceName: SOURCES.main,
      history: false,
      shapeGeoJson: {
        type: 'Feature',
        id: 'quiet-feature',
        properties: { shape: 'marker' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    });
    features.delete({ sourceName: SOURCES.main, featureId: 'quiet-feature' }, { history: false });

    expect(feature).not.toBeNull();
    expect(record).toHaveBeenCalledWith([]);
  });

  it('suppresses history only for update operations with history false', () => {
    const { feature, record } = createFeatureDataWithHistory();

    feature.updateProperties({ label: 'quiet' }, { history: false });
    feature.updateGeometry({ type: 'Point', coordinates: [1, 1] }, { history: false });
    feature.setProperties({ label: 'recorded' });

    expect(record).toHaveBeenCalledTimes(3);
    expect(record.mock.calls[0]?.[0]).toEqual([]);
    expect(record.mock.calls[1]?.[0]).toEqual([]);
    const operation = record.mock.calls[2]?.[0]?.[0] as GeomanHistoryOperation;
    expect(operation).toMatchObject({
      kind: 'update',
      ref: { sourceName: SOURCES.main, featureId: 'history-feature-1' },
    });
    expect(operation.before?.properties.label).toBe('quiet');
    expect(operation.after?.properties.label).toBe('recorded');
  });

  it('records a batch of delete operations for deleteAll by default', () => {
    const { features, record } = createFeaturesWithHistory();

    const marker = createMarkerFeature(features, 'delete-all-marker');
    const line = features.createFeature({
      featureId: 'delete-all-line',
      sourceName: SOURCES.main,
      shapeGeoJson: {
        type: 'Feature',
        id: 'delete-all-line',
        properties: { shape: 'line' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      },
    });
    features.createFeature({
      featureId: 'delete-all-snap-guide',
      sourceName: SOURCES.main,
      shapeGeoJson: {
        type: 'Feature',
        id: 'delete-all-snap-guide',
        properties: { shape: 'snap_guide' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      },
    });
    record.mockClear();

    features.deleteAll();

    expect(marker).not.toBeNull();
    expect(line).not.toBeNull();
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0]?.[1]).toEqual({ label: 'feature.deleteAll' });
    const operations = record.mock.calls[0]?.[0] as GeomanHistoryOperation[];
    expect(operations).toHaveLength(2);
    expect(operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'delete',
          ref: { sourceName: SOURCES.main, featureId: 'delete-all-marker' },
          after: null,
        }),
        expect.objectContaining({
          kind: 'delete',
          ref: { sourceName: SOURCES.main, featureId: 'delete-all-line' },
          after: null,
        }),
      ]),
    );
  });

  it('suppresses deleteAll history and clears stale history markers when history is false', () => {
    const { features, history } = createFeaturesWithRealHistory();

    createMarkerFeature(features, 'existing-record');
    expect(history.getLastRecordedEntryId()).not.toBeNull();

    createMarkerFeature(features, 'quiet-delete-all');
    features.deleteAll({ history: false });

    expect(history.getLastRecordedEntryId()).toBeNull();
    expect(history.getLastRecordedEntry()).toBeNull();
    expect(history.getState().undoCount).toBe(2);
  });

  it('clears stale history markers after history-suppressed create, update, and delete operations', () => {
    const { features, history } = createFeaturesWithRealHistory();

    const baseline = createMarkerFeature(features, 'baseline-record');
    expect(baseline).not.toBeNull();
    expect(history.getLastRecordedEntryId()).not.toBeNull();

    features.createFeature({
      featureId: 'quiet-create',
      sourceName: SOURCES.main,
      history: false,
      shapeGeoJson: {
        type: 'Feature',
        id: 'quiet-create',
        properties: { shape: 'marker' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    });
    expect(history.getLastRecordedEntryId()).toBeNull();
    expect(history.getLastRecordedEntry()).toBeNull();

    baseline?.updateProperties({ label: 'recorded-update' });
    expect(history.getLastRecordedEntryId()).not.toBeNull();
    baseline?.updateProperties({ label: 'quiet-update' }, { history: false });
    expect(history.getLastRecordedEntryId()).toBeNull();
    expect(history.getLastRecordedEntry()).toBeNull();

    baseline?.updateProperties({ label: 'recorded-again' });
    expect(history.getLastRecordedEntryId()).not.toBeNull();
    if (baseline) {
      features.delete(baseline, { history: false });
    }
    expect(history.getLastRecordedEntryId()).toBeNull();
    expect(history.getLastRecordedEntry()).toBeNull();
  });

  it('does not record internal edit control marker or snap guide create, update, or delete operations', () => {
    const { features, record } = createFeaturesWithHistory();

    const parentFeature = features.createFeature({
      featureId: 'editable-line',
      sourceName: SOURCES.main,
      shapeGeoJson: {
        type: 'Feature',
        id: 'editable-line',
        properties: { shape: 'line' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      },
    });
    expect(parentFeature).not.toBeNull();
    record.mockClear();

    for (const markerType of ['vertex', 'edge', 'center'] as const) {
      const marker = features.createMarkerFeature({
        parentFeature: parentFeature!,
        coordinate: [0, 0],
        type: markerType,
        sourceName: SOURCES.main,
      });
      marker?.updateGeoJsonGeometry({ type: 'Point', coordinates: [0.5, 0.5] });
      if (marker) {
        features.delete(marker);
      }
    }

    const snapGuide = features.createFeature({
      featureId: 'snap-guide',
      sourceName: SOURCES.main,
      shapeGeoJson: {
        type: 'Feature',
        id: 'snap-guide',
        properties: { shape: 'snap_guide' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      },
    });
    snapGuide?.updateGeoJsonGeometry({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [2, 2],
      ],
    });
    if (snapGuide) {
      features.delete(snapGuide);
    }

    expect(record).not.toHaveBeenCalled();
  });
});
