# Zoom to Features Helper Mode

Zoom to Features fits the viewport to all visible geometries, making it easy to inspect the entire dataset.

## Enable the Mode

```js
map.gm.enableMode('helper', 'zoom_to_features');
map.gm.disableMode('helper', 'zoom_to_features');
map.gm.toggleMode('helper', 'zoom_to_features');
map.gm.isModeEnabled('helper', 'zoom_to_features');
```

## Events

| Event                              | Params | Description                                | Output          |
|------------------------------------|--------|--------------------------------------------|-----------------|
| `gm:globalzoom_to_featuresmodetoggled` | event  | Fired whenever zoom-to-features toggles.   | `enabled`, `map` |

```js
map.on('gm:globalzoom_to_featuresmodetoggled', event => {
  console.log(event);
});
```

## Behavior

- Calculates a bounding box around all active features.
- Adds a 20 pixel padding to the camera fit.
- Adjusts the viewport so every feature is visible.
