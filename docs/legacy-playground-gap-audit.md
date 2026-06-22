# Legacy Playground Gap Audit

This audit records the retired legacy playground that previously lived at
`examples/playground/src/routes/legacy-playground.ts` and compares its former coverage with the
newer Demo Studio in `examples/playground/src/demo-studio/`.

## Executive Summary

The legacy playground was a narrow lab for two advanced surfaces: line decorators and HTML
overlays. Demo Studio is now the only playground route and the broader product-quality sandbox: it
has routing, category navigation, per-demo setup/teardown, inspectors, code snippets, toasts,
WMS/WMTS layer management, feature import/export, geometry/network tools, transactions, history,
and a reusable UI system.

The former legacy-only decorator and overlay capabilities have Demo Studio replacements. Advanced
decorator authoring now lives in the Line Decorators category, and overlay pointer-mode controls now
live in the Overlays category. Legacy hashes such as `#decorators` and `#overlays` are retained as
compatibility entries that resolve to Demo Studio instead of mounting the removed route.

## Structure Comparison

### Legacy Playground

Entry point: removed (`examples/playground/src/routes/legacy-playground.ts`)

Former route coverage:

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

Former strengths:

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

## Preserved Legacy Strengths

The legacy playground had useful depth that is now represented in Demo Studio:

- Dense line decorator authoring in one place.
- SVG symbol authoring and preview.
- Custom SVG drop/paste workflow.
- Advanced decorator placement controls.
- Decorator JSON preview.
- Direct stress of `syncFromFeatures(...)`.
- Simple overlay interactability and pointer mode checks.

These are preserved by the Demo Studio advanced decorator authoring and overlay pointer-mode demos.

## Recommended Path

### Complete

- Removed `legacy-playground.ts`.
- Kept Demo Studio as the only user-facing playground and API demonstration surface.
- Preserved old `#decorators` and `#overlays` hashes by resolving them to Demo Studio.
- Migrated the legacy decorator authoring controls into the Line Decorators category as the
  “Advanced decorator authoring” demo.
- Migrated the legacy overlay pointer controls into the Overlays category.
- Kept WMS/WMTS layer management, feature import/export, geometry tools, transactions, history, and
  event diagnostics in Demo Studio.

## Prioritized Gap List

Retirement is complete. No legacy-only decorator or overlay gaps remain.

