# Remove Mode

Remove mode deletes features from the map when they are clicked.

## Enable the Mode

```js
map.gm.enableGlobalRemovalMode();
map.gm.disableGlobalRemovalMode();
map.gm.toggleGlobalRemovalMode();
map.gm.globalRemovalModeEnabled();

// Alternatively, enable the delete edit mode explicitly
map.gm.enableMode('edit', 'delete');
map.gm.disableMode('edit', 'delete');
map.gm.toggleMode('edit', 'delete');
map.gm.isModeEnabled('edit', 'delete');
```

## API

| Method                     | Returns   | Description                                                    |
|----------------------------|-----------|----------------------------------------------------------------|
| `enableGlobalRemovalMode()` | `void`    | Enables global removal mode.                                   |
| `disableGlobalRemovalMode()` | `void`    | Disables global removal mode.                                  |
| `toggleGlobalRemovalMode()` | `void`    | Toggles removal mode on or off.                                |
| `globalRemovalModeEnabled()` | `boolean` | Returns `true` when global removal mode is currently enabled.  |

## Events

| Event                       | Params | Description                               | Output          |
|-----------------------------|--------|-------------------------------------------|-----------------|
| `gm:remove`                 | event  | Fired after a feature is removed.         | `map`, `feature`, `shape` |
| `gm:globalremovemodetoggled` | event  | Fired whenever removal mode is toggled.   | `enabled`, `map` |

```js
map.on('gm:globalremovemodetoggled', event => {
  console.log(event);
});
```
