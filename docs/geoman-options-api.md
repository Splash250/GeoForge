# GeoForge Options API

`gm.options` manages configuration for controls, layer styles, and mode state. Use it to toggle modes programmatically and inspect control settings.

## Accessing `GmOptions`

```ts
import { GeoForge } from 'maplibre-geoforge';

const gm = new GeoForge(map, options);
const gmOptions = gm.options;
```

## Mode Management

| Method                                                    | Returns | Description                                 |
| --------------------------------------------------------- | ------- | ------------------------------------------- |
| `enableMode(actionType: ActionType, modeName: ModeName)`  | `void`  | Enable a specific mode for the action type. |
| `disableMode(actionType: ActionType, modeName: ModeName)` | `void`  | Disable the specified mode.                 |
| `toggleMode(actionType: ActionType, modeName: ModeName)`  | `void`  | Toggle the mode on or off.                  |

```ts
gm.options.enableMode('draw', 'polygon');
gm.options.enableMode('edit', 'rotate');

gm.options.disableMode('draw', 'polygon');
gm.options.toggleMode('edit', 'rotate');
```

## Mode State Queries

| Method                                                        | Returns   | Description                                  |
| ------------------------------------------------------------- | --------- | -------------------------------------------- |
| `isModeEnabled(actionType: ActionType, modeName: ModeName)`   | `boolean` | Check whether a mode is currently active.    |
| `isModeAvailable(actionType: ActionType, modeName: ModeName)` | `boolean` | Check whether a mode is available to enable. |

```ts
const isDrawing = gm.options.isModeEnabled('draw', 'polygon');
const canRotate = gm.options.isModeAvailable('edit', 'rotate');
```

## Control Options

```ts
const polygonOptions = gm.options.getControlOptions({
  actionType: 'draw',
  modeName: 'polygon',
});
```

`getControlOptions` returns the control configuration or `null` if the control is not defined.
Use it for inspection and low-level compatibility. For workflow-specific
runtime visibility, prefer `geoForge.control.applyProfile(...)` or
`geoForge.control.setModeVisibility(...)` instead of mutating
`gm.options.controls` directly.

## Dynamic Configuration Example

```ts
const polygonControl = gm.options.getControlOptions({
  actionType: 'draw',
  modeName: 'polygon',
});

const isPolygonEnabled = gm.options.isModeEnabled('draw', 'polygon');
const isRotateAvailable = gm.options.isModeAvailable('edit', 'rotate');

if (isPolygonEnabled) {
  gm.options.disableMode('draw', 'polygon');
} else {
  gm.options.enableMode('draw', 'polygon');
}
```
