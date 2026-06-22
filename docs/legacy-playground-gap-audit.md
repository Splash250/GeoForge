# Legacy Playground Gap Audit

This audit compares the legacy playground in `examples/playground/src/routes/legacy-playground.ts`
with the newer Demo Studio in `examples/playground/src/demo-studio/`.

## Executive Summary

The legacy playground is now a narrow lab for two advanced surfaces: line decorators and HTML
overlays. Demo Studio has become the broader product-quality sandbox: it has routing, category
navigation, per-demo setup/teardown, inspectors, code snippets, toasts, WMS/WMTS layer management,
feature import/export, geometry/network tools, transactions, history, and a reusable UI system.

The legacy playground is still valuable as a dense decorator/overlay stress test, but it is no
longer representative of the full GeoForge API. It is also harder to extend because most UI,
state, event wiring, and rendering lives in one imperative TypeScript file.

## Structure Comparison

### Legacy Playground

Entry point: `examples/playground/src/routes/legacy-playground.ts`

Current route coverage:

- `#decorators`
- `#overlays`

Implementation traits:

- Single large imperative TypeScript module.
- Uses `innerHTML` for UI rendering and manual DOM event wiring.
- Owns its own map setup, GeoForge setup, route state, form state, selection state, and cleanup.
- Navigation is hash-based but only inside the legacy route family.
- No demo registry, no reusable demo contract, no per-demo inspector component.

### Demo Studio

Entry point: `examples/playground/src/routes/demo-studio.ts`

Registry: `examples/playground/src/demo-studio/registry/demoRegistry.ts`

Current category coverage:

- Draw And Edit
- Line Decorators
- Overlays
- Feature Data
- Geometry Tools
- Workflow Systems
- Custom WMS/WMTS raster layers through the shared inspector section

Implementation traits:

- Svelte application with reusable layout and UI components.
- Registry-driven demo definitions.
- Explicit setup/teardown lifecycle per demo.
- Inspector model with live controls, docs path, code snippet, and runtime props.
- Toasts, map status, event counts, reset/export actions, and responsive layout.
- Shared map/GeoForge creation helpers.

## Missing Or Less Advanced In Legacy

### 1. Demo Coverage

Legacy only exposes decorators and overlays. Demo Studio covers substantially more of the public API.

Missing from legacy:

- Draw mode workflows for marker, line, polygon, rectangle, circle, ellipse, text, dot.
- Global edit modes: edit/change, drag, rotate, cut, delete.
- Helper workflows such as snapping, shape markers, zoom-to-features, and click-to-edit.
- Feature import/export flows.
- Feature store inspection and export state.
- Geometry/network topology validation.
- Endpoint/segment network utilities.
- Transactions, validation, commit/cancel flows.
- History and undo/redo diagnostics.
- WMS/WMTS custom layer discovery, add/remove/reorder, and z-index management.
- Demo reset/export snippet workflow.
- Event count/status surfacing beyond one status string.

### 2. Demo Architecture

Legacy is a single-purpose page; Demo Studio is an extensible demo platform.

Legacy limitations:

- No registry equivalent to `demoRegistry`.
- No typed `RegisteredDemoDefinition` contract.
- No category/demo selection model beyond two hardcoded hash values.
- No reusable setup result with `teardown`, `code`, and `inspectorProps`.
- No shared inspector shell for docs path, snippets, and demo-specific state.
- Harder to add a new demo without editing a large central file.

Upgrade recommendation:

- Treat legacy as either a compatibility route or migrate its decorator/overlay labs into Demo Studio demos.
- Avoid adding new feature coverage to `legacy-playground.ts`; add new coverage through Demo Studio registry entries.

### 3. UI And UX

Legacy is functional but less polished and less scalable than Demo Studio.

Legacy limitations:

- No top toolbar with docs/examples/reset/export actions.
- No persistent demo sidebar with categories, search-like scanning, and active demo metadata.
- No toast stack for non-blocking feedback.
- No structured inspector sections.
- No code block/snippet component.
- No reusable buttons, icon buttons, segmented controls, data tables, dropzones, or toggle components.
- Long forms are regenerated with `innerHTML`, losing component-level state boundaries.
- Status feedback is mostly a single text area.

Demo Studio improvements:

- Dedicated map region, sidebar, inspector, toolbar, and toast region.
- Stable reusable Svelte UI primitives under `examples/playground/src/demo-studio/ui/`.
- Clearer separation between map state, demo state, inspector state, and global app state.

### 4. WMS/WMTS Layering

Legacy has no WMS/WMTS workflow.

Missing from legacy:

