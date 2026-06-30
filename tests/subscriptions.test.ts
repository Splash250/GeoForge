// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { GM_PREFIX, GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import { FeatureData } from '@/core/features/feature-data.ts';
import { Features } from '@/core/features/index.ts';
import { GeomanHistorySubsystem } from '@/history/geomanHistorySubsystem.ts';
import { ModeController } from '@/core/modes/modeController.ts';
import type { GeoJsonShapeFeature } from '@/types/geojson.ts';
import type { AnyEventName, BaseEventListener } from '@/types/map/index.ts';
import type { ModeName } from '@/types/controls.ts';
import type { ModeType } from '@/types/options.ts';

vi.mock('@/core/options/layers/style.ts', () => ({ default: {} }));
vi.mock('@/main.ts', () => ({
  includesWithType: (value: unknown, items: readonly unknown[]) => items.includes(value),
  typedKeys: Object.keys,
}));

type Listener = (event: unknown) => void;
type MockSource = ReturnType<typeof createSource>;

function createEventTarget() {
  const listeners = new Map<string, Set<Listener>>();
  const on = vi.fn((name: AnyEventName, listener: BaseEventListener) => {
    const eventName = String(name);
    listeners.set(eventName, listeners.get(eventName) ?? new Set());
    listeners.get(eventName)!.add(listener as Listener);
  });
  const off = vi.fn((name: AnyEventName, listener: BaseEventListener) => {
    listeners.get(String(name))?.delete(listener as Listener);
  });
  const fire = vi.fn((name: string, payload: unknown) => {
    listeners.get(name)?.forEach((listener) => listener(payload));
  });

  return { listeners, on, off, fire };
}

function createSource(id: string) {
  const features = new Map<string | number, GeoJsonShapeFeature>();

  return {
    id,
    features,
    addGeoJson: vi.fn((feature: GeoJsonShapeFeature) => {
      features.set(feature.id ?? String(features.size + 1), feature);
    }),
    removeGeoJson: vi.fn((featureId: string | number) => {
      features.delete(featureId);
    }),
    updateGeoJson: vi.fn((feature: GeoJsonShapeFeature) => {
      features.set(feature.id ?? String(features.size + 1), feature);
    }),
    getGeoJson: vi.fn(() => ({
      type: 'FeatureCollection' as const,
      features: Array.from(features.values()),
    })),
    getGmGeoJson: vi.fn(() => ({
      type: 'FeatureCollection' as const,
      features: Array.from(features.values()),
    })),
  };
}

function createFeaturesSubsystem() {
  const target = createEventTarget();
  const geoman: {
    options: { settings: { idGenerator: null; history: { enabled: boolean; maxEntries: number } } };
    mapAdapter: {
      on: typeof target.on;
      off: typeof target.off;
      fire: typeof target.fire;
      getMapInstance: () => { fire: typeof target.fire };
    };
    history: { record: ReturnType<typeof vi.fn> } | GeomanHistorySubsystem;
    events: { fire: ReturnType<typeof vi.fn> };
    isFeatureEditable: () => boolean;
    features?: Features;
  } = {
    options: { settings: { idGenerator: null, history: { enabled: true, maxEntries: 100 } } },
    mapAdapter: {
      on: target.on,
      off: target.off,
      fire: target.fire,
      getMapInstance: () => ({ fire: target.fire }),
    },
    history: { record: vi.fn() },
    events: { fire: vi.fn() },
    isFeatureEditable: () => true,
  };
  const features = new Features(geoman as never);
  (geoman as { features?: Features }).features = features;
  const main = createSource('gm_main');
  const temp = createSource('gm_temporary');
  features.sources = { gm_main: main as never, gm_temporary: temp as never };
  features.featureStoreService.sources = features.sources;
  vi.spyOn(features.updateManager, 'updateSource').mockImplementation(({ diff, sourceName }) => {
    if (!diff) {
      return undefined;
    }
    const source = features.sources[sourceName] as MockSource | null;
    diff.add?.forEach((feature) => source?.addGeoJson(feature as GeoJsonShapeFeature));
    diff.update?.forEach((feature) => source?.updateGeoJson(feature as GeoJsonShapeFeature));
    diff.remove?.forEach((featureId) => source?.removeGeoJson(featureId));
    return undefined;
  });

  return { features, geoman, target, main, temp };
}

