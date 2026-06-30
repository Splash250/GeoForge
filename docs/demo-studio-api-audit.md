# Demo Studio API Audit

This audit reviews the current Demo Studio page as an integration consumer of GeoForge. The goal is to identify which showcased functions are already clean public APIs, which require too much demo-side orchestration, and which should become simpler production-ready API surfaces.

Primary implementation references:

- `examples/playground/src/demo-studio/DemoStudioApp.svelte`
- `examples/playground/src/demo-studio/registry/demoRegistry.ts`
- `examples/playground/src/demo-studio/demos/**`
- `examples/playground/src/demo-studio/map/**`
- `src/main.ts`
- `src/layers/raster.ts`
- `docs/public-api-boundary.md`

## Executive Summary

Demo Studio successfully proves that the package can support a broad application workflow: drawing, editing, import/export, raster layers, decorators, overlays, topology diagnostics, transactions, and history. The issue is that several flows only feel clean inside the demo because Demo Studio provides its own missing application primitives: setup cancellation, teardown ownership, seeded-data cleanup, reactive feature subscriptions, control visibility profiles, history suppression, transaction lifecycle guards, and helper-internal access.

The highest-value API improvements are:

1. Add a public batch/session API for setup and cleanup work.
2. Add public control-profile APIs on the existing `geoForge.control` subsystem instead of mutating `geoForge.options.controls` and calling `geoForge.control.updateReactivePanel()`.
3. Add public event/subscription helpers for feature, history, and mode state changes.
4. Continue adding focused subsystem facades where demos still need helper configuration; endpoint snapping now has a geometry-owned facade.
5. Add a higher-level transaction editing workflow for common "edit selected feature property, commit/cancel, undo/redo" applications.
6. Add raster-layer state events and optional request-proxy integration points.

These would reduce repeated consumer code, hide internal implementation details, and make the package easier to embed in production applications.

## Functionality Inventory

| Demo area            | What it demonstrates                                                                              | Current implementation                                                                                                                                        | API maturity                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Runtime boot         | MapLibre map creation, GeoForge construction, load waiting, raster defaults                       | `createDemoGeoForge(...)`, `waitForGeomanLoaded()`, `layers.configureRasterLayers(...)` in `DemoStudioApp.svelte`                                             | Good core API, but setup orchestration is app-owned                   |
| Demo switching/reset | Per-demo teardown, abort handling, history clearing, code/inspector updates                       | `setupActiveDemo(...)` owns run ids, `AbortController`, teardown, and `history.clear()`                                                                       | Demo-only orchestration; no package-level session primitive           |
| Control profiles     | Show only relevant controls per category                                                          | Directly mutates `geoForge.options.controls[modeType][modeName].uiEnabled`, disables hidden active modes, then calls `geoForge.control.updateReactivePanel()` | Weak public API boundary                                              |
| Custom raster layers | Add, remove, reorder, discover WMS/WMTS layers                                                    | `geoForge.layers.*` plus demo-specific `/__geoforge_tile_proxy` transform                                                                                     | Mostly strong API; missing reactive state and proxy guidance          |
| Draw/edit modes      | Activate draw shapes and global edit modes, clear seeded features                                 | `disableAllModes()`, `enableDraw(...)`, compatibility helpers like `enableGlobalEditMode()`                                                                   | Works, but mode activation API is split across old and new surfaces   |
| Feature data         | Import GeoJSON, export feature store, show stats                                                  | `features.importGeoJson(...)`, `features.exportGeoJson()`                                                                                                     | Strong core API; cleanup and history suppression are repetitive       |
| Line decorators      | Sync arrowheads/symbols/text from line features and state controls                                | `decorators.lines.configure(...)`, `syncFromFeatures(...)`, custom symbol image management                                                                    | Strong renderer API; authoring ergonomics need a preset/builder layer |
| HTML overlays        | Add iframe-backed overlays and pointer modes                                                      | `overlays.html.add(...)`, `setSelected(...)`, `destroy()`                                                                                                     | Strong API; app still owns map camera/pointer test orchestration      |
| Geometry topology    | Import network, build graph, validate topology, enable endpoint snapping                          | `geometry.getLineNetworkGraph(...)`, `validateLineNetworkTopology(...)`, `geometry.endpointSnapping.configure(...)`                                           | Strong public geometry API                                            |
| Workflow systems     | Single-feature edit, transaction preview/commit/cancel, history undo/redo                         | `enableSingleFeatureEditMode(...)`, `selection.selectFeature(...)`, `transactions.start(...)`, `history.*`                                                    | Powerful but too manual for common production forms                   |
| Studio shell         | Search demos, select demos, reset, copy docs path, show example count, copy snippets, show toasts | `DemoSidebar.svelte`, `DemoTopToolbar.svelte`, `InspectorPanel.svelte`, local handlers in `DemoStudioApp.svelte`                                              | Useful demo wrapper; docs/GitHub actions are placeholders             |

