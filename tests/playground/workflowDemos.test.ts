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

vi.mock(
  '../../examples/playground/src/demo-studio/demos/workflow-systems/WorkflowInspector.svelte',
  () => ({
    default: {},
  }),
);

describe('workflowDemos', () => {
  test('enables history undo from the same global history state shown in the inspector', async () => {
    const { workflowDemos } =
      await import('../../examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts');
    const selectedFeature = {
      id: 'workflow-network-a',
      shape: 'line',
      getProperty: vi.fn(() => 'Network A'),
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
    const featureSubscriptionHandlers: Array<() => void> = [];
    const historySubscriptionHandlers: Array<() => void> = [];
    const unsubscribeFeatures = vi.fn();
    const unsubscribeHistory = vi.fn();
    const unsubscribeEditor = vi.fn();
    const editorState = {
      values: { name: 'Network A' },
      properties: { name: 'Network A' },
      dirty: false,
      active: false,
      available: true,
      disposed: false,
      blocked: false,
      canCommit: false,
      canCancel: false,
      canUndo: true,
      canRedo: false,
      validationMessages: [],
      history: history.getState(),
    };
    const editor = {
      getState: vi.fn(() => editorState),
      set: vi.fn(),
      commit: vi.fn(),
      cancel: vi.fn(),
      undo: vi.fn(() => true),
      redo: vi.fn(() => false),
      dispose: vi.fn(),
      subscribe: vi.fn((handler: (state: typeof editorState) => void) => {
        handler(editorState);
        return unsubscribeEditor;
      }),
    };
    const geoForge = {
      features: {
        importGeoJson: vi.fn(() => ({
          stats: { total: 1, success: 1, failed: 0, overwritten: 0 },
          addedFeatures: [selectedFeature],
        })),
        delete: vi.fn(),
        subscribe: vi.fn((handler: () => void) => {
          featureSubscriptionHandlers.push(handler);
          return unsubscribeFeatures;
        }),
      },
      history: {
        ...history,
        subscribe: vi.fn((handler: (state: unknown, event: { type: string }) => void) => {
          historySubscriptionHandlers.push(() => handler(history.getState(), { type: 'change' }));
          handler(history.getState(), { type: 'initial' });
          return unsubscribeHistory;
        }),
      },
      selection: {
        selectFeature: vi.fn(),
      },
      enableSingleFeatureEditMode: vi.fn(),
      disableSingleFeatureEditMode: vi.fn(),
      transactions: {
        getActive: vi.fn(() => null),
        start: vi.fn(),
        featureProperties: vi.fn(() => editor),
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

    expect(editor.undo).toHaveBeenCalledTimes(1);
    expect(history.undo).not.toHaveBeenCalled();
    expect(geoForge.transactions.start).not.toHaveBeenCalled();
    expect(geoForge.transactions.featureProperties).toHaveBeenCalledWith({
      feature: selectedFeature,
      id: 'demo-feature-name-edit',
      label: 'Demo feature name edit',
    });
    expect(inspectorProps.at(-1)?.state.canUndoDemoChange).toBe(true);

    featureSubscriptionHandlers[0]?.();
    historySubscriptionHandlers[0]?.();

    expect(inspectorProps.at(-1)?.state.historyUndoCount).toBe(4);

    result.teardown();

    expect(unsubscribeFeatures).toHaveBeenCalledTimes(1);
    expect(unsubscribeHistory).toHaveBeenCalledTimes(1);
    expect(unsubscribeEditor).toHaveBeenCalledTimes(1);
    expect(editor.dispose).toHaveBeenCalledTimes(1);
  });

  test('snippet demonstrates featureProperties instead of manual transaction lifecycle', async () => {
    const { workflowDemos } =
      await import('../../examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts');
    const snippet = workflowDemos[0].code();

    expect(snippet).toContain('geoForge.transactions.featureProperties');
    expect(snippet).not.toContain('geoForge.transactions.start');
    expect(snippet).not.toContain('geoForge.transactions.getActive');
    expect(snippet).not.toContain('transaction.cancel();\n  const applied = geoForge.history');
    expect(snippet).not.toContain('transactionIsDirty');
    expect(snippet).not.toContain('canUndoHistory');
  });
});
