# Draw Circle Marker Mode

Draw Circle Marker mode adds circle markers to the map. Circle markers have a fixed radius in pixels, so they keep their screen size regardless of zoom level.

## Enable the Mode

```js
map.gm.enableDraw('circle_marker');
map.gm.disableDraw();
map.gm.toggleDraw('circle_marker');
map.gm.drawEnabled('circle_marker');

// Alternatively, control draw modes explicitly
map.gm.enableMode('draw', 'circle_marker');
map.gm.disableMode('draw', 'circle_marker');
map.gm.toggleMode('draw', 'circle_marker');
map.gm.isModeEnabled('draw', 'circle_marker');
```

## Events

| Event        | Params | Description                            | Output                   |
|--------------|--------|----------------------------------------|--------------------------|
| `gm:drawstart` | event  | Fired when circle marker drawing starts. | `map`, `shape`             |
| `gm:create`    | event  | Fired when a circle marker is created.   | `map`, `shape`, `feature` |

## Behavior

- Click the map to place the circle marker center.
- Circle markers are created with a default pixel radius.
- The marker keeps its pixel size at every zoom level.
