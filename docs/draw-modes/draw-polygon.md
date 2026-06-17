# Draw Polygon Mode

Draw Polygon mode creates polygon geometries by clicking to add vertices and closing the shape.

## Enable the Mode

```js
map.gm.enableDraw('polygon');
map.gm.disableDraw();
map.gm.toggleDraw('polygon');
map.gm.drawEnabled('polygon');

// Alternatively, control draw modes explicitly
map.gm.enableMode('draw', 'polygon');
map.gm.disableMode('draw', 'polygon');
map.gm.toggleMode('draw', 'polygon');
map.gm.isModeEnabled('draw', 'polygon');
```

## Events

| Event        | Params | Description                          | Output                   |
|--------------|--------|--------------------------------------|--------------------------|
| `gm:drawstart` | event  | Fired when polygon drawing starts.    | `map`, `shape`             |
| `gm:create`    | event  | Fired when a polygon is created.       | `map`, `shape`, `feature` |

## Behavior

- Click the map to place the first vertex.
- Move the cursor to preview polygon edges.
- Click to add additional vertices.
- Close the polygon by clicking the first vertex.
