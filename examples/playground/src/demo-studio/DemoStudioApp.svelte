<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import maplibregl, { type Map } from 'maplibre-gl';

  import CustomRasterLayerPanel from './CustomRasterLayerPanel.svelte';
  import DemoSidebar from './DemoSidebar.svelte';
  import DemoTopToolbar from './DemoTopToolbar.svelte';
  import InspectorPanel from './InspectorPanel.svelte';
  import MapCanvas from './MapCanvas.svelte';
  import { createDemoGeoForge } from './map/createGeoForge.ts';
  import { createDemoMap } from './map/createDemoMap.ts';
  import { applyDemoControlProfile } from './map/controlProfiles.ts';
  import { buildCustomRasterTileUrl } from './map/customRasterLayers.ts';
  import { onDemoMapLoad } from './map/onDemoMapLoad.ts';
  import { demoRegistry } from './registry/demoRegistry.ts';
  import type { DemoCategory, DemoContext, RegisteredDemoDefinition } from './registry/types.ts';
  import { ToastStack, type Toast } from './ui/index.ts';
  import type { GeomanRasterLayer, RasterLayerSyncOptions } from 'maplibre-geoforge';

  type ToastInput = Omit<Toast, 'id'>;

  const categories = demoRegistry;
  const initialCategory = categories[0];
  const initialDemo = initialCategory?.demos[0];
  const toastDurationMs = 4200;
  const rasterLayerSyncOptions: RasterLayerSyncOptions = {
    basemapLayerId: 'dark-basemap',
    transformTileUrl: buildCustomRasterTileUrl
  };

  let activeCategoryId = $state(initialCategory?.id ?? '');
  let activeDemoId = $state(initialDemo?.id ?? '');
  let map = $state<Map | null>(null);
  let geoForge = $state<DemoContext['geoForge'] | null>(null);
  let mapReady = $state(false);
  let mapStatus = $state('Initializing map');
  let toasts = $state<Toast[]>([]);
  let eventCount = $state(0);
  let runtimeCode = $state(initialDemo ? readDemoCode(initialDemo) : '');
  let inspectorProps = $state<Record<string, unknown>>({});
  let runtimeVersion = $state(0);
  let customRasterLayers = $state<GeomanRasterLayer[]>([]);

  let activeDemoTeardown: (() => void) | null = null;
  let activeSetupRun = 0;
  let activeSetupAbortController: AbortController | null = null;
  let destroyed = false;
  let toastSequence = 0;
  let resizeCleanup: (() => void) | null = null;
  let activeRuntimeInitializationRun = 0;
  let geoForgeInitializationMap: Map | null = null;
  const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const activeCategory = $derived(findActiveCategory(categories, activeCategoryId));
  const activeDemo = $derived(findActiveDemo(activeCategory, activeDemoId));
  const statusLabel = $derived(eventCount > 0 ? `${eventCount} event${eventCount === 1 ? '' : 's'}` : 'GeoForge Demo Studio');

  $effect(() => {
    const currentMap = map;
    const currentGeoForge = geoForge;

    if (!mapReady || !currentMap || !currentGeoForge) {
      return;
    }

    syncMapCustomRasterLayers(currentMap, currentGeoForge);
  });

  $effect(() => {
    const currentMap = map;
    const currentGeoForge = geoForge;
    const currentDemo = activeDemo;

    if (!mapReady || !currentMap || !currentGeoForge) {
      return;
    }

    untrack(() => {
      void setupActiveDemo(activeCategory.id, currentDemo, currentMap, currentGeoForge, 'select');
    });
  });

  function findActiveCategory(source: DemoCategory[], categoryId: string) {
    return source.find((category) => category.id === categoryId) ?? source[0];
  }

  function findActiveDemo(category: DemoCategory | undefined, demoId: string) {
    if (!category) {
      throw new Error('Demo Studio registry must contain at least one category.');
    }

    const demo = category.demos.find((candidate) => candidate.id === demoId) ?? category.demos[0];

    if (!demo) {
      throw new Error(`Demo category "${category.title}" must contain at least one demo.`);
    }

    return demo;
  }

  function readDemoCode(demo: RegisteredDemoDefinition) {
    try {
      return demo.code();
    } catch (error) {
      return `// Unable to render snippet for ${demo.title}\n// ${describeError(error)}`;
    }
  }

  function handleSelect(categoryId: string, demoId: string) {
    if (categoryId === activeCategoryId && demoId === activeDemoId) {
      return;
    }

    const nextCategory = findActiveCategory(categories, categoryId);
    const nextDemo = findActiveDemo(nextCategory, demoId);

    resetRuntimeState(nextDemo);
    activeCategoryId = categoryId;
    activeDemoId = demoId;
  }

  function handleMapReady(element: HTMLDivElement) {
    if (map) {
      safeResizeMap(map);
      return;
    }

    mapStatus = 'Initializing map';

    const createdMap = createDemoMap(element);
    createdMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-left');
    const runtimeInitializationRun = ++activeRuntimeInitializationRun;

    let cleanupMapLoad = () => {};
    const handleError = (event: { error?: { message?: string } }) => {
      if (destroyed || map !== createdMap) {
        return;
      }

      const body = event.error?.message ?? 'MapLibre reported an unknown map error.';
      mapStatus = mapReady ? 'Map warning' : 'Map load failed';
      notify({ title: 'Map error', body, tone: 'error' });
    };
    const handleResize = () => safeResizeMap(createdMap);

    createdMap.on('error', handleError);
    window.addEventListener('resize', handleResize);
    resizeCleanup = () => {
      window.removeEventListener('resize', handleResize);
      createdMap.off('error', handleError);
      cleanupMapLoad();
    };

    map = createdMap;
    mapStatus = 'Loading map style';

    requestAnimationFrame(() => safeResizeMap(createdMap));

    cleanupMapLoad = onDemoMapLoad(createdMap, () => {
      void initializeDemoRuntime(createdMap, runtimeInitializationRun);
    });
  }

  async function initializeDemoRuntime(currentMap: Map, runtimeInitializationRun: number) {
    if (!isCurrentMap(currentMap, runtimeInitializationRun)) {
      return;
    }

    if (geoForge || geoForgeInitializationMap === currentMap) {
      return;
    }

    geoForgeInitializationMap = currentMap;
    mapStatus = 'Loading GeoForge';

    try {
      const createdGeoForge = createDemoGeoForge(currentMap);
      const loadedGeoForge = await createdGeoForge.waitForGeomanLoaded();

      if (!isCurrentMap(currentMap, runtimeInitializationRun)) {
        return;
      }

      if (!loadedGeoForge || loadedGeoForge !== createdGeoForge || loadedGeoForge.destroyed) {
        handleGeoForgeLoadFailure(currentMap, new Error('GeoForge initialization did not complete.'));
        return;
      }

      geoForge = createdGeoForge;
      mapReady = true;
      mapStatus = 'Map ready';
      requestAnimationFrame(() => safeResizeMap(currentMap));
    } catch (error) {
      handleGeoForgeLoadFailure(currentMap, error);
    } finally {
      if (geoForgeInitializationMap === currentMap) {
        geoForgeInitializationMap = null;
      }
    }
  }

  function handleGeoForgeLoadFailure(currentMap: Map, error: unknown) {
    if (!isCurrentMap(currentMap)) {
      return;
    }

    mapReady = false;
    mapStatus = 'GeoForge load failed';
    notify({
      title: 'GeoForge load failed',
      body: describeError(error),
      tone: 'error'
    });
  }

  function isCurrentMap(currentMap: Map, runtimeInitializationRun?: number) {
    return (
      !destroyed &&
      map === currentMap &&
      (runtimeInitializationRun === undefined ||
        activeRuntimeInitializationRun === runtimeInitializationRun)
    );
  }

  function safeResizeMap(targetMap: Map) {
    if (destroyed || map !== targetMap) {
      return;
    }

    try {
      targetMap.resize();
    } catch {
      // MapLibre can reject resize calls during route teardown.
    }
  }

  async function setupActiveDemo(
    categoryId: DemoCategory['id'],
    demo: RegisteredDemoDefinition,
    currentMap: Map,
    currentGeoForge: DemoContext['geoForge'],
    reason: 'select' | 'reset'
  ) {
    const runId = ++activeSetupRun;
    activeSetupAbortController?.abort();
    const setupAbortController = new AbortController();
    activeSetupAbortController = setupAbortController;
    teardownActiveDemo();
    currentGeoForge.history.clear();
    resetRuntimeState(demo);
    mapStatus = reason === 'reset' ? 'Resetting demo' : 'Running demo setup';
    const isCurrent = () => isCurrentSetupRun(runId, demo, setupAbortController.signal);

    try {
      applyDemoControlProfile(currentGeoForge, categoryId);

      const result = await demo.setup({
        map: currentMap,
        geoForge: currentGeoForge,
        notify: (toast) => {
          if (isCurrent()) {
            notify(toast);
          }
        },
        logEvent: (event) => {
          if (isCurrent()) {
            eventCount += 1;
            console.debug('[Demo Studio]', event.name, event.category, event.payload);
          }
        },
        setInspectorProps: (props) => {
          if (isCurrent()) {
            inspectorProps = props;
          }
        },
        setCode: (code) => {
          if (isCurrent()) {
            runtimeCode = code;
          }
        },
        isCurrent,
        signal: setupAbortController.signal
      });

      if (!isCurrent()) {
        safelyRunTeardown(result.teardown);
        return;
      }

      if (result.inspectorProps) {
        inspectorProps = result.inspectorProps;
      }

      if (result.code !== undefined) {
        runtimeCode = result.code;
      }

      activeDemoTeardown = result.teardown;
      syncMapCustomRasterLayers(currentMap, currentGeoForge);
      mapStatus = 'Ready';
    } catch (error) {
      if (!isCurrent()) {
        return;
      }

      mapStatus = 'Setup failed';
      notify({
        title: 'Demo setup failed',
        body: describeError(error),
        tone: 'error'
      });
    }
  }

  function resetRuntimeState(demo: RegisteredDemoDefinition) {
    runtimeCode = readDemoCode(demo);
    inspectorProps = {};
    runtimeVersion += 1;
  }

  function isCurrentSetupRun(runId: number, demo: RegisteredDemoDefinition, signal?: AbortSignal) {
    return !destroyed && runId === activeSetupRun && demo === activeDemo && !signal?.aborted;
  }

  function teardownActiveDemo() {
    const teardown = activeDemoTeardown;
    activeDemoTeardown = null;

    if (teardown) {
      safelyRunTeardown(teardown);
    }
  }

  function safelyRunTeardown(teardown: () => void) {
    try {
      teardown();
    } catch (error) {
      if (!destroyed) {
        notify({
          title: 'Demo teardown failed',
          body: describeError(error),
          tone: 'error'
        });
      }
    }
  }

  async function handleOpenDocs() {
    const copied = await copyText(activeDemo.docsPath);

    notify({
      title: copied ? 'Docs path copied' : 'Docs path',
      body: activeDemo.docsPath,
      tone: copied ? 'success' : 'info'
    });
  }

  function handleOpenExamples() {
    const categoryCount = categories.length;
    const demoCount = categories.reduce((total, category) => total + category.demos.length, 0);

    notify({
      title: 'Examples registered',
      body: `${categoryCount} categories, ${demoCount} demos. Active: ${activeCategory.title} / ${activeDemo.title}.`,
      tone: 'info'
    });
  }

  function handleOpenGithub() {
    notify({
      title: 'GitHub link unavailable',
      body: 'No repository URL is declared in package metadata or README.',
      tone: 'info'
    });
  }

  function handleReset() {
    if (!mapReady || !map || !geoForge) {
      notify({
        title: 'Map is not ready',
        body:
          mapStatus === 'GeoForge load failed'
            ? 'Reset is unavailable because the GeoForge runtime did not load. Reload Demo Studio to try again.'
            : 'Reset will be available after the map and GeoForge runtime finish loading.',
        tone: 'info'
      });
      return;
    }

    void setupActiveDemo(activeCategory.id, activeDemo, map, geoForge, 'reset');
  }

  function handleAddCustomRasterLayer(input: { name: string; url: string }) {
    if (!geoForge) {
      return;
    }

    geoForge.layers.addRasterLayer(input, rasterLayerSyncOptions);
    customRasterLayers = geoForge.layers.getRasterLayers();
  }

  function handleAddCustomRasterLayers(inputs: Array<{ name: string; url: string }>) {
    if (!geoForge) {
      return;
    }

    geoForge.layers.addRasterLayers(inputs, rasterLayerSyncOptions);
    customRasterLayers = geoForge.layers.getRasterLayers();
  }

  function handleMoveCustomRasterLayer(layerId: string, direction: -1 | 1) {
    if (!geoForge) {
      return;
    }

    geoForge.layers.reorderRasterLayer(layerId, direction, rasterLayerSyncOptions);
    customRasterLayers = geoForge.layers.getRasterLayers();
  }

  function handleRemoveCustomRasterLayer(layerId: string) {
    if (!geoForge) {
      return;
    }

    geoForge.layers.removeRasterLayer(layerId, rasterLayerSyncOptions);
    customRasterLayers = geoForge.layers.getRasterLayers();
  }

  function syncMapCustomRasterLayers(currentMap: Map, currentGeoForge: DemoContext['geoForge']) {
    if (!isCurrentMap(currentMap)) {
      return;
    }

    try {
      currentGeoForge.layers.syncRasterLayers(rasterLayerSyncOptions);
      customRasterLayers = currentGeoForge.layers.getRasterLayers();
    } catch (error) {
      notify({
        title: 'Raster layer update failed',
        body: describeError(error),
        tone: 'error'
      });
    }
  }

  async function handleExport() {
    const copied = await copyText(runtimeCode);

    notify({
      title: copied ? 'Snippet copied' : 'Clipboard unavailable',
      body: copied
        ? `${activeDemo.title} snippet copied to clipboard.`
        : 'The snippet is still visible in the inspector, but this browser did not expose clipboard access.',
      tone: copied ? 'success' : 'error'
    });
  }

  async function copyText(value: string) {
    const clipboard = navigator.clipboard;

    if (!clipboard?.writeText) {
      return false;
    }

    try {
      await clipboard.writeText.call(clipboard, value);
      return true;
    } catch {
      return false;
    }
  }

  function notify(input: ToastInput) {
    const toast: Toast = {
      id: `demo-toast-${Date.now().toString(36)}-${++toastSequence}`,
      ...input
    };

    toasts = [toast, ...toasts].slice(0, 4);

    const timer = setTimeout(() => {
      toasts = toasts.filter((candidate) => candidate.id !== toast.id);
      toastTimers.delete(toast.id);
    }, toastDurationMs);

    toastTimers.set(toast.id, timer);
  }

  function describeError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  onDestroy(() => {
    destroyed = true;
    activeRuntimeInitializationRun++;
    activeSetupRun++;
    activeSetupAbortController?.abort();
    teardownActiveDemo();
    resizeCleanup?.();

    toastTimers.forEach((timer) => clearTimeout(timer));
    toastTimers.clear();

    const currentMap = map;
    map = null;
    geoForge = null;
    mapReady = false;

    if (currentMap) {
      try {
        currentMap.remove();
      } catch {
        // MapLibre can throw if removal races with initialization.
      }
    }
  });