## Findings

### 1. Control profile configuration leaks internals

Severity: High

`applyDemoControlProfile(...)` directly mutates `geoForge.options.controls` and manually calls `geoForge.control.updateReactivePanel()` after changing `uiEnabled`. It also manually disables a mode if a hidden control is active.

References:

- `examples/playground/src/demo-studio/map/controlProfiles.ts:46`
- `examples/playground/src/demo-studio/map/controlProfiles.ts:59`
- `examples/playground/src/demo-studio/map/controlProfiles.ts:62`
- `examples/playground/src/demo-studio/map/controlProfiles.ts:67`

Why this matters:

External apps will want role-based toolbars, workflow-specific controls, and mode palettes. Today they must understand mutable option internals and know to call a control repaint method. That is not a stable production integration contract.

Recommended API:

```ts
geoForge.control.applyProfile({
  draw: ['marker', 'line', 'polygon'],
  edit: ['drag', 'change'],
  helper: ['snapping', 'zoom_to_features'],
  deactivateHidden: true,
});

geoForge.control.setModeVisibility('edit', 'cut', false, {
  deactivateIfActive: true,
});

const profile = geoForge.control.getProfile();
```

Production outcome:

Consumers can switch complete workflows without reaching into `options.controls` or refreshing the reactive panel manually.

### 2. Setup, teardown, and seeded-data lifecycle are app-owned everywhere

Severity: High

Every demo recreates similar lifecycle mechanics: check `signal.aborted`, import seeded features without history, save added feature references, subscribe to events, then manually delete imported features and turn off modes during teardown.

References:

- `examples/playground/src/demo-studio/DemoStudioApp.svelte:238`
- `examples/playground/src/demo-studio/DemoStudioApp.svelte:245`
- `examples/playground/src/demo-studio/DemoStudioApp.svelte:250`
- `examples/playground/src/demo-studio/DemoStudioApp.svelte:286`
- `examples/playground/src/demo-studio/demos/draw-edit/drawEditDemos.ts:181`
- `examples/playground/src/demo-studio/demos/line-decorators/lineDecoratorDemos.ts:71`
- `examples/playground/src/demo-studio/demos/feature-data/featureDataDemos.ts:61`
- `examples/playground/src/demo-studio/demos/geometry-tools/geometryDemos.ts:66`

Why this matters:

Production apps need temporary imports, preview data, wizard state, and scoped cleanup. The current package provides primitives but no ownership/session abstraction, so every integration has to write fragile bookkeeping.

Recommended API:

```ts
const session = geoForge.sessions.start({
  id: 'network-topology-demo',
  history: 'suspend',
  cleanup: {
    features: 'owned',
    modes: 'disable',
    decorators: 'clear',
    overlays: 'clear-owned',
  },
});

const { addedFeatures, stats } = session.features.importGeoJson(sample, {
  overwrite: true,
});

session.onFeatureChange(() => refresh());

session.dispose();
```

Smaller alternative:

```ts
const result = geoForge.features.importGeoJson(sample, {
  overwrite: true,
  history: false,
  ownerId: 'network-topology-demo',
});

geoForge.features.deleteByOwner('network-topology-demo', { history: false });
```

Production outcome:

Apps can stage or demonstrate data safely without broad `deleteAll()` cleanup, repeated `history.suspend(...)`, or manual feature reference tracking.

### 3. History suppression is repeatedly wrapped instead of expressed at the operation site

Severity: High

The same local `runWithoutHistory(...)` helper appears across draw/edit, feature data, geometry, workflow, and line decorator demos. The history subsystem already has `suspend(...)`, but demo code and exported snippets still teach consumers to wrap ordinary feature operations in an extra callback.

References:

