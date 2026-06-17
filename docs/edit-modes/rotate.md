# Rotate Mode

Rotate mode turns features around their center or a chosen pivot.

## Enable the Mode

```js
map.gm.enableGlobalRotateMode();
map.gm.disableGlobalRotateMode();
map.gm.toggleGlobalRotateMode();
map.gm.globalRotateModeEnabled();

// Alternatively, enable the rotate edit mode explicitly
map.gm.enableMode('edit', 'rotate');
map.gm.disableMode('edit', 'rotate');
map.gm.toggleMode('edit', 'rotate');
map.gm.isModeEnabled('edit', 'rotate');
```

## API

| Method                   | Returns   | Description                                                   |
|--------------------------|-----------|---------------------------------------------------------------|
| `enableGlobalRotateMode()` | `void`    | Enables global rotate mode.                                   |
| `disableGlobalRotateMode()` | `void`    | Disables global rotate mode.                                  |
| `toggleGlobalRotateMode()` | `void`    | Toggles rotate mode on or off.                                |
| `globalRotateModeEnabled()` | `boolean` | Returns `true` when global rotate mode is currently enabled.  |

## Events

| Event                     | Params | Description                               | Output                   |
|---------------------------|--------|-------------------------------------------|--------------------------|
| `gm:rotatestart`          | event  | Fired when a layer begins rotating.       | `map`, `feature`, `shape` |
| `gm:rotate`               | event  | Fired while a layer is rotating.          | `map`, `feature`, `shape` |
| `gm:rotateend`            | event  | Fired when rotation ends.                 | `map`, `feature`, `shape` |
| `gm:globalrotatemodetoggled` | event  | Fired whenever rotate mode is toggled.    | `enabled`, `map`          |

```js
map.on('gm:globalrotatemodetoggled', event => {
  console.log(event);
});
```
