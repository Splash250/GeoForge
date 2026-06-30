import type {
  HtmlOverlayDefinition,
  HtmlOverlayPointerMode,
  HtmlOverlaySandboxToken,
} from 'maplibre-geoforge';
import type { DemoDefinition } from '../../registry/types.ts';
import OverlayInspector from './OverlayInspector.svelte';
import OverlayPointerInspector from './OverlayPointerInspector.svelte';

const overlayId = 'overlays-html-iframe-overlay';
const pointerModesOverlayId = 'overlays-pointer-modes-sample';
const overlayCorners: HtmlOverlayDefinition['corners'] = {
  topLeft: [19.039, 47.501],
  topRight: [19.052, 47.501],
  bottomRight: [19.052, 47.496],
  bottomLeft: [19.039, 47.496],
};
const overlaySandbox: HtmlOverlaySandboxToken[] = ['allow-scripts', 'allow-same-origin'];

type OverlayDemoState = {
  visible: boolean;
  interactable: boolean;
  pointerMode: HtmlOverlayPointerMode;
};

type OverlayPointerDemoState = {
  interactable: boolean;
  pointerMode: HtmlOverlayPointerMode;
  mapPitched: boolean;
};

type OverlayPointerInspectorProps = {
  state: OverlayPointerDemoState;
  onStateChange: (state: OverlayPointerDemoState) => void;
  onPitchToggle: () => void;
  onReset: () => void;
};