- `examples/playground/src/demo-studio/demos/draw-edit/drawEditDemos.ts:235`
- `examples/playground/src/demo-studio/demos/feature-data/featureDataDemos.ts:165`
- `examples/playground/src/demo-studio/demos/geometry-tools/geometryDemos.ts:175`
- `examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts:407`
- `examples/playground/src/demo-studio/demos/line-decorators/lineDecoratorDemos.ts:336`

Why this matters:

The consumer intent is simple: import/delete/update setup data without creating undo entries. Requiring callback wrappers around unrelated APIs creates boilerplate, hides intent from the operation call, and makes snippets look more complex than the feature work they demonstrate.

Recommended API:

```ts
geoForge.features.importGeoJson(data, {
  overwrite: true,
  history: false,
});

geoForge.features.delete(feature, { history: false });
geoForge.features.deleteAll({ history: false, sourceName: SOURCES.main });

geoForge.history.suspend(() => {
  // retained callback API for multi-operation batches
});
```

Production outcome:

Setup, import, sync, and cleanup code becomes explicit and self-documenting.

### 4. Reactive feature and history subscriptions are too low-level

Severity: High

Demos attach MapLibre event listeners manually for every relevant mutation event. Draw/edit listens to create/remove/edit/drag/rotate/cut. Geometry listens to create/edit/drag/remove/historychange. Workflow listens to edit/drag/historychange/historyrecord.

References:

- `examples/playground/src/demo-studio/demos/draw-edit/drawEditDemos.ts:110`
- `examples/playground/src/demo-studio/demos/geometry-tools/geometryDemos.ts:102`
- `examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts:311`

Why this matters:

Apps want to update tables, forms, validators, and dashboards when the feature store changes. They should not need to know every event name that can mutate feature state.

Recommended API:

```ts
const unsubscribe = geoForge.features.subscribe(
  (event) => {
    refreshFeatureTable(event.geoJson);
  },
  {
    sourceNames: [SOURCES.main],
    includeTemporary: false,
  },
);

const unsubscribeHistory = geoForge.history.subscribe((state, event) => {
  setUndoRedoState(state);
});

const unsubscribeModes = geoForge.modes.subscribe((state) => {
  setActiveModes(state.activeModes);
});
```

Implemented in Phase 1:

- `geoForge.features.subscribe(callback, { sourceNames, includeTemporary })` listens to feature-store mutations from public APIs, imports, edit updates, deletes, and history restores, then passes `{ type, name, features, geoJson, feature, originalEvent }`.
- `geoForge.history.subscribe(callback)` calls back immediately with the current state and `{ type: 'initial', name: null }`, then emits one callback per logical record/change/undo/redo transition with state plus event context.
- `geoForge.modes.subscribe(callback)` calls back immediately with active draw/edit/helper mode state and updates once per settled mode lifecycle transition.
- Each subscription returns an idempotent unsubscribe function.

Production outcome:

Consumers build UI around package state instead of MapLibre event name lists.

### 5. Feature counting and filtering uses exposed store internals

Severity: Medium

The draw/edit demo counts user-facing features by iterating `features.featureStore.values()` and filtering `temporary`. This works, but it exposes storage details as application-facing API.

References:

- `examples/playground/src/demo-studio/demos/draw-edit/drawEditDemos.ts:37`
- `examples/playground/src/demo-studio/demos/draw-edit/drawEditDemos.ts:241`
- `examples/playground/src/demo-studio/demos/draw-edit/drawEditDemos.ts:244`

Recommended API:

```ts
const count = geoForge.features.count({
  sourceNames: [SOURCES.main],
  includeTemporary: false,
});

const features = geoForge.features.query({
  shapes: ['line', 'polygon'],
  includeTemporary: false,
});
```

Implemented in Phase 1:

- `geoForge.features.query(options?)` returns a `FeatureData[]` snapshot, excluding temporary features by default.
- `geoForge.features.count(options?)` returns the matching snapshot length.
- Query options support `sourceNames`, `shapes`, `includeTemporary`, `ownerId`, `ids`, and `editableOnly`.
- Demo Studio draw/edit feature counts now use `features.count({ sourceNames: [SOURCES.main], includeTemporary: false })` instead of iterating `features.featureStore`.

Production outcome:

Apps no longer depend on the shape of `featureStore` or the `temporary` property.

### 6. Mode activation is split between generic and compatibility APIs

Severity: Medium

