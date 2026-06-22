<script lang="ts">
  import Button from './Button.svelte';
  import CodeBlock from './CodeBlock.svelte';
  import ControlRow from './ControlRow.svelte';
  import DataTable from './DataTable.svelte';
  import Dropzone from './Dropzone.svelte';
  import IconButton from './IconButton.svelte';
  import InspectorSection from './InspectorSection.svelte';
  import SearchInput from './SearchInput.svelte';
  import SegmentedControl from './SegmentedControl.svelte';
  import ToastStack from './ToastStack.svelte';
  import ToggleSwitch from './ToggleSwitch.svelte';
  import type { Toast } from '../types';

  let query = $state('route-main');
  let decoratorKind = $state('arrowhead');
  let layerPosition = $state('above');
  let syncOnRender = $state(true);
  let snapToLine = $state(true);
  let copied = $state(false);
  let selectedFileName = $state('network-routes.geojson');
  let animationDuration = $state(1200);
  const animationFill = $derived(((animationDuration - 200) / 1800) * 100);

  const toasts: Toast[] = [
    {
      id: 'sync-complete',
      tone: 'success',
      title: 'Decorator sync complete',
      body: 'Arrowheads, labels, and animation source updated less than a minute ago.',
    },
    {
      id: 'overlay-warning',
      tone: 'error',
      title: 'Overlay corner mismatch',
      body: 'overlay-01 is missing a valid bottom-right coordinate.',
    },
  ];

  const tableColumns = ['Feature', 'Shape', 'Layer', 'Status'];
  const tableRows = [
    ['route-main', 'Line', 'Above lines', 'Live'],
    ['service-area', 'Polygon', 'Default', 'Idle'],
    ['overlay-01', 'HTML', 'Overlay', 'Invalid'],
    ['inspection-path', 'Line', 'Below lines', 'Queued'],
  ];

  const decoratorCode = `geoForge.decorators.lines.start({
  layerPosition: 'above-lines',
  resolveDecorators: feature => [
    {
      kind: 'arrowhead',
      frequency: '50m',
      offsets: { start: '12px', end: '16px' }
    }
  ]
});`;

  function handleCopy() {
    copied = true;
  }

  function handleSelect(files: File[]) {
    selectedFileName = files[0]?.name ?? selectedFileName;
  }
</script>