- Custom raster layer panel.
- Capabilities discovery.
- WMS/WMTS layer selection.
- Add by name and URL.
- Layer reorder/remove controls.
- Native `geoForge.layers` usage.
- Proxy transform wiring for CORS-bound WMS/WMTS services.
- Enforcement of raster layers above basemap and below GeoForge feature layers.

Demo Studio now covers this through `CustomRasterLayerPanel.svelte` and
`geoForge.layers.configureRasterLayers(...)`.

### 5. Feature Data Workflows

Legacy has no general feature-data demo.

Missing from legacy:

- Import sample GeoJSON.
- Export live feature store.
- Import/export stats.
- Feature identity preservation demonstration.
- Feature collection preview.
- Package-safe GeoJSON flows.

Legacy does use a lab line source and GeoForge feature store for decorator editing, but that is
implementation detail rather than a user-facing feature-data workflow.

### 6. Geometry And Network Utilities

Legacy has no geometry/network demo.

Missing from legacy:

- Topology validation.
- Dangling endpoint/disconnected component surfacing.
- Network graph inspection.
- Segment measurement or nearest segment/endpoint workflows.
- Endpoint connection preview and connection operations.

Demo Studio covers network topology through `geometryDemos.ts` and `GeometryInspector.svelte`.

### 7. Workflow Systems

Legacy has no equivalent to Demo Studio workflow-system demos.

Missing from legacy:

- Transaction-backed editing.
- Validation before commit.
- Commit/cancel state.
- History entry tracking.
- Undo/redo state integration.
- Context panel transaction patterns.

Legacy does direct property updates on selected line features, which is useful for a lab but does
not demonstrate the production workflow APIs.

### 8. Routing And Lifecycle

Legacy lifecycle is more fragile because most behavior is centralized.

Current strengths:

- It has `activeLegacyMountId`, `syncRun`, and cleanup guards.
- It removes the MapLibre map on teardown.
- It handles hash changes for `#decorators` and `#overlays`.

Gaps compared with Demo Studio:

- No per-demo abort controller.
- No central `setupActiveDemo(...)` flow.
- No guarded async setup result model.
- No teardown returned by individual demos.
- No common map-ready/GeoForge-ready lifecycle state.
- No reset operation that reruns a demo setup.

### 9. Code Snippets And Documentation

Legacy does not expose copyable, current snippets.

Missing from legacy:

- Runtime code snippet display.
- Export snippet action.
- Docs path display per demo.
- Demo-specific docs mapping.
- Consistent reference section.

Demo Studio has these through `InspectorPanel.svelte`, demo definitions, and toolbar actions.

### 10. Diagnostics And Feedback

Legacy is less advanced as a diagnostic surface.

Missing from legacy:

- Toast notifications.
- Event count.
- Structured status values.
- Setup failure handling per demo.
- Demo teardown failure feedback.
- Centralized map warning handling.

Legacy has one status region and some direct status text updates, which is adequate for a small lab
but not enough for broad API validation.

## Legacy Strengths Worth Preserving

The legacy playground still has some useful depth:

- Dense line decorator authoring in one place.
- SVG symbol authoring and preview.
- Custom SVG drop/paste workflow.
- Advanced decorator placement controls.
- Decorator JSON preview.
- Direct stress of `syncFromFeatures(...)`.
- Simple overlay interactability and pointer mode checks.

These should be preserved by migrating them into Demo Studio rather than deleting them outright.

## Recommended Path

### Short Term

- Keep legacy route available as a compatibility/deep-lab page.
- Add a visible link from Demo Studio to legacy only if that deep decorator authoring remains useful.
- Do not add new API coverage to legacy.

### Medium Term

- Port the legacy decorator authoring controls into the existing Line Decorators category as an
  “Advanced decorator authoring” demo.
- Port the legacy overlay pointer controls into the Overlays category if Demo Studio does not yet
  expose the same pointer-mode depth.
- Add tests or smoke coverage for any migrated flows before removing legacy.

### Long Term

- Remove `legacy-playground.ts` once all unique decorator/overlay capabilities are represented in
  Demo Studio.
- Keep Demo Studio as the only user-facing sandbox and API demonstration surface.

## Prioritized Gap List

1. Add/migrate advanced decorator authoring to Demo Studio.
2. Add/migrate overlay pointer-mode controls if still more complete in legacy.
3. Keep WMS/WMTS layer management only in Demo Studio.
4. Keep feature import/export, geometry tools, transactions, history, and event diagnostics in Demo Studio.
5. Stop expanding legacy route except for critical compatibility fixes.

