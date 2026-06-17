// @vitest-environment jsdom

import { FeatureData } from '@/core/features/feature-data.ts';
import { SOURCES } from '@/core/features/constants.ts';
import type { BaseSource } from '@/core/map/base/source.ts';
import { SourceUpdateManager } from '@/core/features/source-update-manager.ts';
import { GeomanTransactionSubsystem } from '@/transactions/geomanTransactionSubsystem.ts';
import type { Geoman } from '@/main.ts';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/core/options/layers/style.ts', () => ({ default: {} }));
vi.mock('@/main.ts', () => ({
  includesWithType: (value: unknown, items: readonly unknown[]) => items.includes(value),
  typedKeys: Object.keys,
}));

function createFeature() {
  const updateSource = vi.fn();
  const geoman = {
    features: {
      updateManager: { updateSource },
      getFeatureShapeByGeoJson: () => 'marker',
    },
  } as unknown as Geoman;
  const source = { id: SOURCES.main } as BaseSource;
  const feature = new FeatureData({
    gm: geoman,
    id: 'tx-feature-1',
    source,
    parent: null,
    geoJsonShapeFeature: {
      type: 'Feature',
      id: 'tx-feature-1',
      properties: { shape: 'marker', segmentValue: 300 },
      geometry: { type: 'Point', coordinates: [0, 51] },
    },
  });

  updateSource.mockClear();

  return { geoman, feature, updateSource };
}

function createFeatureWithSourceUpdateManager() {
  const geoman = {
    options: { settings: { throttlingDelay: 0 } },
    features: {
      sources: { [SOURCES.main]: { id: SOURCES.main } },
      updateManager: undefined,
      getFeatureShapeByGeoJson: () => 'marker',
    },
  } as unknown as Geoman;
  const updateManager = new SourceUpdateManager(geoman);
  const flushSource = vi.fn();
  updateManager.delayedSourceUpdateMethods[SOURCES.main] = flushSource;
  geoman.features.updateManager = updateManager;

  const source = { id: SOURCES.main } as BaseSource;
  const feature = new FeatureData({
    gm: geoman,
    id: 'tx-feature-1',
    source,
    parent: null,
    geoJsonShapeFeature: {
      type: 'Feature',
      id: 'tx-feature-1',
      properties: { shape: 'marker', segmentValue: 300 },
      geometry: { type: 'Point', coordinates: [0, 51] },
    },
  });

  return { geoman, feature, updateManager, flushSource };
}