Draw/edit mode selection calls `disableAllModes()` and `enableDraw(...)`, but edit mode activation uses compatibility helpers such as `enableGlobalDragMode()` and `enableGlobalEditMode()`. The core also has `geoForge.modes.enable(modeType, modeName)`.

References:

- `examples/playground/src/demo-studio/demos/draw-edit/drawEditDemos.ts:119`
- `examples/playground/src/demo-studio/demos/draw-edit/drawEditDemos.ts:139`
- `examples/playground/src/demo-studio/demos/draw-edit/drawEditDemos.ts:223`
- `src/main.ts:336`
- `src/main.ts:353`
- `src/main.ts:370`

Recommended API:

```ts
geoForge.modes.activateOnly('draw', 'polygon');
geoForge.modes.activateOnly('edit', 'change');
geoForge.modes.disableAll({ clearSelection: true });

const state = geoForge.modes.getState();
```

Production outcome:

Applications use one mode controller instead of mixing old shortcut names and generic mode APIs.

### 7. Geometry topology is strong, but helper configuration leaks through `actionInstances`

Severity: High

Status: Implemented.

The topology demo uses public geometry methods for graph construction and validation. Endpoint snapping is now configured through the geometry subsystem instead of reaching into `geoForge.actionInstances.helper__snapping` and casting it to `SnappingHelper`.

References:

- `examples/playground/src/demo-studio/demos/geometry-tools/geometryDemos.ts`
- `src/geometry/geomanGeometrySubsystem.ts`
- `src/geometry/types.ts`
- `src/main.ts:93`

Why this matters:

Endpoint snapping is a production editing feature, not an internal demo concern. If consumers need it, they need a supported helper API.

Implemented API:

```ts
const applied = geoForge.geometry.endpointSnapping.configure({
  enabled: true,
  maxPixelDistance: 18,
  endpoints: ['start', 'end'],
  excludeFeatures: [activeFeature],
  sourceNames: ['gm_main'],
});

const state = geoForge.geometry.endpointSnapping.getState();
geoForge.geometry.endpointSnapping.disable();
```

Production outcome:

Advanced editing behavior is stable and discoverable without exposing action instance keys. `configure(...)` and `disable()` return `true` when the snapping helper is available and received the configuration, and `false` when the call safely no-ops. `getState()` reports the requested state plus `available` and `applied` flags; `applied` is only true for the current snapping helper instance.

### 8. Transaction workflows are powerful but too manual for common forms

Severity: High

The workflow demo manually checks for active transactions, starts one, updates a property, commits/cancels, restarts a transaction after commit/cancel, blocks undo/redo while dirty, cancels before history operations, and rebuilds UI state after every step.

References:

- `examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts:91`
- `examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts:114`
- `examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts:127`
- `examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts:196`
- `examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts:210`
- `examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts:254`
- `examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts:308`

Recommended API:

```ts
const editor = geoForge.editors.featureProperties({
  feature,
  transactionId: 'feature-name-edit',
  history: true,
  singleFeatureEdit: { allowedShapes: ['line'] },
});

editor.set('name', nextName);
editor.commit();
editor.cancel();
editor.undo();
editor.redo();

const unsubscribe = editor.subscribe((state) => {
  renderForm(state);
});
```

Smaller alternative:

```ts
const tx = geoForge.transactions.ensure({ id: 'feature-name-edit' });
const result = tx.updateProperty(feature, 'name', nextName).commitAndRestart();
```

Production outcome:

Form-based integrations become straightforward, and transaction/history correctness is centralized.

### 9. Single-feature edit mode is a good high-level API but needs state events

Severity: Medium

`enableSingleFeatureEditMode(...)` is useful and internally composes selection plus edit mode. The demo still has to manually call `selection.selectFeature(...)` and subscribe to unrelated history/edit events to reflect UI state.

References:

- `src/main.ts:386`
- `src/main.ts:393`
- `src/main.ts:399`
- `examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts:308`
- `examples/playground/src/demo-studio/demos/workflow-systems/workflowDemos.ts:310`

Recommended API:

```ts
const singleEdit = geoForge.singleFeatureEdit.start({
  allowedShapes: ['line'],
  selectedFeature: feature,
});

singleEdit.subscribe((state) => {
  // selectedFeature, editableFeatureIds, active, hoveredFeature
});

singleEdit.stop();
```

Production outcome:

The existing convenience API becomes a complete workflow surface, not just mode activation.

