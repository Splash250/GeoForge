<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    Button,
    CodeBlock,
    ControlRow,
    InspectorSection,
    SegmentedControl,
    ToggleSwitch,
  } from '../../ui/index.ts';
  import type { HtmlOverlayPointerMode } from 'maplibre-geoforge';

  type OverlayPointerDemoState = {
    interactable: boolean;
    pointerMode: HtmlOverlayPointerMode;
    mapPitched: boolean;
  };

  type OverlayPointerInspectorProps = {
    state?: OverlayPointerDemoState;
    onStateChange?: (state: OverlayPointerDemoState) => void;
    onPitchToggle?: () => void;
    onReset?: () => void;
    code?: string;
    title?: string;
    description?: string;
  };

  const pointerModeOptions = [
    { value: 'selected', label: 'Selected' },
    { value: 'always', label: 'Always' },
    { value: 'none', label: 'None' },
  ];

  const emptyPointerState: OverlayPointerDemoState = {
    interactable: true,
    pointerMode: 'selected',
    mapPitched: false,
  };

  let {
    state: demoState = emptyPointerState,
    onStateChange = () => {},
    onPitchToggle = () => {},
    onReset = () => {},
    code = '',
    title = 'Overlay pointer modes',
    description,
  }: OverlayPointerInspectorProps = $props();

  let copied = $state(false);
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

  function patch(patch: Partial<OverlayPointerDemoState>) {
    onStateChange({ ...demoState, ...patch });
  }

  function handlePointerModeChange(value: string) {
    patch({ pointerMode: value as HtmlOverlayPointerMode });
  }

  async function copyCode(value: string) {
    const writeText = navigator?.clipboard?.writeText;

    if (!writeText) {
      return;
    }

    try {
      await writeText.call(navigator.clipboard, value);
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
    <ControlRow label="Interactable">
      <ToggleSwitch
        checked={demoState.interactable}
        label="Iframe interactable"
        onChange={(interactable) => patch({ interactable })}
      />
    </ControlRow>

    <ControlRow class="pointer-mode-row" label="Pointer mode">
      <SegmentedControl
        label="Pointer mode"
        value={demoState.pointerMode}
        options={pointerModeOptions}
        onChange={handlePointerModeChange}
      />
    </ControlRow>

    <ControlRow label="Map pitch">
      <Button variant="utility" onclick={onPitchToggle}>
        {demoState.mapPitched ? 'Flatten map' : 'Pitch map'}
      </Button>
    </ControlRow>

    <ControlRow label="Defaults">
      <Button variant="secondary" onclick={onReset}>Reset overlay</Button>
    </ControlRow>
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

  .section-stack :global(.pointer-mode-row fieldset) {
    width: min(220px, 100%);
  }
</style>