describe('GeomanTransactionSubsystem', () => {
  test('applies property previews and restores the original snapshot on cancel', () => {
    const { geoman, feature } = createFeature();
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const transaction = transactions.start({ id: 'property-edit' });

    transaction.updateProperty(feature, 'segmentValue', 450);
    transaction.updateProperty(feature, 'label', 'Line A');

    expect(transaction.isDirty()).toBe(true);
    expect(feature.getProperty('segmentValue')).toBe(450);
    expect(feature.getProperty('label')).toBe('Line A');
    expect(transaction.getChanges()).toHaveLength(1);

    transaction.cancel();

    expect(transaction.status).toBe('cancelled');
    expect(transactions.getActive()).toBeNull();
    expect(feature.getProperty('segmentValue')).toBe(300);
    expect(feature.getProperty('label')).toBeUndefined();
  });

  test('queues rollback property removals with explicit undefined markers', () => {
    const { geoman, feature, updateSource } = createFeature();
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const transaction = transactions.start();

    transaction.updateProperty(feature, 'label', 'Line A');
    transaction.cancel();

    const lastCall = updateSource.mock.lastCall?.[0];
    const rollbackFeature = lastCall?.diff?.update?.[0];

    expect(feature.getProperty('label')).toBeUndefined();
    expect(rollbackFeature?.properties).toMatchObject({
      segmentValue: 300,
      label: undefined,
    });
  });

  test('queues rollback diff objects that are isolated from later feature mutations', () => {
    const { geoman, feature, updateSource } = createFeature();
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const transaction = transactions.start();

    transaction.updateProperty(feature, 'label', 'Line A');
    transaction.cancel();

    const rollbackFeature = updateSource.mock.lastCall?.[0].diff?.update?.[0];

    feature.updateProperty('label', 'Later mutation');

    expect(feature.getProperty('label')).toBe('Later mutation');
    expect(rollbackFeature?.properties).toMatchObject({
      segmentValue: 300,
      label: undefined,
    });
  });

  test('commits property previews without restoring the original snapshot', () => {
    const { geoman, feature } = createFeature();
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const transaction = transactions.start();

    transaction.updateProperties(feature, { segmentValue: 500, label: 'Line B' });
    const result = transaction.commit();

    expect(result).toEqual({ committed: true, messages: [], historyEntryId: null });
    expect(transaction.status).toBe('committed');
    expect(transactions.getActive()).toBeNull();
    expect(feature.getProperty('segmentValue')).toBe(500);
    expect(feature.getProperty('label')).toBe('Line B');
  });

  test('records a committed transaction as one grouped history entry', () => {
    const { geoman, feature } = createFeature();
    let suspensionDepth = 0;
    const record = vi.fn((operations: unknown[], options?: unknown) => {
      void operations;
      void options;
      return { id: 'gm-history-123' };
    });
    const recordIfNotSuspended = vi.fn((...args: Parameters<typeof record>) => {
      if (suspensionDepth === 0) {
        return record(...args);
      }
      return null;
    });
    const suspend = vi.fn((callback: () => unknown) => {
      suspensionDepth += 1;
      try {
        return callback();
      } finally {
        suspensionDepth -= 1;
      }
    });
    (geoman as never as { history: { record: typeof record; suspend: typeof suspend } }).history = {
      record: recordIfNotSuspended,
      suspend,
    };
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const transaction = transactions.start({ id: 'grouped-history' });

    transaction.updateProperty(feature, 'segmentValue', 450);
    transaction.updateProperty(feature, 'label', 'Line A');
    const result = transaction.commit();

    expect(result).toEqual({
      committed: true,
      messages: [],
      historyEntryId: 'gm-history-123',
    });
    expect(suspend).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenCalledOnce();
    expect(record.mock.calls[0]?.[0]).toHaveLength(1);
    expect(record.mock.calls[0]?.[0]?.[0]).toMatchObject({
      kind: 'update',
      ref: { sourceName: SOURCES.main, featureId: 'tx-feature-1' },
      before: {
        properties: expect.objectContaining({ segmentValue: 300 }),
      },
      after: {
        properties: expect.objectContaining({ segmentValue: 450, label: 'Line A' }),
      },
    });
    expect(record.mock.calls[0]?.[1]).toEqual({ label: 'grouped-history' });
  });

  test('does not record cancelled or validation-blocked transactions', () => {
    const { geoman, feature } = createFeature();
    let suspensionDepth = 0;
    const record = vi.fn();
    const recordIfNotSuspended = vi.fn((...args: Parameters<typeof record>) => {
      if (suspensionDepth === 0) {
        record(...args);
      }
    });
    const suspend = vi.fn((callback: () => unknown) => {
      suspensionDepth += 1;
      try {
        return callback();
      } finally {
        suspensionDepth -= 1;
      }
    });
    (geoman as never as { history: { record: typeof record; suspend: typeof suspend } }).history = {
      record: recordIfNotSuspended,
      suspend,
    };
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const cancelled = transactions.start({ id: 'cancelled-history' });

    cancelled.updateProperty(feature, 'label', 'Preview');
    cancelled.cancel();

    const blocked = transactions.start({
      id: 'blocked-history',
      validate: () => ({ valid: false, messages: ['Blocked'] }),
    });
    blocked.updateProperty(feature, 'label', 'Blocked');

    expect(blocked.commit()).toEqual({
      committed: false,
      messages: ['Blocked'],
      historyEntryId: null,
    });
    expect(record).not.toHaveBeenCalled();

    blocked.cancel();
  });

  test('returns null history entry id when history recording is skipped', () => {
    const { geoman, feature } = createFeature();
    let suspensionDepth = 0;
    const record = vi.fn(() => null);
    const recordIfNotSuspended = vi.fn((...args: Parameters<typeof record>) => {
      if (suspensionDepth === 0) {
        return record(...args);
      }
      return null;
    });
    const suspend = vi.fn((callback: () => unknown) => {
      suspensionDepth += 1;
      try {
        return callback();
      } finally {
        suspensionDepth -= 1;
      }
    });
    (geoman as never as { history: { record: typeof record; suspend: typeof suspend } }).history = {
      record: recordIfNotSuspended,
      suspend,
    };
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const transaction = transactions.start({ id: 'skipped-history' });

    transaction.updateProperty(feature, 'label', 'No history entry');

    expect(transaction.commit()).toEqual({
      committed: true,
      messages: [],
      historyEntryId: null,
    });
    expect(record).toHaveBeenCalledOnce();
  });

  test('rolls back geometry previews on cancel', () => {
    const { geoman, feature } = createFeature();
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const transaction = transactions.start();

    transaction.updateGeometry(feature, { type: 'Point', coordinates: [10, 52] });
    expect(feature.getGeoJson().geometry).toEqual({ type: 'Point', coordinates: [10, 52] });

    transaction.cancel();

    expect(feature.getGeoJson().geometry).toEqual({ type: 'Point', coordinates: [0, 51] });
  });

  test('allows only one active transaction at a time', () => {
    const { geoman } = createFeature();
    const transactions = new GeomanTransactionSubsystem({ geoman });

    transactions.start();

    expect(() => transactions.start()).toThrow('A Geoman transaction is already active.');
  });

  test('keeps transaction active when validation blocks commit', () => {
    const { geoman, feature } = createFeature();
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const transaction = transactions.start({
      validate: () => ({ valid: false, messages: ['Segment value is required'] }),
    });

    transaction.updateProperty(feature, 'segmentValue', undefined);
    const result = transaction.commit();

    expect(result).toEqual({
      committed: false,
      messages: ['Segment value is required'],
      historyEntryId: null,
    });
    expect(transaction.status).toBe('active');
    expect(transactions.getActive()).toBe(transaction);
    expect(feature.getProperty('segmentValue')).toBeUndefined();

    transaction.cancel();
    expect(feature.getProperty('segmentValue')).toBe(300);
  });

  test('batches preview and rollback source updates atomically when available', () => {
    const { geoman, feature } = createFeature();
    const withAtomicSourcesUpdate = vi.fn((callback: () => unknown) => callback());
    (
      geoman.features.updateManager as never as {
        withAtomicSourcesUpdate: typeof withAtomicSourcesUpdate;
      }
    ).withAtomicSourcesUpdate = withAtomicSourcesUpdate;
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const transaction = transactions.start();

    transaction.updateProperties(feature, { segmentValue: 350, label: 'Preview' });
    transaction.cancel();

    expect(withAtomicSourcesUpdate).toHaveBeenCalledTimes(2);
  });

  test('keeps source updates disabled until the outer atomic update callback finishes', () => {
    const { geoman, feature, updateManager } = createFeatureWithSourceUpdateManager();
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const transaction = transactions.start();
    const enabledStates: boolean[] = [];
    const atomicFlushStates: boolean[] = [];
    const updateSource = updateManager.updateSource.bind(updateManager);
    updateManager.updateSource = vi.fn((options) => {
      if (!options.diff) {
        atomicFlushStates.push(updateManager.autoUpdatesEnabled);
      }
      return updateSource(options);
    });

    updateManager.withAtomicSourcesUpdate(() => {
      enabledStates.push(updateManager.autoUpdatesEnabled);
      transaction.updateProperty(feature, 'segmentValue', 350);
      enabledStates.push(updateManager.autoUpdatesEnabled);
      expect(atomicFlushStates).toEqual([]);
    });

    expect(enabledStates).toEqual([false, false]);
    expect(updateManager.autoUpdatesEnabled).toBe(true);
    expect(atomicFlushStates).toEqual([true]);
  });

  test('rolls back multi-feature endpoint connection updates', () => {
    const { geoman, feature: lineA } = createFeatureWithSourceUpdateManager();
    const source = { id: SOURCES.main } as BaseSource;
    lineA.updateGeometry({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 0],
      ],
    });
    lineA.updateProperties({ shape: 'line' });
    const lineB = new FeatureData({
      gm: geoman,
      id: 'tx-feature-2',
      source,
      parent: null,
      geoJsonShapeFeature: {
        type: 'Feature',
        id: 'tx-feature-2',
        properties: { shape: 'line' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [1.1, 0],
            [2, 0],
          ],
        },
      },
    });
    const transaction = new GeomanTransactionSubsystem({ geoman }).start();

    transaction.updateGeometry(lineA, {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1.1, 0],
      ],
    });
    transaction.updateGeometry(lineB, {
      type: 'LineString',
      coordinates: [
        [1.2, 0],
        [2, 0],
      ],
    });
    transaction.cancel();

    expect(lineA.getGeoJson().geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 0],
      ],
    });
    expect(lineB.getGeoJson().geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [1.1, 0],
        [2, 0],
      ],
    });
  });
});
