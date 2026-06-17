# Geoman Events

Geoman exposes a comprehensive event system so you can react to drawing, editing, or helper interactions. Listen to individual events or capture everything through a global listener.

## Listening Strategies

### Individual Event Listening

```ts
map.on('gm:create', (event) => {
  console.log('Feature created:', event);
});
```

### Global Event Listener

```ts
import type { GmEvent, GmSystemEvent } from '@sewergy/maplibre-geoman';

geoman.setGlobalEventsListener((event: GmSystemEvent | GmEvent) => {
  console.log('Event:', event);
});

// Later, remove the listener
geoman.setGlobalEventsListener(null);
```

## Mode Toggle Events

| Event                                  | Description                          | Payload fields   |
| -------------------------------------- | ------------------------------------ | ---------------- |
| `gm:globaldrawmodetoggled`             | Fired when draw mode toggles.        | `enabled`, `map` |
| `gm:globaleditmodetoggled`             | Fired when edit mode toggles.        | `enabled`, `map` |
| `gm:globalremovemodetoggled`           | Fired when remove mode toggles.      | `enabled`, `map` |
| `gm:globalrotatemodetoggled`           | Fired when rotate mode toggles.      | `enabled`, `map` |
| `gm:globaldragmodetoggled`             | Fired when drag mode toggles.        | `enabled`, `map` |
| `gm:globalcutmodetoggled`              | Fired when cut mode toggles.         | `enabled`, `map` |
| `gm:globalsnappingmodetoggled`         | Fired when snapping helper toggles.  | `enabled`, `map` |
| `gm:globalzoom_to_featuresmodetoggled` | Fired when zoom-to-features toggles. | `enabled`, `map` |

```ts
map.on('gm:globaldrawmodetoggled', (event) => {
  console.log('Draw mode toggled:', event.enabled);
});
```

## Drawing Events

```ts
map.on('_gm:draw', (event: GmDrawEvent) => {
  console.log('Draw event:', event);
});

map.on('gm:create', (event: FeatureCreatedFwdEvent) => {
  console.log('Feature created:', event);
});
```

## Edit Events

```ts
map.on('_gm:edit', (event: GmEditEvent) => {
  console.log('Edit event:', event);
});

map.on('gm:editstart', (event: FeatureEditStartFwdEvent) => {
  console.log('Edit started:', event);
});

map.on('gm:editend', (event: FeatureEditEndFwdEvent) => {
  console.log('Edit ended:', event);
});
```

## Remove Events

```ts
map.on('gm:remove', (event: FeatureRemovedFwdEvent) => {
  console.log('Feature removed:', event);
});
```

## History Events

`geoman.history` emits lifecycle events for app-owned undo and redo controls.

| Event              | Description                                      | Payload fields |
| ------------------ | ------------------------------------------------ | -------------- |
| `gm:historyrecord` | A new undoable history entry was recorded.       | `entry`        |
| `gm:historychange` | Undo/redo availability or history config changed. | `state`        |
| `gm:undo`          | A history entry was undone.                      | `entry`        |
| `gm:redo`          | A history entry was redone.                      | `entry`        |

```ts
map.on('gm:historychange', (event) => {
  console.log(event.state.canUndo, event.state.canRedo);
});

map.on('gm:historyrecord', (event) => {
  console.log(event.entry.id, event.entry.operations.length);
});
```

## Rotate Events

```ts
map.on('gm:rotate', (event: FeatureUpdatedFwdEvent) => {
  console.log('Rotate event:', event);
});

map.on('gm:rotatestart', (event: FeatureEditStartFwdEvent) => {
  console.log('Rotation started:', event);
});

map.on('gm:rotateend', (event: FeatureEditEndFwdEvent) => {
  console.log('Rotation ended:', event);
});
```

## Drag Events

```ts
map.on('gm:drag', (event: FeatureUpdatedFwdEvent) => {
  console.log('Drag event:', event);
});

map.on('gm:dragstart', (event: FeatureEditStartFwdEvent) => {
  console.log('Drag started:', event);
});

map.on('gm:dragend', (event: FeatureEditEndFwdEvent) => {
  console.log('Drag ended:', event);
});
```

## Cut Events

```ts
map.on('gm:cut', (event: FeatureUpdatedFwdEvent) => {
  console.log('Feature cut:', event);
});
```

## Helper and Control Events

```ts
map.on('_gm:helper', (event: GmHelperEvent) => {
  console.log('Helper event:', event);
});

map.on('_gm:control', (event: GmControlEvent) => {
  console.log('Control event:', event);
});
```

## Feature Interaction Events

When `helper:click_to_edit` is active, Geoman forwards feature interaction events
that applications can use for app-owned previews, inspectors, and command
state.

| Event                | Description                                  |
| -------------------- | -------------------------------------------- |
| `gm:featurehover`    | A selectable feature is hovered.             |
| `gm:featurehoverend` | A hovered feature is cleared.                |
| `gm:featureclick`    | A selectable feature is clicked.             |
| `gm:mapblankclick`   | The map is clicked without a selectable hit. |

