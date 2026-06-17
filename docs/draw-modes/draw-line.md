# Draw Line Mode

Draw Line mode creates polyline geometries by clicking to add vertices.

## Enable the Mode

```js
map.gm.enableDraw('line');
map.gm.disableDraw();
map.gm.toggleDraw('line');
map.gm.drawEnabled('line');

// Alternatively, control draw modes explicitly
map.gm.enableMode('draw', 'line');
map.gm.disableMode('draw', 'line');
map.gm.toggleMode('draw', 'line');
map.gm.isModeEnabled('draw', 'line');
```

## Events

| Event        | Params | Description                       | Output                   |
|--------------|--------|-----------------------------------|--------------------------|
| `gm:drawstart` | event  | Fired when line drawing starts.    | `map`, `shape`             |
| `gm:create`    | event  | Fired when a line is created.       | `map`, `shape`, `feature` |

## Behavior

- Click on the map to place the first vertex.
- Move the cursor to preview the segment.
- Click again to add vertices.
- Double-click or click the first vertex to finish the line.
