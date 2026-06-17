import { describe, expect, it, vi } from 'vitest';
import { GeomanHistorySubsystem } from '../../src/history/geomanHistorySubsystem.ts';
import type { GeomanHistoryOperation } from '../../src/history/types.ts';
import type { GeoJsonShapeFeature } from '../../src/types/geojson.ts';

const SOURCE_NAME = 'gm_main';

function createFeature(id = 'feature-1', label = 'A'): GeoJsonShapeFeature {
  return {
    type: 'Feature',
    id,
    geometry: {
      type: 'Point',
      coordinates: [1, 2],
    },
    properties: {
      gm_shape: 'marker',
      label,
    },
  };
}

function createOperation(
  before: GeoJsonShapeFeature | null,
  after: GeoJsonShapeFeature | null,
): GeomanHistoryOperation {
  return {
    kind: before && after ? 'update' : before ? 'delete' : 'create',
    ref: {
      sourceName: SOURCE_NAME,
      featureId: (before ?? after)?.id ?? 'feature-1',
    },
    before,
    after,
  };
}

function createHistory(options: { enabled?: boolean; maxEntries?: number } = {}) {
  const events: Array<{ name: string; payload: unknown }> = [];
  const restored = vi.fn();
  const deleted = vi.fn();
  const created = vi.fn();
  const feature = {
    restoreGeoJsonSnapshot: restored,
  };
  const geoman = {
    options: {
      settings: {
        history: {
          enabled: options.enabled ?? true,
          maxEntries: options.maxEntries ?? 100,
        },
      },
    },
    features: {
      get: vi.fn(() => feature),
      delete: deleted,
      createFeature: created,
    },
    mapAdapter: {
      getMapInstance: () => ({
        fire: (name: string, payload: unknown) => events.push({ name, payload }),
      }),
    },
  };

  return {
    events,
    feature,
    restored,
    deleted,
    created,
    geoman,
    history: new GeomanHistorySubsystem({ geoman: geoman as never }),
  };
}

describe('GeomanHistorySubsystem', () => {
  it('records entries, clears redo after new record, and drops oldest undo entries over capacity', () => {
    const { history } = createHistory({ maxEntries: 2 });

    const first = history.record([createOperation(null, createFeature('feature-1'))]);
    const second = history.record([createOperation(null, createFeature('feature-2'))]);
    const third = history.record([createOperation(null, createFeature('feature-3'))]);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();
    expect(history.getLastRecordedEntryId()).toBe(third?.id);
    expect(history.getState()).toMatchObject({
      undoCount: 2,
      redoCount: 0,
      canUndo: true,
      canRedo: false,
      maxEntries: 2,
    });

    expect(history.undo()).toBe(true);
    expect(history.getState()).toMatchObject({ undoCount: 1, redoCount: 1, canRedo: true });

    history.record([createOperation(null, createFeature('feature-4'))]);

    expect(history.getState()).toMatchObject({ undoCount: 2, redoCount: 0, canRedo: false });
  });

  it('consumes the latest recorded entry id once for event correlation', () => {
    const { history } = createHistory();
    const entry = history.record([createOperation(null, createFeature())]);

    expect(entry).not.toBeNull();
    expect(history.getLastRecordedEntryId()).toBe(entry?.id);
    expect(history.getLastRecordedEntry()?.id).toBe(entry?.id);
    expect(history.consumeLastRecordedEntryId()).toBe(entry?.id);
    expect(history.getLastRecordedEntryId()).toBeNull();
    expect(history.getLastRecordedEntry()).toBeNull();
    expect(history.consumeLastRecordedEntryId()).toBeNull();
  });

  it('returns cloned latest recorded entries for event change record correlation', () => {
    const { history } = createHistory();
    const entry = history.record([createOperation(null, createFeature())]);
    const latest = history.getLastRecordedEntry();

    expect(latest).toEqual(entry);
    expect(latest).not.toBe(entry);
    expect(latest?.operations[0]).not.toBe(entry?.operations[0]);

    if (latest?.operations[0]?.after) {
      latest.operations[0].after.properties.label = 'mutated clone';
    }

    expect(history.getLastRecordedEntry()?.operations[0]?.after?.properties.label).toBe('A');
  });

  it('does not record when disabled', () => {
    const { history } = createHistory({ enabled: false });

    expect(history.record([createOperation(null, createFeature())])).toBeNull();
    expect(history.getLastRecordedEntryId()).toBeNull();
    expect(history.getState()).toMatchObject({ undoCount: 0, canUndo: false, enabled: false });
  });

  it('does not record while suspended', () => {
    const { history } = createHistory();

    history.suspend(() => {
      history.record([createOperation(null, createFeature())]);
    });

    expect(history.getLastRecordedEntryId()).toBeNull();
    expect(history.getState().undoCount).toBe(0);
  });

  it('clears the last recorded entry id after empty skipped records', () => {
    const { history } = createHistory();
    const entry = history.record([createOperation(null, createFeature())]);

    expect(history.getLastRecordedEntryId()).toBe(entry?.id);

    expect(history.record([])).toBeNull();

    expect(history.getLastRecordedEntryId()).toBeNull();
  });

  it('undo and redo apply inverse operations without recursive records', () => {
    const before = createFeature('feature-1', 'before');
    const after = createFeature('feature-1', 'after');
    const { history, restored } = createHistory();

    const entry = history.record([createOperation(before, after)]);
    expect(history.getLastRecordedEntryId()).toBe(entry?.id);

    expect(history.undo()).toBe(true);
    expect(restored).toHaveBeenCalledWith(before);
    expect(history.getState()).toMatchObject({ undoCount: 0, redoCount: 1 });
    expect(history.getLastRecordedEntryId()).toBeNull();

    expect(history.redo()).toBe(true);
    expect(restored).toHaveBeenCalledWith(after);
    expect(history.getState()).toMatchObject({ undoCount: 1, redoCount: 0 });
    expect(history.getLastRecordedEntryId()).toBeNull();
  });

  it('emits historyrecord, historychange, undo, and redo events', () => {
    const { history, events } = createHistory();

    history.record([createOperation(null, createFeature())], { label: 'Create feature' });
    history.undo();
    history.redo();

    expect(events.map((event) => event.name)).toEqual([
      'gm:historyrecord',
      'gm:historychange',
      'gm:undo',
      'gm:historychange',
      'gm:redo',
      'gm:historychange',
    ]);
  });
});
