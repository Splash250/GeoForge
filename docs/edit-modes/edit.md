# Edit Mode

Edit mode modifies vertex positions and shape geometry for all editable layers.

## Enable the Mode

```js
map.gm.enableGlobalEditMode();
map.gm.disableGlobalEditMode();
map.gm.toggleGlobalEditMode();
map.gm.globalEditModeEnabled();

// Alternatively, enable the change edit mode explicitly
map.gm.enableMode('edit', 'change');
map.gm.disableMode('edit', 'change');
map.gm.toggleMode('edit', 'change');
map.gm.isModeEnabled('edit', 'change');
```

## API

| Method                   | Returns   | Description                                                  |
|--------------------------|-----------|--------------------------------------------------------------|
| `enableGlobalEditMode()` | `void`    | Enables global edit mode.                                    |
| `disableGlobalEditMode()` | `void`    | Disables global edit mode.                                   |
| `toggleGlobalEditMode()` | `void`    | Toggles global edit mode on or off.                          |
| `globalEditModeEnabled()` | `boolean` | Returns `true` when global edit mode is currently enabled.   |

## Events

| Event                      | Params | Description                                | Output                   |
|----------------------------|--------|--------------------------------------------|--------------------------|
| `gm:editstart`             | event  | Fired when a layer begins editing.         | `map`, `feature`, `shape` |
| `gm:edit`                  | event  | Fired while a layer is being edited.       | `map`, `feature`, `shape` |
| `gm:editend`               | event  | Fired when editing finishes.               | `map`, `feature`, `shape` |
| `gm:globaleditmodetoggled` | event  | Fired whenever edit mode is toggled.       | `enabled`, `map`          |

```js
map.on('gm:globaleditmodetoggled', event => {
  console.log(event);
});
```
