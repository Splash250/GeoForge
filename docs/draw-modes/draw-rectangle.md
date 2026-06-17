# Draw Rectangle Mode

Draw Rectangle mode creates rectangular polygons by clicking and dragging to define opposite corners.

## Enable the Mode

```js
map.gm.enableDraw('rectangle');
map.gm.disableDraw();
map.gm.toggleDraw('rectangle');
map.gm.drawEnabled('rectangle');

// Alternatively, control draw modes explicitly
map.gm.enableMode('draw', 'rectangle');
map.gm.disableMode('draw', 'rectangle');
map.gm.toggleMode('draw', 'rectangle');
map.gm.isModeEnabled('draw', 'rectangle');
```

## Events

| Event        | Params | Description                             | Output                   |
|--------------|--------|-----------------------------------------|--------------------------|
| `gm:drawstart` | event  | Fired when rectangle drawing starts.     | `map`, `shape`             |
| `gm:create`    | event  | Fired when a rectangle is created.        | `map`, `shape`, `feature` |

## Behavior

- Click and hold to set the first corner.
- Drag to define the rectangle dimensions.
- Release the mouse button to complete the shape.
