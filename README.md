<p align="center">
  <a href="https://geoman.io">
    <img width="130" alt="Geoman Logo" src="https://geoman-static.onrender.com/assets/logo_white_bg.svg" />
  </a>
</p>
<h1 align="center">
  Maplibre-Geoman
</h1>
<p align="center">
  <strong>Maplibre Plugin For Creating And Editing Geometry Layers</strong><br>
  Draw, Edit, Drag, Cut, Rotate, Split, Scale, Measure, Snap and Pin Layers<br>
  Supports Markers, CircleMarkers, Polylines, Polygons, Circles, Rectangles, ImageOverlays, LayerGroups, GeoJSON, MultiLineStrings and MultiPolygons
</p>
<p align="center">
  <strong>Forked package used by Sewergy: <code>@sewergy/maplibre-geoman</code></strong>
</p>

<p align="center">
    <img src="https://github.com/geoman-io/maplibre-geoman/raw/master/geoman-maplibre-demo.png" alt="Demo" />
</p>

## Documentation

Use the package docs in [`docs`](docs/introduction.md) for this Sewergy fork.
The upstream Geoman documentation remains useful as background reference, but
this package includes Sewergy-specific APIs, docs, and validation coverage that
are not part of the upstream package.

## Issues

This package is maintained as a Sewergy fork. Report package issues through the
Sewergy project support process for the repository that consumes
`@sewergy/maplibre-geoman`. Use upstream Geoman issue trackers only for
upstream package behavior that reproduces outside this fork.

## Demo