<main class="gf-studio board">
  <section class="hero" aria-labelledby="control-board-title">
    <div>
      <p class="eyebrow">GeoForge UI kit</p>
      <h1 id="control-board-title">Control language for map editing</h1>
    </div>
    <p>
      A compact Demo Studio board for line decorators, HTML overlays, layer placement, and
      GeoJSON handoff states.
    </p>
  </section>

  <section class="grid" aria-label="Control board components">
    <article class="panel">
      <div class="panel-heading">
        <h2>Actions</h2>
        <span class="badge success">Live</span>
      </div>
      <div class="button-row">
        <Button variant="primary">Export snippet</Button>
        <Button>Docs</Button>
        <Button disabled>Disabled</Button>
      </div>
      <div class="tool-row" aria-label="Editor tools">
        <IconButton label="Move feature" active>
          <span aria-hidden="true">↗</span>
        </IconButton>
        <IconButton label="Undo edit">
          <span aria-hidden="true">↶</span>
        </IconButton>
        <IconButton label="Command palette">
          <span aria-hidden="true">⌘</span>
        </IconButton>
        <IconButton label="Zoom in">
          <span aria-hidden="true">+</span>
        </IconButton>
        <IconButton label="Zoom out">
          <span aria-hidden="true">−</span>
        </IconButton>
      </div>
      <div class="badge-row" aria-label="System states">
        <span class="badge success">New</span>
        <span class="badge neutral">Advanced</span>
        <span class="badge error">Error</span>
      </div>
    </article>

    <article class="panel">
      <div class="panel-heading">
        <h2>Inputs</h2>
      </div>
      <SearchInput bind:value={query} placeholder="Search demos, APIs, features" />
      <div class="field-grid">
        <label>
          <span>Frequency</span>
          <input id="frequency" value="50" inputmode="numeric" />
        </label>
        <label>
          <span>Easing</span>
          <select>
            <option>Ease-out</option>
            <option>Linear</option>
            <option>Ease-in-out</option>
          </select>
        </label>
      </div>
      <div class="toggle-row">
        <ToggleSwitch bind:checked={syncOnRender} label="Sync on render" />
        <span>Sync on render</span>
      </div>
      <div class="toggle-row">
        <ToggleSwitch bind:checked={snapToLine} label="Snap labels to line" />
        <span>Snap labels to line</span>
      </div>
    </article>

    <article class="panel">
      <div class="panel-heading">
        <h2>Segments</h2>
      </div>
      <SegmentedControl
        label="Decorator kind"
        bind:value={decoratorKind}
        options={[
          { value: 'arrowhead', label: 'Arrowhead' },
          { value: 'text', label: 'Text' },
          { value: 'symbol', label: 'Symbol' },
        ]}
      />
      <SegmentedControl
        label="Layer position"
        bind:value={layerPosition}
        options={[
          { value: 'below', label: 'Below' },
          { value: 'above', label: 'Above' },
        ]}
      />
      <div class="slider-row">
        <input
          class="slider"
          type="range"
          min="200"
          max="2000"
          bind:value={animationDuration}
          style={`--slider-fill: ${animationFill}%`}
          aria-label="Animation duration"
        />
        <strong>Animation duration: {animationDuration}ms</strong>
      </div>
    </article>

    <article class="panel wide">
      <div class="panel-heading">
        <h2>Inspector</h2>
        <span class="badge neutral">{query}</span>
      </div>
      <InspectorSection title="Selected feature">
        <ControlRow label="Frequency"><span>50m</span></ControlRow>
        <ControlRow label="Segment"><span>All</span></ControlRow>
        <ControlRow label="Layer position"><span>Above lines</span></ControlRow>
        <ControlRow label="Decorator"><span>{decoratorKind}</span></ControlRow>
        <ControlRow label="Animation">
          <ToggleSwitch bind:checked={syncOnRender} label="Animation enabled" />
        </ControlRow>
      </InspectorSection>
    </article>

    <article class="panel">
      <div class="panel-heading">
        <h2>Feature Color</h2>
      </div>
      <div class="swatches" aria-label="Feature color swatches">
        <button class="swatch active blue" type="button" aria-label="Blue" aria-pressed="true"></button>
        <button class="swatch white" type="button" aria-label="White" aria-pressed="false"></button>
        <button class="swatch cyan" type="button" aria-label="Cyan" aria-pressed="false"></button>
        <button class="swatch green" type="button" aria-label="Green" aria-pressed="false"></button>
        <button class="swatch red" type="button" aria-label="Red" aria-pressed="false"></button>
      </div>
      <p class="panel-note">
        Swatches are confined to feature styling controls and never become page decoration.
      </p>
    </article>

    <article class="panel wide">
      <div class="panel-heading">
        <h2>Decorator API</h2>
      </div>
      <CodeBlock code={decoratorCode} {copied} onCopy={handleCopy} />
    </article>

    <article class="panel toast-panel">
      <div class="panel-heading">
        <h2>Toast</h2>
      </div>
      <ToastStack {toasts} />
    </article>

    <article class="panel wide">
      <div class="panel-heading">
        <h2>Feature Inventory</h2>
        <span class="badge neutral">4 rows</span>
      </div>
      <DataTable columns={tableColumns} rows={tableRows} />
    </article>

    <article class="panel">
      <div class="panel-heading">
        <h2>GeoJSON Dropzone</h2>
      </div>
      <Dropzone
        label="Drop GeoJSON here"
        actionLabel="Select file"
        accept=".geojson,.json,application/geo+json,application/json"
        selectedFileName={selectedFileName}
        onSelect={handleSelect}
      />
    </article>
  </section>
</main>

