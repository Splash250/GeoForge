# GeoForge Instance API

The GeoForge instance is your entry point for managing draw, edit, and helper modes. This reference lists the most important properties and functions exposed on `geoForge`.

## Installation and Initialization

```ts
import { GeoForge, type GmOptionsPartial } from 'maplibre-geoforge';

const options: GmOptionsPartial = {
  // configuration options
};

const geoForge = new GeoForge(map, options);
```

## Core Properties

| Property        | Type                             | Description                                                    | Example                                              |
| --------------- | -------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| `features`      | `Features`                       | Feature management API.                                        | `const features = gm.features;`                      |
| `geometry`      | `GeomanGeometrySubsystem`        | Geometry calculations for editor workflows.                    | `gm.geometry.getNearestSegment(feature, point)`      |
| `selection`     | `GeomanSelectionSubsystem`       | Single-feature selection state and filters.                    | `gm.selection.getSelectedFeature()`                  |
| `tools`         | `GeomanToolsSubsystem`           | Custom interaction tool registry.                              | `gm.tools.activate('inspect-feature')`               |
| `contextPanels` | `GeomanContextPanelSubsystem`    | One-open right-side context panel registry for tool workflows. | `gm.contextPanels.open('feature-info', { feature })` |
| `mapAdapter`    | `BaseMapAdapter<AnyMapInstance>` | Wrapper around the underlying map.                             | `const adapter = gm.mapAdapter;`                     |

## Mode Management

`geoman.modes` is the preferred direct mode API for new code. The legacy helper
methods remain supported for compatibility.

```ts
const geoman = new GeoForge(map);

geoman.modes.enable('draw', 'line');
geoman.modes.disable('draw', 'line');
geoman.modes.toggle('edit', 'drag');

if (geoman.modes.isEnabled('edit', 'drag')) {
  geoman.modes.disableAll();
}
```

### Draw Modes

These helpers are preserved for existing integrations. Prefer
`geoman.modes.enable('draw', shape)` for new code.

| Method                             | Returns   | Description                              |
| ---------------------------------- | --------- | ---------------------------------------- |
| `enableDraw(shape: DrawModeName)`  | `void`    | Enable drawing mode for the given shape. |
| `disableDraw()`                    | `void`    | Disable any active draw mode.            |
| `toggleDraw(shape: DrawModeName)`  | `void`    | Toggle drawing mode for the given shape. |
| `drawEnabled(shape: DrawModeName)` | `boolean` | Check if the shape draw mode is active.  |

### Global Edit Modes

| Mode             | Enable method               | Disable method               | Toggle method               | Status method                |
| ---------------- | --------------------------- | ---------------------------- | --------------------------- | ---------------------------- |
| Edit             | `enableGlobalEditMode()`    | `disableGlobalEditMode()`    | `toggleGlobalEditMode()`    | `globalEditModeEnabled()`    |
| Drag             | `enableGlobalDragMode()`    | `disableGlobalDragMode()`    | `toggleGlobalDragMode()`    | `globalDragModeEnabled()`    |
| Rotate           | `enableGlobalRotateMode()`  | `disableGlobalRotateMode()`  | `toggleGlobalRotateMode()`  | `globalRotateModeEnabled()`  |
| Cut              | `enableGlobalCutMode()`     | `disableGlobalCutMode()`     | `toggleGlobalCutMode()`     | `globalCutModeEnabled()`     |
| Removal (delete) | `enableGlobalRemovalMode()` | `disableGlobalRemovalMode()` | `toggleGlobalRemovalMode()` | `globalRemovalModeEnabled()` |

### Single-Feature Edit Mode

Use this high-level API for interaction-mode editing where one feature can be
selected and edited at a time.

| Method                                  | Returns               | Description                                                                        |
| --------------------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| `enableSingleFeatureEditMode(options?)` | `Geoman`              | Enable hover, click selection, selected highlighting, and editing for one feature. |
| `disableSingleFeatureEditMode()`        | `Geoman`              | Disable the single-feature workflow and restore normal editability.                |
| `toggleSingleFeatureEditMode(options?)` | `Geoman`              | Toggle the single-feature workflow.                                                |
| `singleFeatureEditModeEnabled()`        | `boolean`             | Check whether the workflow is active.                                              |
| `getSelectedFeature()`                  | `FeatureData \| null` | Return the selected editable feature, or `null` when no feature is selected.       |