export const overlayDemos: DemoDefinition[] = [
  {
    id: overlayId,
    title: 'HTML iframe overlay',
    description: 'Add and update iframe-backed HTML content inside a projected map rectangle.',
    docsPath: '/docs/html-overlays',
    sourcePath: 'examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts',
    code: () => buildOverlaySnippet(createInitialState()),
    inspector: OverlayInspector,
    setup: (context) => {
      const { geoForge } = context;
      let state = createInitialState();

      const isActive = () => !context.signal.aborted && context.isCurrent();

      if (!isActive()) {
        return { teardown: () => {} };
      }

      const syncOverlay = (nextState: OverlayDemoState) => {
        if (!isActive()) {
          return;
        }

        geoForge.overlays.html.upsert(createOverlayDefinition(nextState));
        geoForge.overlays.html.setSelected(nextState.visible ? overlayId : null);
      };

      const updateRuntime = (nextState: OverlayDemoState) => {
        if (!isActive()) {
          return;
        }

        const code = buildOverlaySnippet(nextState);
        context.setInspectorProps({ state: nextState, onStateChange });
        context.setCode(code);
      };

      const onStateChange = (nextState: OverlayDemoState) => {
        if (!isActive()) {
          return;
        }

        state = nextState;
        syncOverlay(state);
        updateRuntime(state);
      };

      syncOverlay(state);
      updateRuntime(state);

      context.logEvent({
        name: 'overlays:html-iframe-ready',
        category: 'demo-studio',
        payload: {
          overlayId,
          visible: state.visible,
          interactable: state.interactable,
          pointerMode: state.pointerMode,
        },
      });
      context.notify({
        title: 'HTML overlay ready',
        body: 'Iframe content is anchored to four map coordinates and updates from the inspector.',
        tone: 'success',
      });

      return {
        inspectorProps: { state, onStateChange },
        code: buildOverlaySnippet(state),
        teardown: () => {
          geoForge.overlays.html.destroy();
        },
      };
    },
  },
  {
    id: 'overlays-pointer-modes',
    title: 'Overlay pointer modes',
    description: 'Compare selected, always-on, and disabled iframe pointer handling.',
    docsPath: '/docs/html-overlays',
    sourcePath: 'examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts',
    code: () => buildPointerModesSnippet(createInitialPointerState()),
    inspector: OverlayPointerInspector,
    setup: (context) => {
      const { geoForge, map } = context;
      let state = createInitialPointerState();

      const isActive = () => !context.signal.aborted && context.isCurrent();

      if (!isActive()) {
        return { teardown: () => {} };
      }

      const syncOverlay = (nextState: OverlayPointerDemoState) => {
        if (!isActive()) {
          return;
        }

        geoForge.overlays.html.upsert(createPointerModesOverlayDefinition(nextState));
        geoForge.overlays.html.setSelected(pointerModesOverlayId);
      };

      const updateRuntime = (nextState: OverlayPointerDemoState) => {
        if (!isActive()) {
          return;
        }

        const code = buildPointerModesSnippet(nextState);
        context.setInspectorProps({
          state: nextState,
          onStateChange,
          onPitchToggle,
          onReset,
        } satisfies OverlayPointerInspectorProps);
        context.setCode(code);
      };

      const applyMapPitch = (pitched: boolean, duration = 500) => {
        map.easeTo({
          pitch: pitched ? 58 : 0,
          bearing: pitched ? -18 : 0,
          duration,
        });
      };

      const applyState = (nextState: OverlayPointerDemoState) => {
        state = nextState;
        syncOverlay(state);
        updateRuntime(state);
      };

      const onStateChange = (nextState: OverlayPointerDemoState) => {
        if (!isActive()) {
          return;
        }

        applyState(nextState);
      };

      const onPitchToggle = () => {
        if (!isActive()) {
          return;
        }

        const mapPitched = map.getPitch() <= 0;
        state = { ...state, mapPitched };
        applyMapPitch(mapPitched);
        updateRuntime(state);
      };

      const onReset = () => {
        if (!isActive()) {
          return;
        }

        applyMapPitch(false);
        applyState(createInitialPointerState());
      };

      syncOverlay(state);
      updateRuntime(state);

      context.logEvent({
        name: 'overlays:pointer-modes-ready',
        category: 'demo-studio',
        payload: {
          overlayId: pointerModesOverlayId,
          interactable: state.interactable,
          pointerMode: state.pointerMode,
        },
      });
      context.notify({
        title: 'Overlay pointer modes ready',
        body: 'The selected iframe overlay is ready for pointer behavior checks.',
        tone: 'success',
      });

      return {
        inspectorProps: {
          state,
          onStateChange,
          onPitchToggle,
          onReset,
        } satisfies OverlayPointerInspectorProps,
        code: buildPointerModesSnippet(state),
        teardown: () => {
          geoForge.overlays.html.destroy();
          map.easeTo({ pitch: 0, bearing: 0, duration: 0 });
        },
      };
    },
  },
];

function createInitialState(): OverlayDemoState {
  return {
    visible: true,
    interactable: true,
    pointerMode: 'selected',
  };
}

function createInitialPointerState(): OverlayPointerDemoState {
  return {
    interactable: true,
    pointerMode: 'selected',
    mapPitched: false,
  };
}

function createOverlayDefinition(state: OverlayDemoState): HtmlOverlayDefinition {
  return {
    id: overlayId,
    corners: overlayCorners,
    html: overlayHtml(),
    iframe: {
      title: 'GeoForge overlay sample',
      interactable: state.interactable,
      pointerMode: state.pointerMode,
      sandbox: overlaySandbox,
    },
    selected: state.visible,
    visible: state.visible,
  };
}

function createPointerModesOverlayDefinition(
  state: OverlayPointerDemoState,
): HtmlOverlayDefinition {
  return {
    id: pointerModesOverlayId,
    corners: overlayCorners,
    html: pointerModesOverlayHtml(),
    iframe: {
      title: 'GeoForge pointer mode overlay',
      interactable: state.interactable,
      pointerMode: state.pointerMode,
      sandbox: overlaySandbox,
    },
    selected: true,
    visible: true,
  };
}

