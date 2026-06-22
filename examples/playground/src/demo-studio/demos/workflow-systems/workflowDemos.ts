import type {
  FeatureData,
  GeoJsonImportFeatureCollection,
  GeomanTransaction,
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
const workflowMutationEventNames = [
  'gm:edit',
  'gm:drag',
  'gm:historychange',
  'gm:historyrecord',
] as const;
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
    code: () => buildWorkflowSnippet(),
    inspector: WorkflowInspector,
    setup: (context) => {
      const { geoForge } = context;
      const isActive = () => !context.signal.aborted && context.isCurrent();

      if (!isActive()) {
        return { teardown: () => {} };
      }

      let activeTransaction: GeomanTransaction | null = null;
      let importedFeatures: FeatureData[] = [];
      let singleFeatureEditActivated = false;
      let workflowMutationHandler: (() => void) | null = null;
      let state: WorkflowDemoState;

      const cancelDemoTransaction = () => {
        const transaction = activeTransaction;
        if (transaction?.status === 'active') {
          transaction.cancel();
        }
        activeTransaction = null;
      };

      const cleanupImportedFeatures = () => {
        runWithoutHistory(geoForge, () => {
          importedFeatures.forEach((feature) => {
            geoForge.features.delete(feature);
          });
        });
      };

      if (geoForge.transactions.getActive()?.status === 'active') {
        const message = 'Workflow transaction demo requires no active transaction before setup.';
        context.notify({
          title: 'Transactions setup blocked',
          body: message,
          tone: 'error',
        });
        throw new Error(message);
      }

      try {
        const importResult = runWithoutHistory(geoForge, () =>
          geoForge.features.importGeoJson(workflowSampleNetworkGeoJson),
        );
        importedFeatures = importResult.addedFeatures;
        const selectedFeature = importedFeatures.find((feature) => feature.shape === 'line');

        if (!selectedFeature) {
          throw new Error('Workflow transaction demo could not import a selectable line feature.');
        }

        const getSelectedName = () => readFeatureName(selectedFeature);

        const ensureActiveTransaction = () => {
          if (!isActive()) {
            return null;
          }

          if (activeTransaction?.status === 'active') {
            return activeTransaction;
          }

          if (geoForge.transactions.getActive()?.status === 'active') {
            throw new Error('Workflow transaction demo cannot start while another transaction is active.');
          }

          activeTransaction = geoForge.transactions.start({ id: transactionId });
          return activeTransaction;
        };

        const canUndoHistoryChange = (transactionDirty: boolean) => {
          const historyState = geoForge.history.getState();

          return !transactionDirty && historyState.canUndo;
        };

        const canRedoHistoryChange = (transactionDirty: boolean) => {
          const historyState = geoForge.history.getState();

          return !transactionDirty && historyState.canRedo;
        };

        const buildState = (lastAction: string): WorkflowDemoState => {
          const historyState = geoForge.history.getState();
          const transactionStatus = activeTransaction?.status ?? 'inactive';
          const transactionDirty =
            activeTransaction?.status === 'active' ? activeTransaction.isDirty() : false;

          return {
            selectedFeatureId: String(selectedFeature.id),
            selectedFeatureName: getSelectedName(),
            transactionStatus,
            transactionDirty,
            historyCanUndo: historyState.canUndo,
            historyCanRedo: historyState.canRedo,
            historyUndoCount: historyState.undoCount,
            historyRedoCount: historyState.redoCount,
            canUndoDemoChange: canUndoHistoryChange(transactionDirty),
            canRedoDemoChange: canRedoHistoryChange(transactionDirty),
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

        const handleWorkflowMutation = () => {
          updateRuntime('Map edit history updated');
        };
        workflowMutationHandler = handleWorkflowMutation;

        const onNameInput = (nextName: string) => {
          if (!isActive()) {
            return;
          }

          const transaction = ensureActiveTransaction();
          if (!transaction) {
            return;
          }

          transaction.updateProperty(selectedFeature, 'name', nextName);
          updateRuntime('Previewing name change');
        };

        const onCommit = () => {
          if (!isActive()) {
            return;
          }

          const transaction = ensureActiveTransaction();
          if (!transaction) {
            return;
          }

          const result = transaction.commit();
          const lastAction = formatCommitResult(result);
          if (!isActive()) {
            return;
          }

          if (result.committed) {
            activeTransaction = null;
            ensureActiveTransaction();
          } else {
            activeTransaction = transaction;
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

          if (activeTransaction?.status === 'active') {
            activeTransaction.cancel();
          }
          activeTransaction = null;
          ensureActiveTransaction();
          updateRuntime('Cancelled preview and restored the selected feature name');
          context.logEvent({
            name: 'workflow-systems:transaction-cancelled',
            category: 'demo-studio',
            payload: { selectedFeatureId: selectedFeature.id },
          });
        };

        const applyHistory = (direction: 'undo' | 'redo') => {
          if (!isActive()) {
            return;
          }

          if (activeTransaction?.status === 'active') {
            activeTransaction.cancel();
          }
          activeTransaction = null;

          const applied = direction === 'undo' ? geoForge.history.undo() : geoForge.history.redo();
          ensureActiveTransaction();
          updateRuntime(
            applied
              ? `${direction === 'undo' ? 'Undid' : 'Redid'} last transaction`
              : `Nothing to ${direction}`,
          );
          context.logEvent({
            name: `workflow-systems:history-${direction}`,
            category: 'demo-studio',
            payload: {
              applied,
              history: geoForge.history.getState(),
              selectedFeatureId: selectedFeature.id,
            },
          });
        };

        const onUndo = () => {
          if (!isActive()) {
            return;
          }

          if (!canUndoHistoryChange(activeTransaction?.isDirty() ?? false)) {
            updateRuntime('No history entry to undo');
            return;
          }

          applyHistory('undo');
        };

        const onRedo = () => {
          if (!isActive()) {
            return;
          }

          if (!canRedoHistoryChange(activeTransaction?.isDirty() ?? false)) {
            updateRuntime('No history entry to redo');
            return;
          }

          applyHistory('redo');
        };

        geoForge.enableSingleFeatureEditMode({ allowedShapes: ['line'] });
        singleFeatureEditActivated = true;
        geoForge.selection.selectFeature(selectedFeature, { reason: 'api' });
        workflowMutationEventNames.forEach((eventName) => {
          context.map.on(eventName, handleWorkflowMutation);
        });
        ensureActiveTransaction();
        state = buildState('Ready for a transaction-backed name edit');
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
            workflowMutationEventNames.forEach((eventName) => {
              context.map.off(eventName, handleWorkflowMutation);
            });
            cancelDemoTransaction();
            if (singleFeatureEditActivated) {
              geoForge.disableSingleFeatureEditMode();
            }
            cleanupImportedFeatures();
          },
        };
      } catch (error) {
        const handler = workflowMutationHandler;
        if (handler) {
          workflowMutationEventNames.forEach((eventName) => {
            context.map.off(eventName, handler);
          });
          workflowMutationHandler = null;
        }
        cancelDemoTransaction();
        if (singleFeatureEditActivated) {
          geoForge.disableSingleFeatureEditMode();
        }
        cleanupImportedFeatures();
        if (isActive()) {
          context.notify({
            title: 'Transactions setup failed',
            body: error instanceof Error ? error.message : 'Workflow transaction demo setup failed.',
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

if (geoForge.transactions.getActive()?.status === 'active') {
  throw new Error('Workflow transaction demo requires no active transaction before setup.');
}

let transaction;
let addedFeatures = [];
let feature;

try {
  const importResult = runWithoutHistory(() =>
    geoForge.features.importGeoJson(workflowSampleNetworkGeoJson),
  );
  addedFeatures = importResult.addedFeatures;
  feature = addedFeatures.find((candidate) => candidate.shape === 'line');

  if (!feature) {
    throw new Error('Workflow transaction demo could not import a selectable line feature.');
  }

  geoForge.enableSingleFeatureEditMode({ allowedShapes: ['line'] });
  geoForge.selection.selectFeature(feature, { reason: 'api' });
  transaction = geoForge.transactions.start({ id: '${transactionId}' });
} catch (error) {
  transaction?.cancel();
  geoForge.disableSingleFeatureEditMode();
  cleanupImportedFeatures();
  throw error;
}

function updateName(nextName) {
  if (!feature) return;
  if (transaction.status !== 'active') {
    if (geoForge.transactions.getActive()?.status === 'active') {
      throw new Error('Workflow transaction demo cannot start while another transaction is active.');
    }
    transaction = geoForge.transactions.start({ id: '${transactionId}' });
  }
  transaction.updateProperty(feature, 'name', nextName);
}

function commitName() {
  const result = transaction.commit();
  console.log(result, geoForge.history.getState());
  if (result.committed) {
    transaction = geoForge.transactions.start({ id: '${transactionId}' });
  }
}

function cancelName() {
  transaction.cancel();
  console.log(feature.getProperty('name'), geoForge.history.getState());
  transaction = geoForge.transactions.start({ id: '${transactionId}' });
}

function transactionIsDirty() {
  return transaction?.status === 'active' ? transaction.isDirty() : false;
}

function canUndoHistory() {
  return !transactionIsDirty() && geoForge.history.getState().canUndo;
}

function canRedoHistory() {
  return !transactionIsDirty() && geoForge.history.getState().canRedo;
}

function undoName() {
  if (!canUndoHistory()) {
    return false;
  }
  transaction.cancel();
  const applied = geoForge.history.undo();
  transaction = geoForge.transactions.start({ id: '${transactionId}' });
  return applied;
}

function redoName() {
  if (!canRedoHistory()) {
    return false;
  }
  transaction.cancel();
  const applied = geoForge.history.redo();
  transaction = geoForge.transactions.start({ id: '${transactionId}' });
  return applied;
}

// Demo cleanup:
transaction?.cancel();
geoForge.disableSingleFeatureEditMode();
cleanupImportedFeatures();`;
}