### 10. Decorator rendering API is good; authoring needs production helpers

Severity: Medium

The basic decorator demo has a clean public path: configure layer position and `syncFromFeatures(...)`. The advanced authoring demo, however, has substantial app-owned image loading, state-to-decorator translation, line style mutation, versioning, and error fallback.

References:

- `examples/playground/src/demo-studio/demos/line-decorators/lineDecoratorDemos.ts:89`
- `examples/playground/src/demo-studio/demos/line-decorators/lineDecoratorDemos.ts:91`
- `examples/playground/src/demo-studio/demos/line-decorators/lineDecoratorDemos.ts:203`
- `examples/playground/src/demo-studio/demos/line-decorators/lineDecoratorDemos.ts:223`
- `examples/playground/src/demo-studio/demos/line-decorators/advancedDecoratorAuthoring.ts:335`
- `examples/playground/src/demo-studio/demos/line-decorators/advancedDecoratorAuthoring.ts:350`

Recommended API:

```ts
const authoring = geoForge.decorators.lines.createAuthoringSession({
  features,
  layerPosition: 'above-lines',
  symbolImages: {
    registerSvg: true,
  },
});

authoring.setLineStyle({ color, width, opacity });
authoring.setDecorators(decorators);
authoring.sync();
authoring.dispose();
```

Production outcome:

The core renderer remains lean, while applications get a supported path for interactive decorator editors.

### 11. Overlay lifecycle is clean, but add/update semantics should be clearer

Severity: Low

Overlay demos call `overlays.html.add(...)` repeatedly as state changes. This appears to behave as an upsert, but the public API names both `add(...)` and `update(...)`, which can make production consumers unsure whether repeated `add` is intended.

References:

- `examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts:62`
- `examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts:63`
- `examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts:136`
- `examples/playground/src/demo-studio/demos/overlays/overlayDemos.ts:137`

Recommended API/documentation:

```ts
geoForge.overlays.html.upsert(definition);
geoForge.overlays.html.add(definition); // throws if id exists
geoForge.overlays.html.update(id, patch);
```

Or document that `add` is intentionally an upsert.

Production outcome:

Overlay state synchronization is less ambiguous.

### 12. Raster layer API is close, but production integration needs state and proxy hooks

Severity: Medium

The raster subsystem exposes good methods: configure defaults, discover, add, remove, reorder, get, sync. Demo Studio still has to keep a separate `customRasterLayers` Svelte state and manually refresh it after every operation. It also owns a request transformer for a local tile proxy.

References:

- `examples/playground/src/demo-studio/DemoStudioApp.svelte:184`
- `examples/playground/src/demo-studio/DemoStudioApp.svelte:394`
- `examples/playground/src/demo-studio/DemoStudioApp.svelte:417`
- `examples/playground/src/demo-studio/DemoStudioApp.svelte:426`
- `examples/playground/src/demo-studio/DemoStudioApp.svelte:435`
- `examples/playground/src/demo-studio/map/customRasterLayers.ts:1`
- `src/layers/raster.ts:111`
- `src/layers/raster.ts:128`

Recommended API:

```ts
const unsubscribe = geoForge.layers.subscribeRasterLayers((layers) => {
  setLayers(layers);
});

geoForge.layers.configureRasterLayers({
  basemapLayerId: 'dark-basemap',
  requestProxy: {
    path: '/__geoforge_tile_proxy',
    preserveTemplateTokens: true,
  },
});
```

Production outcome:

Raster UI components can render directly from package state, and proxy integration has a clear supported contract.

### 13. Studio shell utility actions are still demo placeholders

Severity: Low

The shell around the map is functional: the sidebar filters and selects demos, reset re-runs setup, the inspector renders demo-specific controls, and export copies the active snippet. The weaker actions are `Docs`, `Examples`, and `GitHub`: `Docs` copies the docs path instead of navigating, `Examples` displays a registry count, and `GitHub` always reports that no repository URL is available.

References:

- `examples/playground/src/demo-studio/DemoSidebar.svelte:20`
- `examples/playground/src/demo-studio/DemoTopToolbar.svelte:28`
- `examples/playground/src/demo-studio/InspectorPanel.svelte:27`
- `examples/playground/src/demo-studio/DemoStudioApp.svelte:349`
- `examples/playground/src/demo-studio/DemoStudioApp.svelte:359`
- `examples/playground/src/demo-studio/DemoStudioApp.svelte:370`
- `examples/playground/src/demo-studio/DemoStudioApp.svelte:378`

