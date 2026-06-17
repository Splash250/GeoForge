# Draw Marker Mode

Draw Marker mode allows you to add markers to the map by clicking on the desired location.

## Enable the Mode

```js
map.gm.enableDraw('marker');
map.gm.disableDraw();
map.gm.toggleDraw('marker');
map.gm.drawEnabled('marker');

// Alternatively, control draw modes explicitly
map.gm.enableMode('draw', 'marker');
map.gm.disableMode('draw', 'marker');
map.gm.toggleMode('draw', 'marker');
map.gm.isModeEnabled('draw', 'marker');
```

## Events

| Event     | Params | Description                         | Output                 |
|-----------|--------|-------------------------------------|------------------------|
| `gm:create` | event  | Fired during marker drawing operations. | `map`, `shape`, `feature` |

## Behavior

- Click on the map to place a marker.
- The marker is immediately added at the clicked location.
