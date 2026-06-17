import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-geoforge/dist/maplibre-geoforge.css';
import './styles.css';

import {
  Geoman,
  SOURCES,
  type ArrowFrequencyUnit,
  type DeselectFwdEvent,
  type FeatureData,
  type GeomanSelectionOptions,
  type LineDecoratorAnimationOptions,
  type LineDecoratorOptions,
  type LinePlacementFrequency,
  type PartialLayerStyle,
  type SelectFwdEvent,
} from 'maplibre-geoforge';
import maplibregl, { type GeoJSONSource, type Map } from 'maplibre-gl';
import type { Feature, LineString } from 'geojson';

type PlaygroundName = 'decorators' | 'overlays';
type LayerPosition = 'default' | 'below-lines' | 'above-lines';
type DecoratorKind = 'arrowhead' | 'symbol' | 'text';
type AnimationProperty = 'rotate' | 'opacity' | 'size' | 'fontSize';
type LineSelectionId = 'sample-line' | string;

const lineEditSelectionOptions: GeomanSelectionOptions = { allowedShapes: ['line'] };

type LineStyleState = {
  color: string;
  width: number;
  opacity: number;
};

type DecoratorFormState = {
  kind: DecoratorKind;
  frequency: string;
  segment: 'first' | 'middle' | 'last' | 'all';
  anchor: 'front' | 'middle' | 'back';
  offsetPercent: number;
  lineOffsetPx: number;
  startOffset: string;
  endOffset: string;
  rotateMode: 'line' | 'fixed' | 'viewport';
  rotateAngle: number;
  symbolPreset: 'chevron' | 'diamond' | 'dot' | 'custom';
  symbolColor: string;
  symbolSize: number;
  symbolOpacity: number;
  customSvg: string;
  customSvgCss: string;
  text: string;
  textColor: string;
  fontSize: number;
  textOpacity: number;
  haloColor: string;
  haloWidth: number;
  haloBlur: number;
  arrowColor: string;
  arrowFillColor: string;
  arrowSize: string;
  arrowYawn: number;
  arrowWeight: number;
  arrowOpacity: number;
  arrowFillOpacity: number;
  arrowFill: boolean;
  arrowProportional: boolean;
  animationEnabled: boolean;
  animationProperties: AnimationProperty[];
  animationFrom: number;
  animationTo: number;
  animationDurationMs: number;
  animationDelayMs: number;
  animationIterationCount: string;
  animationDirection: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  animationEasing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
};

const baseFormState: DecoratorFormState = {
  kind: 'symbol',
  frequency: 'single',
  segment: 'middle',
  anchor: 'middle',
  offsetPercent: 0,
  lineOffsetPx: 0,
  startOffset: '0px',
  endOffset: '0px',
  rotateMode: 'line',
  rotateAngle: -90,
  symbolPreset: 'chevron',
  symbolColor: '#0f766e',
  symbolSize: 1,
  symbolOpacity: 1,
  customSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <path class="mark" d="M6 16h17m0 0-7-7m7 7-7 7" />
</svg>`,
  customSvgCss: `.mark {
  fill: none;
  stroke: #0f766e;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}`,
  text: 'DN 300',
  textColor: '#172554',
  fontSize: 16,
  textOpacity: 1,
  haloColor: '#ffffff',
  haloWidth: 2,
  haloBlur: 0,
  arrowColor: '#f97316',
  arrowFillColor: '#f97316',
  arrowSize: '16px',
  arrowYawn: 60,
  arrowWeight: 2,
  arrowOpacity: 1,
  arrowFillOpacity: 0.22,
  arrowFill: true,
  arrowProportional: false,
  animationEnabled: false,
  animationProperties: ['rotate'],
  animationFrom: 0,
  animationTo: 360,
  animationDurationMs: 1200,
  animationDelayMs: 0,
  animationIterationCount: 'infinite',
  animationDirection: 'normal',
  animationEasing: 'linear',
};

const DEFAULT_LINE_STYLE: LineStyleState = {
  color: '#0f766e',
  width: 6,
  opacity: 0.86,
};

const geomanLineLayerStyle: PartialLayerStyle[] = [
  {
    type: 'line',
    paint: {
      'line-color': ['coalesce', ['get', 'lineColor'], DEFAULT_LINE_STYLE.color],
      'line-opacity': ['coalesce', ['get', 'lineOpacity'], DEFAULT_LINE_STYLE.opacity],
      'line-width': ['coalesce', ['get', 'lineWidth'], DEFAULT_LINE_STYLE.width],
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
  },
];

const app = requireElement<HTMLDivElement>('#app');

app.innerHTML = `
  <main class="shell">
    <aside class="sidebar" aria-label="Playground controls">
      <div>
        <p class="eyebrow">GeoForge</p>
        <h1>GeoForge Lab</h1>
        <p class="summary">Standalone package playground for decorators and HTML overlays.</p>
      </div>
      <nav class="nav" aria-label="Playgrounds">
        <button type="button" class="nav-button" data-playground="decorators">Line decorators</button>
        <button type="button" class="nav-button" data-playground="overlays">HTML overlays</button>
      </nav>
      <section class="panel" id="controls"></section>
      <section class="status" id="status" aria-live="polite">Initializing map...</section>
    </aside>
    <section class="map-wrap" aria-label="Map preview">
      <div id="map"></div>
    </section>
  </main>
`;

const controls = requireElement<HTMLElement>('#controls');
const status = requireElement<HTMLElement>('#status');
const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.nav-button'));

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: 'OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  },
  center: [19.047, 47.497],
  zoom: 13.4,
  pitch: 0,
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-left');

const geoman = new Geoman(map, {
  layerStyles: {
    line: {
      [SOURCES.main]: geomanLineLayerStyle,
      [SOURCES.temporary]: geomanLineLayerStyle,
    },
  },
});
geoman.tools.register({
  id: 'playground-single-feature-edit',
  title: 'Select feature to edit',
  control: {
    icon: handIcon(),
  },
  onStart: ({ geoman }) => {
    interactionMode = 'select';
    geoman.disableDraw();
    geoman.enableSingleFeatureEditMode(lineEditSelectionOptions);
    selectedLineId = geoman.getSelectedFeature()?.id
      ? String(geoman.getSelectedFeature()?.id)
      : selectedLineId;
    status.textContent = 'Interaction mode active. Hover a line, then click it to edit that line.';
    renderDecoratorPlayground();
  },
  onEnd: ({ geoman }) => {
    geoman.disableSingleFeatureEditMode();
  },
  onCancel: ({ geoman }) => {
    geoman.disableSingleFeatureEditMode();
  },
});
let decoratorFormState = { ...baseFormState };
let layerPosition: LayerPosition = 'above-lines';
let lineColor = DEFAULT_LINE_STYLE.color;
let lineWidth = DEFAULT_LINE_STYLE.width;
let lineOpacity = DEFAULT_LINE_STYLE.opacity;
let interactionMode: 'select' | 'draw' = 'select';
let selectedLineId: LineSelectionId | null = null;
let sampleLineVisible = true;
let syncRun = 0;

const lineFeature: Feature<LineString> = {
  type: 'Feature',
  id: 'lab-line-1',
  properties: {
    lineColor: DEFAULT_LINE_STYLE.color,
    lineWidth: DEFAULT_LINE_STYLE.width,
    lineOpacity: DEFAULT_LINE_STYLE.opacity,
    decorators: mixedCapabilityDecorators(),
  },
  geometry: {
    type: 'LineString',
    coordinates: [
      [19.025, 47.491],
      [19.04, 47.497],
      [19.055, 47.493],
      [19.071, 47.501],
    ],
  },
};

map.on('load', async () => {
  await ensureBaseSymbolImages(map);

  map.addSource('lab-lines', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [lineFeature],
    },
  });

  map.addLayer({
    id: 'lab-lines',
    type: 'line',
    source: 'lab-lines',
    paint: {
      'line-color': lineColor,
      'line-width': lineWidth,
      'line-opacity': lineOpacity,
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
  });

  setPlayground(resolveInitialPlayground());
});

map.on('gm:select', (event: SelectFwdEvent) => {
  if (event.feature.shape !== 'line') {
    return;
  }

  selectedLineId = String(event.feature.id);
  renderDecoratorPlayground();
});
map.on('gm:deselect', (_event: DeselectFwdEvent) => {
  selectedLineId = null;
  renderDecoratorPlayground();
});
map.on('gm:create', (event) => {
  const feature = event.feature as FeatureData;
  if (feature.shape !== 'line') {
    return;
  }

  feature.updateProperties({
    lineColor: DEFAULT_LINE_STYLE.color,
    lineWidth: DEFAULT_LINE_STYLE.width,
    lineOpacity: DEFAULT_LINE_STYLE.opacity,
    decorators: [],
  });
  selectLine(String(feature.id));
});
map.on('gm:remove', () => {
  if (selectedLineId && !getLineSelection(selectedLineId)) {
    selectedLineId = null;
  }
  renderDecoratorPlayground();
});

window.addEventListener('hashchange', () => {
  setPlayground(resolveInitialPlayground());
});

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const playground = button.dataset.playground as PlaygroundName;
    window.location.hash = playground;
    setPlayground(playground);
  });
});

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