</script>

<svelte:head>
  <title>GeoForge Demo Studio</title>
</svelte:head>

<div class="gf-studio demo-studio-app">
  <DemoTopToolbar
    categoryTitle={activeCategory.title}
    demoTitle={activeDemo.title}
    onOpenDocs={handleOpenDocs}
    onOpenExamples={handleOpenExamples}
    onOpenGithub={handleOpenGithub}
    onReset={handleReset}
    onExport={handleExport}
  />

  <div class="studio-workbench">
    <DemoSidebar
      {categories}
      {activeCategoryId}
      {activeDemoId}
      onSelect={handleSelect}
    />

    <main class="map-region" aria-label="Live GeoForge demo map">
      <MapCanvas onReady={handleMapReady} {statusLabel} statusValue={mapStatus} />
    </main>

    <InspectorPanel
      demo={activeDemo}
      code={runtimeCode}
      {inspectorProps}
      inspectorKey={`${activeDemo.id}:${runtimeVersion}`}
    >
      <CustomRasterLayerPanel
        layers={customRasterLayers}
        disabled={!mapReady}
        onAdd={handleAddCustomRasterLayer}
        onAddMany={handleAddCustomRasterLayers}
        onMove={handleMoveCustomRasterLayer}
        onRemove={handleRemoveCustomRasterLayer}
      />
    </InspectorPanel>
  </div>

  <div class="toast-region">
    <ToastStack {toasts} />
  </div>