function createFeaturesWithRealHistory() {
  const setup = createFeaturesSubsystem();
  const history = new GeomanHistorySubsystem({ geoman: setup.geoman as never });
  setup.geoman.history = history;
  return { ...setup, history };
}

function createHistorySubsystem() {
  const target = createEventTarget();
  const geoman = {
    options: { settings: { history: { enabled: true, maxEntries: 100 } } },
    features: {
      get: vi.fn(),
      delete: vi.fn(),
      createFeature: vi.fn(),
    },
    mapAdapter: {
      getMapInstance: () => ({ fire: target.fire }),
      on: target.on,
      off: target.off,
    },
  };

  return { history: new GeomanHistorySubsystem({ geoman: geoman as never }), target };
}

function createModeController() {
  const target = createEventTarget();
  const activeModes = new Set<string>();
  const geoman = {
    actionInstances: {},
    options: {
      controls: {
        draw: { marker: { active: false } },
        edit: { drag: { active: false } },
        helper: { snapping: { active: false } },
      },
      enableMode: vi.fn((modeType: ModeType, modeName: ModeName) => {
        activeModes.add(`${modeType}:${modeName}`);
      }),
      disableMode: vi.fn((modeType: ModeType, modeName: ModeName) => {
        activeModes.delete(`${modeType}:${modeName}`);
      }),
      toggleMode: vi.fn(),
      isModeEnabled: vi.fn((modeType: ModeType, modeName: ModeName) =>
        activeModes.has(`${modeType}:${modeName}`),
      ),
    },
    mapAdapter: {
      on: target.on,
      off: target.off,
    },
    disableAllModes: vi.fn(() => activeModes.clear()),
    getActiveDrawModes: () =>
      Array.from(activeModes)
        .filter((item) => item.startsWith('draw:'))
        .map((item) => item.split(':')[1]),
    getActiveEditModes: () =>
      Array.from(activeModes)
        .filter((item) => item.startsWith('edit:'))
        .map((item) => item.split(':')[1]),
    getActiveHelperModes: () =>
      Array.from(activeModes)
        .filter((item) => item.startsWith('helper:'))
        .map((item) => item.split(':')[1]),
  };

  return { modes: new ModeController(geoman as never), target, activeModes };
}