function resolveInitialPlayground(): PlaygroundName {
  return window.location.hash === '#overlays' ? 'overlays' : 'decorators';
}

function setPlayground(playground: PlaygroundName) {
  navButtons.forEach((button) => {
    button.dataset.active = String(button.dataset.playground === playground);
  });

  geoman.decorators.lines.clear();
  geoman.overlays.html.destroy();

  if (playground === 'overlays') {
    geoman.disableSingleFeatureEditMode();
    renderOverlayPlayground();
  } else {
    if (interactionMode === 'select') {
      geoman.enableSingleFeatureEditMode(lineEditSelectionOptions);
    }
    renderDecoratorPlayground();
  }
}

function renderDecoratorPlayground() {
  const decorators = getDecorators();
  const selection = selectedLineId ? getLineSelection(selectedLineId) : null;
  const selectedStyle = selection ? getLineStyle(selection.feature) : null;
  controls.innerHTML = `
    <div class="panel-heading">
      <div>
        <h2>Line decorators</h2>
        <p>Exercise arrowheads, SVG symbols, text labels, placement, layer order, and property animations.</p>
      </div>
      <span class="count-pill">${decorators.length}</span>
    </div>

    <section class="control-section">
      <h3>Line mode</h3>
      <div class="mode-row">
        <button type="button" id="select-line-mode" class="mode-button ${interactionMode === 'select' ? '' : 'secondary'}" data-active="${interactionMode === 'select'}">
          ${handIcon()}
          <span>Interaction mode</span>
        </button>
        <button type="button" id="draw-line-mode" class="mode-button ${interactionMode === 'draw' ? '' : 'secondary'}" data-active="${interactionMode === 'draw'}">
          ${lineIcon()}
          <span>Draw line</span>
        </button>
      </div>
      <p class="muted">${
        selection
          ? `Editing ${escapeHtml(selection.label)}.`
          : 'No line selected. Use Interaction mode to hover and click an editable line.'
      }</p>
      ${
        selectedStyle
          ? `
            <div class="selected-line-editor">
              <div class="two-col">
                <label class="field">Selected color <input id="selected-line-color" type="color" value="${selectedStyle.color}" /></label>
                <label class="field">Selected width <input id="selected-line-width" type="number" min="1" max="24" step="1" value="${selectedStyle.width}" /></label>
              </div>
              <label class="field">Selected opacity <input id="selected-line-opacity" type="number" min="0" max="1" step="0.05" value="${selectedStyle.opacity}" /></label>
              <div class="button-row">
                <button type="button" id="apply-line-style">Apply style</button>
                <button type="button" id="delete-selected-line" class="secondary danger-subtle">Delete line</button>
              </div>
            </div>
          `
          : ''
      }
    </section>

    <section class="control-section">
      <h3>Scenario</h3>
      <div class="preset-grid">
        <button type="button" class="secondary" data-preset="mixed">Mixed animated</button>
        <button type="button" class="secondary" data-preset="arrows">Arrowheads</button>
        <button type="button" class="secondary" data-preset="symbols">SVG symbols</button>
        <button type="button" class="secondary" data-preset="text">Text labels</button>
      </div>
    </section>

    <section class="control-section">
      <h3>Map layers</h3>
      <label class="field">
        Decorator layer order
        <select id="decorator-layer-order">
          ${option('default', 'Default', layerPosition)}
          ${option('below-lines', 'Under line', layerPosition)}
          ${option('above-lines', 'Over line', layerPosition)}
        </select>
      </label>
      <div class="two-col">
        <label class="field">
          Line color
          <input id="line-color" type="color" value="${lineColor}" />
        </label>
        <label class="field">
          Line width
          <input id="line-width" type="number" min="1" max="18" step="1" value="${lineWidth}" />
        </label>
      </div>
      <label class="field">
        Default line opacity
        <input id="line-opacity" type="number" min="0" max="1" step="0.05" value="${lineOpacity}" />
      </label>
    </section>

    <section class="control-section">
      <h3>Add decorator</h3>
      <label class="field">
        Decorator kind
        <select id="decorator-kind">
          ${option('symbol', 'SVG symbol', decoratorFormState.kind)}
          ${option('text', 'Text', decoratorFormState.kind)}
          ${option('arrowhead', 'Arrowhead', decoratorFormState.kind)}
        </select>
      </label>
      ${renderKindFields(decoratorFormState)}
      ${renderPlacementFields(decoratorFormState)}
      ${renderAnimationFields(decoratorFormState)}
      <div class="button-row">
        <button type="button" id="add-decorator">Add decorator</button>
        <button type="button" id="update-preview" class="secondary">Preview form</button>
      </div>
    </section>

    <section class="control-section">
      <h3>Current decorators</h3>
      <div class="decorator-list">
        ${
          decorators.length === 0
            ? '<p class="muted">No line selected. Select a line in Interaction mode to edit its decorators.</p>'
            : decorators.map(renderDecoratorListItem).join('')
        }
      </div>
      <button type="button" id="clear-decorators" class="secondary danger-subtle">Clear all</button>
    </section>

    <details class="json-panel">
      <summary>Feature decorator JSON</summary>
      <pre>${escapeHtml(JSON.stringify(decorators, null, 2))}</pre>
    </details>
  `;

  wireDecoratorControls();
  void syncDecorators();
}

