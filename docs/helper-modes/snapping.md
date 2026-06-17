# Snapping Helper Mode

Snapping aligns features to nearby vertices or lines while editing, keeping geometry consistent and precise.

## Enable the Mode

```js
map.gm.enableMode('helper', 'snapping');
map.gm.disableMode('helper', 'snapping');
map.gm.toggleMode('helper', 'snapping');
map.gm.isModeEnabled('helper', 'snapping');
```

## Events

| Event                       | Params | Description                              | Output          |
|-----------------------------|--------|------------------------------------------|-----------------|
| `gm:globalsnappingmodetoggled` | event  | Fired whenever snapping mode is toggled. | `enabled`, `map` |

```js
map.on('gm:globalsnappingmodetoggled', event => {
  console.log(event);
});
```

## Behavior

- Works with markers, circle markers, text markers, lines, rectangles, polygons, circles, and guide lines.
- Calculates the distance to nearby vertices and edges.
- Snaps to the closest candidate within tolerance, favoring vertices over edges.
- Uses an 18 pixel snapping tolerance by default.

## Configuration

```js
// Enable snapping
map.gm.markerPointer.setSnapping(true);

// Disable snapping
map.gm.markerPointer.setSnapping(false);

// Pause snapping temporarily
map.gm.markerPointer.pauseSnapping();

// Resume snapping
map.gm.markerPointer.resumeSnapping();
```
