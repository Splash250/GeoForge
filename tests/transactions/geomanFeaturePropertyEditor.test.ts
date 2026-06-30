// @vitest-environment jsdom

import { FeatureData } from '@/core/features/feature-data.ts';
import { SOURCES } from '@/core/features/constants.ts';
import type { BaseSource } from '@/core/map/base/source.ts';
import type { Geoman } from '@/main.ts';
import { GeomanTransactionSubsystem } from '@/transactions/geomanTransactionSubsystem.ts';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/core/options/layers/style.ts', () => ({ default: {} }));
vi.mock('@/main.ts', () => ({
  includesWithType: (value: unknown, items: readonly unknown[]) => items.includes(value),
  typedKeys: Object.keys,
}));

function createFeature() {
  const updateSource = vi.fn();
  const featureListeners = new Set<() => void>();
  let suspensionDepth = 0;
  const record = vi.fn(() => ({ id: 'gm-history-editor' }));
  const geoman = {
    features: {
      updateManager: {
        updateSource,
        withAtomicSourcesUpdate: (callback: () => unknown) => callback(),
      },
      getFeatureShapeByGeoJson: () => 'marker',
      get: vi.fn(() => null),
      subscribe: vi.fn((callback: () => void) => {
        featureListeners.add(callback);
        return () => featureListeners.delete(callback);
      }),
    },
    history: {
      getState: vi.fn(() => ({
        canUndo: false,
        canRedo: false,
        undoCount: 0,
        redoCount: 0,
        maxEntries: 100,
        enabled: true,
      })),
      record: vi.fn((...args: Parameters<typeof record>) => {
        if (suspensionDepth === 0) {
          return record(...args);
        }
        return null;
      }),
      suspend: vi.fn((callback: () => unknown) => {
        suspensionDepth += 1;
        try {
          return callback();
        } finally {
          suspensionDepth -= 1;
        }
      }),
      undo: vi.fn(() => true),
      redo: vi.fn(() => true),
      subscribe: vi.fn((callback: () => void) => {
        callback();
        return vi.fn();
      }),
    },
  } as unknown as Geoman;
  const source = { id: SOURCES.main } as BaseSource;
  const feature = new FeatureData({
    gm: geoman,
    id: 'editor-feature-1',
    source,
    parent: null,
    geoJsonShapeFeature: {
      type: 'Feature',
      id: 'editor-feature-1',
      properties: { shape: 'marker', name: 'Original', segmentValue: 300 },
      geometry: { type: 'Point', coordinates: [0, 51] },
    },
  });

  (
    geoman.features as unknown as {
      get: ReturnType<typeof vi.fn>;
    }
  ).get.mockImplementation((sourceName: unknown, featureId: unknown) =>
    sourceName === SOURCES.main && featureId === feature.id ? feature : null,
  );
  updateSource.mockClear();

  return { geoman, feature, featureListeners, record };
}

