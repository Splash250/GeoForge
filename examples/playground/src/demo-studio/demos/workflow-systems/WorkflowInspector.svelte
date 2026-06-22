<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button, CodeBlock, ControlRow, InspectorSection } from '../../ui';

  export type WorkflowInspectorState = {
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
    state?: WorkflowInspectorState;
    onNameInput?: (nextName: string) => void;
    onCommit?: () => void;
    onCancel?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    code?: string;
    title?: string;
    description?: string;
  };

  const emptyWorkflowState: WorkflowInspectorState = {
    selectedFeatureId: '',
    selectedFeatureName: '',
    transactionStatus: 'inactive',
    transactionDirty: false,
    historyCanUndo: false,
    historyCanRedo: false,
    historyUndoCount: 0,
    historyRedoCount: 0,
    canUndoDemoChange: false,
    canRedoDemoChange: false,
    lastAction: 'Waiting for setup',
  };

  let {
    state: demoState = emptyWorkflowState,
    onNameInput = () => {},
    onCommit = () => {},
    onCancel = () => {},
    onUndo = () => {},
    onRedo = () => {},
    code = '',
    title = 'Transactions',
    description,
  }: WorkflowInspectorProps = $props();

  let copied = $state(false);
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

  function handleNameInput(event: Event) {
    onNameInput((event.currentTarget as HTMLInputElement).value);
  }

  async function copyCode(value: string) {
    const clipboard = navigator.clipboard;

    if (!clipboard?.writeText) {
      return;
    }

    try {
      await clipboard.writeText.call(clipboard, value);
      copied = true;
      clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => {
        copied = false;
      }, 1400);
    } catch {
      copied = false;
    }
  }

  onDestroy(() => clearTimeout(copyResetTimer));
</script>

<InspectorSection {title}>
  {#if description}
    <p class="description">{description}</p>
  {/if}

  <div class="section-stack">
    <ControlRow label="Selected feature">{demoState.selectedFeatureId || 'None'}</ControlRow>

    <label class="name-field" for="workflow-feature-name">
      <span>Name</span>
      <input
        id="workflow-feature-name"
        type="text"
        value={demoState.selectedFeatureName}
        placeholder="Feature name"
        autocomplete="off"
        oninput={handleNameInput}
      />
    </label>
  </div>
</InspectorSection>

<InspectorSection title="Transaction">
  <div class="section-stack">
    <ControlRow label="Status">{demoState.transactionStatus}</ControlRow>
    <ControlRow label="Dirty">{demoState.transactionDirty ? 'Yes' : 'No'}</ControlRow>
  </div>

  <div class="action-strip" aria-label="Transaction actions">
    <Button variant="primary" disabled={!demoState.transactionDirty} onclick={onCommit}>
      Commit
    </Button>
    <Button variant="secondary" disabled={!demoState.transactionDirty} onclick={onCancel}>
      Cancel
    </Button>
  </div>

  <p class="last-action">{demoState.lastAction}</p>
</InspectorSection>

<InspectorSection title="History">
  <div class="section-stack">
    <ControlRow label="Can undo">
      {demoState.historyCanUndo ? 'Yes' : 'No'} ({demoState.historyUndoCount})
    </ControlRow>
    <ControlRow label="Can redo">
      {demoState.historyCanRedo ? 'Yes' : 'No'} ({demoState.historyRedoCount})
    </ControlRow>
  </div>

  <div class="action-strip" aria-label="History actions">
    <Button variant="secondary" disabled={!demoState.canUndoDemoChange} onclick={onUndo}>
      Undo
    </Button>
    <Button variant="secondary" disabled={!demoState.canRedoDemoChange} onclick={onRedo}>
      Redo
    </Button>
  </div>
</InspectorSection>

<InspectorSection title="Code">
  <CodeBlock {code} {copied} onCopy={copyCode} />
</InspectorSection>

<style>
  .description {
    margin-bottom: 12px;
    color: var(--gf-body);
    font-size: 13px;
    line-height: 1.5;
  }

  .section-stack {
    display: grid;
  }

  .name-field {
    min-height: 40px;
    display: grid;
    grid-template-columns: minmax(78px, 36%) minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    border-top: 1px solid var(--gf-line);
    color: var(--gf-body);
    font-size: 13px;
    line-height: 1.35;
  }

  .name-field span {
    color: var(--gf-body);
    font-weight: 500;
  }

  .name-field input {
    width: min(360px, 100%);
    min-width: 0;
    min-height: var(--gf-control-height);
    justify-self: start;
    border: 1px solid color-mix(in srgb, var(--gf-line) 82%, #252a31);
    border-radius: var(--gf-radius-tool);
    padding: 0 10px;
    background: var(--gf-code);
    color: var(--gf-text);
    font-size: 13px;
    font-weight: 650;
  }

  .name-field input::placeholder {
    color: var(--gf-muted);
  }

  .action-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px;
    margin-top: 12px;
  }

  .action-strip :global(button) {
    flex: 0 0 auto;
    width: auto;
    max-width: 100%;
  }

  .last-action {
    margin-top: 10px;
    color: var(--gf-body);
    font-size: 12px;
    line-height: 1.45;
  }
</style>
