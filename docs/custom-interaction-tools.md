# Custom Interaction Tools

Custom interaction tools let applications build map editor workflows on top of
GeoForge without forking helper modes or treating GeoForge as a standalone app. A
tool is registered with behavior, activated by the application, and receives
typed feature and map interaction hooks while it is active.

The control surface stays small by design. GeoForge owns feature resolution,
selection state, lifecycle events, interaction dispatch, and optional basic tool
buttons. Your application can still own richer product UI such as toolbars,
shortcut handlers, side panels, menus, and workflow state.

## Register and Activate a Tool

```ts
geoman.tools.register({
  id: 'inspect-feature',
  selection: {
    hover: true,
    cursor: 'pointer',
  },
  onFeatureClick: ({ selection }, event) => {
    selection.selectFeature(event.feature, { reason: 'feature-click' });
    console.log('Selected for inspection', event.feature);
    return { handled: true };
  },
  onBlankMapClick: ({ selection }) => {
    selection.clearSelection({ reason: 'map-click' });
  },
  onCancel: ({ selection }) => {
    selection.clearSelection({ reason: 'api' });
  },
});

geoman.tools.activate('inspect-feature');
```

Only one custom tool is active at a time. Activating another registered tool ends
the previous one first.

## API

```ts
geoman.tools.register(definition);
geoman.tools.activate('inspect-feature');
geoman.tools.deactivate('inspect-feature');
geoman.tools.cancel('api');

const activeToolId = geoman.tools.getActiveToolId();
const tool = geoman.tools.get('inspect-feature');
const tools = geoman.tools.getAll();
const toolControls = geoman.tools.getToolControls();
```

`register` throws when a tool id is already registered. `activate` throws when
the id is unknown. `deactivate` is a no-op when the requested id is not active.

## Tool Context

Every hook receives the same context object:

```ts
type GeomanToolContext = {
  geoman: Geoman;
  map: AnyMapInstance;
  features: Features;
  selection: GeomanSelectionSubsystem;
  contextPanels: GeomanContextPanelSubsystem;
  modes: ModeController;
};
```

Use the context to compose existing GeoForge primitives. For example, a custom
edit tool can activate selection on start, select one feature on click, and then
enable a built-in edit mode only for that selected feature.

## Built-In Selection Feedback

Tools that behave like a select mode can opt into GeoForge-owned selection
feedback without manually wiring hover hooks:

```ts
geoman.tools.register({
  id: 'measure-line',
  selection: {
    hover: true,
    cursor: 'pointer',
    allowedShapes: ['line'],
  },
  onFeatureClick: ({ geoman }, event) => {
    const segment = geoman.geometry.getNearestSegment(event.feature, event.point);
    if (!segment) return;

    console.log(segment.lengthMeters);
    return { handled: true };
  },
});
```

`selection: true` is shorthand for hover feedback with a pointer cursor.
`selection.enabled` defaults to `true` when an options object is provided, and
`selection.hover` defaults to `true`. `allowedShapes` filters which features can
fire the tool's hover and click hooks for that tool.

## Interaction Hooks

```ts
geoman.tools.register({
  id: 'delete-on-click',
  onFeatureHover(ctx, event) {},
  onFeatureHoverEnd(ctx, event) {},
  onFeatureClick(ctx, event) {
    ctx.features.delete(event.feature);
    return { handled: true };
  },
  onBlankMapClick(ctx, event) {},
});
```

Feature hooks receive `feature`, `sourceName`, `point`, `lngLat`,
`originalEvent`, and `map`. Hover events also receive `previousFeature`; hover
end receives a reason. Returning `{ handled: true }` from `onFeatureClick`
prevents later map click handlers from processing the same click.

## Feature Context Panels

Custom tools can open right-side context panels from feature context-menu
interactions:

```ts
geoman.contextPanels.register({
  id: 'segment-details',
  title: 'Segment Details',
  render: ({ data }) => {
    const root = document.createElement('section');
    const length = document.createElement('p');
    const segmentValue = document.createElement('p');

    length.textContent = `Length: ${String(data.lengthMeters ?? '')}`;
    segmentValue.textContent = `segmentValue: ${String(data.segmentValue ?? '')}`;
    root.append(length, segmentValue);

    return root;
  },
});

geoman.tools.register({
  id: 'inspect-segment',
  selection: {
    hover: true,
    cursor: 'pointer',
    allowedShapes: ['line'],
  },
  onFeatureContextMenu: ({ geoman, contextPanels }, event) => {
    const segment = geoman.geometry.getNearestSegment(event.feature, event.point);

    if (!segment) return;

    contextPanels.open('segment-details', {
      feature: event.feature,
      point: event.point,
      lngLat: event.lngLat,
      lengthMeters: segment.lengthMeters,
      segmentValue: event.feature.getGeoJson().properties.segmentValue,
    });

    return { handled: true };
  },
  onContextMenu: ({ contextPanels }) => {
    contextPanels.close('blank-map');
    return { handled: true };
  },
});
```