</div>

<style>
  .demo-studio-app {
    position: relative;
    width: 100%;
    height: 100dvh;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
  }

  .studio-workbench {
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-columns: auto minmax(360px, 1fr) auto;
    grid-template-areas: "nav map inspector";
    overflow: hidden;
  }

  .map-region {
    grid-area: map;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .demo-studio-app :global(.maplibregl-ctrl-group) {
    overflow: hidden;
    border: 1px solid rgba(108, 126, 148, 0.42);
    border-radius: 8px;
    background: #14181e;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.36);
  }

  .demo-studio-app :global(.maplibregl-ctrl-group button) {
    width: 34px;
    height: 34px;
    color: #8fdcff;
    border-bottom: 1px solid rgba(108, 126, 148, 0.28) !important;
    background: #161b22;
  }

  .demo-studio-app :global(.maplibregl-ctrl-group button:last-child) {
    border-bottom: 0;
  }

  .demo-studio-app :global(.maplibregl-ctrl-group button:hover),
  .demo-studio-app :global(.maplibregl-ctrl-group button:focus-visible) {
    color: #ffffff;
    background: #1f2a34;
  }

  .demo-studio-app :global(.maplibregl-ctrl-group button.gm-control-button.active),
  .demo-studio-app :global(.maplibregl-ctrl-group button[aria-pressed='true']) {
    color: #ffffff;
    background: #12395b;
    box-shadow: inset 3px 0 0 var(--gf-blue);
  }

  .demo-studio-app :global(.maplibregl-ctrl-group button:disabled) {
    color: rgba(160, 170, 186, 0.38);
    background: #11151a;
    cursor: not-allowed;
  }

  .demo-studio-app :global(.maplibregl-ctrl-group button.gm-control-button) {
    padding: 7px;
  }

  .demo-studio-app :global(.maplibregl-ctrl-group button.gm-control-button svg) {
    color: inherit;
    fill: currentColor;
    stroke: currentColor;
  }

  .demo-studio-app :global(.maplibregl-ctrl-group .maplibregl-ctrl-icon) {
    filter: invert(1) grayscale(1) brightness(1.8);
    opacity: 0.78;
  }

  .demo-studio-app :global(.maplibregl-ctrl-group button:hover .maplibregl-ctrl-icon),
  .demo-studio-app :global(.maplibregl-ctrl-group button:focus-visible .maplibregl-ctrl-icon) {
    opacity: 1;
  }

  .demo-studio-app .studio-workbench :global(.demo-sidebar) {
    grid-area: nav;
  }

  .demo-studio-app .studio-workbench :global(.inspector-panel) {
    grid-area: inspector;
  }

  .toast-region {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 50;
  }

  @media (max-width: 1100px) {
    .demo-studio-app {
      height: auto;
      min-height: 100dvh;
      grid-template-rows: auto auto;
      overflow: auto;
    }

    .studio-workbench {
      grid-template-columns: 1fr;
      grid-template-rows: 340px auto auto;
      grid-template-areas:
        "map"
        "nav"
        "inspector";
      min-height: auto;
      overflow: visible;
    }

    .map-region {
      height: 340px;
      min-height: 340px;
    }

    .demo-studio-app .studio-workbench :global(.demo-sidebar),
    .demo-studio-app .studio-workbench :global(.inspector-panel) {
      width: 100%;
      min-width: 0;
      height: auto;
      border-right: 0;
      border-left: 0;
      overflow: auto;
    }

    .demo-studio-app .studio-workbench :global(.demo-sidebar) {
      max-height: min(420px, 42dvh);
      border-bottom: 1px solid var(--gf-line);
    }

    .demo-studio-app .studio-workbench :global(.inspector-panel) {
      max-height: min(520px, 46dvh);
      border-top: 1px solid var(--gf-line);
    }

    .toast-region {
      right: 12px;
      bottom: 12px;
    }
  }
</style>