function renderKindFields(state: DecoratorFormState) {
  if (state.kind === 'arrowhead') {
    return `
      <div class="kind-fields">
        <div class="two-col">
          <label class="field">Stroke <input id="arrow-color" type="color" value="${state.arrowColor}" /></label>
          <label class="field">Fill <input id="arrow-fill-color" type="color" value="${state.arrowFillColor}" /></label>
        </div>
        <div class="two-col">
          <label class="field">Size <input id="arrow-size" type="text" value="${state.arrowSize}" /></label>
          <label class="field">Yawn <input id="arrow-yawn" type="number" min="10" max="160" step="1" value="${state.arrowYawn}" /></label>
        </div>
        <div class="two-col">
          <label class="field">Stroke width <input id="arrow-weight" type="number" min="0" max="10" step="0.5" value="${state.arrowWeight}" /></label>
          <label class="field">Opacity <input id="arrow-opacity" type="number" min="0" max="1" step="0.05" value="${state.arrowOpacity}" /></label>
        </div>
        <div class="two-col">
          <label class="field">Fill opacity <input id="arrow-fill-opacity" type="number" min="0" max="1" step="0.05" value="${state.arrowFillOpacity}" /></label>
          <label class="check compact"><input id="arrow-fill" type="checkbox" ${state.arrowFill ? 'checked' : ''} /> Fill arrowheads</label>
        </div>
        <label class="check compact"><input id="arrow-proportional" type="checkbox" ${state.arrowProportional ? 'checked' : ''} /> Proportional end-only size</label>
      </div>
    `;
  }

  if (state.kind === 'text') {
    return `
      <div class="kind-fields">
        <label class="field">Text <input id="text-value" type="text" value="${escapeAttribute(state.text)}" /></label>
        <div class="two-col">
          <label class="field">Text color <input id="text-color" type="color" value="${state.textColor}" /></label>
          <label class="field">Font size <input id="text-font-size" type="number" min="8" max="72" step="1" value="${state.fontSize}" /></label>
        </div>
        <div class="two-col">
          <label class="field">Opacity <input id="text-opacity" type="number" min="0" max="1" step="0.05" value="${state.textOpacity}" /></label>
          <label class="field">Halo color <input id="text-halo-color" type="color" value="${state.haloColor}" /></label>
        </div>
        <div class="two-col">
          <label class="field">Halo width <input id="text-halo-width" type="number" min="0" max="8" step="0.5" value="${state.haloWidth}" /></label>
          <label class="field">Halo blur <input id="text-halo-blur" type="number" min="0" max="8" step="0.5" value="${state.haloBlur}" /></label>
        </div>
      </div>
    `;
  }

  return `
    <div class="kind-fields">
      <label class="field">
        SVG preset
        <select id="symbol-preset">
          ${option('chevron', 'Chevron arrow', state.symbolPreset)}
          ${option('diamond', 'Diamond marker', state.symbolPreset)}
          ${option('dot', 'Dot marker', state.symbolPreset)}
          ${option('custom', 'Custom SVG + CSS', state.symbolPreset)}
        </select>
      </label>
      <div class="two-col">
        <label class="field">Symbol color <input id="symbol-color" type="color" value="${state.symbolColor}" /></label>
        <label class="field">Symbol size <input id="symbol-size" type="number" min="0.1" max="5" step="0.1" value="${state.symbolSize}" /></label>
      </div>
      <label class="field">Symbol opacity <input id="symbol-opacity" type="number" min="0" max="1" step="0.05" value="${state.symbolOpacity}" /></label>
      ${renderSvgAuthoringFields(state)}
    </div>
  `;
}

function renderSvgAuthoringFields(state: DecoratorFormState) {
  return `
    <div class="svg-authoring" id="svg-authoring">
      <label class="field">
        SVG markup
        <textarea id="custom-svg" rows="8" spellcheck="false" placeholder="Paste <svg>...</svg> markup here">${escapeHtml(state.customSvg)}</textarea>
      </label>
      <label class="field">
        SVG CSS
        <textarea id="custom-svg-css" rows="5" spellcheck="false" placeholder=".mark { ... }">${escapeHtml(state.customSvgCss)}</textarea>
      </label>
      <div class="svg-preview-box">
        <div class="svg-preview-toolbar">
          <strong>Live preview</strong>
          <span id="svg-preview-state">Waiting for SVG</span>
        </div>
        <div class="svg-preview-canvas">
          <img id="svg-live-preview" alt="Custom SVG preview" />
        </div>
      </div>
      <div class="drop-zone" id="svg-drop-zone" tabindex="0">
        <strong>Drop an SVG file here</strong>
        <span>or paste SVG tags directly into the markup editor.</span>
      </div>
    </div>
  `;
}

function renderPlacementFields(state: DecoratorFormState) {
  const arrowOnly = state.kind === 'arrowhead';
  return `
    <div class="accordion-block">
      <h4>Placement</h4>
      <label class="field">
        Frequency
        <select id="decorator-frequency">
          ${option('single', 'Single placement', state.frequency, arrowOnly)}
          ${option('3', '3 evenly spaced', state.frequency)}
          ${option('6', '6 evenly spaced', state.frequency)}
          ${option('40px', 'Every 40px', state.frequency)}
          ${option('80px', 'Every 80px', state.frequency)}
          ${option('200m', 'Every 200m', state.frequency)}
          ${option('allvertices', 'All vertices', state.frequency)}
          ${option('endonly', 'End only', state.frequency)}
        </select>
      </label>
      ${
        arrowOnly
          ? ''
          : `
            <div class="three-col">
              <label class="field">Segment
                <select id="segment-target">
                  ${option('first', 'First', state.segment)}
                  ${option('middle', 'Middle', state.segment)}
                  ${option('last', 'Last', state.segment)}
                  ${option('all', 'All', state.segment)}
                </select>
              </label>
              <label class="field">Anchor
                <select id="segment-anchor">
                  ${option('front', 'Front', state.anchor)}
                  ${option('middle', 'Middle', state.anchor)}
                  ${option('back', 'Back', state.anchor)}
                </select>
              </label>
              <label class="field">Percent offset <input id="offset-percent" type="number" min="-100" max="100" step="1" value="${state.offsetPercent}" /></label>
            </div>
            <label class="field">Line distance px <input id="line-offset-px" type="number" min="-120" max="120" step="1" value="${state.lineOffsetPx}" /></label>
          `
      }
      <div class="two-col">
        <label class="field">Start trim <input id="start-offset" type="text" value="${state.startOffset}" /></label>
        <label class="field">End trim <input id="end-offset" type="text" value="${state.endOffset}" /></label>
      </div>
      ${
        arrowOnly
          ? ''
          : `
            <div class="two-col">
              <label class="field">Rotation mode
                <select id="rotate-mode">
                  ${option('line', 'Follow line', state.rotateMode)}
                  ${option('fixed', 'Fixed map angle', state.rotateMode)}
                  ${option('viewport', 'Viewport aligned', state.rotateMode)}
                </select>
              </label>
              <label class="field">Rotation angle <input id="rotate-angle" type="number" min="-360" max="360" step="1" value="${state.rotateAngle}" /></label>
            </div>
          `
      }
    </div>
  `;
}