function buildOverlaySnippet(state: OverlayDemoState) {
  return `geoForge.overlays.html.upsert({
  id: '${overlayId}',
  corners: {
    topLeft: [19.039, 47.501],
    topRight: [19.052, 47.501],
    bottomRight: [19.052, 47.496],
    bottomLeft: [19.039, 47.496],
  },
  html: overlayHtml(),
  iframe: {
    title: 'GeoForge overlay sample',
    interactable: ${state.interactable},
    pointerMode: '${state.pointerMode}',
    sandbox: ['allow-scripts', 'allow-same-origin'],
  },
  selected: ${state.visible},
  visible: ${state.visible},
});

geoForge.overlays.html.setSelected(${state.visible ? `'${overlayId}'` : 'null'});`;
}

function buildPointerModesSnippet(state: OverlayPointerDemoState) {
  return `geoForge.overlays.html.upsert({
  id: '${pointerModesOverlayId}',
  corners: {
    topLeft: [19.039, 47.501],
    topRight: [19.052, 47.501],
    bottomRight: [19.052, 47.496],
    bottomLeft: [19.039, 47.496],
  },
  html: pointerModesOverlayHtml(),
  iframe: {
    title: 'GeoForge pointer mode overlay',
    interactable: ${state.interactable},
    pointerMode: '${state.pointerMode}',
    sandbox: ['allow-scripts', 'allow-same-origin'],
  },
  selected: true,
  visible: true,
});

geoForge.overlays.html.setSelected('${pointerModesOverlayId}');
map.easeTo({
  pitch: ${state.mapPitched ? 58 : 0},
  bearing: ${state.mapPitched ? -18 : 0},
  duration: 500,
});`;
}

function overlayHtml() {
  return `<!doctype html>
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
        display: grid;
        gap: 8px;
        align-content: start;
        border: 2px solid #0f766e;
        padding: 16px;
        background: linear-gradient(135deg, #ffffff, #dbeafe);
      }

      h1 {
        margin: 0;
        font-size: 18px;
      }

      p {
        margin: 0;
        font-size: 13px;
        line-height: 1.45;
      }

      button {
        width: max-content;
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
      <p>Anchored to four Budapest map coordinates.</p>
      <button onclick="document.body.dataset.clicked = 'true'">Test button</button>
    </section>
  </body>
</html>`;
}

function pointerModesOverlayHtml() {
  return `<!doctype html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        font-family: Inter, system-ui, sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }

      .panel {
        height: 100vh;
        box-sizing: border-box;
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 12px;
        border: 2px solid #2563eb;
        padding: 16px;
        background: linear-gradient(135deg, #ffffff, #eef2ff);
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      h1 {
        margin: 0;
        font-size: 18px;
      }

      .badge {
        border-radius: 999px;
        padding: 4px 8px;
        background: #dbeafe;
        color: #1e3a8a;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      p {
        margin: 0;
        font-size: 13px;
        line-height: 1.45;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .metric {
        border: 1px solid #bfdbfe;
        border-radius: 6px;
        padding: 8px;
        background: rgb(255 255 255 / 0.78);
      }

      .metric strong {
        display: block;
        margin-bottom: 2px;
        color: #1e3a8a;
        font-size: 16px;
      }

      button {
        width: max-content;
        border: 0;
        border-radius: 6px;
        padding: 8px 10px;
        background: #2563eb;
        color: white;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <section class="panel">
      <header>
        <h1>Valve chamber A17</h1>
        <span class="badge">Live overlay</span>
      </header>
      <p>Use the inspector to decide whether this iframe receives pointer events only when selected, always, or never.</p>
      <div class="metrics" aria-label="Inspection metrics">
        <div class="metric"><strong>42 psi</strong><span>Pressure</span></div>
        <div class="metric"><strong>18 C</strong><span>Cabinet</span></div>
        <div class="metric"><strong>09:45</strong><span>Last ping</span></div>
      </div>
      <button onclick="document.body.dataset.acknowledged = 'true'">Acknowledge</button>
    </section>
  </body>
</html>`;
}
