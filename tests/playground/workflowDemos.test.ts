import { describe, expect, test, vi } from 'vitest';
import type { DemoContext } from '../../examples/playground/src/demo-studio/registry/types.ts';

type WorkflowInspectorProps = {
  state: {
    historyCanUndo: boolean;
    historyUndoCount: number;
    canUndoDemoChange: boolean;
    canRedoDemoChange: boolean;
  };
  onUndo: () => void;
};

vi.mock('../../examples/playground/src/demo-studio/demos/workflow-systems/WorkflowInspector.svelte', () => ({
  default: {},
}));

describe('workflowDemos', () => {
  test('enables history undo from the same global history state shown in the inspector', async () => {
    const { workflowDemos } = await import(
      '../../examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts'
    );
    const selectedFeature = {
      id: 'workflow-network-a',
      shape: 'line',
      getProperty: vi.fn(() => 'Network A'),
    };
    const transaction = {
      status: 'active',
      isDirty: vi.fn(() => false),
      cancel: vi.fn(),
      updateProperty: vi.fn(),
      commit: vi.fn(),
    };
    const history = {
      getState: vi.fn(() => ({
        canUndo: true,
        canRedo: false,
        undoCount: 4,
        redoCount: 0,
        maxEntries: 100,
        enabled: true,
      })),
      suspend: vi.fn(<TResult>(callback: () => TResult) => callback()),
      undo: vi.fn(() => true),
      redo: vi.fn(() => false),
    };
    const inspectorProps: WorkflowInspectorProps[] = [];
    const geoForge = {
      features: {
        importGeoJson: vi.fn(() => ({
          stats: { total: 1, success: 1, failed: 0, overwritten: 0 },
          addedFeatures: [selectedFeature],
        })),
        delete: vi.fn(),
      },
      history,
      selection: {
        selectFeature: vi.fn(),
      },
      enableSingleFeatureEditMode: vi.fn(),
      disableSingleFeatureEditMode: vi.fn(),
      transactions: {
        getActive: vi.fn(() => null),
        start: vi.fn(() => transaction),
      },
    };
    const context: DemoContext = {
      geoForge: geoForge as unknown as DemoContext['geoForge'],
      map: {
        on: vi.fn(),
        off: vi.fn(),
      } as unknown as DemoContext['map'],
      signal: new AbortController().signal,
      isCurrent: () => true,
      setInspectorProps: (props) => inspectorProps.push(props as WorkflowInspectorProps),
      setCode: vi.fn(),
      logEvent: vi.fn(),
      notify: vi.fn(),
    };

    const result = await Promise.resolve(workflowDemos[0].setup(context));
    const resultInspectorProps = result.inspectorProps as WorkflowInspectorProps;

    expect(resultInspectorProps.state.historyCanUndo).toBe(true);
    expect(resultInspectorProps.state.historyUndoCount).toBe(4);
    expect(resultInspectorProps.state.canUndoDemoChange).toBe(true);
    expect(resultInspectorProps.state.canRedoDemoChange).toBe(false);
    expect(geoForge.enableSingleFeatureEditMode).toHaveBeenCalledWith({ allowedShapes: ['line'] });

    resultInspectorProps.onUndo();

    expect(transaction.cancel).toHaveBeenCalledTimes(1);
    expect(history.undo).toHaveBeenCalledTimes(1);
    expect(inspectorProps.at(-1)?.state.canUndoDemoChange).toBe(true);
  });
});