function renderAnimationFields(state: DecoratorFormState) {
  const supportsSize = state.kind === 'symbol' ? 'size' : 'fontSize';
  const disabled = state.kind === 'arrowhead';
  return `
    <div class="accordion-block ${disabled ? 'is-disabled' : ''}">
      <h4>Animations</h4>
      ${
        disabled
          ? '<p class="muted">Arrowhead animation is not exposed by the current line decorator API.</p>'
          : `
            <label class="check compact"><input id="animation-enabled" type="checkbox" ${state.animationEnabled ? 'checked' : ''} /> Enable package animation</label>
            <div class="check-grid">
              ${animationCheck('rotate', 'Rotate', state)}
              ${animationCheck('opacity', 'Opacity', state)}
              ${animationCheck(supportsSize, state.kind === 'symbol' ? 'Size' : 'Font size', state)}
            </div>
            <div class="two-col">
              <label class="field">From <input id="animation-from" type="number" step="0.1" value="${state.animationFrom}" /></label>
              <label class="field">To <input id="animation-to" type="number" step="0.1" value="${state.animationTo}" /></label>
            </div>
            <div class="two-col">
              <label class="field">Duration ms <input id="animation-duration" type="number" min="50" step="50" value="${state.animationDurationMs}" /></label>
              <label class="field">Delay ms <input id="animation-delay" type="number" min="0" step="50" value="${state.animationDelayMs}" /></label>
            </div>
            <div class="two-col">
              <label class="field">Iterations <input id="animation-iterations" type="text" value="${state.animationIterationCount}" /></label>
              <label class="field">Direction
                <select id="animation-direction">
                  ${option('normal', 'Normal', state.animationDirection)}
                  ${option('reverse', 'Reverse', state.animationDirection)}
                  ${option('alternate', 'Alternate', state.animationDirection)}
                  ${option('alternate-reverse', 'Alternate reverse', state.animationDirection)}
                </select>
              </label>
            </div>
            <label class="field">Easing
              <select id="animation-easing">
                ${option('linear', 'Linear', state.animationEasing)}
                ${option('ease', 'Ease', state.animationEasing)}
                ${option('ease-in', 'Ease in', state.animationEasing)}
                ${option('ease-out', 'Ease out', state.animationEasing)}
                ${option('ease-in-out', 'Ease in out', state.animationEasing)}
              </select>
            </label>
          `
      }
    </div>
  `;
}

function wireDecoratorControls() {
  controls.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = button.dataset.preset;
      sampleLineVisible = true;
      selectedLineId = 'sample-line';
      setActiveLineDecorators(
        preset === 'arrows'
          ? arrowheadDecorators()
          : preset === 'symbols'
            ? symbolDecorators()
            : preset === 'text'
              ? textDecorators()
              : mixedCapabilityDecorators(),
      );
      renderDecoratorPlayground();
    });
  });

  controls.querySelector('#select-line-mode')?.addEventListener('click', () => {
    setInteractionMode('select');
    renderDecoratorPlayground();
  });

  controls.querySelector('#draw-line-mode')?.addEventListener('click', () => {
    setInteractionMode('draw');
    renderDecoratorPlayground();
  });

  controls.querySelector('#apply-line-style')?.addEventListener('click', () => {
    applySelectedLineStyle();
  });

  controls.querySelector('#delete-selected-line')?.addEventListener('click', () => {
    deleteSelectedLine();
  });

  onChange('#decorator-layer-order', (element) => {
    layerPosition = element.value as LayerPosition;
    geoman.decorators.lines.configure({ layerPosition });
    void syncDecorators();
  });

  onInput('#line-color', (element) => {
    lineColor = element.value;
    updateDefaultLineStyle();
  });

  onInput('#line-width', (element) => {
    lineWidth = readNumber(element, lineWidth);
    updateDefaultLineStyle();
  });

  onInput('#line-opacity', (element) => {
    lineOpacity = readNumber(element, lineOpacity);
    updateDefaultLineStyle();
  });

  controls.querySelector('#decorator-kind')?.addEventListener('change', () => {
    readDecoratorForm();
    renderDecoratorPlayground();
  });

  wireSvgAuthoringControls();

  controls.querySelector('#update-preview')?.addEventListener('click', () => {
    readDecoratorForm();
    updateSvgPreview();
    status.textContent = `Preview ready for ${decoratorFormState.kind}. Add it to render on the map.`;
  });

  controls.querySelector('#add-decorator')?.addEventListener('click', async () => {
    readDecoratorForm();
    const decorator = await buildDecoratorFromForm();
    const decorators = getDecorators();
    setActiveLineDecorators([...decorators, decorator]);
    renderDecoratorPlayground();
  });

  controls.querySelector('#clear-decorators')?.addEventListener('click', () => {
    setActiveLineDecorators([]);
    renderDecoratorPlayground();
  });

  controls.querySelectorAll<HTMLButtonElement>('[data-remove-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const removeIndex = Number(button.dataset.removeIndex);
      setActiveLineDecorators(getDecorators().filter((_, index) => index !== removeIndex));
      renderDecoratorPlayground();
    });
  });
}

function setInteractionMode(mode: typeof interactionMode) {
  interactionMode = mode;

  if (mode === 'draw') {
    geoman.disableSingleFeatureEditMode();
    geoman.disableDraw();
    geoman.enableDraw('line');
    status.textContent = 'Draw mode active. Finish the line to select it and edit its style.';
    return;
  }

  geoman.disableDraw();
  geoman.enableSingleFeatureEditMode(lineEditSelectionOptions);
  selectedLineId = geoman.getSelectedFeature()?.id
    ? String(geoman.getSelectedFeature()?.id)
    : selectedLineId;
  status.textContent = 'Interaction mode active. Hover a line, then click it to edit that line.';
}

function selectLine(lineId: LineSelectionId) {
  selectedLineId = lineId;
  setInteractionMode('select');
  if (lineId !== 'sample-line') {
    geoman.selection.selectFeature(lineId, { reason: 'api' });
  }
  renderDecoratorPlayground();
}

function getLineSelection(lineId: LineSelectionId) {
  if (lineId === 'sample-line') {
    if (!sampleLineVisible) {
      return null;
    }
    return { id: lineId, label: 'sample line', feature: lineFeature };
  }

  const featureData = geoman.features.featureStore.get(lineId);
  if (!featureData || featureData.shape !== 'line') {
    return null;
  }

  return {
    id: lineId,
    label: `drawn line ${lineId}`,
    feature: featureData.getGeoJson() as Feature<LineString>,
    featureData,
  };
}

function getLineStyle(feature: Feature): LineStyleState {
  return {
    color:
      typeof feature.properties?.lineColor === 'string' ? feature.properties.lineColor : lineColor,
    width:
      typeof feature.properties?.lineWidth === 'number' &&
      Number.isFinite(feature.properties.lineWidth)
        ? feature.properties.lineWidth
        : lineWidth,
    opacity:
      typeof feature.properties?.lineOpacity === 'number' &&
      Number.isFinite(feature.properties.lineOpacity)
        ? feature.properties.lineOpacity
        : lineOpacity,
  };
}