Returning `{ handled: true }` from `onFeatureContextMenu` prevents the browser
context menu and stops later map handlers from processing the same event. See
[Context Panels](context-panels.md) for the panel registry, lifecycle, and
feature-property guidance.

By default, custom tool pointer interactions query the current Geoman default
source. Use `selection.sourceNames` when a tool should inspect another Geoman
source:

```ts
geoman.tools.register({
  id: 'standby-inspector',
  selection: {
    sourceNames: ['gm_standby'],
    allowedShapes: ['line'],
  },
  onFeatureContextMenu: ({ contextPanels }, event) => {
    contextPanels.open('standby-feature', { feature: event.feature });
    return { handled: true };
  },
});
```

## Lifecycle Hooks and Events

Tools can implement lifecycle hooks:

```ts
geoman.tools.register({
  id: 'review-feature',
  onStart(ctx) {},
  onCancel(ctx, reason) {},
  onEnd(ctx) {},
});
```

Geoman also emits public lifecycle events:

```ts
map.on('gm:toolstart', (event) => {
  console.log(event.toolId);
});

map.on('gm:toolcancel', (event) => {
  console.log(event.toolId, event.reason);
});

map.on('gm:toolend', (event) => {
  console.log(event.toolId);
});
```

Use these events to keep app-owned UI synchronized with tool state.

## Selection Filters

Selection can be configured independently from a custom tool:

```ts
geoman.selection.configure({
  selectableFeatureFilter: ({ feature }) => {
    return feature.getGeoJson().properties.locked !== true;
  },
  beforeSelect: ({ feature }) => {
    return feature.getGeoJson().properties.archived !== true;
  },
});
```

`selectableFeatureFilter` controls whether a feature is selectable for hover,
selection, and selection style updates. `beforeSelect` runs after basic
selectability checks and can veto a selection without clearing the previous
selection.

## Optional Built-In Controls

Custom tools can be controlled through your own UI:

```ts
button.addEventListener('click', () => {
  if (geoman.tools.getActiveToolId() === 'inspect-feature') {
    geoman.tools.deactivate('inspect-feature');
  } else {
    geoman.tools.activate('inspect-feature');
  }
});
```

They can also opt into the built-in Geoman control panel by adding `control`
metadata to the tool definition:

```ts
geoman.tools.register({
  id: 'inspect-feature',
  title: 'Inspect',
  control: {
    title: 'Inspect',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true">...</svg>',
    uiEnabled: true,
    eventType: 'toggle',
  },
  onFeatureClick: ({ selection }, event) => {
    selection.selectFeature(event.feature, { reason: 'feature-click' });
    return { handled: true };
  },
});
```

`eventType: 'toggle'` activates an inactive tool and deactivates it when its
active button is clicked again. `eventType: 'click'` activates the tool without
toggling it off on a second click. `uiEnabled: false` keeps the tool registered
and programmatically usable without rendering a button.

## Selection-Based Edit Composition

For standard one-feature-at-a-time interaction editing, prefer the high-level
instance API:

```ts
geoman.enableSingleFeatureEditMode({
  allowedShapes: ['line', 'polygon', 'rectangle'],
});
```

That method configures selection, hover and selected styling, pointer cursor
feedback, and `edit:change` scoping for the selected feature. For line-only
editing, pass `allowedShapes: ['line']`.

The lower-level `helper:click_to_edit` mode is still available as the generic
primitive when you are composing custom selection/edit workflows:

```ts
geoman.modes.enable('helper', 'click_to_edit');
geoman.modes.enable('edit', 'change');
```

You can also compose the same selection primitives from a tool:

```ts
geoman.tools.register({
  id: 'single-feature-change',
  onStart: ({ selection, modes }) => {
    selection.activate();
    modes.enable('edit', 'change');
  },
  onFeatureClick: ({ selection }, event) => {
    selection.selectFeature(event.feature, { reason: 'feature-click' });
    return { handled: true };
  },
  onBlankMapClick: ({ selection }) => {
    selection.clearSelection({ reason: 'map-click' });
  },
  onEnd: ({ selection, modes }) => {
    selection.clearSelection({ reason: 'api' });
    selection.deactivate();
    modes.disable('edit', 'change');
  },
});
```

The selected feature remains available through
`geoman.selection.getSelectedFeature()`.
