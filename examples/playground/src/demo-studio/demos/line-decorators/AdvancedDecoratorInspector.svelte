<script lang="ts">
  import {
    Button,
    ControlRow,
    InspectorSection,
    SegmentedControl,
    ToggleSwitch,
  } from '../../ui';
  import AdvancedDecoratorJsonPanel from './AdvancedDecoratorJsonPanel.svelte';
  import {
    addAdvancedDecorator,
    buildDecoratorFromAdvancedState,
    clearAdvancedDecorators,
    createAdvancedDecoratorState,
    getAdvancedDecoratorLineFeature,
    mergeSvgCss,
    removeAdvancedDecorator,
    validateSvgMarkup,
    type AdvancedDecoratorAnimationProperty,
    type AdvancedDecoratorKind,
    type AdvancedDecoratorLayerPosition,
    type AdvancedDecoratorState,
    type AdvancedDecoratorSymbolPreset,
  } from './advancedDecoratorAuthoring.ts';

  type AdvancedDecoratorInspectorProps = {
    state?: AdvancedDecoratorState;
    onStateChange?: (state: AdvancedDecoratorState) => void;
    code?: string;
    title?: string;
    description?: string;
  };

  const defaultState = createAdvancedDecoratorState();

  const kindOptions = [
    { value: 'symbol', label: 'Symbol' },
    { value: 'text', label: 'Text' },
    { value: 'arrowhead', label: 'Arrow' },
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

  const rotateModeOptions = [
    { value: 'line', label: 'Line' },
    { value: 'fixed', label: 'Fixed' },
    { value: 'viewport', label: 'View' },
  ];

  const symbolPresetOptions = [
    { value: 'chevron', label: 'Chevron' },
    { value: 'diamond', label: 'Diamond' },
    { value: 'dot', label: 'Dot' },
    { value: 'custom', label: 'Custom' },
  ];

  const animationDirectionOptions = [
    { value: 'normal', label: 'Normal' },
    { value: 'reverse', label: 'Reverse' },
    { value: 'alternate', label: 'Alt' },
    { value: 'alternate-reverse', label: 'Alt rev' },
  ];

  const animationEasingOptions = [
    { value: 'linear', label: 'Linear' },
    { value: 'ease', label: 'Ease' },
    { value: 'ease-in', label: 'In' },
    { value: 'ease-out', label: 'Out' },
    { value: 'ease-in-out', label: 'In out' },
  ];

  const animationProperties: { value: AdvancedDecoratorAnimationProperty; label: string }[] = [
    { value: 'rotate', label: 'Rotate' },
    { value: 'opacity', label: 'Opacity' },
    { value: 'size', label: 'Size' },
    { value: 'fontSize', label: 'Font' },
  ];

  let {
    state: demoState = defaultState,
    onStateChange = () => {},
    code = '',
    title = 'Advanced decorator authoring',
    description = 'Author line decorators with placement, symbol, text, arrowhead, and animation controls.',
  }: AdvancedDecoratorInspectorProps = $props();

  const decoratorCount = $derived(demoState.decorators?.length ?? 0);
  const usesPlacementControls = $derived(demoState.kind === 'symbol' || demoState.kind === 'text');
  const svgValidation = $derived(validateSvgMarkup(demoState.customSvg));
  const mergedSvg = $derived(mergeSvgCss(demoState.customSvg, demoState.customSvgCss));
  const svgPreviewSrc = $derived(
    svgValidation.valid ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mergedSvg)}` : '',
  );
  const currentDecorator = $derived(buildDecoratorFromAdvancedState(demoState));
  const currentFeature = $derived(getAdvancedDecoratorLineFeature(demoState));

  function patch(patchValue: Partial<AdvancedDecoratorState>) {
    onStateChange({ ...demoState, ...patchValue });
  }

  function patchLineStyle(patchValue: Partial<AdvancedDecoratorState['lineStyle']>) {
    patch({ lineStyle: { ...demoState.lineStyle, ...patchValue } });
  }

  function readString(event: Event) {
    return (event.currentTarget as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  function readNumber(event: Event, fallback = 0) {
    const value = Number(readString(event));
    return Number.isFinite(value) ? value : fallback;
  }

  function addDecorator() {
    patchState(addAdvancedDecorator(demoState, buildDecoratorFromAdvancedState(demoState)));
  }

  function removeDecorator(index: number) {
    patchState(removeAdvancedDecorator(demoState, index));
  }

  function clearDecorators() {
    patchState(clearAdvancedDecorators(demoState));
  }

  function patchState(nextState: AdvancedDecoratorState) {
    onStateChange(nextState);
  }

  function toggleAnimationProperty(property: AdvancedDecoratorAnimationProperty, checked: boolean) {
    const nextProperties = checked
      ? Array.from(new Set([...demoState.animationProperties, property]))
      : demoState.animationProperties.filter((value) => value !== property);

    patch({ animationProperties: nextProperties.length ? nextProperties : [property] });
  }

  async function loadSvgFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const customSvg = await file.text();
    patch({ symbolPreset: 'custom', customSvg });
    input.value = '';
  }

  function decoratorDetail(decorator: (typeof currentFeature.properties.decorators)[number]) {
    if (decorator.kind === 'text') {
      return decorator.text;
    }

    if (decorator.kind === 'symbol') {
      return decorator.imageId;
    }

    return String(decorator.frequency ?? 'default');
  }
</script>

<InspectorSection {title}>
  <p class="description">{description}</p>

  <div class="section-stack">
    <ControlRow class="compact-row" label="Kind">
      <SegmentedControl
        label="Decorator kind"
        value={demoState.kind}
        options={kindOptions}
        onChange={(kind) => patch({ kind: kind as AdvancedDecoratorKind })}
      />
    </ControlRow>

    <ControlRow class="compact-row" label="Layer">
      <SegmentedControl
        label="Layer position"
        value={demoState.layerPosition}
        options={layerPositionOptions}
        onChange={(layerPosition) =>
          patch({ layerPosition: layerPosition as AdvancedDecoratorLayerPosition })}
      />
    </ControlRow>

    <ControlRow label="Saved">
      <span>{decoratorCount}</span>
    </ControlRow>
  </div>
</InspectorSection>

<InspectorSection title="Line style">
  <div class="section-stack">
    <ControlRow label="Color" for="advanced-line-color">
      <input
        id="advanced-line-color"
        class="color-input"
        type="color"
        value={demoState.lineStyle.color}
        oninput={(event) => patchLineStyle({ color: readString(event) })}
      />
    </ControlRow>

    <ControlRow label="Width" for="advanced-line-width">
      <input
        id="advanced-line-width"
        class="number-input"
        type="number"
        min="1"
        max="24"
        step="1"
        value={demoState.lineStyle.width}
        oninput={(event) => patchLineStyle({ width: readNumber(event, demoState.lineStyle.width) })}
      />
    </ControlRow>

    <ControlRow label="Opacity" for="advanced-line-opacity">
      <input
        id="advanced-line-opacity"
        class="number-input"
        type="number"
        min="0"
        max="1"
        step="0.05"
        value={demoState.lineStyle.opacity}
        oninput={(event) =>
          patchLineStyle({ opacity: readNumber(event, demoState.lineStyle.opacity) })}
      />
    </ControlRow>
  </div>
</InspectorSection>

<InspectorSection title="Placement">
  <div class="section-stack">
    <ControlRow label="Frequency" for="advanced-frequency">
      <input
        id="advanced-frequency"
        class="text-input"
        value={demoState.frequency}
        oninput={(event) => patch({ frequency: readString(event) })}
      />
    </ControlRow>

    {#if usesPlacementControls}
      <ControlRow class="compact-row" label="Segment">
        <SegmentedControl
          label="Segment"
          value={demoState.segment}
          options={segmentOptions}
          onChange={(segment) =>
            patch({ segment: segment as AdvancedDecoratorState['segment'] })}
        />
      </ControlRow>

      <ControlRow class="compact-row" label="Anchor">
        <SegmentedControl
          label="Anchor"
          value={demoState.anchor}
          options={anchorOptions}
          onChange={(anchor) => patch({ anchor: anchor as AdvancedDecoratorState['anchor'] })}
        />
      </ControlRow>

      <ControlRow label="Offset %" for="advanced-offset-percent">
        <input
          id="advanced-offset-percent"
          class="number-input"
          type="number"
          step="1"
          value={demoState.offsetPercent}
          oninput={(event) => patch({ offsetPercent: readNumber(event, demoState.offsetPercent) })}
        />
      </ControlRow>

      <ControlRow label="Line offset" for="advanced-line-offset">
        <input
          id="advanced-line-offset"
          class="number-input"
          type="number"
          step="1"
          value={demoState.lineOffsetPx}
          oninput={(event) => patch({ lineOffsetPx: readNumber(event, demoState.lineOffsetPx) })}
        />
      </ControlRow>

      <ControlRow class="compact-row" label="Rotate">
        <SegmentedControl
          label="Rotate mode"
          value={demoState.rotateMode}
          options={rotateModeOptions}
          onChange={(rotateMode) =>
            patch({ rotateMode: rotateMode as AdvancedDecoratorState['rotateMode'] })}
        />
      </ControlRow>

      <ControlRow label="Angle" for="advanced-rotate-angle">
        <input
          id="advanced-rotate-angle"
          class="number-input"
          type="number"
          step="1"
          value={demoState.rotateAngle}
          oninput={(event) => patch({ rotateAngle: readNumber(event, demoState.rotateAngle) })}
        />
      </ControlRow>
    {/if}

    <ControlRow label="Start" for="advanced-start-offset">
      <input
        id="advanced-start-offset"
        class="text-input"
        value={demoState.startOffset}
        oninput={(event) => patch({ startOffset: readString(event) })}
      />
    </ControlRow>

    <ControlRow label="End" for="advanced-end-offset">
      <input
        id="advanced-end-offset"
        class="text-input"
        value={demoState.endOffset}
        oninput={(event) => patch({ endOffset: readString(event) })}
      />
    </ControlRow>
  </div>
</InspectorSection>

{#if demoState.kind === 'symbol'}
  <InspectorSection title="Symbol">
    <div class="section-stack">
      <ControlRow class="compact-row" label="Preset">
        <SegmentedControl
          label="Symbol preset"
          value={demoState.symbolPreset}
          options={symbolPresetOptions}
          onChange={(symbolPreset) =>
            patch({ symbolPreset: symbolPreset as AdvancedDecoratorSymbolPreset })}
        />
      </ControlRow>

      <ControlRow label="Color" for="advanced-symbol-color">
        <input
          id="advanced-symbol-color"
          class="color-input"
          type="color"
          value={demoState.symbolColor}
          oninput={(event) => patch({ symbolColor: readString(event) })}
        />
      </ControlRow>

      <ControlRow label="Size" for="advanced-symbol-size">
        <input
          id="advanced-symbol-size"
          class="number-input"
          type="number"
          min="0.1"
          max="6"
          step="0.05"
          value={demoState.symbolSize}
          oninput={(event) => patch({ symbolSize: readNumber(event, demoState.symbolSize) })}
        />
      </ControlRow>

      <ControlRow label="Opacity" for="advanced-symbol-opacity">
        <input
          id="advanced-symbol-opacity"
          class="number-input"
          type="number"
          min="0"
          max="1"
          step="0.05"
          value={demoState.symbolOpacity}
          oninput={(event) => patch({ symbolOpacity: readNumber(event, demoState.symbolOpacity) })}
        />
      </ControlRow>
    </div>

    <div class="svg-workbench">
      <div class="svg-preview" data-valid={svgValidation.valid}>
        {#if svgPreviewSrc}
          <img src={svgPreviewSrc} alt="Custom SVG preview" />
        {:else}
          <span>{svgValidation.message}</span>
        {/if}
      </div>

      <label class="file-drop">
        <input type="file" accept=".svg,image/svg+xml" onchange={loadSvgFile} />
        <span>Drop or choose SVG</span>
      </label>

      <label class="textarea-field" for="advanced-custom-svg">
        <span>SVG markup</span>
        <textarea
          id="advanced-custom-svg"
          rows="6"
          value={demoState.customSvg}
          oninput={(event) => patch({ symbolPreset: 'custom', customSvg: readString(event) })}
        ></textarea>
      </label>

      <label class="textarea-field" for="advanced-custom-css">
        <span>CSS</span>
        <textarea
          id="advanced-custom-css"
          rows="5"
          value={demoState.customSvgCss}
          oninput={(event) => patch({ customSvgCss: readString(event) })}
        ></textarea>
      </label>
    </div>
  </InspectorSection>
{:else if demoState.kind === 'text'}
  <InspectorSection title="Text">
    <div class="section-stack">
      <ControlRow label="Text" for="advanced-text">
        <input
          id="advanced-text"
          class="text-input"
          value={demoState.text}
          oninput={(event) => patch({ text: readString(event) })}
        />
      </ControlRow>

      <ControlRow label="Color" for="advanced-text-color">
        <input
          id="advanced-text-color"
          class="color-input"
          type="color"
          value={demoState.textColor}
          oninput={(event) => patch({ textColor: readString(event) })}
        />
      </ControlRow>

      <ControlRow label="Font size" for="advanced-font-size">
        <input
          id="advanced-font-size"
          class="number-input"
          type="number"
          min="8"
          max="72"
          step="1"
          value={demoState.fontSize}
          oninput={(event) => patch({ fontSize: readNumber(event, demoState.fontSize) })}
        />
      </ControlRow>

      <ControlRow label="Opacity" for="advanced-text-opacity">
        <input
          id="advanced-text-opacity"
          class="number-input"
          type="number"
          min="0"
          max="1"
          step="0.05"
          value={demoState.textOpacity}
          oninput={(event) => patch({ textOpacity: readNumber(event, demoState.textOpacity) })}
        />
      </ControlRow>

      <ControlRow label="Halo" for="advanced-halo-color">
        <input
          id="advanced-halo-color"
          class="color-input"
          type="color"
          value={demoState.haloColor}
          oninput={(event) => patch({ haloColor: readString(event) })}
        />
      </ControlRow>

      <ControlRow label="Halo width" for="advanced-halo-width">
        <input
          id="advanced-halo-width"
          class="number-input"
          type="number"
          min="0"
          max="12"
          step="0.5"
          value={demoState.haloWidth}
          oninput={(event) => patch({ haloWidth: readNumber(event, demoState.haloWidth) })}
        />
      </ControlRow>

      <ControlRow label="Halo blur" for="advanced-halo-blur">
        <input
          id="advanced-halo-blur"
          class="number-input"
          type="number"
          min="0"
          max="12"
          step="0.5"
          value={demoState.haloBlur}
          oninput={(event) => patch({ haloBlur: readNumber(event, demoState.haloBlur) })}
        />
      </ControlRow>
    </div>
  </InspectorSection>
{:else}
  <InspectorSection title="Arrowhead">
    <div class="section-stack">
      <ControlRow label="Stroke" for="advanced-arrow-color">
        <input
          id="advanced-arrow-color"
          class="color-input"
          type="color"
          value={demoState.arrowColor}
          oninput={(event) => patch({ arrowColor: readString(event) })}
        />
      </ControlRow>

      <ControlRow label="Fill color" for="advanced-arrow-fill-color">
        <input
          id="advanced-arrow-fill-color"
          class="color-input"
          type="color"
          value={demoState.arrowFillColor}
          oninput={(event) => patch({ arrowFillColor: readString(event) })}
        />
      </ControlRow>

      <ControlRow label="Size" for="advanced-arrow-size">
        <input
          id="advanced-arrow-size"
          class="text-input"
          value={demoState.arrowSize}
          oninput={(event) => patch({ arrowSize: readString(event) })}
        />
      </ControlRow>

      <ControlRow label="Yawn" for="advanced-arrow-yawn">
        <input
          id="advanced-arrow-yawn"
          class="number-input"
          type="number"
          min="10"
          max="160"
          step="1"
          value={demoState.arrowYawn}
          oninput={(event) => patch({ arrowYawn: readNumber(event, demoState.arrowYawn) })}
        />
      </ControlRow>

      <ControlRow label="Weight" for="advanced-arrow-weight">
        <input
          id="advanced-arrow-weight"
          class="number-input"
          type="number"
          min="0"
          max="10"
          step="0.5"
          value={demoState.arrowWeight}
          oninput={(event) => patch({ arrowWeight: readNumber(event, demoState.arrowWeight) })}
        />
      </ControlRow>

      <ControlRow label="Opacity" for="advanced-arrow-opacity">
        <input
          id="advanced-arrow-opacity"
          class="number-input"
          type="number"
          min="0"
          max="1"
          step="0.05"
          value={demoState.arrowOpacity}
          oninput={(event) => patch({ arrowOpacity: readNumber(event, demoState.arrowOpacity) })}
        />
      </ControlRow>

      <ControlRow label="Fill opacity" for="advanced-arrow-fill-opacity">
        <input
          id="advanced-arrow-fill-opacity"
          class="number-input"
          type="number"
          min="0"
          max="1"
          step="0.05"
          value={demoState.arrowFillOpacity}
          oninput={(event) =>
            patch({ arrowFillOpacity: readNumber(event, demoState.arrowFillOpacity) })}
        />
      </ControlRow>

      <ControlRow label="Fill">
        <ToggleSwitch
          checked={demoState.arrowFill}
          label="Fill arrowheads"
          onChange={(arrowFill) => patch({ arrowFill })}
        />
      </ControlRow>

      <ControlRow label="Proportional">
        <ToggleSwitch
          checked={demoState.arrowProportional}
          label="Scale end-only arrowheads proportionally"
          onChange={(arrowProportional) => patch({ arrowProportional })}
        />
      </ControlRow>
    </div>
  </InspectorSection>
{/if}

<InspectorSection title="Animation">
  <div class="section-stack">
    <ControlRow label="Enabled">
      <ToggleSwitch
        checked={demoState.animationEnabled}
        label="Animation enabled"
        disabled={demoState.kind === 'arrowhead'}
        onChange={(animationEnabled) => patch({ animationEnabled })}
      />
    </ControlRow>

    {#if demoState.animationEnabled && demoState.kind !== 'arrowhead'}
      <ControlRow label="Properties">
        <div class="check-grid">
          {#each animationProperties as property}
            <label>
              <input
                type="checkbox"
                checked={demoState.animationProperties.includes(property.value)}
                onchange={(event) =>
                  toggleAnimationProperty(property.value, (event.currentTarget as HTMLInputElement).checked)}
              />
              <span>{property.label}</span>
            </label>
          {/each}
        </div>
      </ControlRow>

      <ControlRow label="From" for="advanced-animation-from">
        <input
          id="advanced-animation-from"
          class="number-input"
          type="number"
          step="1"
          value={demoState.animationFrom}
          oninput={(event) => patch({ animationFrom: readNumber(event, demoState.animationFrom) })}
        />
      </ControlRow>

      <ControlRow label="To" for="advanced-animation-to">
        <input
          id="advanced-animation-to"
          class="number-input"
          type="number"
          step="1"
          value={demoState.animationTo}
          oninput={(event) => patch({ animationTo: readNumber(event, demoState.animationTo) })}
        />
      </ControlRow>

      <ControlRow label="Duration" for="advanced-animation-duration">
        <input
          id="advanced-animation-duration"
          class="number-input"
          type="number"
          min="1"
          step="50"
          value={demoState.animationDurationMs}
          oninput={(event) =>
            patch({ animationDurationMs: readNumber(event, demoState.animationDurationMs) })}
        />
      </ControlRow>

      <ControlRow label="Delay" for="advanced-animation-delay">
        <input
          id="advanced-animation-delay"
          class="number-input"
          type="number"
          min="0"
          step="50"
          value={demoState.animationDelayMs}
          oninput={(event) =>
            patch({ animationDelayMs: readNumber(event, demoState.animationDelayMs) })}
        />
      </ControlRow>

      <ControlRow label="Iterations" for="advanced-animation-iterations">
        <input
          id="advanced-animation-iterations"
          class="text-input"
          value={demoState.animationIterationCount}
          oninput={(event) => patch({ animationIterationCount: readString(event) })}
        />
      </ControlRow>

      <ControlRow class="compact-row" label="Direction">
        <SegmentedControl
          label="Animation direction"
          value={demoState.animationDirection}
          options={animationDirectionOptions}
          onChange={(animationDirection) =>
            patch({
              animationDirection:
                animationDirection as AdvancedDecoratorState['animationDirection'],
            })}
        />
      </ControlRow>

      <ControlRow class="compact-row" label="Easing">
        <SegmentedControl
          label="Animation easing"
          value={demoState.animationEasing}
          options={animationEasingOptions}
          onChange={(animationEasing) =>
            patch({ animationEasing: animationEasing as AdvancedDecoratorState['animationEasing'] })}
        />
      </ControlRow>
    {/if}
  </div>
</InspectorSection>

<InspectorSection title="Decorators">
  <div class="current-card">
    <span>Current</span>
    <strong>{currentDecorator.kind}</strong>
    <small>{decoratorDetail(currentDecorator)}</small>
  </div>

  <div class="decorator-actions">
    <Button variant="primary" onclick={addDecorator}>Add current</Button>
    <Button variant="danger" disabled={decoratorCount === 0} onclick={clearDecorators}>
      Clear all
    </Button>
  </div>

  {#if decoratorCount > 0}
    <ol class="decorator-list" aria-label="Saved decorators">
      {#each demoState.decorators ?? [] as decorator, index}
        <li>
          <span>{index + 1}</span>
          <div>
            <strong>{decorator.kind}</strong>
            <small>{decoratorDetail(decorator)}</small>
          </div>
          <Button variant="utility" aria-label={`Remove ${decorator.kind} decorator`} onclick={() => removeDecorator(index)}>
            Remove
          </Button>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="empty-state">No saved decorators. The preview uses the current form until you add one.</p>
  {/if}
</InspectorSection>

<AdvancedDecoratorJsonPanel state={demoState} {code} />

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

  .section-stack :global(.compact-row) {
    gap: 10px;
  }

  .section-stack :global(fieldset) {
    width: min(230px, 100%);
  }

  .text-input,
  .number-input {
    width: min(150px, 100%);
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

  .svg-workbench {
    display: grid;
    gap: 10px;
    margin-top: 14px;
  }

  .svg-preview {
    min-height: 86px;
    display: grid;
    place-items: center;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-card);
    background:
      linear-gradient(45deg, color-mix(in srgb, var(--gf-line) 38%, transparent) 25%, transparent 25%),
      linear-gradient(-45deg, color-mix(in srgb, var(--gf-line) 38%, transparent) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, color-mix(in srgb, var(--gf-line) 38%, transparent) 75%),
      linear-gradient(-45deg, transparent 75%, color-mix(in srgb, var(--gf-line) 38%, transparent) 75%);
    background-color: var(--gf-overlay);
    background-position:
      0 0,
      0 8px,
      8px -8px,
      -8px 0;
    background-size: 16px 16px;
  }

  .svg-preview[data-valid='false'] {
    background: var(--gf-overlay);
  }

  .svg-preview img {
    width: 56px;
    height: 56px;
    object-fit: contain;
  }

  .svg-preview span {
    color: var(--gf-muted);
    font-size: 12px;
    font-weight: 700;
  }

  .file-drop {
    min-height: 42px;
    display: grid;
    place-items: center;
    border: 1px dashed color-mix(in srgb, var(--gf-body) 58%, var(--gf-line));
    border-radius: var(--gf-radius-card);
    color: var(--gf-body);
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
  }

  .file-drop input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .textarea-field {
    display: grid;
    gap: 6px;
    color: var(--gf-body);
    font-size: 12px;
    font-weight: 700;
  }

  textarea {
    width: 100%;
    resize: vertical;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-tool);
    padding: 10px;
    background: var(--gf-overlay);
    color: var(--gf-text);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    font-size: 12px;
    line-height: 1.45;
  }

  .check-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    text-align: left;
  }

  .check-grid label {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--gf-text);
    font-size: 12px;
    font-weight: 700;
  }

  .check-grid span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .current-card {
    min-width: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 10px;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-card);
    padding: 10px;
    background: var(--gf-overlay);
  }

  .current-card span {
    color: var(--gf-muted);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .current-card strong,
  .current-card small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .current-card strong {
    color: var(--gf-text);
    font-size: 13px;
    text-transform: capitalize;
  }

  .current-card small {
    grid-column: 2;
    color: var(--gf-body);
    font-size: 12px;
    font-weight: 650;
  }

  .decorator-actions {
    width: min(330px, 100%);
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 12px;
  }

  .decorator-actions :global(button) {
    min-width: 0;
    width: 100%;
    padding-inline: 10px;
  }

  .decorator-list {
    display: grid;
    gap: 8px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }

  .decorator-list li {
    min-width: 0;
    min-height: 38px;
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-tool);
    padding: 6px 8px;
    background: var(--gf-overlay);
  }

  .decorator-list span {
    color: var(--gf-muted);
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
    text-align: right;
  }

  .decorator-list div {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .decorator-list strong,
  .decorator-list small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .decorator-list strong {
    color: var(--gf-text);
    font-size: 12px;
    font-weight: 750;
    text-transform: capitalize;
  }

  .decorator-list small {
    color: var(--gf-body);
    font-size: 11px;
    font-weight: 650;
  }

  .decorator-list :global(button) {
    min-height: 28px;
    padding-inline: 10px;
  }

  .empty-state {
    margin-top: 12px;
    color: var(--gf-muted);
    font-size: 12px;
    font-weight: 650;
    line-height: 1.4;
  }

  @media (max-width: 380px) {
    .decorator-actions,
    .check-grid {
      grid-template-columns: 1fr;
    }

    .decorator-list li {
      grid-template-columns: 20px minmax(0, 1fr);
    }

    .decorator-list :global(button) {
      grid-column: 2;
      justify-self: start;
    }
  }
</style>