function applySelectedLineStyle() {
  if (!selectedLineId) {
    return;
  }

  const selection = getLineSelection(selectedLineId);
  if (!selection) {
    selectedLineId = null;
    renderDecoratorPlayground();
    return;
  }

  const nextStyle = {
    lineColor: readInputValue('selected-line-color', DEFAULT_LINE_STYLE.color),
    lineWidth: readNumberById('selected-line-width', DEFAULT_LINE_STYLE.width),
    lineOpacity: readNumberById('selected-line-opacity', DEFAULT_LINE_STYLE.opacity),
  };

  if ('featureData' in selection && selection.featureData) {
    selection.featureData.updateProperties(nextStyle);
  } else {
    lineFeature.properties = {
      ...(lineFeature.properties ?? {}),
      ...nextStyle,
    };
    updateLabLineSource();
  }

  void syncDecorators();
  status.textContent = `Updated ${selection.label} style.`;
}

function deleteSelectedLine() {
  if (!selectedLineId) {
    return;
  }

  const selection = getLineSelection(selectedLineId);
  if (!selection) {
    selectedLineId = null;
    renderDecoratorPlayground();
    return;
  }

  if ('featureData' in selection && selection.featureData) {
    selection.featureData.updateProperties({ decorators: undefined });
    selection.featureData.delete();
    geoman.features.delete(selection.featureData);
  } else {
    lineFeature.properties = {
      ...(lineFeature.properties ?? {}),
      decorators: [],
    };
    sampleLineVisible = false;
    updateLabLineSource();
  }

  selectedLineId = null;
  void syncDecorators();
  renderDecoratorPlayground();
}

function updateDefaultLineStyle() {
  if (map.getLayer('lab-lines')) {
    map.setPaintProperty('lab-lines', 'line-color', lineColor);
    map.setPaintProperty('lab-lines', 'line-width', lineWidth);
    map.setPaintProperty('lab-lines', 'line-opacity', lineOpacity);
  }
}

function updateLabLineSource() {
  const source = map.getSource('lab-lines') as GeoJSONSource | undefined;
  source?.setData({
    type: 'FeatureCollection',
    features: sampleLineVisible ? [lineFeature] : [],
  });
}

function getActiveLineSelection() {
  return selectedLineId ? getLineSelection(selectedLineId) : null;
}

function wireSvgAuthoringControls() {
  const svgInput = controls.querySelector<HTMLTextAreaElement>('#custom-svg');
  const cssInput = controls.querySelector<HTMLTextAreaElement>('#custom-svg-css');
  const dropZone = controls.querySelector<HTMLElement>('#svg-drop-zone');
  const presetSelect = controls.querySelector<HTMLSelectElement>('#symbol-preset');
  const colorInput = controls.querySelector<HTMLInputElement>('#symbol-color');

  if (!svgInput || !cssInput || !dropZone || !presetSelect || !colorInput) {
    return;
  }

  const update = () => {
    decoratorFormState.customSvg = svgInput.value;
    decoratorFormState.customSvgCss = cssInput.value;
    updateSvgPreview();
  };

  svgInput.addEventListener('input', update);
  cssInput.addEventListener('input', update);
  svgInput.addEventListener('paste', () => window.setTimeout(update, 0));
  presetSelect.addEventListener('change', () => {
    decoratorFormState.symbolPreset = presetSelect.value as DecoratorFormState['symbolPreset'];
    if (decoratorFormState.symbolPreset !== 'custom') {
      const preset = svgPresetAuthoring(
        decoratorFormState.symbolPreset,
        colorInput.value || decoratorFormState.symbolColor,
      );
      svgInput.value = preset.svg;
      cssInput.value = preset.css;
    }
    update();
  });
  colorInput.addEventListener('input', () => {
    decoratorFormState.symbolColor = colorInput.value;
    decoratorFormState.symbolPreset = presetSelect.value as DecoratorFormState['symbolPreset'];
    if (decoratorFormState.symbolPreset !== 'custom') {
      const preset = svgPresetAuthoring(decoratorFormState.symbolPreset, colorInput.value);
      svgInput.value = preset.svg;
      cssInput.value = preset.css;
    }
    update();
  });

  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.dataset.dragging = 'true';
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.dataset.dragging = 'false';
  });
  dropZone.addEventListener('drop', async (event) => {
    event.preventDefault();
    dropZone.dataset.dragging = 'false';
    const file = event.dataTransfer?.files.item(0);
    const droppedText = event.dataTransfer?.getData('text/plain');

    if (file) {
      svgInput.value = await file.text();
      update();
      return;
    }

    if (droppedText?.trim()) {
      svgInput.value = droppedText;
      update();
    }
  });

  updateSvgPreview();
}

function updateSvgPreview() {
  const preview = controls.querySelector<HTMLImageElement>('#svg-live-preview');
  const state = controls.querySelector<HTMLElement>('#svg-preview-state');
  const svgInput = controls.querySelector<HTMLTextAreaElement>('#custom-svg');
  const cssInput = controls.querySelector<HTMLTextAreaElement>('#custom-svg-css');

  if (!preview || !state || !svgInput || !cssInput) {
    return;
  }

  const svg = svgInput.value.trim();
  const css = cssInput.value.trim();
  const mergedSvg = mergeSvgCss(svg, css);
  const validation = validateSvgMarkup(mergedSvg);

  if (!validation.valid) {
    preview.removeAttribute('src');
    preview.hidden = true;
    state.textContent = validation.message;
    state.dataset.valid = 'false';
    return;
  }

  preview.hidden = false;
  preview.src = svgToDataUrl(mergedSvg);
  state.textContent = 'Live';
  state.dataset.valid = 'true';
}

function readDecoratorForm() {
  decoratorFormState = {
    ...decoratorFormState,
    kind: readSelectValue('decorator-kind', decoratorFormState.kind),
    frequency: readSelectValue('decorator-frequency', decoratorFormState.frequency),
    segment: readSelectValue('segment-target', decoratorFormState.segment),
    anchor: readSelectValue('segment-anchor', decoratorFormState.anchor),
    offsetPercent: readNumberById('offset-percent', decoratorFormState.offsetPercent),
    lineOffsetPx: readNumberById('line-offset-px', decoratorFormState.lineOffsetPx),
    startOffset: readInputValue('start-offset', decoratorFormState.startOffset),
    endOffset: readInputValue('end-offset', decoratorFormState.endOffset),
    rotateMode: readSelectValue('rotate-mode', decoratorFormState.rotateMode),
    rotateAngle: readNumberById('rotate-angle', decoratorFormState.rotateAngle),
    symbolPreset: readSelectValue('symbol-preset', decoratorFormState.symbolPreset),
    symbolColor: readInputValue('symbol-color', decoratorFormState.symbolColor),
    symbolSize: readNumberById('symbol-size', decoratorFormState.symbolSize),
    symbolOpacity: readNumberById('symbol-opacity', decoratorFormState.symbolOpacity),
    customSvg: readTextareaValue('custom-svg', decoratorFormState.customSvg),
    customSvgCss: readTextareaValue('custom-svg-css', decoratorFormState.customSvgCss),
    text: readInputValue('text-value', decoratorFormState.text),
    textColor: readInputValue('text-color', decoratorFormState.textColor),
    fontSize: readNumberById('text-font-size', decoratorFormState.fontSize),
    textOpacity: readNumberById('text-opacity', decoratorFormState.textOpacity),
    haloColor: readInputValue('text-halo-color', decoratorFormState.haloColor),
    haloWidth: readNumberById('text-halo-width', decoratorFormState.haloWidth),
    haloBlur: readNumberById('text-halo-blur', decoratorFormState.haloBlur),
    arrowColor: readInputValue('arrow-color', decoratorFormState.arrowColor),
    arrowFillColor: readInputValue('arrow-fill-color', decoratorFormState.arrowFillColor),
    arrowSize: readInputValue('arrow-size', decoratorFormState.arrowSize),
    arrowYawn: readNumberById('arrow-yawn', decoratorFormState.arrowYawn),
    arrowWeight: readNumberById('arrow-weight', decoratorFormState.arrowWeight),
    arrowOpacity: readNumberById('arrow-opacity', decoratorFormState.arrowOpacity),
    arrowFillOpacity: readNumberById('arrow-fill-opacity', decoratorFormState.arrowFillOpacity),
    arrowFill: readChecked('arrow-fill', decoratorFormState.arrowFill),
    arrowProportional: readChecked('arrow-proportional', decoratorFormState.arrowProportional),
    animationEnabled: readChecked('animation-enabled', decoratorFormState.animationEnabled),
    animationProperties: readAnimationProperties(),
    animationFrom: readNumberById('animation-from', decoratorFormState.animationFrom),
    animationTo: readNumberById('animation-to', decoratorFormState.animationTo),
    animationDurationMs: readNumberById(
      'animation-duration',
      decoratorFormState.animationDurationMs,
    ),
    animationDelayMs: readNumberById('animation-delay', decoratorFormState.animationDelayMs),
    animationIterationCount: readInputValue(
      'animation-iterations',
      decoratorFormState.animationIterationCount,
    ),
    animationDirection: readSelectValue(
      'animation-direction',
      decoratorFormState.animationDirection,
    ),
    animationEasing: readSelectValue('animation-easing', decoratorFormState.animationEasing),
  };
}

