# Drag Mode

Drag mode moves any editable layer directly on the map.

## Enable the Mode

```js
map.gm.enableGlobalDragMode();
map.gm.disableGlobalDragMode();
map.gm.toggleGlobalDragMode();
map.gm.globalDragModeEnabled();

// Alternatively, enable the edit drag mode explicitly
map.gm.enableMode('edit', 'drag');
map.gm.disableMode('edit', 'drag');
map.gm.toggleMode('edit', 'drag');
map.gm.isModeEnabled('edit', 'drag');
```

## API

| Method                   | Returns | Description                                                 |
|--------------------------|---------|-------------------------------------------------------------|
| `enableGlobalDragMode()` | `void`  | Enables global drag mode.                                   |
| `disableGlobalDragMode()` | `void`  | Disables global drag mode.                                  |
| `toggleGlobalDragMode()` | `void`  | Toggles global drag mode on or off.                         |
| `globalDragModeEnabled()` | `boolean` | Returns `true` when global drag mode is enabled.             |

## Events

| Event                     | Params | Description                              | Output                   |
|---------------------------|--------|------------------------------------------|--------------------------|
| `gm:dragstart`            | event  | Fired when a layer starts being dragged. | `map`, `feature`, `shape` |
| `gm:drag`                 | event  | Fired while a layer is being dragged.    | `map`, `feature`, `shape` |
| `gm:dragend`              | event  | Fired when dragging stops.               | `map`, `feature`, `shape` |
| `gm:globaldragmodetoggled` | event  | Fired whenever drag mode is toggled.     | `enabled`, `map`          |

```js
map.on('gm:globaldragmodetoggled', event => {
  console.log(event);
});
```