```ts
geoman.enableSingleFeatureEditMode({
  allowedShapes: ['line', 'polygon', 'rectangle'],
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

This API composes `helper:click_to_edit` with `edit:change` internally. Do not
enable those lower-level modes directly for the standard single-feature edit
workflow. Use them directly only when building custom selection/editing behavior.

### Generic Mode Management

These helpers remain available. Prefer the equivalent `geoman.modes` methods in
new code.

| Method                                                      | Returns   | Description                                |
| ----------------------------------------------------------- | --------- | ------------------------------------------ |
| `enableMode(actionType: ActionType, modeName: ModeName)`    | `void`    | Enable a specific mode for an action type. |
| `disableMode(actionType: ActionType, modeName: ModeName)`   | `void`    | Disable a specific mode.                   |
| `toggleMode(actionType: ActionType, modeName: ModeName)`    | `void`    | Toggle a mode on or off.                   |
| `isModeEnabled(actionType: ActionType, modeName: ModeName)` | `boolean` | Check if a mode is currently enabled.      |
| `disableAllModes()`                                         | `void`    | Disable every active mode.                 |

The mode-name TypeScript unions include implemented keys and reserved compatibility keys. Before exposing optional controls for a mode key, use `geoman.options.isModeAvailable(actionType, modeName)` to confirm that the key has a runtime implementation in this package.

### Mode Status Helpers

| Method                   | Returns                 | Description                    |
| ------------------------ | ----------------------- | ------------------------------ |
| `getActiveDrawModes()`   | `Array<DrawModeName>`   | Currently active draw modes.   |
| `getActiveEditModes()`   | `Array<EditModeName>`   | Currently active edit modes.   |
| `getActiveHelperModes()` | `Array<HelperModeName>` | Currently active helper modes. |

## Control Management

| Method                                       | Returns         | Description                       |
| -------------------------------------------- | --------------- | --------------------------------- |
| `addControls(controlsElement?: HTMLElement)` | `Promise<void>` | Add Geoman controls to the map.   |
| `removeControls()`                           | `void`          | Remove the controls from the map. |

Built-in controls target built-in draw, edit, and helper modes. Custom
interaction tools are controlled through `gm.tools` and can be connected to
app-owned UI or rendered as optional built-in tool controls.

### Control Profiles

Use `geoForge.control` to switch visible controls at runtime for workflow-,
role-, or route-specific toolbars. This is the preferred public API for dynamic
control visibility; do not mutate `geoForge.options.controls.*.*.uiEnabled` or
call `geoForge.control.updateReactivePanel()` from application code.

| Method                                                              | Returns                        | Description                                             |
| ------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------- |
| `geoForge.control.applyProfile(profile)`                            | `GeomanControlProfile`         | Apply visible controls by mode type and refresh once.   |
| `geoForge.control.setModeVisibility(type, mode, visible, options?)` | `void`                         | Show or hide one mode control and refresh the panel.    |
| `geoForge.control.getProfile()`                                     | `Record<ModeType, ModeName[]>` | Return a copied snapshot of currently visible controls. |

```ts
geoForge.control.applyProfile({
  draw: ['line', 'polygon'],
  edit: ['change', 'drag'],
  helper: ['snapping', 'zoom_to_features'],
});

geoForge.control.setModeVisibility('edit', 'cut', false, {
  deactivateIfActive: true,
});

const visibleControls = geoForge.control.getProfile();
```

`applyProfile(...)` treats omitted mode sections as empty visible sets. Hidden
active modes are deactivated by default; pass `deactivateHidden: false` to hide
controls without changing active mode state. `getProfile()` returns copied
arrays, not mutable internal option state.

## Custom Interaction Tools

```ts
gm.tools.register({
  id: 'inspect-feature',
  title: 'Inspect',
  control: {
    title: 'Inspect',
    eventType: 'toggle',
  },
  selection: true,
  onFeatureClick: ({ selection }, event) => {
    selection.selectFeature(event.feature, { reason: 'feature-click' });
    return { handled: true };
  },
});

gm.tools.activate('inspect-feature');
gm.tools.deactivate('inspect-feature');
gm.tools.cancel('api');
gm.tools.getToolControls();
```

See [Custom Interaction Tools](custom-interaction-tools.md) for hook payloads,
lifecycle events, and composition examples.

## Context Panels

```ts
gm.contextPanels.register({
  id: 'feature-info',
  title: 'Feature Info',
  render: ({ feature }) => {
    const root = document.createElement('section');
    root.textContent = String(feature?.getGeoJson().properties.name ?? 'Unnamed feature');
    return root;
  },
});