async function buildDecoratorFromForm(): Promise<LineDecoratorOptions> {
  const id = `${decoratorFormState.kind}-${Date.now().toString(36)}`;
  const frequency = parseFrequency(decoratorFormState.frequency);
  const offsets = buildOffsets();

  if (decoratorFormState.kind === 'arrowhead') {
    const arrowFrequency: ArrowFrequencyUnit =
      decoratorFormState.frequency === 'single' ? 'endonly' : (frequency as ArrowFrequencyUnit);
    return {
      kind: 'arrowhead',
      id,
      frequency: arrowFrequency,
      offsets,
      color: decoratorFormState.arrowColor,
      fillColor: decoratorFormState.arrowFillColor,
      fill: decoratorFormState.arrowFill,
      size: decoratorFormState.arrowSize as never,
      yawn: decoratorFormState.arrowYawn,
      weight: decoratorFormState.arrowWeight,
      opacity: decoratorFormState.arrowOpacity,
      fillOpacity: decoratorFormState.arrowFillOpacity,
      proportionalToTotal: decoratorFormState.arrowProportional,
    };
  }

  const placement = {
    frequency,
    offsets,
    segment: decoratorFormState.segment,
    anchor: decoratorFormState.anchor,
    offsetPercent: decoratorFormState.offsetPercent,
    lineOffsetPx: decoratorFormState.lineOffsetPx,
    rotate: {
      mode: decoratorFormState.rotateMode,
      angle: decoratorFormState.rotateAngle,
    },
    animation: buildAnimations(decoratorFormState.kind),
  };

  if (decoratorFormState.kind === 'text') {
    return {
      kind: 'text',
      id,
      text: decoratorFormState.text,
      color: decoratorFormState.textColor,
      fontSize: decoratorFormState.fontSize,
      opacity: decoratorFormState.textOpacity,
      haloColor: decoratorFormState.haloColor,
      haloWidth: decoratorFormState.haloWidth,
      haloBlur: decoratorFormState.haloBlur,
      ...placement,
    };
  }

  const imageId = await resolveSymbolImageId();
  return {
    kind: 'symbol',
    id,
    imageId,
    color: decoratorFormState.symbolColor,
    size: decoratorFormState.symbolSize,
    opacity: decoratorFormState.symbolOpacity,
    ...placement,
  };
}

async function syncDecorators() {
  const runId = ++syncRun;
  await ensureImagesForDecorators();
  if (runId !== syncRun) {
    return;
  }

  geoman.decorators.lines.configure({ layerPosition });
  geoman.decorators.lines.syncFromFeatures(getDecoratorLineFeatures(), (feature) => {
    return Array.isArray(feature.properties?.decorators) ? feature.properties.decorators : [];
  });

  updateLabLineSource();

  const count = getDecorators().length;
  if (interactionMode === 'draw') {
    status.textContent = 'Draw mode active. Finish the line to select it and edit its style.';
  } else if (selectedLineId) {
    status.textContent = `${count} decorator${count === 1 ? '' : 's'} rendered on the selected line. Layer order: ${layerPosition}.`;
  } else {
    status.textContent =
      'No line selected. Use Interaction mode to hover and click an editable line.';
  }
}

function getDecorators(): LineDecoratorOptions[] {
  const selection = getActiveLineSelection();
  return Array.isArray(selection?.feature.properties?.decorators)
    ? (selection.feature.properties.decorators as LineDecoratorOptions[])
    : [];
}

function setActiveLineDecorators(decorators: LineDecoratorOptions[]) {
  const selection = getActiveLineSelection();
  if (!selection) {
    return;
  }

  if ('featureData' in selection && selection.featureData) {
    selection.featureData.updateProperties({ decorators });
  } else {
    lineFeature.properties = {
      ...(lineFeature.properties ?? {}),
      lineColor,
      lineWidth,
      lineOpacity,
      decorators,
    };
    updateLabLineSource();
  }
}

function getDecoratorLineFeatures(): Feature<LineString>[] {
  const geomanLines: Feature<LineString>[] = [];
  geoman.features.featureStore.forEach((featureData) => {
    if (featureData.shape === 'line') {
      geomanLines.push(featureData.getGeoJson() as Feature<LineString>);
    }
  });

  return sampleLineVisible ? [lineFeature, ...geomanLines] : geomanLines;
}

function arrowheadDecorators(): LineDecoratorOptions[] {
  return [
    {
      kind: 'arrowhead',
      color: '#f97316',
      fillColor: '#fed7aa',
      fill: true,
      size: '18px',
      yawn: 62,
      frequency: '60px',
      offsets: { start: '12px', end: '16px' },
      weight: 2,
      opacity: 1,
      fillOpacity: 0.55,
    },
    {
      kind: 'arrowhead',
      color: '#172554',
      fill: false,
      size: '22px',
      yawn: 84,
      frequency: 'endonly',
      proportionalToTotal: true,
      offsets: { end: '10px' },
      weight: 3,
    },
  ];
}