Why this matters:

This is not a blocker for the package API, but it affects Demo Studio's value as a production-grade reference. A reference app should send users to the real docs and source locations rather than making them copy paths or see placeholder messages.

Recommended solution:

```ts
type DemoDefinition = {
  docsPath: string;
  sourcePath?: string;
  githubUrl?: string;
  exampleUrl?: string;
};

// Demo shell behavior:
open(demo.docsPath);
open(demo.githubUrl ?? packageRepositoryUrlFor(demo.sourcePath));
copySnippet(activeDemo.code());
```

Production outcome:

Demo Studio becomes a stronger external integration reference without changing GeoForge runtime APIs.

## Solution Derivation Matrix

Use this matrix to turn the audit into implementation work. Each solution should be accepted only if it removes demo-side glue and keeps existing compatibility exports working.

| Problem                        | Best next solution                                                       | Minimum acceptance criteria                                                                                                       | Avoid                                                                          |
| ------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Control profile mutation       | Add `geoForge.control.applyProfile(...)` and granular visibility setters | Demo Studio no longer writes `control.uiEnabled` directly or calls `updateReactivePanel()` after profile changes                  | Adding another demo-only wrapper around `options.controls`                     |
| Repeated seeded-data cleanup   | Add owned feature imports or workflow sessions                           | A caller can import features, dispose them by owner/session, and opt out of history without storing every `FeatureData` reference | Making `deleteAll()` the recommended cleanup path                              |
| History suppression wrappers   | Add `history: false` to feature mutating APIs                            | Import/delete/update snippets no longer need `runWithoutHistory(...)` for single operations                                       | Deprecating `history.suspend(...)`; it is still useful for batches             |
| Manual event-name lists        | Add feature/history/mode subscriptions returning unsubscribe functions   | Draw/edit, geometry, and workflow inspectors can refresh from package subscriptions, not `map.on(...)` event arrays               | Forcing consumers to subscribe to internal `_gm:*` events                      |
| Feature store internals        | Add `features.query(...)` and `features.count(...)`                      | Consumers can filter by source, shape, temporary state, and id without touching `featureStore`                                    | Returning live mutable store internals as the primary query API                |
| Endpoint snapping internals    | Implemented: use `geoForge.geometry.endpointSnapping.configure(...)`     | Geometry demo no longer reads `geoForge.actionInstances.helper__snapping`; unavailable helper calls safely return `false`         | Documenting `actionInstances` as supported application API                     |
| Transaction form boilerplate   | Add transaction `ensure(...)` or feature-property editor helper          | A form can set properties, commit, cancel, and block undo while dirty through one stable object                                   | Hiding transactions completely; advanced consumers still need raw transactions |
| Raster state mirroring         | Add raster-layer subscription and proxy helper                           | Raster panel can render from subsystem notifications and configure proxy behavior declaratively                                   | Baking a demo-specific proxy path into core defaults                           |
| Decorator authoring complexity | Add optional authoring session/helper layer                              | Interactive authoring can register symbols, apply line styles, sync decorators, and dispose cleanly                               | Moving all authoring state into the renderer core                              |
| Overlay add/update ambiguity   | Document `add` as upsert or introduce `upsert`                           | Consumer code can choose strict create, patch update, or intentional upsert                                                       | Silent behavior that differs from method names                                 |
| Placeholder shell actions      | Add source/docs URLs to demo metadata                                    | Docs and GitHub buttons navigate to real references; export still copies snippets                                                 | Treating placeholder shell actions as GeoForge API problems                    |

## API Design Guardrails

- Keep the root import boundary intact: new public APIs should remain available through `maplibre-geoforge`.
- Prefer adding methods to existing subsystems (`control`, `features`, `history`, `modes`, `layers`) before creating new top-level namespaces.
- Introduce a new top-level namespace only when no existing subsystem owns the concept cleanly. Endpoint snapping is owned by `geoForge.geometry.endpointSnapping` because it supports line topology workflows.
- Return unsubscribe/dispose functions from every subscription or session API.
- Preserve compatibility shortcuts such as `enableDraw(...)` and `enableGlobalEditMode(...)`, but make new snippets prefer the generic `geoForge.modes` surface.
- Keep advanced exports available for specialized users, but do not make Demo Studio snippets depend on internals such as `actionInstances`, direct `featureStore` iteration, or manual control repaint calls.