<style>
  .board {
    height: 100dvh;
    overflow: auto;
    padding: 36px;
    background:
      radial-gradient(circle at 82% 0%, color-mix(in srgb, var(--gf-blue) 14%, transparent), transparent 27%),
      var(--gf-void);
  }

  .hero {
    max-width: 1440px;
    display: flex;
    justify-content: space-between;
    gap: 32px;
    align-items: end;
    margin: 0 auto 28px;
  }

  .eyebrow {
    color: var(--gf-muted);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.7em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  h1 {
    max-width: 760px;
    margin-top: 8px;
    color: var(--gf-text);
    font-size: 56px;
    font-weight: 760;
    line-height: 1.02;
  }

  .hero p {
    max-width: 440px;
    color: var(--gf-body);
    font-size: 15px;
    font-weight: 500;
    line-height: 1.6;
  }

  .grid {
    max-width: 1440px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin: 0 auto;
  }

  .panel {
    min-width: 0;
    min-height: 220px;
    display: grid;
    align-content: start;
    gap: 14px;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-card);
    padding: 18px;
    background: var(--gf-panel);
  }

  .panel.wide {
    grid-column: span 2;
  }

  .panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 0;
    border-radius: 0;
    padding: 0;
    background: transparent;
  }

  h2 {
    margin: 0;
    color: var(--gf-text);
    font-size: 18px;
    font-weight: 720;
    line-height: 1.15;
  }

  .button-row,
  .tool-row,
  .badge-row,
  .toggle-row,
  .slider-row,
  .swatches {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .button-row {
    margin: 0;
  }

  .board .panel-heading {
    border: 0;
    border-radius: 0;
    padding: 0;
    background: transparent;
  }

  .board .button-row {
    display: flex;
    grid-template-columns: none;
    margin: 0;
  }

  .board h1,
  .board h2,
  .board p {
    margin-bottom: 0;
  }

  .tool-row :global(button) {
    font-size: 17px;
    font-weight: 760;
  }

  .badge {
    min-height: 20px;
    display: inline-flex;
    align-items: center;
    border-radius: var(--gf-radius-badge);
    padding: 0 7px;
    color: var(--gf-text);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.32em;
    line-height: 1;
    text-transform: uppercase;
  }

  .badge.success {
    background: var(--gf-green);
  }

  .badge.neutral {
    background: var(--gf-overlay);
    color: var(--gf-body);
  }

  .badge.error {
    background: var(--gf-red);
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  label {
    min-width: 0;
    display: grid;
    gap: 8px;
    color: var(--gf-body);
    font-size: 12px;
    font-weight: 700;
  }

  label span {
    color: var(--gf-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  input,
  select {
    width: 100%;
    min-height: var(--gf-control-height);
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-tool);
    padding: 0 12px;
    background: var(--gf-raised);
    color: var(--gf-text);
    font-size: 13px;
    font-weight: 600;
  }

  select {
    color: var(--gf-body);
  }

  .toggle-row {
    color: var(--gf-body);
    font-size: 13px;
    font-weight: 600;
  }

  .slider-row {
    margin-top: 2px;
  }

  .slider {
    appearance: none;
    flex: 1 1 160px;
    height: 4px;
    min-height: 4px;
    border: 0;
    padding: 0;
    border-radius: var(--gf-radius-pill);
    background: linear-gradient(
      90deg,
      var(--gf-blue) 0 var(--slider-fill),
      var(--gf-line) var(--slider-fill) 100%
    );
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border: 0;
    border-radius: 50%;
    background: var(--gf-text);
  }

  .slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: 0;
    border-radius: 50%;
    background: var(--gf-text);
  }

  .slider-row strong {
    color: var(--gf-text);
    font-size: 13px;
    font-weight: 720;
  }

  .swatch {
    width: 26px;
    height: 26px;
    border: 2px solid var(--gf-line);
    border-radius: 50%;
    cursor: pointer;
  }

  .swatch.active {
    border-color: var(--gf-blue);
  }

  .swatch.blue {
    background: var(--gf-blue);
  }

  .swatch.white {
    background: var(--gf-text);
  }

  .swatch.cyan {
    background: #67d6ff;
  }

  .swatch.green {
    background: var(--gf-green);
  }

  .swatch.red {
    background: var(--gf-red);
  }

  .panel-note {
    color: var(--gf-body);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
  }

  .toast-panel :global([role='status']) {
    width: 100%;
  }

  @media (max-width: 1040px) {
    .board {
      padding: 28px;
    }

    .hero {
      display: grid;
      align-items: start;
    }

    .grid {
      grid-template-columns: 1fr;
    }

    .panel.wide {
      grid-column: auto;
    }

    h1 {
      font-size: 42px;
    }
  }

  @media (max-width: 620px) {
    .board {
      padding: 20px;
    }

    h1 {
      font-size: 34px;
    }

    .field-grid {
      grid-template-columns: 1fr;
    }

    .button-row {
      align-items: stretch;
    }

    .button-row :global(button) {
      width: 100%;
    }
  }

  @media (max-width: 420px) {
    .eyebrow {
      letter-spacing: 0.45em;
    }
  }

  @media (max-width: 340px) {
    .eyebrow {
      letter-spacing: 0.28em;
    }
  }
</style>