```ts
map.on('gm:featurehover', (event) => {
  console.log(event.feature, event.previousFeature);
});

map.on('gm:featureclick', (event) => {
  console.log(event.feature, event.lngLat);
});

map.on('gm:mapblankclick', (event) => {
  console.log(event.lngLat);
});
```

## Custom Tool Events

Custom tools registered through `geoman.tools` emit lifecycle events. Use these
to synchronize app-owned controls with the active tool.

| Event           | Description                  |
| --------------- | ---------------------------- |
| `gm:toolstart`  | A custom tool became active. |
| `gm:toolcancel` | A custom tool was cancelled. |
| `gm:toolend`    | A custom tool ended.         |

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

## Complete Example

```ts
import {
  Geoman,
  type GmEvent,
  type GmOptionsPartial,
  type GmSystemEvent,
} from '@sewergy/maplibre-geoman';

const map = new maplibregl.Map({
  container: 'map',
  style: 'your-style-url',
});

const options: GmOptionsPartial = {
  // configuration options (see Configuring Geoman)
};

const gm = new Geoman(map, options);
const gmEvents: Array<Record<string, unknown>> = [];

map.once('gm:loaded', () => {
  console.log('Geoman loaded');

  const getGeoJson = (featureData: any) => {
    try {
      return JSON.stringify(featureData.getGeoJson(), null, 2);
    } catch (error) {
      return 'Cannot retrieve GeoJSON';
    }
  };

  const handleEvent = (event: any) => {
    console.log('Event', event);

    gmEvents.push({
      id: event?.feature?.id ?? undefined,
      enabled: event?.enabled ?? undefined,
      timestamp: new Date().toLocaleTimeString(),
      type: event?.type,
      shape: event?.shape ?? undefined,
      geojson: event?.feature ? getGeoJson(event.feature) : undefined,
    });
  };

  // Mode events
  map.on('gm:globaldrawmodetoggled', handleEvent);
  map.on('gm:globaleditmodetoggled', handleEvent);
  map.on('gm:globalremovemodetoggled', handleEvent);
  map.on('gm:globalrotatemodetoggled', handleEvent);
  map.on('gm:globaldragmodetoggled', handleEvent);
  map.on('gm:globalcutmodetoggled', handleEvent);
  map.on('gm:globalsnappingmodetoggled', handleEvent);

  // Draw events
  map.on('gm:create', handleEvent);

  // Edit events
  map.on('gm:editstart', handleEvent);
  map.on('gm:editend', handleEvent);

  // Remove events
  map.on('gm:remove', handleEvent);

  // Rotate events
  map.on('gm:rotatestart', handleEvent);
  map.on('gm:rotateend', handleEvent);

  // Drag events
  map.on('gm:dragstart', handleEvent);
  map.on('gm:dragend', handleEvent);

  // Cut events
  map.on('gm:cut', handleEvent);

  // Helper and control events
  map.on('_gm:helper', handleEvent);
  map.on('_gm:control', handleEvent);
});

gm.setGlobalEventsListener((event: GmSystemEvent | GmEvent) => {
  console.log('Global event:', event);
});
```

Example stored event:

```json
{
  "id": "feature-123",
  "enabled": true,
  "timestamp": "14:30:45",
  "type": "gm:create",
  "shape": "polygon",
  "geojson": "{ \"type\": \"Feature\", \"properties\": { \"shape\": \"polygon\" }, \"geometry\": { \"type\": \"Polygon\", \"coordinates\": [...] } }"
}
```

## Event Payload Types

```ts
interface FeatureCreatedFwdEvent {
  name: 'gm:create';
  shape: DrawModeName;
  feature: FeatureData;
  map: AnyMapInstance;
}

interface FeatureUpdatedFwdEvent {
  name: `gm:${FwdEditModeName}`;
  map: AnyMapInstance;
  shape?: FeatureShape;
  feature?: FeatureData;
  features?: Array<FeatureData>;
  originalFeature?: FeatureData;
  originalFeatures?: Array<FeatureData>;
}

interface GlobalEditToggledFwdEvent {
  name: `gm:global${FwdEditModeName}modetoggled`;
  enabled: boolean;
  map: AnyMapInstance;
}
```

## Best Practices

- **Group handlers by category** to keep code organized.

  ```ts
  const drawHandlers = {
    onCreate: (event: FeatureCreatedFwdEvent) => {
      /* ... */
    },
    onUpdate: (event: FeatureUpdatedFwdEvent) => {
      /* ... */
    },
  };
  ```

- **Handle errors** inside listeners.

  ```ts
  map.on('gm:create', (event) => {
    try {
      // Process event
    } catch (error) {
      console.error('Error processing create event:', error);
    }
  });
  ```

- **Clean up listeners** when they are no longer needed.

  ```ts
  const handler = (event: FeatureCreatedFwdEvent) => {
    /* ... */
  };
  map.on('gm:create', handler);

  // Later...
  map.off('gm:create', handler);
  ```

- **Throttle high-frequency events** such as drag updates.

  ```ts
  import { debounce } from 'lodash';

  const debouncedHandler = debounce((event: FeatureUpdatedFwdEvent) => {
    // Process drag event
  }, 100);

  map.on('gm:drag', debouncedHandler);
  ```