## Recommended API Roadmap

### Phase 1: Stabilize integration boundaries

1. Add `geoForge.control.applyProfile(...)` and `setModeVisibility(...)`.
2. Add `history: false` options to feature import/delete/update APIs, while retaining `history.suspend(...)` for multi-operation batches.
3. Add `features.subscribe(...)`, `history.subscribe(...)`, and `modes.subscribe(...)`. (Implemented)
4. Add `features.count(...)` and `features.query(...)`. (Implemented)

These changes remove the most obvious internal leaks without changing the deeper subsystems.

### Phase 2: Add scoped workflow ownership

1. Add `geoForge.sessions.start(...)` or owner-based feature cleanup.
2. Add automatic disposal utilities for event subscriptions, overlays, decorators, and imported features.
3. Add state snapshots for controls, modes, features, selection, transactions, and raster layers.

These changes make GeoForge easier to use in route-based apps, demos, wizards, and long-lived editors.

### Phase 3: Productize advanced workflows

1. Add a public `geoForge.helpers` facade or equivalent helper-specific APIs for snapping configuration.
2. Add a feature property editor or transaction helper for common forms.
3. Add decorator authoring helpers for interactive editors.
4. Clarify overlay `add` versus `upsert` semantics.
5. Add raster layer subscription and proxy configuration helpers.

These changes turn the most complex demo flows into reusable production patterns.

## Production-Ready API Shape

A cleaner external integration should be able to look like this:

This example intentionally includes proposed additions from the roadmap. It is not valid against the current package until those APIs are implemented.

```ts
const geoForge = new GeoForge(map, {
  controls: {
    profile: {
      draw: ['marker', 'line', 'polygon'],
      edit: ['drag', 'change'],
      helper: ['snapping', 'zoom_to_features'],
    },
  },
  rasterLayers: {
    basemapLayerId: 'dark-basemap',
    requestProxy: { path: '/__geoforge_tile_proxy' },
  },
});

await geoForge.waitForGeomanLoaded();

const session = geoForge.sessions.start({
  id: 'network-workflow',
  history: 'suspend',
});

const imported = session.features.importGeoJson(sampleNetwork, {
  overwrite: true,
});

const unsubscribe = session.features.subscribe(() => {
  const graph = geoForge.geometry.getLineNetworkGraph(session.features.query({ shapes: ['line'] }));
  renderTopology(geoForge.geometry.validateLineNetworkTopology(graph));
});

geoForge.geometry.endpointSnapping.configure({
  enabled: true,
  maxPixelDistance: 18,
});

session.dispose();
unsubscribe();
```

This preserves the current subsystem architecture while removing the repeated glue that Demo Studio currently has to write.

## Prioritized Backlog

| Priority | Item                                   | Reason                                                                   |
| -------- | -------------------------------------- | ------------------------------------------------------------------------ |
| P0       | Public control profiles                | Current implementation mutates internals and refreshes controls manually |
| P0       | History-free feature operations        | Repeated local wrappers across almost every demo                         |
| P0       | Feature/history/mode subscriptions     | UI integrations should not maintain event-name lists                     |
| Done     | Public snapping configuration          | Implemented as `geoForge.geometry.endpointSnapping`                      |
| P1       | Session/owner lifecycle API            | Prevents broad cleanup and repetitive teardown code                      |
| P1       | Feature query/count APIs               | Avoids direct feature store iteration                                    |
| P1       | Transaction form helper                | Simplifies a common application workflow                                 |
| P2       | Raster state subscription/proxy helper | Makes raster layer panels easier to externalize                          |
| P2       | Decorator authoring session            | Helps advanced visual editors without bloating renderer APIs             |
| P2       | Overlay upsert semantics               | Low-cost clarity improvement                                             |
| P2       | Demo shell reference links             | Turns Demo Studio into a stronger production reference app               |

## Bottom Line

The public GeoForge API is already capable, but the Demo Studio exposes where external apps still need too much framework-specific glue and internal knowledge. The most production-ready path is not to replace the existing subsystems; it is to add higher-level workflow and subscription APIs around them so consumers can express intent: apply this control profile, import this temporary dataset, watch feature state, configure snapping, edit this selected feature, and dispose this workflow cleanly.