describe('GeomanFeaturePropertyEditor', () => {
  test('lazily starts a transaction on first set and previews property updates', () => {
    const { geoman, feature } = createFeature();
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const editor = transactions.featureProperties({ feature, id: 'name-editor' });

    expect(transactions.getActive()).toBeNull();
    expect(editor.getState()).toMatchObject({
      dirty: false,
      active: false,
      available: true,
      values: { name: 'Original', segmentValue: 300 },
    });

    editor.set('name', 'Preview');

    expect(transactions.getActive()?.id).toBe('name-editor');
    expect(feature.getProperty('name')).toBe('Preview');
    expect(editor.getState()).toMatchObject({
      dirty: true,
      active: true,
      canCommit: true,
      canCancel: true,
      canUndo: false,
      values: { name: 'Preview' },
    });
  });

  test('commits as one grouped history entry, clears dirty state, and remains reusable', () => {
    const { geoman, feature, record } = createFeature();
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const editor = transactions.featureProperties({
      feature,
      id: 'name-editor',
      label: 'Feature name edit',
    });

    editor.set('name', 'Committed');
    const firstResult = editor.commit();
    editor.set('name', 'Second');
    const secondResult = editor.commit();

    expect(firstResult).toEqual({
      committed: true,
      messages: [],
      historyEntryId: 'gm-history-editor',
    });
    expect(secondResult.committed).toBe(true);
    expect(record).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenLastCalledWith(expect.any(Array), {
      label: 'Feature name edit',
    });
    expect(transactions.getActive()).toBeNull();
    expect(feature.getProperty('name')).toBe('Second');
    expect(editor.getState()).toMatchObject({ dirty: false, active: false });
  });

  test('cancel restores the original snapshot and clears dirty state', () => {
    const { geoman, feature } = createFeature();
    const editor = new GeomanTransactionSubsystem({ geoman }).featureProperties({
      feature,
      id: 'name-editor',
    });

    editor.set('name', 'Preview');
    editor.set('segmentValue', 450);
    editor.cancel();

    expect(feature.getProperty('name')).toBe('Original');
    expect(feature.getProperty('segmentValue')).toBe(300);
    expect(editor.getState()).toMatchObject({
      dirty: false,
      active: false,
      canCancel: false,
    });
  });

  test('blocks undo and redo while dirty and delegates when clean', () => {
    const { geoman, feature } = createFeature();
    const history = geoman.history as NonNullable<Geoman['history']>;
    vi.mocked(history.getState).mockReturnValue({
      canUndo: true,
      canRedo: true,
      undoCount: 1,
      redoCount: 1,
      maxEntries: 100,
      enabled: true,
    });
    const editor = new GeomanTransactionSubsystem({ geoman }).featureProperties({
      feature,
      id: 'name-editor',
    });

    editor.set('name', 'Preview');

    expect(editor.undo()).toBe(false);
    expect(editor.redo()).toBe(false);
    expect(history.undo).not.toHaveBeenCalled();
    expect(history.redo).not.toHaveBeenCalled();

    editor.cancel();

    expect(editor.undo()).toBe(true);
    expect(editor.redo()).toBe(true);
    expect(history.undo).toHaveBeenCalledTimes(1);
    expect(history.redo).toHaveBeenCalledTimes(1);
  });

  test('validation-blocked commit keeps preview active and exposes validation messages', () => {
    const { geoman, feature } = createFeature();
    const editor = new GeomanTransactionSubsystem({ geoman }).featureProperties({
      feature,
      id: 'name-editor',
      validate: ({ values }) => ({
        valid: typeof values.name === 'string' && values.name.trim().length > 0,
        messages: ['Name is required'],
      }),
    });

    editor.set('name', '');
    const result = editor.commit();

    expect(result).toEqual({
      committed: false,
      messages: ['Name is required'],
      historyEntryId: null,
    });
    expect(feature.getProperty('name')).toBe('');
    expect(editor.getState()).toMatchObject({
      dirty: true,
      active: true,
      validationMessages: ['Name is required'],
      canCommit: false,
    });
  });

  test('subscribe emits initial and subsequent state until unsubscribe or dispose', () => {
    const { geoman, feature } = createFeature();
    const editor = new GeomanTransactionSubsystem({ geoman }).featureProperties({
      feature,
      id: 'name-editor',
    });
    const subscriber = vi.fn();

    const unsubscribe = editor.subscribe(subscriber);
    editor.set('name', 'Preview');
    unsubscribe();
    editor.set('name', 'Ignored');
    editor.dispose();
    editor.cancel();

    expect(subscriber).toHaveBeenCalledTimes(2);
    expect(subscriber.mock.calls[0]?.[0]).toMatchObject({ dirty: false });
    expect(subscriber.mock.calls[1]?.[0]).toMatchObject({
      dirty: true,
      values: { name: 'Preview' },
    });
  });

  test('does not cancel or commit transactions it does not own', () => {
    const { geoman, feature } = createFeature();
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const external = transactions.start({ id: 'external' });
    const editor = transactions.featureProperties({ feature, id: 'name-editor' });

    expect(() => editor.set('name', 'Preview')).toThrow(
      'Cannot edit feature properties while transaction "external" is active.',
    );
    expect(editor.getState()).toMatchObject({
      blocked: true,
      blockReason: 'transaction "external" is active.',
    });

    editor.cancel();
    editor.dispose();

    expect(external.status).toBe('active');
    expect(transactions.getActive()).toBe(external);
  });

  test('blocks undo and redo while another transaction is active even when clean', () => {
    const { geoman, feature } = createFeature();
    const history = geoman.history as NonNullable<Geoman['history']>;
    vi.mocked(history.getState).mockReturnValue({
      canUndo: true,
      canRedo: true,
      undoCount: 1,
      redoCount: 1,
      maxEntries: 100,
      enabled: true,
    });
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const editor = transactions.featureProperties({ feature, id: 'name-editor' });

    transactions.start({ id: 'external' });

    expect(editor.getState()).toMatchObject({
      dirty: false,
      blocked: true,
      canUndo: false,
      canRedo: false,
    });
    expect(editor.undo()).toBe(false);
    expect(editor.redo()).toBe(false);
    expect(history.undo).not.toHaveBeenCalled();
    expect(history.redo).not.toHaveBeenCalled();
  });

  test('handles external feature deletion without throwing during state updates', () => {
    const { geoman, feature, featureListeners } = createFeature();
    const features = geoman.features as unknown as { get: ReturnType<typeof vi.fn> };
    const editor = new GeomanTransactionSubsystem({ geoman }).featureProperties({
      feature,
      id: 'name-editor',
    });
    const subscriber = vi.fn();

    editor.subscribe(subscriber);
    features.get.mockReturnValue(null);

    expect(() => {
      featureListeners.forEach((listener) => listener());
      editor.getState();
    }).not.toThrow();
    expect(editor.getState()).toMatchObject({
      available: false,
      dirty: false,
      canCommit: false,
      values: {},
    });
    expect(subscriber).toHaveBeenLastCalledWith(
      expect.objectContaining({ available: false, values: {} }),
    );
  });

  test('releases a helper-owned dirty transaction when the feature becomes unavailable', () => {
    const { geoman, feature, featureListeners } = createFeature();
    const features = geoman.features as unknown as { get: ReturnType<typeof vi.fn> };
    const history = geoman.history as NonNullable<Geoman['history']>;
    vi.mocked(history.getState).mockReturnValue({
      canUndo: true,
      canRedo: true,
      undoCount: 1,
      redoCount: 1,
      maxEntries: 100,
      enabled: true,
    });
    const transactions = new GeomanTransactionSubsystem({ geoman });
    const editor = transactions.featureProperties({ feature, id: 'name-editor' });

    editor.set('name', 'Preview');
    expect(transactions.getActive()?.id).toBe('name-editor');

    features.get.mockReturnValue(null);
    featureListeners.forEach((listener) => listener());

    expect(transactions.getActive()).toBeNull();
    expect(editor.getState()).toMatchObject({
      available: false,
      dirty: false,
      active: false,
      canUndo: false,
      canRedo: false,
    });
    expect(editor.undo()).toBe(false);
    expect(editor.redo()).toBe(false);
    expect(history.undo).not.toHaveBeenCalled();
    expect(history.redo).not.toHaveBeenCalled();
  });
});
