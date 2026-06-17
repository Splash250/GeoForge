# HTML Overlays

HTML overlays place iframe-backed HTML inside a projected rectangle on the map.
Use `geoman.overlays.html` for the high-level lifecycle.

## Add an overlay

```ts
const geoman = new Geoman(map);

geoman.overlays.html.add({
  id: 'inspection-panel',
  html: '<main><h1>Inspection</h1></main>',
  corners: {
    topLeft: [16.371, 48.209],
    topRight: [16.373, 48.209],
    bottomRight: [16.373, 48.208],
    bottomLeft: [16.371, 48.208],
  },
  iframe: {
    title: 'Inspection panel',
    interactable: true,
    pointerMode: 'selected',
    sandbox: ['allow-scripts', 'allow-same-origin'],
  },
});
```

`add` creates a new overlay or replaces the existing overlay with the same
`id`.

## Lifecycle API

```ts
geoman.overlays.html.update('inspection-panel', {
  html: '<main><h1>Updated inspection</h1></main>',
  visible: true,
});

geoman.overlays.html.setSelected('inspection-panel');

const overlay = geoman.overlays.html.get('inspection-panel');
const overlays = geoman.overlays.html.getAll();

geoman.overlays.html.remove('inspection-panel');
geoman.overlays.html.destroy();
```

- `update(id, patch)` merges a partial definition into an existing overlay and
  keeps the original `id`.
- `remove(id)` removes one overlay.
- `get(id)` returns a cloned overlay definition or `null`.
- `getAll()` returns cloned definitions for every overlay.
- `setSelected(id)` selects one overlay and clears the rest; pass `null` to
  clear selection.
- `destroy()` removes all overlay DOM and releases map listeners.

The low-level HTML overlay manager is kept for advanced compatibility. New
application code should use `geoman.overlays.html` unless it must own overlay
manager construction and cleanup directly.

## Iframe interaction

Overlays are read-only by default. The iframe receives pointer events only when
`iframe.interactable` is `true` and the pointer mode allows it:

- `pointerMode: 'selected'` enables interaction only for the selected overlay.
- `pointerMode: 'always'` keeps interaction enabled.
- `pointerMode: 'none'` keeps interaction disabled.

Use `setSelected(id)` before interacting with overlays that use the default
`selected` pointer mode. The iframe defaults to an empty `sandbox`, so add only
the sandbox tokens required by the embedded HTML.

## Map pitch and rectangle expectations

The overlay manager refreshes on map render, move, zoom, rotate, pitch, and
resize events. Corners are projected through the current map camera, so overlays
follow map pitch and rotation.

Corners must describe a valid rectangle in this order:

```ts
{
  topLeft: [lng, lat],
  topRight: [lng, lat],
  bottomRight: [lng, lat],
  bottomLeft: [lng, lat],
}
```

Invalid, self-intersecting, non-finite, non-rectangular, or too-small projected
rectangles are hidden until the next valid update.
