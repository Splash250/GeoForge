import type {
  HtmlOverlayDefinition,
  HtmlOverlayPointerMode,
  HtmlOverlaySandboxToken,
} from 'maplibre-geoforge';
import type { DemoDefinition } from '../../registry/types.ts';
import OverlayInspector from './OverlayInspector.svelte';

const overlayId = 'overlays-html-iframe-overlay';
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

type OverlayInspectorProps = {
  state: OverlayDemoState;
  onStateChange: (state: OverlayDemoState) => void;
};

export const overlayDemos: DemoDefinition<OverlayInspectorProps>[] = [
  {
    id: overlayId,
    title: 'HTML iframe overlay',
    description: 'Add and update iframe-backed HTML content inside a projected map rectangle.',
    docsPath: '/docs/html-overlays',
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

        geoForge.overlays.html.add(createOverlayDefinition(nextState));
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
];

function createInitialState(): OverlayDemoState {
  return {
    visible: true,
    interactable: true,
    pointerMode: 'selected',
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

function buildOverlaySnippet(state: OverlayDemoState) {
  return `geoForge.overlays.html.add({
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