Check out the full power of Maplibre-Geoman Pro on [geoman.io/demo/maplibre](https://geoman.io/demo/maplibre)

Or watch a demo video on [YouTube](https://youtu.be/VX7A_rb2Pis)

## Installation

### Fork (Sewergy)

```shell
# local workspace usage
pnpm add @sewergy/maplibre-geoman
```

### Free Version (upstream)

```shell
# install free version
npm install @geoman-io/maplibre-geoman-free
```

### Pro Version

Add the following content to .npmrc in your project root

```shell
#.npmrc
@geoman-io:registry=https://npm.geoman.io/
//npm.geoman.io/:_authToken="<YOUR LICENSE KEY>"
```

Replace `<YOUR LICENSE KEY>` with your license key.

```shell
# install pro version
npm install @geoman-io/maplibre-geoman-pro
```

Don't have a license key yet? [Purchase one here](https://geoman.io/pricing).

## Usage

### Examples

| Framework/Template     | Demo URL                                          | Code URL                                                                                         | Description                                                     |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| maplibre-geoman-vite   | [Demo](https://maplibre-geoman-vite.vercel.app)   | [Code](https://github.com/geoman-io/maplibre-geoman-examples/tree/master/maplibre-geoman-vite)   | Vanilla JavaScript implementation using Vite as the build tool  |
| maplibre-geoman-vue    | [Demo](https://maplibre-geoman-vue.vercel.app)    | [Code](https://github.com/geoman-io/maplibre-geoman-examples/tree/master/maplibre-geoman-vue)    | Vue.js integration showcasing reactive map editing capabilities |
| maplibre-geoman-react  | [Demo](https://maplibre-geoman-react.vercel.app)  | [Code](https://github.com/geoman-io/maplibre-geoman-examples/tree/master/maplibre-geoman-react)  | React integration using the package root API                    |
| maplibre-geoman-preact | [Demo](https://maplibre-geoman-preact.vercel.app) | [Code](https://github.com/geoman-io/maplibre-geoman-examples/tree/master/maplibre-geoman-preact) | Lightweight Preact alternative to the React implementation      |
| maplibre-geoman-nextjs | [Demo](https://maplibre-geoman-nextjs.vercel.app) | [Code](https://github.com/geoman-io/maplibre-geoman-examples/tree/master/maplibre-geoman-nextjs) | Next.js integration with server-side rendering support          |
| maplibre-geoman-svelte | [Demo](https://maplibre-geoman-svelte.vercel.app) | [Code](https://github.com/geoman-io/maplibre-geoman-examples/tree/master/maplibre-geoman-svelte) | Svelte implementation offering reactive map editing features    |

### Expected HTML Structure

```html
<!-- index.html -->
<html lang="en_US">
  <head>
    <title>Geoman Maplibre</title>
    <style>
      #dev-map {
        height: 100vh;
        width: 100vw;
      }
    </style>
  </head>
  <body>
    <div id="dev-map"></div>
  </body>
</html>
```

### Maplibre and Geoman initialization

```typescript
import ml from 'maplibre-gl';
import { Geoman, type GmOptionsPartial } from '@sewergy/maplibre-geoman';

import 'maplibre-gl/dist/maplibre-gl.css';
import '@sewergy/maplibre-geoman/dist/maplibre-geoman.css';

const mapStyle: ml.StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const map = new ml.Map({
  container: 'dev-map',
  style: mapStyle,
  center: [0, 51],
  zoom: 5,
});

const gmOptions: GmOptionsPartial = {
  // geoman options here
};

const geoman = new Geoman(map, gmOptions);

map.on('gm:loaded', () => {
  console.log('Geoman fully loaded');

  // Here you can add your geojson shapes for example
  const shapeGeoJson = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 51] },
  };
  map.gm.features.addGeoJsonFeature({ shapeGeoJson, defaultSource: true });
});
```

### Preferred high-level APIs

Use the `Geoman` instance directly for mode, decorator, and overlay orchestration.

### Public API boundary

Application code should import from the package root and prefer Geoman-owned
subsystems such as `geoman.decorators.lines`, `geoman.overlays.html`,
`geoman.tools`, `geoman.contextPanels`, `geoman.geometry`, `geoman.transactions`,
and `geoman.history`.

Root exports are documented in three tiers:

- stable exports for preferred application code,
- advanced compatibility exports for integrations that need lower-level manager ownership,
- deprecated compatibility exports retained for existing consumers.

See [Public API Boundary](docs/public-api-boundary.md) for tier guidance and
compatibility rules. Do not rely on deep imports from `src`, `dist`, or internal
folders.

### React bindings

React bindings in this package are internal-only. The public package does not
provide a supported React hook API from the root entry point, and it does not
provide a supported `./react` subpath export. Internal React hooks are reserved
for package tests and future binding work; application code should use the
framework-agnostic `Geoman` instance APIs, including `geoman.decorators.lines`.

```typescript
const geoman = new Geoman(map);

geoman.modes.enable('draw', 'line');
geoman.modes.disableAll();

geoman.decorators.lines.start({
  resolveDecorators: (geoJsonFeature) => geoJsonFeature.properties?.decorators,
});

geoman.overlays.html.add({
  id: 'inspection-panel',
  html: '<main><h1>Inspection</h1></main>',
  corners: {
    topLeft: [16.371, 48.209],
    topRight: [16.373, 48.209],
    bottomRight: [16.373, 48.208],
    bottomLeft: [16.371, 48.208],
  },
});
```

### Single-Feature Edit Mode

Use the high-level single-feature API when an application needs
interaction-mode editing for one feature at a time.

```typescript
const geoman = new Geoman(map);

geoman.enableSingleFeatureEditMode({
  styles: {
    hover: { lineColor: '#0ea5e9', lineWidth: 8, lineOpacity: 0.45 },
    selected: { lineColor: '#db2777', lineWidth: 9, lineOpacity: 0.72 },
  },
});

map.on('gm:select', (event) => {
  console.log('Selected feature', event.feature);
});

map.on('gm:deselect', (event) => {
  console.log('Deselected feature', event.previousFeature);
});
```

Internally this composes the generic `helper:click_to_edit` selection primitive
with `edit:change`. When no feature is selected, no feature is editable. When
one feature is selected, only that feature is editable.

The selected feature is available through:

```typescript
const selectedFeature = geoman.getSelectedFeature();
```

Disable the workflow with:

```typescript
geoman.disableSingleFeatureEditMode();
```

Filter or veto selectable features with application rules:

```typescript
geoman.enableSingleFeatureEditMode({
  allowedShapes: ['line', 'polygon', 'rectangle'],
  selectableFeatureFilter: ({ feature }) => {
    return feature.getGeoJson().properties.locked !== true;
  },
  beforeSelect: ({ feature, previousFeature }) => {
    return feature !== previousFeature;
  },
});
```

For line-only editing, use the same API with a line shape filter:

```typescript
geoman.enableSingleFeatureEditMode({
  allowedShapes: ['line'],
});
```

### Generic Single-Feature Selection Edit

`helper:click_to_edit` is the generic primitive behind selection-based editing.
It handles hover feedback, pointer cursor, feature click selection, blank-map
click clearing, and Escape clearing. Pair it with an edit mode when you want to
compose your own workflow instead of using a high-level API such as
`enableSingleFeatureEditMode()`.

```typescript
geoman.enableMode('helper', 'click_to_edit');
geoman.enableMode('edit', 'change');
```

Selection state is internal and is not written into exported GeoJSON.

### Custom Interaction Tools

Use `geoman.tools` when an application needs a custom map editor command without
subclassing Geoman internals. Tools are engine primitives: register behavior in
Geoman, then connect your own toolbar, shortcut, command palette, or workflow
state to `activate`, `deactivate`, and `cancel`, or opt into a small built-in
tool button.

```typescript
geoman.tools.register({
  id: 'inspect-feature',
  title: 'Inspect',
  control: {
    title: 'Inspect',
    eventType: 'toggle',
  },
  selection: {
    hover: true,
    cursor: 'pointer',
  },
  onFeatureClick: ({ selection }, event) => {
    selection.selectFeature(event.feature, { reason: 'feature-click' });
    console.log('Inspect', event.feature);
    return { handled: true };
  },
  onBlankMapClick: ({ selection }) => {
    selection.clearSelection({ reason: 'map-click' });
  },
  onCancel: ({ selection }) => selection.clearSelection({ reason: 'api' }),
});
```

Custom tools emit `gm:toolstart`, `gm:toolend`, and `gm:toolcancel`. Built-in
tool controls are optional metadata; richer product UI can stay app-owned and
call the same `geoman.tools` methods.

See [Custom Interaction Tools](docs/custom-interaction-tools.md) for the full
tool API and examples.

### Context Panels

Use `geoman.contextPanels` with custom tools when a right-click feature workflow
needs a Geoman-owned right-side map panel.

```typescript
geoman.contextPanels.register({
  id: 'feature-info',
  title: 'Feature Info',
  render: ({ feature }) => {
    const root = document.createElement('section');
    root.textContent = String(feature?.getGeoJson().properties.segmentValue ?? 'No segment value');
    return root;
  },
});

geoman.tools.register({
  id: 'inspect-feature',
  selection: true,
  onFeatureContextMenu: ({ contextPanels }, event) => {
    contextPanels.open('feature-info', { feature: event.feature });
    return { handled: true };
  },
});
```

Only one context panel is open at a time. String render results are sanitized
before insertion; for feature properties, prefer returning DOM nodes and assigning
values with `textContent`. See [Context Panels](docs/context-panels.md) for the
full workflow.

Context panels render as non-modal `role="region"` panels labelled by their
visible title. When a panel opens, Geoman focuses the first focusable control, or
the panel itself when no focusable control exists. `Escape` closes the active
panel, and close restores focus to the element that was focused before the panel
opened when that element still exists. Destroy cleanup closes any active panel
without restoring focus.

For accessible custom panel content, prefer exported helpers such as
`createContextPanelTextInput`. Custom controls should use visible labels,
associate helper or error text with `aria-describedby`, and avoid pointer-only
interactions.

For line segment context menus, `geoman.geometry` includes helpers for resolving
the nearest segment and updating segment-scoped metadata such as segmentValue.

### Feature Properties and Transactions

`FeatureData` exposes typed helpers for application-owned GeoJSON properties:

```typescript
const segmentValue = feature.getProperty<number>('segmentValue');

feature.updateProperty('segmentValue', 450);

const properties = feature.getTypedProperties<{
  segmentValue: number;
  label?: string;
}>();
```

Passing `undefined` deletes a custom property:

```typescript
feature.updateProperty('segmentValue', undefined);
```

Geoman system properties remain protected and are filtered out of these helpers,
so custom code cannot read or overwrite internal `gm_*` or `gm:*` metadata
through the application property API.

Use `geoman.transactions` when an application needs previewable edits before
committing or restoring feature snapshots:

```typescript
const transaction = geoman.transactions.start({
  validate: ({ getChanges }) => {
    const hasMissingSegmentValue = getChanges().some(
      ({ after }) => typeof after.properties.segmentValue !== 'number',
    );

    return hasMissingSegmentValue ? 'Segment value is required.' : true;
  },
});

transaction.updateProperty(feature, 'segmentValue', 450);

const result = transaction.commit();

if (!result.committed) {
  console.warn(result.messages);
} else {
  console.log(result.historyEntryId);
}
```

`commit()` returns `{ committed, messages, historyEntryId }`. When the commit
records a grouped history entry, `historyEntryId` is that entry id; otherwise it
is `null`. If validation returns messages, the commit is rejected and the preview
remains active so the application can show errors or continue editing. `cancel()`
restores the original GeoJSON snapshots captured for features edited through the
transaction object:

```typescript
transaction.cancel();
```

Transactions only track edits made through transaction methods such as
`transaction.updateProperty(feature, 'segmentValue', 450)`. Direct calls such as
`feature.updateProperty('segmentValue', 450)` are still immediate feature mutations
and are not rolled back by an active transaction.

### Generic History

`geoman.history` records source-aware feature snapshots for create, update, and
delete operations. It is enabled by default with `maxEntries: 100`:

```typescript
const geoman = new Geoman(map, {
  settings: {
    sourceUpdates: {
      maxDiffItems: 5000,
      waitTimeoutMs: 5000,
      onTimeout: 'warn-and-continue',
      onDiagnostic: (diagnostic) => console.warn(diagnostic),
    },
    history: {
      enabled: true,
      maxEntries: 100,
    },
  },
});
```

Use the subsystem for application-owned undo and redo controls:

```typescript
if (geoman.history.canUndo()) {
  geoman.history.undo();
}

if (geoman.history.canRedo()) {
  geoman.history.redo();
}

geoman.history.configure({ maxEntries: 250 });
const state = geoman.history.getState();
```

History entries are shape-agnostic and source-aware. Direct feature mutations
record one entry per create, update, or delete. Transaction commits record one
grouped entry, while transaction previews, cancels, undo, and redo do not record
recursive history entries.

Public mutation events (`gm:create`, `gm:remove`, and `gm:edit`) include
correlation metadata for consumers that need to connect events with undo history
or previewable edits:

```typescript
map.on('gm:edit', (event) => {
  console.log(event.historyEntryId);
  console.log(event.transactionId);
});
```

`historyEntryId` is populated when a mutation is associated with a recorded
history entry. It is `null` when history recording is skipped, disabled, or
suspended during replay. `transactionId` is populated while a transaction is
active and is `null` for mutations outside a transaction.

When deleting or otherwise targeting a specific feature, prefer source-aware
references so feature ids remain unambiguous across sources:

```typescript
geoman.features.delete({ sourceName, featureId });
```

Plain feature ids remain supported for compatibility, but source-aware
destructive operations are the preferred integration path for new code.

Listen for `gm:historyrecord`, `gm:historychange`, `gm:undo`, and `gm:redo` to
sync app-owned controls or audit logs. The old polygon-draw-only methods
`undoPolygonVertex`, `redoPolygonVertex`, `canUndoPolygonVertex`, and
`canRedoPolygonVertex` are no longer part of the public API; use
`geoman.history` instead.

### Transaction-Backed Context Panels

Use the `transaction` option on a context panel when a panel should preview
feature edits and then commit or cancel them as one unit:

```typescript
geoman.contextPanels.register(
  defineGeomanContextPanel({
    id: 'segment-value-editor',
    title: 'Segment Value Editor',
    transaction: {
      id: ({ data }) => `segment-value-editor:${data.feature.id}`,
      closeBehavior: 'cancel',
      closeOnCommit: true,
      validate: ({ transaction }) =>
        transaction.getChanges().some(({ after }) => after.properties.segmentValue == null)
          ? 'Segment value is required.'
          : true,
    },
    render: ({ data, transaction }) => {
      if (!transaction) return;

      const segmentValue = createContextPanelTextInput({
        label: 'Set segment value',
        ariaLabel: 'Segment value',
        value: data.feature.getProperty('segmentValue'),
        parse: (value) => (value === '' ? undefined : Number(value)),
        onChange: (value) =>
          transaction.current.updateProperty(data.feature, 'segmentValue', value),
      });

      const save = createContextPanelActionButton({
        label: 'Save',
        ariaLabel: 'Save segment value edit',
        onAction: () => {
          segmentValue.applyChange();
          transaction.commit();
        },
      });

      const cancel = createContextPanelActionButton({
        label: 'Cancel',
        ariaLabel: 'Cancel segment value edit',
        onAction: () => transaction.cancel({ refresh: true }),
      });

      const validation = createContextPanelValidationList(transaction.validation.messages);
      const content = document.createElement('div');
      content.append(segmentValue, validation, save, cancel);

      return content;
    },
  }),
);
```

The panel owns its DOM. Geoman owns the transaction lifecycle: preview edits go
through `transaction.current`, `commit()` validates and optionally closes, and
`cancel()` restores snapshots. By default, closing a transaction-backed panel
cancels the active panel transaction. Use `closeBehavior` to choose `cancel`,
`commit`, `keep-active`, or a custom close handler.

The playground includes a dev-only external inspector example registered as
`playground-external-inspector`. It shows the intended app-owned pattern:
activate a custom tool, open a context panel for the selected feature, display
generic feature and geometry details, edit an application-owned property such as
`label`, then Save, Cancel, or Close through the panel transaction lifecycle.
This example is a verification surface and not a package-owned production
inspector UI.

### Geometry Utilities

Use `geoman.geometry` for reusable geometry calculations that are useful in map
editor workflows:

```typescript
geoman.tools.register({
  id: 'measure-segment',
  selection: {
    hover: true,
    cursor: 'pointer',
    allowedShapes: ['line'],
  },
  onFeatureClick: ({ geoman }, event) => {
    const segment = geoman.geometry.getNearestSegment(event.feature, event.point);

    if (!segment) return;

    console.log(segment.segmentIndex, segment.lengthMeters);
    return { handled: true };
  },
});
```

The initial geometry subsystem supports `LineString` segment extraction and
nearest-segment hit testing.

For line workflows with segment-scoped metadata, use the metadata-safe insertion
helpers before applying the result directly or through a transaction:

```typescript
const insertion = geoman.geometry.getLineVertexInsertion(feature, {
  segmentIndex: 0,
  coordinate: [0.005, 51],
  metadataMode: 'duplicate',
});

if (insertion) {
  const transaction = geoman.transactions.start({ id: 'split-line' });
  transaction.updateGeometry(feature, insertion.geometry);
  transaction.updateProperties(feature, insertion.properties);
  transaction.commit();
}
```

With the default `duplicate` metadata mode, metadata from the split segment is
copied to both resulting segment indexes, and later segment metadata indexes are
shifted forward.

Use the semantic split and removal helpers when a tool needs line-editing plans
that can be previewed, applied directly, or committed through transactions:

```typescript
const split = geoman.geometry.getLineSplitAtPoint(feature, {
  point: event.point,
  maxPixelDistance: 12,
  metadataMode: 'duplicate',
});

const removal = geoman.geometry.getLineSegmentRemoval(feature, {
  segmentIndex: 1,
});

if (split) {
  transaction.updateGeometry(feature, split.geometry);
  transaction.updateProperties(feature, split.properties);
}
```

For network-style line workflows, the geometry subsystem also exposes
source-aware line primitives:

```typescript
const vertex = geoman.geometry.getNearestVertex(feature, event.point, {
  maxPixelDistance: 12,
});

const graph = geoman.geometry.getLineNetworkGraph(features, {
  coordinateDistanceTolerance: 0.000001,
});

const connection = geoman.geometry.getLineEndpointConnection({
  from: { feature: lineA, endpoint: 'end' },
  to: { feature: lineB, endpoint: 'start' },
});

if (connection) {
  const transaction = geoman.transactions.start({ id: 'connect-lines' });
  for (const update of connection.updates) {
    transaction.updateGeometry(update.feature, update.geometry);
    transaction.updateProperties(update.feature, update.properties);
  }
  transaction.commit();
}
```

Endpoint tools can use pure hit-testing and preview planning before committing:

```typescript
const endpoint = geoman.geometry.getNearestLineEndpoint(features, event.point, {
  maxPixelDistance: 12,
  excludeFeatures: [activeLine],
});

const preview = geoman.geometry.getLineEndpointConnectionPreview({
  from: { feature: activeLine, endpoint: 'end' },
  candidates: features,
  point: event.point,
  maxPixelDistance: 12,
  excludeFeatures: [activeLine],
});

geoman.geometry.renderLineEndpointConnectionPreview(preview);
geoman.geometry.clearLineEndpointConnectionPreview();
```

`MultiLineString` endpoints are returned per part. Endpoint refs include
`partIndex` and `vertexIndex`; `LineString` refs use `partIndex: null`.
When connecting a `MultiLineString`, pass the returned `partIndex` back to
`getLineEndpointConnection(...)` or `getLineEndpointConnectionPreview(...)` so
only the selected part is updated.

The optional preview renderer creates a lightweight GeoJSON source and dashed
line layer from pure preview data. Call `renderLineEndpointConnectionPreview`
with a preview result while the user hovers a candidate endpoint, call
`clearLineEndpointConnectionPreview` on no-hit, cancel, or tool end, and call
`destroyLineEndpointConnectionPreview` only when the preview source and layer
should be removed. By default, the preview layer is appended to the current map
style. Pass `beforeId` to insert the layer before an existing MapLibre layer
when an application needs explicit layer ordering:

```typescript
geoman.geometry.renderLineEndpointConnectionPreview(preview, {
  beforeId: 'app-label-layer',
});
```

The renderer uses `beforeId` only when creating the preview layer. It does not
reorder an already-created preview layer.

The snapping helper can opt into endpoint-first snapping for network workflows:

```typescript
import { SnappingHelper } from '@sewergy/maplibre-geoman';

const snapping = geoman.actionInstances.helper__snapping;

if (snapping instanceof SnappingHelper) {
  snapping.configureLineEndpointSnapping({
    enabled: true,
    maxPixelDistance: 14,
    sourceNames: ['gm_main'],
    excludeFeatures: [activeLine],
  });
}
```

Endpoint snapping is endpoint-to-endpoint only. It does not merge features or
validate network topology.

Topology checks are available as pure validators over a line network graph:

```typescript
const graph = geoman.geometry.getLineNetworkGraph(features, {
  coordinateDistanceTolerance: 0.000001,
});

const result = geoman.geometry.validateLineNetworkTopology(graph, {
  danglingEndpoints: {
    severity: 'warning',
    message: 'Endpoint is not connected.',
  },
  duplicateEndpointGroups: {
    minEndpoints: 3,
    message: ({ node }) => `Endpoint group ${node?.key} has too many endpoints.`,
  },
  disconnectedComponents: true,
  degreeThresholds: {
    minDegree: 1,
    maxDegree: 2,
  },
});

for (const issue of result.issues) {
  console.log(issue.type, issue.message);
}
```

Line network graph construction includes `LineString` endpoints and every
valid `MultiLineString` member as an independent edge. `LineString` endpoint
refs use `partIndex: null`; `MultiLineString` endpoint refs use the member's
zero-based `partIndex`, with vertex indexes scoped to that member.

By default, topology validation reports dangling endpoints, duplicate endpoint
groups, and disconnected components. Endpoint degree threshold checks run only
when `degreeThresholds` is configured. Messages and severity are consumer-owned
so applications can decide which findings are warnings, errors, or
informational notes.

Connected `LineString` features can be merged through a pure plan/apply flow:

```typescript
const merge = geoman.geometry.getLineMergePlan([lineA, lineB], {
  propertyStrategy: 'merge-compatible',
  coordinateDistanceTolerance: 0.000001,
});

if (merge.ok) {
  geoman.geometry.applyLineMergePlan(merge.plan);
} else {
  console.warn(merge.reason, merge.message);
}
```

Merge planning requires a single non-branching open path. Same-source merging is
required by default, segment metadata is concatenated in path order with segment
indexes rewritten, and property conflicts are reported when
`propertyStrategy: 'merge-compatible'` is used. Merging is still generic line
editing: it does not infer direction or app-specific topology.

Endpoint matching is exact by default. Set `coordinateDistanceTolerance` to a
positive number to group endpoints whose coordinate/lng-lat distance is within
that tolerance; the value is in coordinate units, not meters. Existing callers
can continue to pass `endpointTolerance`, which is kept as an alias for
`coordinateDistanceTolerance`. Unsupported selections return
`{ ok: false, reason, message }` with extra context such as `feature` or
`propertyName` where relevant.

Applying a merge updates the primary feature and deletes the removed features.
Geometry subsystem apply batches source updates with
`features.updateManager.withAtomicSourcesUpdate(...)` when supported. If a
feature update or remove callback throws, apply restores captured feature
snapshots and rethrows the original error.

These helpers intentionally stay at the geometry-planning level. The first
network foundation supports `LineString` endpoints and `MultiLineString` part
endpoints, but it does not split parts, merge connected features, infer
directional semantics, trace paths, validate full topology, or persist
app-specific network rules. Endpoint tolerance grouping is transitive, so a
chain of nearby endpoints is represented as one connected node even when the
first and last endpoints in the chain are farther apart than the tolerance.

## Contributing

We welcome contributions from the community! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started, report issues, and submit pull requests.

## Code of Conduct

We are committed to fostering a welcoming and respectful community. Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Security Policy

If you discover a security vulnerability, please see our [Security Policy](SECURITY.md) for responsible disclosure guidelines.

## License & Commercial Use

This repository is licensed under the MIT License, which means you are free to use, modify, and distribute this software for any purpose, including commercial use. The free version of Maplibre-Geoman is fully open source. However, please note that the Pro version of Maplibre-Geoman is not open source and requires a commercial license, which can be purchased at [geoman.io/pricing](https://geoman.io/pricing). See [LICENSE](LICENSE) for full license details.
