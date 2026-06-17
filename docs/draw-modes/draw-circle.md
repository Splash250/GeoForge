# Draw Circle Mode

Draw Circle mode adds circles to the map by defining a center point and radius.

## Enable the Mode

```js
map.gm.enableDraw('circle');
map.gm.disableDraw();
map.gm.toggleDraw('circle');
map.gm.drawEnabled('circle');

// Alternatively, control draw modes explicitly
map.gm.enableMode('draw', 'circle');
map.gm.disableMode('draw', 'circle');
map.gm.toggleMode('draw', 'circle');
map.gm.isModeEnabled('draw', 'circle');
```

## Events

| Event        | Params | Description                        | Output                   |
|--------------|--------|------------------------------------|--------------------------|
| `gm:drawstart` | event  | Fired when circle drawing starts.   | `map`, `shape`             |
| `gm:create`    | event  | Fired when a circle is created.      | `map`, `shape`, `feature` |

## Behavior

- Click on the map to place the circle center.
- Move the cursor to adjust the radius.
- Click again to finalize the circle.

Circles are represented as GeoJSON polygons with 80 steps by default to ensure smooth rendering.
