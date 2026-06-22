<script lang="ts">
  import { onDestroy } from 'svelte';
  import { CodeBlock, ControlRow, InspectorSection, SegmentedControl, ToggleSwitch } from '../../ui';
  import type { HtmlOverlayPointerMode } from 'maplibre-geoforge';

  type OverlayDemoState = {
    visible: boolean;
    interactable: boolean;
    pointerMode: HtmlOverlayPointerMode;
  };

  type OverlayInspectorProps = {
    state?: OverlayDemoState;
    onStateChange?: (state: OverlayDemoState) => void;
    code?: string;
    title?: string;
    description?: string;
  };

  const pointerModeOptions = [
    { value: 'selected', label: 'Selected' },
    { value: 'always', label: 'Always' },
    { value: 'none', label: 'None' },
  ];

  const emptyOverlayState: OverlayDemoState = {
    visible: true,
    interactable: true,
    pointerMode: 'selected',
  };

  let {
    state: demoState = emptyOverlayState,
    onStateChange = () => {},
    code = '',
    title = 'HTML overlay',
    description,
  }: OverlayInspectorProps = $props();

  let copied = $state(false);
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

  function patch(patch: Partial<OverlayDemoState>) {
    onStateChange({ ...demoState, ...patch });
  }

  function handlePointerModeChange(value: string) {
    patch({ pointerMode: value as HtmlOverlayPointerMode });
  }

  async function copyCode(value: string) {
    const writeText = globalThis.navigator?.clipboard?.writeText;

    if (!writeText) {
      return;
    }

    try {
      await writeText.call(globalThis.navigator.clipboard, value);
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
    <ControlRow label="Visible">
      <ToggleSwitch
        checked={demoState.visible}
        label="Overlay visible"
        onChange={(visible) => patch({ visible })}
      />
    </ControlRow>

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
