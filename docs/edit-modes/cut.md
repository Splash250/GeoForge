# Cut Mode

Cut mode subtracts one feature from another, splitting geometry along the cut path.

## Enable the Mode

```js
map.gm.enableGlobalCutMode();
map.gm.disableGlobalCutMode();
map.gm.toggleGlobalCutMode();
map.gm.globalCutModeEnabled();

// Alternatively, enable the cut edit mode explicitly
map.gm.enableMode('edit', 'cut');
map.gm.disableMode('edit', 'cut');
map.gm.toggleMode('edit', 'cut');
map.gm.isModeEnabled('edit', 'cut');
```

## API

| Method                 | Returns   | Description                                                  |
|------------------------|-----------|--------------------------------------------------------------|
| `enableGlobalCutMode()` | `void`    | Enables global cut mode.                                     |
| `disableGlobalCutMode()` | `void`    | Disables global cut mode.                                    |
| `toggleGlobalCutMode()` | `void`    | Toggles cut mode on or off.                                  |
| `globalCutModeEnabled()` | `boolean` | Returns `true` when global cut mode is currently enabled.    |

## Events

| Event                     | Params | Description                                | Output                   |
|---------------------------|--------|--------------------------------------------|--------------------------|
| `gm:cut`                  | event  | Fired after a cut operation completes.     | `map`, `feature`, `shape` |
| `gm:globalcutmodetoggled` | event  | Fired whenever cut mode is toggled.        | `enabled`, `map`          |

```js
map.on('gm:globalcutmodetoggled', event => {
  console.log(event);
});
```
