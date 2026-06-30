import type {
  FeatureData,
  GeoJsonImportFeatureCollection,
  GeomanFeaturePropertyEditor,
  GeomanTransactionCommitResult,
} from 'maplibre-geoforge';
import type { DemoContext, DemoDefinition } from '../../registry/types.ts';
import { sampleNetworkGeoJson } from '../shared/sampleGeoJson.ts';
import WorkflowInspector from './WorkflowInspector.svelte';

type WorkflowDemoState = {
  selectedFeatureId: string;
  selectedFeatureName: string;
  transactionStatus: string;
  transactionDirty: boolean;
  historyCanUndo: boolean;
  historyCanRedo: boolean;
  historyUndoCount: number;
  historyRedoCount: number;
  canUndoDemoChange: boolean;
  canRedoDemoChange: boolean;
  lastAction: string;
};

type WorkflowInspectorProps = {
  state: WorkflowDemoState;
  onNameInput: (nextName: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

const transactionId = 'demo-feature-name-edit';
const typedSampleNetworkGeoJson = sampleNetworkGeoJson as GeoJsonImportFeatureCollection;
const workflowSampleNetworkGeoJson = {
  ...typedSampleNetworkGeoJson,
  features: typedSampleNetworkGeoJson.features.map((feature) => ({
    ...feature,
    id: `workflow-${String(feature.id ?? feature.properties?.name ?? 'network')}`.toLowerCase(),
    properties: {
      ...feature.properties,
    },
  })),
} satisfies GeoJsonImportFeatureCollection;

export const workflowDemos: DemoDefinition<WorkflowInspectorProps>[] = [
  {
    id: 'workflow-systems-transactions',
    title: 'Transactions',
    description: 'Preview feature property edits, commit or cancel them, and step through history.',
    docsPath: '/docs/context-panels',
    sourcePath: 'examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts',
    code: () => buildWorkflowSnippet(),
    inspector: WorkflowInspector,
    setup: (context) => {
      const { geoForge } = context;
      const isActive = () => !context.signal.aborted && context.isCurrent();

      if (!isActive()) {
        return { teardown: () => {} };
      }

      let importedFeatures: FeatureData[] = [];
      let singleFeatureEditActivated = false;
      let unsubscribeFeatures: (() => void) | null = null;
      let unsubscribeHistory: (() => void) | null = null;
      let unsubscribeEditor: (() => void) | null = null;
      let propertyEditor: GeomanFeaturePropertyEditor | null = null;
      let state: WorkflowDemoState;

      const cleanupImportedFeatures = () => {
        runWithoutHistory(geoForge, () => {
          importedFeatures.forEach((feature) => {
            geoForge.features.delete(feature);
          });
        });
      };

      try {
        const importResult = geoForge.features.importGeoJson(workflowSampleNetworkGeoJson, {
          history: false,
        });
        importedFeatures = importResult.addedFeatures;
        const selectedFeature = importedFeatures.find((feature) => feature.shape === 'line');

        if (!selectedFeature) {
          throw new Error('Workflow transaction demo could not import a selectable line feature.');
        }

        const getSelectedName = () => readFeatureName(selectedFeature);

        const buildState = (lastAction: string): WorkflowDemoState => {
          const editorState = propertyEditor?.getState();
          const historyState = editorState?.history ?? geoForge.history.getState();
          const transactionStatus = editorState?.blocked
            ? 'blocked'
            : editorState?.active
              ? 'active'
              : 'inactive';
          const selectedFeatureName =
            typeof editorState?.values.name === 'string'
              ? editorState.values.name
              : getSelectedName();

          return {
            selectedFeatureId: String(selectedFeature.id),
            selectedFeatureName,
            transactionStatus,
            transactionDirty: editorState?.dirty ?? false,
            historyCanUndo: historyState.canUndo,
            historyCanRedo: historyState.canRedo,
            historyUndoCount: historyState.undoCount,
            historyRedoCount: historyState.redoCount,
            canUndoDemoChange: editorState?.canUndo ?? historyState.canUndo,
            canRedoDemoChange: editorState?.canRedo ?? historyState.canRedo,
            lastAction,
          };
        };

        const updateRuntime = (lastAction = state.lastAction) => {
          if (!isActive()) {
            return;
          }

          state = buildState(lastAction);
          context.setInspectorProps({
            state,
            onNameInput,
            onCommit,
            onCancel,
            onUndo,
            onRedo,
          });
          context.setCode(buildWorkflowSnippet());
        };

        const refreshFeatureState = () => {
          updateRuntime('Feature collection updated');
        };

        const refreshHistoryState = () => {
          updateRuntime('History state updated');
        };

        const onNameInput = (nextName: string) => {
          if (!isActive()) {
            return;
          }

          propertyEditor?.set('name', nextName);
          updateRuntime('Previewing name change');
        };

        const onCommit = () => {
          if (!isActive()) {
            return;
          }

          const result = propertyEditor?.commit() ?? {
            committed: true,
            messages: [],
            historyEntryId: null,
          };
          const lastAction = formatCommitResult(result);
          if (!isActive()) {
            return;
          }

          updateRuntime(lastAction);
          context.notify({
            title: result.committed ? 'Transaction committed' : 'Transaction blocked',
            body: formatCommitToastBody(result),
            tone: result.committed ? (result.historyEntryId ? 'success' : 'info') : 'error',
          });
          context.logEvent({
            name: 'workflow-systems:transaction-committed',
            category: 'demo-studio',
            payload: result,
          });
        };

        const onCancel = () => {
          if (!isActive()) {
            return;
          }

          propertyEditor?.cancel();
          updateRuntime('Cancelled preview and restored the selected feature name');
          context.logEvent({
            name: 'workflow-systems:transaction-cancelled',
            category: 'demo-studio',
            payload: { selectedFeatureId: selectedFeature.id },
          });
        };

        const onUndo = () => {
          if (!isActive()) {
            return;
          }

          const applied = propertyEditor?.undo() ?? false;
          updateRuntime(applied ? 'Undid last transaction' : 'Nothing to undo');
          context.logEvent({
            name: 'workflow-systems:history-undo',
            category: 'demo-studio',
            payload: {
              applied,
              history: geoForge.history.getState(),
              selectedFeatureId: selectedFeature.id,
            },
          });
        };

        const onRedo = () => {
          if (!isActive()) {
            return;
          }

          const applied = propertyEditor?.redo() ?? false;
          updateRuntime(applied ? 'Redid last transaction' : 'Nothing to redo');
          context.logEvent({
            name: 'workflow-systems:history-redo',
            category: 'demo-studio',
            payload: {
              applied,
              history: geoForge.history.getState(),
              selectedFeatureId: selectedFeature.id,
            },
          });
        };

        geoForge.enableSingleFeatureEditMode({ allowedShapes: ['line'] });
        singleFeatureEditActivated = true;
        geoForge.selection.selectFeature(selectedFeature, { reason: 'api' });
        propertyEditor = geoForge.transactions.featureProperties({
          feature: selectedFeature,
          id: transactionId,
          label: 'Demo feature name edit',
        });
        state = buildState('Ready for a transaction-backed name edit');
        unsubscribeEditor = propertyEditor.subscribe(() => {
          updateRuntime('Feature property editor updated');
        });
        unsubscribeFeatures = geoForge.features.subscribe(refreshFeatureState);
        unsubscribeHistory = geoForge.history.subscribe((_historyState, event) => {
          if (event.type !== 'initial') {
            refreshHistoryState();
          }
        });
        updateRuntime(state.lastAction);

        context.logEvent({
          name: 'workflow-systems:transactions-ready',
          category: 'demo-studio',
          payload: {
            stats: importResult.stats,
            featureIds: importedFeatures.map((feature) => feature.id),
            selectedFeatureId: selectedFeature.id,
            history: geoForge.history.getState(),
          },
        });
        context.notify({
          title: 'Transactions ready',
          body: `Selected ${String(selectedFeature.id)} for transaction-backed name edits.`,
          tone: 'success',
        });

        return {
          inspectorProps: {
            state,
            onNameInput,
            onCommit,
            onCancel,
            onUndo,
            onRedo,
          },
          code: buildWorkflowSnippet(),
          teardown: () => {
            unsubscribeEditor?.();
            unsubscribeFeatures?.();
            unsubscribeHistory?.();
            propertyEditor?.dispose();
            if (singleFeatureEditActivated) {
              geoForge.disableSingleFeatureEditMode();
            }
            cleanupImportedFeatures();
          },
        };
      } catch (error) {
        unsubscribeEditor?.();
        unsubscribeFeatures?.();
        unsubscribeHistory?.();
        propertyEditor?.dispose();
        if (singleFeatureEditActivated) {
          geoForge.disableSingleFeatureEditMode();
        }
        cleanupImportedFeatures();
        if (isActive()) {
          context.notify({
            title: 'Transactions setup failed',
            body:
              error instanceof Error ? error.message : 'Workflow transaction demo setup failed.',
            tone: 'error',
          });
        }
        throw error;
      }
    },
  },
];

function readFeatureName(feature: FeatureData | null | undefined) {
  return feature?.getProperty<string>('name') ?? '';
}

function formatCommitResult(result: GeomanTransactionCommitResult) {
  if (!result.committed) {
    return result.messages.length ? result.messages.join(' ') : 'Transaction commit was blocked';
  }

  return result.historyEntryId
    ? `Committed transaction as ${result.historyEntryId}`
    : 'Committed transaction without a history entry';
}

function formatCommitToastBody(result: GeomanTransactionCommitResult) {
  if (!result.committed) {
    return result.messages.length
      ? result.messages.join(' ')
      : 'Transaction validation blocked the commit.';
  }

  return result.historyEntryId
    ? `History entry: ${result.historyEntryId}`
    : 'Committed successfully, but no history entry was recorded.';
}

function runWithoutHistory<T>(geoForge: DemoContext['geoForge'], callback: () => T): T {
  const history = geoForge.history as { suspend?: <TResult>(callback: () => TResult) => TResult };

  return history.suspend ? history.suspend(callback) : callback();
}

function buildWorkflowSnippet() {
  return `import { sampleNetworkGeoJson } from '../shared/sampleGeoJson';

const workflowSampleNetworkGeoJson = {
  ...sampleNetworkGeoJson,
  features: sampleNetworkGeoJson.features.map((feature) => ({
    ...feature,
    id: \`workflow-\${String(feature.id ?? feature.properties?.name ?? 'network')}\`.toLowerCase(),
    properties: { ...feature.properties },
  })),
};

function runWithoutHistory(callback) {
  const suspend = geoForge.history.suspend?.bind(geoForge.history);
  return suspend ? suspend(callback) : callback();
}

function cleanupImportedFeatures() {
  runWithoutHistory(() => {
    addedFeatures.forEach((addedFeature) => {
      geoForge.features.delete(addedFeature);
    });
  });
}

let editor;
let addedFeatures = [];
let feature;
let unsubscribeFeatures;
let unsubscribeHistory;
let unsubscribeEditor;

try {
  const importResult = geoForge.features.importGeoJson(workflowSampleNetworkGeoJson, {
    history: false,
  });
  addedFeatures = importResult.addedFeatures;
  feature = addedFeatures.find((candidate) => candidate.shape === 'line');

  if (!feature) {
    throw new Error('Workflow transaction demo could not import a selectable line feature.');
  }

  geoForge.enableSingleFeatureEditMode({ allowedShapes: ['line'] });
  geoForge.selection.selectFeature(feature, { reason: 'api' });
  editor = geoForge.transactions.featureProperties({
    feature,
    id: '${transactionId}',
    label: 'Demo feature name edit',
  });

  unsubscribeEditor = editor.subscribe((state) => {
    console.log('Feature property editor state', state);
  });
  unsubscribeFeatures = geoForge.features.subscribe(() => {
    console.log('Selected feature changed', feature.getProperty('name'));
  });
  unsubscribeHistory = geoForge.history.subscribe((state, event) => {
    if (event.type !== 'initial') {
      console.log('History controls changed', state);
    }
  });
} catch (error) {
  editor?.dispose();
  geoForge.disableSingleFeatureEditMode();
  cleanupImportedFeatures();
  throw error;
}

function updateName(nextName) {
  editor.set('name', nextName);
}

function commitName() {
  const result = editor.commit();
  console.log(result, editor.getState());
}

function cancelName() {
  editor.cancel();
  console.log(feature.getProperty('name'), editor.getState());
}

function undoName() {
  return editor.undo();
}

function redoName() {
  return editor.redo();
}

// Demo cleanup:
unsubscribeEditor?.();
unsubscribeFeatures?.();
unsubscribeHistory?.();
editor?.dispose();
geoForge.disableSingleFeatureEditMode();
cleanupImportedFeatures();`;
}