describe('public subscription helpers', () => {
  it('features.subscribe emits filtered snapshots for store mutations and detaches listeners', () => {
    const { features, target } = createFeaturesSubsystem();
    const callback = vi.fn();

    const unsubscribe = features.subscribe(callback, { sourceNames: ['gm_main'] });
    const kept = features.createFeature({
      featureId: 'kept',
      sourceName: 'gm_main',
      history: false,
      shapeGeoJson: {
        type: 'Feature',
        id: 'kept',
        geometry: { type: 'Point', coordinates: [1, 2] },
        properties: { gm_shape: 'marker' },
      },
    });
    features.createFeature({
      featureId: 'temporary',
      sourceName: 'gm_temporary',
      history: false,
      shapeGeoJson: {
        type: 'Feature',
        id: 'temporary',
        geometry: { type: 'Point', coordinates: [3, 4] },
        properties: { gm_shape: 'marker' },
      },
    });
    if (!kept) {
      throw new Error('Expected feature to be created');
    }

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'create',
      name: `${GM_PREFIX}:create`,
      feature: kept,
      features: [kept],
      geoJson: { type: 'FeatureCollection', features: [kept.getGeoJson()] },
    });

    unsubscribe();
    unsubscribe();
    features.createFeature({
      featureId: 'after-unsubscribe',
      sourceName: 'gm_main',
      history: false,
      shapeGeoJson: {
        type: 'Feature',
        id: 'after-unsubscribe',
        geometry: { type: 'Point', coordinates: [5, 6] },
        properties: { gm_shape: 'marker' },
      },
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(target.off).not.toHaveBeenCalled();
  });

  it('features.subscribe can include temporary features', () => {
    const { features } = createFeaturesSubsystem();
    const callback = vi.fn();

    features.subscribe(callback, { includeTemporary: true });
    const temporary = features.createFeature({
      featureId: 'temporary',
      sourceName: 'gm_temporary',
      history: false,
      shapeGeoJson: {
        type: 'Feature',
        id: 'temporary',
        geometry: { type: 'Point', coordinates: [3, 4] },
        properties: { gm_shape: 'marker' },
      },
    });

    expect(callback.mock.calls[0]?.[0].features).toEqual([temporary]);
  });

  it('features.subscribe does not emit for history-only state changes', () => {
    const { features, target } = createFeaturesSubsystem();
    const callback = vi.fn();

    features.subscribe(callback);
    target.fire('gm:historychange', { state: { canUndo: false } });

    expect(callback).not.toHaveBeenCalled();
  });

  it('features.subscribe fires for imported feature creation APIs', () => {
    const { features } = createFeaturesSubsystem();
    const callback = vi.fn();

    features.subscribe(callback);
    const importedFeature = features.importGeoJsonFeature(
      {
        type: 'Feature',
        id: 'imported-feature',
        geometry: { type: 'Point', coordinates: [1, 2] },
        properties: { gm_shape: 'marker' },
      },
      { history: false },
    );
    const importedCollection = features.importGeoJson(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'imported-collection-feature',
            geometry: { type: 'Point', coordinates: [3, 4] },
            properties: { gm_shape: 'marker' },
          },
        ],
      },
      { history: false },
    );

    expect(importedFeature).not.toBeNull();
    expect(importedCollection.addedFeatures).toHaveLength(1);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls.map((call) => call[0]?.type)).toEqual(['create', 'create']);
    expect(
      callback.mock.calls.at(-1)?.[0].features.map((feature: FeatureData) => feature.id),
    ).toEqual(['imported-feature', 'imported-collection-feature']);
  });

  it('features.subscribe fires for public delete and feature data updates', () => {
    const { features } = createFeaturesSubsystem();
    const callback = vi.fn();
    const feature = features.createFeature({
      featureId: 'mutable-feature',
      sourceName: 'gm_main',
      history: false,
      shapeGeoJson: {
        type: 'Feature',
        id: 'mutable-feature',
        geometry: { type: 'Point', coordinates: [1, 2] },
        properties: { gm_shape: 'marker' },
      },
    });
    if (!feature) {
      throw new Error('Expected feature to be created');
    }

    features.subscribe(callback);
    feature.updateProperties({ label: 'updated' }, { history: false });
    feature.updateGeometry({ type: 'Point', coordinates: [4, 5] }, { history: false });
    features.delete(feature, { history: false });

    expect(callback.mock.calls.map((call) => call[0]?.type)).toEqual([
      'update',
      'update',
      'delete',
    ]);
    expect(callback.mock.calls[0]?.[0].features[0].getProperty('label')).toBe('updated');
    expect(callback.mock.calls[1]?.[0].geoJson.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [4, 5],
    });
    expect(callback.mock.calls[2]?.[0].features).toEqual([]);
  });

  it('features.subscribe fires once for history restore snapshots', () => {
    const { features, history } = createFeaturesWithRealHistory();
    const feature = features.createFeature({
      featureId: 'history-restored-feature',
      sourceName: 'gm_main',
      history: false,
      shapeGeoJson: {
        type: 'Feature',
        id: 'history-restored-feature',
        geometry: { type: 'Point', coordinates: [1, 2] },
        properties: { gm_shape: 'marker', label: 'before' },
      },
    });
    if (!feature) {
      throw new Error('Expected feature to be created');
    }
    const callback = vi.fn();

    features.subscribe(callback);
    feature.updateProperties({ label: 'after' });
    callback.mockClear();
    history.undo();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]?.[0]).toMatchObject({
      type: 'update',
      name: `${GM_PREFIX}:edit`,
      feature,
    });
    expect(callback.mock.calls[0]?.[0].features[0].getProperty('label')).toBe('before');
  });

  it('history.subscribe emits one callback per logical history record and detaches', () => {
    const { history, target } = createHistorySubsystem();
    const callback = vi.fn();

    const unsubscribe = history.subscribe(callback);

    expect(callback).toHaveBeenCalledWith(
      history.getState(),
      expect.objectContaining({ type: 'initial', name: null }),
    );

    const entry = history.record([
      {
        kind: 'create',
        ref: { sourceName: 'gm_main', featureId: 'history-feature' },
        before: null,
        after: {
          type: 'Feature',
          id: 'history-feature',
          geometry: { type: 'Point', coordinates: [1, 2] },
          properties: { gm_shape: 'marker' },
        },
      },
    ]);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(
      history.getState(),
      expect.objectContaining({ type: 'record', name: 'gm:historyrecord', entry }),
    );

    unsubscribe();
    target.fire('gm:historychange', { state: history.getState() });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(target.off).toHaveBeenCalledWith('gm:historychange', expect.any(Function));
  });

  it('history.subscribe emits standalone change events without duplicating undo context', () => {
    const { history } = createHistorySubsystem();
    const callback = vi.fn();
    history.record([
      {
        kind: 'create',
        ref: { sourceName: 'gm_main', featureId: 'history-feature' },
        before: null,
        after: {
          type: 'Feature',
          id: 'history-feature',
          geometry: { type: 'Point', coordinates: [1, 2] },
          properties: { gm_shape: 'marker' },
        },
      },
    ]);
    callback.mockClear();

    history.subscribe(callback);
    history.undo();
    history.clear();

    expect(callback.mock.calls.map((call) => call[1]?.type)).toEqual(['initial', 'undo', 'change']);
  });

  it('modes.subscribe emits active mode state immediately, updates once for a full lifecycle sequence, and detaches', () => {
    const { modes, target, activeModes } = createModeController();
    activeModes.add('edit:drag');
    const callback = vi.fn();

    const unsubscribe = modes.subscribe(callback);

    expect(callback).toHaveBeenCalledWith({
      activeDrawModes: [],
      activeEditModes: ['drag'],
      activeHelperModes: [],
      activeModes: [{ type: 'edit', name: 'drag' }],
    });

    activeModes.add('draw:marker');
    target.fire(`${GM_SYSTEM_PREFIX}:draw`, {
      name: `${GM_SYSTEM_PREFIX}:draw:mode`,
      level: 'system',
      actionType: 'draw',
      mode: 'marker',
      action: 'mode_start',
    });
    target.fire(`${GM_SYSTEM_PREFIX}:draw`, {
      name: `${GM_SYSTEM_PREFIX}:draw:mode`,
      level: 'system',
      actionType: 'draw',
      mode: 'marker',
      action: 'mode_started',
    });

    expect(callback).toHaveBeenLastCalledWith({
      activeDrawModes: ['marker'],
      activeEditModes: ['drag'],
      activeHelperModes: [],
      activeModes: [
        { type: 'draw', name: 'marker' },
        { type: 'edit', name: 'drag' },
      ],
    });

    unsubscribe();
    target.fire(`${GM_SYSTEM_PREFIX}:draw`, {
      name: `${GM_SYSTEM_PREFIX}:draw:mode`,
      level: 'system',
      actionType: 'draw',
      mode: 'marker',
      action: 'mode_end',
    });
    target.fire(`${GM_SYSTEM_PREFIX}:draw`, {
      name: `${GM_SYSTEM_PREFIX}:draw:mode`,
      level: 'system',
      actionType: 'draw',
      mode: 'marker',
      action: 'mode_ended',
    });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(target.off).toHaveBeenCalledWith(`${GM_SYSTEM_PREFIX}:draw`, expect.any(Function));
  });
});