function symbolDecorators(): LineDecoratorOptions[] {
  return [
    {
      kind: 'symbol',
      id: 'svg-first',
      imageId: 'lab-chevron',
      size: 1.15,
      opacity: 1,
      frequency: 'single',
      segment: 'first',
      anchor: 'middle',
      offsetPercent: 0,
      lineOffsetPx: -18,
      rotate: { mode: 'line', angle: -90 },
    },
    {
      kind: 'symbol',
      id: 'svg-all',
      imageId: 'lab-diamond',
      size: 0.85,
      opacity: 0.95,
      frequency: 'single',
      segment: 'all',
      anchor: 'middle',
      offsetPercent: 18,
      lineOffsetPx: 18,
      rotate: { mode: 'viewport', angle: 0 },
      animation: [
        {
          property: 'opacity',
          from: 0.35,
          to: 1,
          durationMs: 900,
          iterationCount: 'infinite',
          direction: 'alternate',
          easing: 'ease-in-out',
        },
        {
          property: 'size',
          from: 0.7,
          to: 1.2,
          durationMs: 900,
          iterationCount: 'infinite',
          direction: 'alternate',
          easing: 'ease-in-out',
        },
      ],
    },
    {
      kind: 'symbol',
      id: 'svg-repeat',
      imageId: 'lab-chevron',
      size: 0.72,
      opacity: 0.9,
      frequency: '80px',
      offsets: { start: '20px', end: '20px' },
      rotate: { mode: 'line', angle: -90 },
    },
  ];
}

function textDecorators(): LineDecoratorOptions[] {
  return [
    {
      kind: 'text',
      id: 'text-middle',
      text: 'DN 300',
      fontSize: 16,
      color: '#172554',
      haloColor: '#ffffff',
      haloWidth: 2,
      frequency: 'single',
      segment: 'middle',
      anchor: 'middle',
      lineOffsetPx: -18,
      rotate: { mode: 'line', angle: -90 },
    },
    {
      kind: 'text',
      id: 'text-animated',
      text: 'FLOW',
      fontSize: 14,
      color: '#be123c',
      haloColor: '#ffffff',
      haloWidth: 2,
      frequency: '80px',
      offsets: { start: '20px', end: '20px' },
      rotate: { mode: 'line', angle: -90 },
      animation: [
        {
          property: 'opacity',
          from: 0.35,
          to: 1,
          durationMs: 800,
          iterationCount: 'infinite',
          direction: 'alternate',
          easing: 'ease-in-out',
        },
        {
          property: 'fontSize',
          from: 12,
          to: 18,
          durationMs: 800,
          iterationCount: 'infinite',
          direction: 'alternate',
          easing: 'ease-in-out',
        },
      ],
    },
  ];
}

function mixedCapabilityDecorators(): LineDecoratorOptions[] {
  return [...arrowheadDecorators().slice(0, 1), ...symbolDecorators(), ...textDecorators()];
}

async function ensureBaseSymbolImages(targetMap: Map) {
  await Promise.all([
    ensureSvgImage(targetMap, 'lab-chevron', chevronSvg('#0f766e')),
    ensureSvgImage(targetMap, 'lab-diamond', diamondSvg('#be123c')),
    ensureSvgImage(targetMap, 'lab-dot', dotSvg('#2563eb')),
  ]);
}

async function ensureImagesForDecorators() {
  const symbols = getDecorators().filter(
    (decorator): decorator is Extract<LineDecoratorOptions, { kind: 'symbol' }> =>
      decorator.kind === 'symbol',
  );

  await Promise.all(
    symbols.map((decorator) => {
      if (map.hasImage(decorator.imageId)) {
        return Promise.resolve();
      }

      return ensureSvgImage(map, decorator.imageId, chevronSvg(decorator.color ?? '#0f766e'));
    }),
  );
}

async function resolveSymbolImageId() {
  if (decoratorFormState.symbolPreset === 'custom') {
    const id = `custom-svg-${Date.now().toString(36)}`;
    await ensureSvgImage(
      map,
      id,
      mergeSvgCss(decoratorFormState.customSvg, decoratorFormState.customSvgCss),
    );
    return id;
  }

  const idByPreset = {
    chevron: 'lab-chevron',
    diamond: 'lab-diamond',
    dot: 'lab-dot',
  } satisfies Record<Exclude<DecoratorFormState['symbolPreset'], 'custom'>, string>;

  return idByPreset[decoratorFormState.symbolPreset];
}

async function ensureSvgImage(targetMap: Map, id: string, svg: string) {
  if (targetMap.hasImage(id)) {
    return;
  }

  const image = await svgToImage(svg);
  targetMap.addImage(id, image);
}

function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(32, 32);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to load SVG image'));
    };
    image.src = url;
  });
}

function mergeSvgCss(svg: string, css: string) {
  const style = `<style>${css}</style>`;
  if (svg.includes('<style')) {
    return svg;
  }

  return svg.replace(/<svg([^>]*)>/i, `<svg$1>${style}`);
}

function svgPresetAuthoring(
  preset: Exclude<DecoratorFormState['symbolPreset'], 'custom'>,
  color: string,
) {
  if (preset === 'diamond') {
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <path class="mark" d="M16 3 29 16 16 29 3 16Z" />
  <path class="shine" d="M16 8 24 16 16 24 8 16Z" />
</svg>`,
      css: `.mark {
  fill: ${color};
}

.shine {
  fill: #ffffff;
  fill-opacity: 0.78;
}`,
    };
  }

  if (preset === 'dot') {
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <circle class="mark" cx="16" cy="16" r="10" />
  <circle class="shine" cx="16" cy="16" r="4" />
</svg>`,
      css: `.mark {
  fill: ${color};
}

.shine {
  fill: #ffffff;
}`,
    };
  }

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <path class="mark" d="M6 16h17m0 0-7-7m7 7-7 7" />
</svg>`,
    css: `.mark {
  fill: none;
  stroke: ${color};
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}`,
  };
}

function validateSvgMarkup(svg: string) {
  if (!svg.trim()) {
    return { valid: false, message: 'Paste SVG markup' };
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(svg, 'image/svg+xml');
  const parserError = parsed.querySelector('parsererror');
  const root = parsed.documentElement;

  if (parserError || root.nodeName.toLowerCase() !== 'svg') {
    return { valid: false, message: 'Invalid SVG' };
  }

  return { valid: true, message: 'Live' };
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function chevronSvg(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M7 16h17m0 0-7-7m7 7-7 7" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function diamondSvg(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 3 29 16 16 29 3 16Z" fill="${color}" fill-opacity=".92"/><path d="M16 8 24 16 16 24 8 16Z" fill="#fff" fill-opacity=".78"/></svg>`;
}