gm.contextPanels.open('feature-info', { feature });
gm.contextPanels.close();
```

Use `onClose` on a panel definition when application state needs to react to
panel replacement, tool cleanup, draw start, feature removal, API-driven close,
or teardown/destroy.

See [Context Panels](context-panels.md) for custom tool context-menu workflows,
rendering guidance, and feature-property examples.

## Geometry Utilities

```ts
const segment = gm.geometry.getNearestSegment(feature, point, {
  maxPixelDistance: 12,
});

if (segment) {
  console.log(segment.segmentIndex, segment.lengthMeters);
}
```

Line segment context menus can use
`geoman.geometry.getLineSegmentContext(feature, point)` to resolve the nearest
segment and its stored metadata. Use `getLineSegmentMetadata`,
`getLineSegmentProperty`, and `updateLineSegmentProperty` for segment-scoped
values stored in `feature.getGeoJson().properties.segments`.

## Event Handling

```ts
gm.setGlobalEventsListener((parameters?: GlobalEventsListenerParameters) => {
  // Inspect parameters here
});
```

Pass `null` to remove the listener.

## Types

The exported mode-name types include implemented mode keys and reserved compatibility keys. Reserved keys are retained so existing configuration shapes and type signatures stay compatible, but they are not available editing workflows unless this package adds a runtime mode class for them.

```ts
type DrawModeName =
  | 'marker'
  | 'circle'
  | 'circle_marker'
  | 'ellipse'
  | 'text_marker'
  | 'line'
  | 'rectangle'
  | 'polygon'
  | 'freehand'
  | 'custom_shape';

type EditModeName =
  | 'drag'
  | 'change'
  | 'rotate'
  | 'scale'
  | 'copy'
  | 'cut'
  | 'split'
  | 'union'
  | 'difference'
  | 'line_simplification'
  | 'lasso'
  | 'delete';

type HelperModeName =
  | 'shape_markers'
  | 'pin'
  | 'snapping'
  | 'snap_guides'
  | 'measurements'
  | 'auto_trace'
  | 'geofencing'
  | 'zoom_to_features'
  | 'click_to_edit';

type GlobalEventsListenerParameters = {
  type: 'system' | 'converted';
  name: GmFwdEventNameWithPrefix | GmFwdSystemEventNameWithPrefix;
  payload: GmFwdEvent | GmEvent;
};
```

Implemented mode keys:

- **Draw shapes**: `marker`, `circle`, `circle_marker`, `ellipse`, `text_marker`, `line`, `rectangle`, `polygon`.
- **Edit modes**: `drag`, `change`, `rotate`, `cut`, `delete`.
- **Helper modes**: `shape_markers`, `snapping`, `zoom_to_features`, `click_to_edit`.

Reserved mode keys:

- **Draw keys**: `freehand`, `custom_shape`.
- **Edit keys**: `scale`, `copy`, `split`, `union`, `difference`, `line_simplification`, `lasso`.
- **Helper keys**: `pin`, `snap_guides`, `measurements`, `auto_trace`, `geofencing`.

## Example Usage

```ts
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://maps.geoman.io/styles/basic/style.json',
});

const geoman = new GeoForge(map);

await geoman.addControls();

geoman.modes.enable('draw', 'polygon');

geoman.setGlobalEventsListener((params) => {
  if (params.name === 'gm:create') {
    console.log('Feature created:', params.payload);
  }
});

geoman.modes.enable('edit', 'change');
geoman.modes.enable('edit', 'rotate');

const activeModes = geoman.getActiveEditModes();
console.log('Active edit modes:', activeModes);

geoman.modes.disableAll();
```

## Implemented And Reserved Modes

- **Implemented draw shapes**: `marker`, `circle`, `circle_marker`, `ellipse`, `text_marker`, `line`, `rectangle`, `polygon`.
- **Reserved draw keys**: `freehand`, `custom_shape`.
- **Implemented edit modes**: `drag`, `change`, `rotate`, `cut`, `delete`.
- **Reserved edit keys**: `scale`, `copy`, `split`, `union`, `difference`, `line_simplification`, `lasso`.
- **Implemented helper modes**: `shape_markers`, `snapping`, `zoom_to_features`, `click_to_edit`.
- **Reserved helper keys**: `pin`, `snap_guides`, `measurements`, `auto_trace`, `geofencing`.
