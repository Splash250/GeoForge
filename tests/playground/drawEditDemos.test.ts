import { describe, expect, test, vi } from 'vitest';
import type { FeatureData } from '../../src/core/features/feature-data.ts';
import type { DemoContext } from '../../examples/playground/src/demo-studio/registry/types.ts';

type DrawEditInspectorProps = {
  state: { featureCount: number; lastAction: string };
  onSelectShape: (shape: 'marker') => void;
  onClearFeatures: () => void;
};

type FeatureDouble = Pick<FeatureData, 'id'> & { temporary: boolean };

vi.mock(
  '../../examples/playground/src/demo-studio/demos/draw-edit/DrawEditInspector.svelte',
  () => ({
    default: {},
  }),
);

describe('drawEditDemos', () => {
  test('counts seeded features from the in-memory feature store immediately after import', async () => {
    const { drawEditDemos } =
      await import('../../examples/playground/src/demo-studio/demos/draw-edit/drawEditDemos.ts');
    const featureStore = new Map<string, FeatureDouble>([
      ['main:seed-1', { id: 'seed-1', temporary: false }],
      ['main:seed-2', { id: 'seed-2', temporary: false }],
    ]);
    const inspectorProps: DrawEditInspectorProps[] = [];
    const mutationHandlers = new Map<string, () => void>();

    const geoForge = {
      features: {
        featureStore,
        exportGeoJson: () => ({ type: 'FeatureCollection', features: [] }),
        importGeoJson: vi.fn(() => ({
          stats: { total: 2, success: 2, failed: 0, overwritten: 0 },
          addedFeatures: Array.from(featureStore.values()),
        })),
        deleteAll: vi.fn(() => featureStore.clear()),
      },
      history: {
        suspend: vi.fn(<TResult>(callback: () => TResult) => callback()),
      },
      disableAllModes: vi.fn(),
      enableDraw: vi.fn(),
      enableGlobalDragMode: vi.fn(),
      enableGlobalEditMode: vi.fn(),
      enableGlobalRotateMode: vi.fn(),
      enableGlobalCutMode: vi.fn(),
      enableGlobalRemovalMode: vi.fn(),
    };
    const map = {
      on: vi.fn((eventName: string, handler: () => void) => {
        mutationHandlers.set(eventName, handler);
      }),
      off: vi.fn(),
    };
    const context: DemoContext = {
      geoForge: geoForge as unknown as DemoContext['geoForge'],
      map: map as unknown as DemoContext['map'],
      signal: new AbortController().signal,
      isCurrent: () => true,
      setInspectorProps: (props) => inspectorProps.push(props as DrawEditInspectorProps),
      setCode: vi.fn(),
      logEvent: vi.fn(),
      notify: vi.fn(),
    };

    const result = await Promise.resolve(drawEditDemos[0].setup(context));
    const resultInspectorProps = result.inspectorProps as DrawEditInspectorProps;

    expect(geoForge.features.exportGeoJson().features).toHaveLength(0);
    expect(featureStore.size).toBe(2);
    expect(resultInspectorProps.state.featureCount).toBe(2);
    expect(resultInspectorProps.state.lastAction).toBe('Seeded sample features');
    expect(inspectorProps.at(-1)?.state.featureCount).toBe(2);
    expect(geoForge.features.importGeoJson).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ overwrite: true, history: false }),
    );
    expect(geoForge.history.suspend).not.toHaveBeenCalled();

    resultInspectorProps.onClearFeatures();

    expect(inspectorProps.at(-1)?.state.featureCount).toBe(0);
    expect(inspectorProps.at(-1)?.state.lastAction).toBe('Features cleared');
    expect(geoForge.features.deleteAll).toHaveBeenLastCalledWith({ history: false });

    resultInspectorProps.onSelectShape('marker');

    expect(geoForge.history.suspend).not.toHaveBeenCalled();

    featureStore.set('main:drawn-1', { id: 'drawn-1', temporary: false });
    featureStore.set('temporary:helper-1', { id: 'helper-1', temporary: true });
    mutationHandlers.get('gm:create')?.();

    expect(inspectorProps.at(-1)?.state.featureCount).toBe(1);
    expect(inspectorProps.at(-1)?.state.lastAction).toBe('Feature collection updated');
  });
});
