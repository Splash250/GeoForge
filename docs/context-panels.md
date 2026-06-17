# Context Panels

Context panels are GeoForge-owned right-side map panels for custom tool
workflows. They are intended for feature inspection, segment details, and other
map interaction results that should stay attached to the current map session.

GeoForge owns the panel slot and lifecycle. Your application owns the content,
business logic, feature data, and any app-specific styling inside the panel.

## Register a Panel

Register a panel definition once during setup:

```ts
geoman.contextPanels.register({
  id: 'feature-info',
  title: 'Feature Info',
  render: ({ feature, close }) => {
    const root = document.createElement('section');
    const title = document.createElement('h3');
    const closeButton = document.createElement('button');

    title.textContent = String(feature?.getGeoJson().properties.name ?? 'Unnamed feature');
    closeButton.type = 'button';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', close);

    root.append(title, closeButton);
    return root;
  },
});
```

Only one context panel can be open at a time. Opening a second panel replaces
the current panel.

## Open From a Custom Tool

Context panels are commonly opened from `onFeatureContextMenu`:

```ts
geoman.tools.register({
  id: 'inspect-feature',
  selection: {
    hover: true,
    cursor: 'pointer',
  },
  onFeatureContextMenu: ({ contextPanels }, event) => {
    contextPanels.open('feature-info', {
      feature: event.feature,
      point: event.point,
      lngLat: event.lngLat,
    });

    return { handled: true };
  },
  onContextMenu: ({ contextPanels }) => {
    contextPanels.close('blank-map');
    return { handled: true };
  },
});
```

Returning `{ handled: true }` prevents the browser context menu and stops later
map handlers from processing the same context-menu event.

## Feature Properties

Use GeoJSON feature properties for persisted custom application data:

```ts
feature.updateProperties({
  segmentValue: 300,
  segments: [{ index: 0, segmentValue: 300 }],
});
```

Panel render functions can then read those properties from
`feature.getGeoJson().properties`. Properties prefixed with `gm_` are GeoForge
system properties and should be treated as protected implementation details.

## Reusable Controls

Use the context panel control helpers for simple editable panels:

```ts
import {
  createContextPanelDescriptionList,
  createContextPanelTextInput,
  defineGeomanContextPanel,
} from 'maplibre-geoforge';
import type { FeatureData, GeomanLineSegmentContext } from 'maplibre-geoforge';

type SegmentDetailsPanelData = {
  feature: FeatureData;
  segmentContext: GeomanLineSegmentContext;
};

geoman.contextPanels.register(
  defineGeomanContextPanel<SegmentDetailsPanelData>({
    id: 'segment-details',
    title: 'Segment Details',
    render: ({ data }) => {
      const segmentValue = data.segmentContext.metadata?.segmentValue;
      const content = document.createElement('div');

      content.append(
        createContextPanelDescriptionList([
          ['Length', data.segmentContext.segment.lengthMeters],
          ['Segment value', segmentValue],
        ]),
        createContextPanelTextInput({
          label: 'Set segment value',
          ariaLabel: 'Segment value',
          value: segmentValue,
          inputMode: 'decimal',
          parse: (value) => {
            const numericValue = Number(value);
            return value === '' ? undefined : Number.isFinite(numericValue) ? numericValue : value;
          },
          onChange: (segmentValue) => {
            geoman.geometry.updateLineSegmentProperty(
              data.feature,
              data.segmentContext.segment.segmentIndex,
              'segmentValue',
              segmentValue,
            );
            geoman.contextPanels.update({
              segmentContext: {
                ...data.segmentContext,
                metadata: geoman.geometry.getLineSegmentMetadata(
                  data.feature,
                  data.segmentContext.segment.segmentIndex,
                ),
              },
            });
          },
        }),
      );

      return content;
    },
  }),
);
```

`contextPanels.update(data)` rerenders the currently open panel with merged data.
It does not persist feature properties by itself; call feature or geometry update
APIs first when the panel edits stored GeoJSON data.

## Rendering Safety

Panel render functions can return an `HTMLElement`, a string, or nothing. String
render results are sanitized before they are inserted into the panel body, so
basic markup can be used while scriptable attributes and unsafe tags are removed.

For feature properties or other user-controlled values, prefer returning DOM
nodes and assigning values with `textContent`.

## Close Lifecycle

Panels can observe their own close lifecycle with `onClose`:

```ts
geoman.contextPanels.register({
  id: 'feature-info',
  title: 'Feature Info',
  render: () => 'Feature details',
  onClose: ({ reason, state }) => {
    console.log(`Closed ${state.id} because ${reason}`);
  },
});
```

Close reasons include `api`, `replacement`, `blank-map`, `tool-end`,
`draw-start`, `feature-removed`, and `destroy`.
