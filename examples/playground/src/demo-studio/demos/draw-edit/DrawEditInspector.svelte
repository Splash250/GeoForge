<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button, CodeBlock, ControlRow, InspectorSection, SegmentedControl } from '../../ui';

  export type DrawEditShapeTool =
    | 'marker'
    | 'line'
    | 'polygon'
    | 'rectangle'
    | 'circle'
    | 'ellipse'
    | 'text_marker'
    | 'circle_marker';

  export type DrawEditMode = 'drag' | 'change' | 'rotate' | 'cut' | 'delete';

  export type DrawEditDemoState = {
    activeDrawShape: DrawEditShapeTool | '';
    activeEditMode: DrawEditMode | '';
    featureCount: number;
    lastAction: string;
  };

  type DrawEditInspectorProps = {
    state?: DrawEditDemoState;
    onSelectShape?: (shape: DrawEditShapeTool) => void;
    onSelectEditMode?: (mode: DrawEditMode) => void;
    onClearFeatures?: () => void;
    code?: string;
    title?: string;
    description?: string;
  };

  const shapeTools: Array<{ value: DrawEditShapeTool; label: string }> = [
    { value: 'marker', label: 'Marker' },
    { value: 'line', label: 'Line' },
    { value: 'polygon', label: 'Polygon' },
    { value: 'rectangle', label: 'Rect' },
    { value: 'circle', label: 'Circle' },
    { value: 'ellipse', label: 'Ellipse' },
    { value: 'text_marker', label: 'Text' },
    { value: 'circle_marker', label: 'Dot' },
  ];

  const editModeOptions: Array<{ value: DrawEditMode; label: string }> = [
    { value: 'drag', label: 'Drag' },
    { value: 'change', label: 'Change' },
    { value: 'rotate', label: 'Rotate' },
    { value: 'cut', label: 'Cut' },
    { value: 'delete', label: 'Delete' },
  ];

  const emptyDrawEditState: DrawEditDemoState = {
    activeDrawShape: '',
    activeEditMode: '',
    featureCount: 0,
    lastAction: 'Waiting for setup',
  };

  let {
    state: demoState = emptyDrawEditState,
    onSelectShape = () => {},
    onSelectEditMode = () => {},
    onClearFeatures = () => {},
    code = '',
    title = 'Draw and edit modes',
    description,
  }: DrawEditInspectorProps = $props();

  let copied = $state(false);
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

  function handleEditModeChange(value: string) {
    onSelectEditMode(value as DrawEditMode);
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

  <div class="rows">
    <ControlRow label="Features">{demoState.featureCount}</ControlRow>
    <ControlRow label="Draw mode">{demoState.activeDrawShape || 'Off'}</ControlRow>
    <ControlRow label="Edit mode">{demoState.activeEditMode || 'Off'}</ControlRow>
    <ControlRow label="Last action">{demoState.lastAction}</ControlRow>
  </div>
</InspectorSection>

<InspectorSection title="Shape tools">
  <div class="shape-grid" role="group" aria-label="Shape drawing tools">
    {#each shapeTools as shapeTool}
      <button
        type="button"
        class:active={shapeTool.value === demoState.activeDrawShape}
        aria-pressed={shapeTool.value === demoState.activeDrawShape}
        onclick={() => onSelectShape(shapeTool.value)}
      >
        {shapeTool.label}
      </button>
    {/each}
  </div>
</InspectorSection>

<InspectorSection title="Edit mode">
  <SegmentedControl
    class="edit-mode-control"
    label="Edit mode"
    value={demoState.activeEditMode}
    options={editModeOptions}
    onChange={handleEditModeChange}
  />
</InspectorSection>

<InspectorSection title="Features">
  <Button variant="danger" disabled={demoState.featureCount === 0} onclick={onClearFeatures}>
    Clear features
  </Button>
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

  .rows {
    display: grid;
  }

  .shape-grid {
    width: min(360px, 100%);
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .shape-grid button {
    min-width: 0;
    min-height: var(--gf-control-height);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-tool);
    padding: 0 10px;
    background: var(--gf-raised);
    color: var(--gf-body);
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      background-color 140ms ease,
      color 140ms ease;
  }

  .shape-grid button:hover {
    border-color: color-mix(in srgb, var(--gf-body) 78%, var(--gf-text));
    background: var(--gf-overlay);
    color: var(--gf-text);
  }

  .shape-grid button.active {
    border-color: var(--gf-blue);
    background: var(--gf-blue);
    color: var(--gf-text);
  }

  :global(.edit-mode-control) {
    width: min(260px, 100%);
  }
</style>