function dotSvg(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="${color}"/><circle cx="16" cy="16" r="4" fill="#fff"/></svg>`;
}

function buildAnimations(
  kind: Exclude<DecoratorKind, 'arrowhead'>,
): LineDecoratorAnimationOptions[] | undefined {
  if (!decoratorFormState.animationEnabled) {
    return undefined;
  }

  const properties = decoratorFormState.animationProperties.filter((property) => {
    if (kind === 'symbol') {
      return property !== 'fontSize';
    }

    return property !== 'size';
  });

  return properties.map(
    (property): LineDecoratorAnimationOptions => ({
      property,
      from: decoratorFormState.animationFrom,
      to: decoratorFormState.animationTo,
      durationMs: decoratorFormState.animationDurationMs,
      delayMs: decoratorFormState.animationDelayMs,
      iterationCount:
        decoratorFormState.animationIterationCount === 'infinite'
          ? 'infinite'
          : Number(decoratorFormState.animationIterationCount) || 1,
      direction: decoratorFormState.animationDirection,
      easing: decoratorFormState.animationEasing,
    }),
  );
}

function buildOffsets() {
  const start = decoratorFormState.startOffset.trim();
  const end = decoratorFormState.endOffset.trim();
  return {
    ...(start ? { start: start as never } : {}),
    ...(end ? { end: end as never } : {}),
  };
}

function parseFrequency(value: string): LinePlacementFrequency {
  const numeric = Number(value);
  return Number.isFinite(numeric) && value.trim() !== ''
    ? numeric
    : (value as LinePlacementFrequency);
}

function renderDecoratorListItem(decorator: LineDecoratorOptions, index: number) {
  const kind = decorator.kind ?? 'arrowhead';
  const detail =
    decorator.kind === 'text'
      ? decorator.text
      : decorator.kind === 'symbol'
        ? decorator.imageId
        : String(decorator.frequency ?? 'default');

  return `
    <div class="decorator-item">
      <div>
        <strong>${kind}</strong>
        <span>${escapeHtml(detail)}</span>
      </div>
      <button type="button" class="icon-button" data-remove-index="${index}" aria-label="Remove ${kind} decorator">Remove</button>
    </div>
  `;
}

function animationCheck(property: AnimationProperty, label: string, state: DecoratorFormState) {
  return `
    <label class="check compact">
      <input type="checkbox" data-animation-property="${property}" ${
        state.animationProperties.includes(property) ? 'checked' : ''
      } />
      ${label}
    </label>
  `;
}

function option(value: string, label: string, selected: string, disabled = false) {
  return `<option value="${value}" ${value === selected ? 'selected' : ''} ${
    disabled ? 'disabled' : ''
  }>${label}</option>`;
}

function handIcon() {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" class="button-icon"><path d="M8 12V5.75a1.25 1.25 0 0 1 2.5 0V11m0 0V4.75a1.25 1.25 0 0 1 2.5 0V11m0 0V6.25a1.25 1.25 0 0 1 2.5 0V13m0-1.5v-3a1.25 1.25 0 0 1 2.5 0v5.65c0 3.3-2.35 5.85-5.75 5.85h-1.1a5.5 5.5 0 0 1-4.55-2.43L4.1 13.7a1.35 1.35 0 0 1 2.1-1.68L8 14.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function lineIcon() {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" class="button-icon"><path d="M4 17 9.5 8.5l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17h.01M20 6h.01" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`;
}

function onInput(selector: string, callback: (element: HTMLInputElement) => void) {
  controls.querySelector<HTMLInputElement>(selector)?.addEventListener('input', (event) => {
    callback(event.currentTarget as HTMLInputElement);
  });
}

function onChange(selector: string, callback: (element: HTMLSelectElement) => void) {
  controls.querySelector<HTMLSelectElement>(selector)?.addEventListener('change', (event) => {
    callback(event.currentTarget as HTMLSelectElement);
  });
}

function readSelectValue<T extends string>(id: string, fallback: T): T {
  return (controls.querySelector<HTMLSelectElement>(`#${id}`)?.value as T | undefined) ?? fallback;
}

function readInputValue(id: string, fallback: string) {
  return controls.querySelector<HTMLInputElement>(`#${id}`)?.value ?? fallback;
}

function readTextareaValue(id: string, fallback: string) {
  return controls.querySelector<HTMLTextAreaElement>(`#${id}`)?.value ?? fallback;
}

function readNumberById(id: string, fallback: number) {
  const input = controls.querySelector<HTMLInputElement>(`#${id}`);
  return input ? readNumber(input, fallback) : fallback;
}

function readNumber(input: HTMLInputElement, fallback: number) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function readChecked(id: string, fallback: boolean) {
  return controls.querySelector<HTMLInputElement>(`#${id}`)?.checked ?? fallback;
}

function readAnimationProperties(): AnimationProperty[] {
  const properties = Array.from(
    controls.querySelectorAll<HTMLInputElement>('[data-animation-property]:checked'),
  )
    .map((input) => input.dataset.animationProperty)
    .filter((property): property is AnimationProperty =>
      ['rotate', 'opacity', 'size', 'fontSize'].includes(property ?? ''),
    );

  return properties.length > 0 ? properties : decoratorFormState.animationProperties;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('\n', '&#10;');
}

function renderOverlayPlayground() {
  controls.innerHTML = `
    <h2>HTML overlays</h2>
    <label class="check">
      <input id="overlay-interactable" type="checkbox" checked />
      Interactable iframe
    </label>
    <label class="field">
      Pointer mode
      <select id="overlay-pointer-mode">
        <option value="selected">Selected</option>
        <option value="always">Always</option>
        <option value="none">Read only</option>
      </select>
    </label>
    <div class="button-row">
      <button type="button" id="pitch-map">Pitch map</button>
      <button type="button" id="reset-overlay">Reset overlay</button>
    </div>
  `;

  const interactable = controls.querySelector<HTMLInputElement>('#overlay-interactable');
  const pointerMode = controls.querySelector<HTMLSelectElement>('#overlay-pointer-mode');
  const pitchMap = controls.querySelector<HTMLButtonElement>('#pitch-map');
  const resetOverlay = controls.querySelector<HTMLButtonElement>('#reset-overlay');

  if (!interactable || !pointerMode || !pitchMap || !resetOverlay) {
    throw new Error('Overlay controls failed to render');
  }

  const syncOverlay = () => {
    geoman.overlays.html.add({
      id: 'lab-overlay',
      selected: true,
      html: overlayHtml(),
      corners: {
        topLeft: [19.039, 47.501],
        topRight: [19.052, 47.501],
        bottomRight: [19.052, 47.496],
        bottomLeft: [19.039, 47.496],
      },
      iframe: {
        title: 'GeoForge overlay sample',
        interactable: interactable.checked,
        pointerMode: pointerMode.value as never,
        sandbox: ['allow-scripts', 'allow-same-origin'],
      },
    });
    geoman.overlays.html.setSelected('lab-overlay');
    status.textContent = `Overlay ready. Pointer mode: ${pointerMode.value}.`;
  };

  interactable.addEventListener('change', syncOverlay);
  pointerMode.addEventListener('change', syncOverlay);
  pitchMap.addEventListener('click', () => {
    const pitched = map.getPitch() > 0;
    map.easeTo({
      pitch: pitched ? 0 : 58,
      bearing: pitched ? 0 : -18,
      duration: 500,
    });
    pitchMap.textContent = pitched ? 'Pitch map' : 'Flatten map';
  });
  resetOverlay.addEventListener('click', syncOverlay);

  syncOverlay();
}

function overlayHtml() {
  return `
    <!doctype html>
    <html>
      <head>
        <style>
          body {
            margin: 0;
            font-family: Inter, system-ui, sans-serif;
            background: #f8fafc;
            color: #0f172a;
          }
          .card {
            height: 100vh;
            box-sizing: border-box;
            padding: 16px;
            border: 2px solid #0f766e;
            background: linear-gradient(135deg, #ffffff, #dbeafe);
          }
          h1 { margin: 0 0 8px; font-size: 18px; }
          button {
            border: 0;
            border-radius: 6px;
            padding: 8px 10px;
            background: #0f766e;
            color: white;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <section class="card">
          <h1>Iframe overlay</h1>
          <p>Anchored to four map coordinates.</p>
          <button onclick="document.body.dataset.clicked = 'true'">Test button</button>
        </section>
      </body>
    </html>
  `;
}
