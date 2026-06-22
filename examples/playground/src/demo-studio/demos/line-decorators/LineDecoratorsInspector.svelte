<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    Button,
    CodeBlock,
    ControlRow,
    InspectorSection,
    SegmentedControl,
    ToggleSwitch,
  } from '../../ui';
  import { createDecoratorFromState, initialLineDecoratorState } from './state.ts';
  import type { DecoratorKind, LayerPosition, LineDecoratorDemoState } from './types.ts';

  type LineDecoratorsInspectorProps = {
    state?: LineDecoratorDemoState;
    onStateChange?: (state: LineDecoratorDemoState) => void;
    code?: string;
    title?: string;
    description?: string;
  };

  const kindOptions = [
    { value: 'arrowhead', label: 'Arrowhead' },
    { value: 'symbol', label: 'Symbol' },
    { value: 'text', label: 'Text' },
  ];

  const layerPositionOptions = [
    { value: 'default', label: 'Default' },
    { value: 'below-lines', label: 'Below' },
    { value: 'above-lines', label: 'Above' },
  ];

  const segmentOptions = [
    { value: 'first', label: 'First' },
    { value: 'middle', label: 'Middle' },
    { value: 'last', label: 'Last' },
    { value: 'all', label: 'All' },
  ];

  const anchorOptions = [
    { value: 'front', label: 'Front' },
    { value: 'middle', label: 'Middle' },
    { value: 'back', label: 'Back' },
  ];

  const emptyLineDecoratorState: LineDecoratorDemoState = {
    ...initialLineDecoratorState,
    decorators: [],
  };

  let {
    state: demoState = emptyLineDecoratorState,
    onStateChange = () => {},
    code = '',
    title = 'Line decorators',
    description,
  }: LineDecoratorsInspectorProps = $props();

  let copied = $state(false);
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

  const usesPlacementControls = $derived(demoState.kind === 'symbol' || demoState.kind === 'text');
  const decoratorCount = $derived(demoState.decorators.length);

  function patch(patch: Partial<LineDecoratorDemoState>) {
    onStateChange({ ...demoState, ...patch });
  }

  function addDecorator() {
    onStateChange({
      ...demoState,
      decorators: [...demoState.decorators, createDecoratorFromState(demoState)],
    });
  }

  function clearDecorators() {
    patch({ decorators: [] });
  }

  function handleKindChange(value: string) {
    patch({ kind: value as DecoratorKind });
  }

  function handleLayerPositionChange(value: string) {
    patch({ layerPosition: value as LayerPosition });
  }

  function handleSegmentChange(value: string) {
    patch({ segment: value as LineDecoratorDemoState['segment'] });
  }

  function handleAnchorChange(value: string) {
    patch({ anchor: value as LineDecoratorDemoState['anchor'] });
  }

  function handleTextInput(event: Event) {
    patch({ text: (event.currentTarget as HTMLInputElement).value });
  }

  function handleFrequencyInput(event: Event) {
    patch({ frequency: (event.currentTarget as HTMLInputElement).value });
  }

  function handleNumberInput(
    event: Event,
    key: 'lineOffsetPx' | 'animationDurationMs'
  ) {
    patch({ [key]: Number((event.currentTarget as HTMLInputElement).value) });
  }

  function handleColorInput(
    event: Event,
    key: 'arrowColor' | 'symbolColor' | 'textColor'
  ) {
    patch({ [key]: (event.currentTarget as HTMLInputElement).value });
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
    <ControlRow class="decorator-choice-row" label="Kind">
      <SegmentedControl
        label="Decorator kind"
        value={demoState.kind}
        options={kindOptions}
        onChange={handleKindChange}
      />
    </ControlRow>

    <ControlRow class="decorator-choice-row" label="Layer">
      <SegmentedControl
        label="Layer position"
        value={demoState.layerPosition}
        options={layerPositionOptions}
        onChange={handleLayerPositionChange}
      />
    </ControlRow>

    <ControlRow label="Active">
      <span>{decoratorCount}</span>
    </ControlRow>
  </div>
</InspectorSection>

<InspectorSection title="Placement">
  <div class="section-stack">
    <ControlRow label="Frequency" for="decorator-frequency">
      <input
        id="decorator-frequency"
        class="compact-input"
        value={demoState.frequency}
        oninput={handleFrequencyInput}
      />
    </ControlRow>

    {#if usesPlacementControls}
      <ControlRow label="Segment">
        <SegmentedControl
          label="Segment"
          value={demoState.segment}
          options={segmentOptions}
          onChange={handleSegmentChange}
        />
      </ControlRow>

      <ControlRow label="Anchor">
        <SegmentedControl
          label="Anchor"
          value={demoState.anchor}
          options={anchorOptions}
          onChange={handleAnchorChange}
        />
      </ControlRow>

      <ControlRow label="Offset" for="decorator-line-offset">
        <input
          id="decorator-line-offset"
          class="compact-input number-input"
          type="number"
          step="1"
          value={demoState.lineOffsetPx}
          oninput={(event) => handleNumberInput(event, 'lineOffsetPx')}
        />
      </ControlRow>
    {/if}
  </div>
</InspectorSection>

<InspectorSection title="Style">
  <div class="section-stack">
    {#if demoState.kind === 'text'}
      <ControlRow label="Text" for="decorator-text">
        <input
          id="decorator-text"
          class="compact-input"
          value={demoState.text}
          oninput={handleTextInput}
        />
      </ControlRow>

      <ControlRow label="Text color" for="decorator-text-color">
        <input
          id="decorator-text-color"
          class="color-input"
          type="color"
          value={demoState.textColor}
          oninput={(event) => handleColorInput(event, 'textColor')}
        />
      </ControlRow>
    {:else if demoState.kind === 'symbol'}
      <ControlRow label="Symbol color" for="decorator-symbol-color">
        <input
          id="decorator-symbol-color"
          class="color-input"
          type="color"
          value={demoState.symbolColor}
          oninput={(event) => handleColorInput(event, 'symbolColor')}
        />
      </ControlRow>
    {:else}
      <ControlRow label="Arrow color" for="decorator-arrow-color">
        <input
          id="decorator-arrow-color"
          class="color-input"
          type="color"
          value={demoState.arrowColor}
          oninput={(event) => handleColorInput(event, 'arrowColor')}
        />
      </ControlRow>
    {/if}
  </div>
</InspectorSection>

<InspectorSection title="Animation">
  <div class="section-stack">
    <ControlRow label="Enabled">
      <ToggleSwitch
        checked={demoState.animationEnabled}
        label="Animation enabled"
        onChange={(animationEnabled) => patch({ animationEnabled })}
      />
    </ControlRow>

    {#if demoState.animationEnabled}
      <ControlRow label="Duration" for="decorator-animation-duration">
        <input
          id="decorator-animation-duration"
          class="compact-input number-input"
          type="number"
          min="1"
          step="50"
          value={demoState.animationDurationMs}
          oninput={(event) => handleNumberInput(event, 'animationDurationMs')}
        />
      </ControlRow>
    {/if}
  </div>
</InspectorSection>

<InspectorSection title="Decorators">
  <div class="decorator-actions">
    <Button variant="primary" onclick={addDecorator}>Add decorator</Button>
    <Button variant="danger" disabled={decoratorCount === 0} onclick={clearDecorators}>
      Clear decorators
    </Button>
  </div>

  {#if decoratorCount > 0}
    <ol class="decorator-list" aria-label="Active decorators">
      {#each demoState.decorators as decorator, index}
        <li>
          <span>{index + 1}</span>
          <strong>{decorator.kind}</strong>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="empty-state">No active decorators</p>
  {/if}
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

  .section-stack :global(strong) {
    display: flex;
    justify-content: flex-end;
  }

  .section-stack :global(fieldset) {
    width: min(220px, 100%);
  }

  .section-stack :global(.decorator-choice-row) {
    gap: 10px;
  }

  .section-stack :global(.decorator-choice-row > span) {
    flex-basis: 52px;
  }

  .compact-input {
    width: min(142px, 100%);
    min-height: var(--gf-control-height);
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-tool);
    padding: 0 10px;
    background: var(--gf-overlay);
    color: var(--gf-text);
    font-size: 13px;
    font-weight: 650;
    text-align: right;
  }

  .number-input {
    width: 96px;
  }

  .color-input {
    width: 46px;
    height: 30px;
    min-height: 30px;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-tool);
    padding: 3px;
    background: var(--gf-overlay);
    cursor: pointer;
  }

  .decorator-actions {
    width: min(330px, 100%);
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .decorator-actions :global(button) {
    min-width: 0;
    width: 100%;
    padding-inline: 10px;
  }

  .decorator-list {
    display: grid;
    gap: 6px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }

  .decorator-list li {
    min-width: 0;
    min-height: 28px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-tool);
    padding: 0 8px;
    background: var(--gf-overlay);
  }

  .decorator-list span {
    min-width: 18px;
    color: var(--gf-muted);
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
    text-align: right;
  }

  .decorator-list strong {
    min-width: 0;
    overflow: hidden;
    color: var(--gf-text);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.2;
    text-overflow: ellipsis;
    text-transform: capitalize;
    white-space: nowrap;
  }

  .empty-state {
    margin-top: 12px;
    color: var(--gf-muted);
    font-size: 12px;
    font-weight: 650;
    line-height: 1.4;
  }

  @media (max-width: 380px) {
    .decorator-actions {
      grid-template-columns: 1fr;
    }
  }
</style>
