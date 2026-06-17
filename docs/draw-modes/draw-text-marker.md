# Draw Text Marker Mode

Draw Text Marker mode places text labels on the map. Click on the map and supply custom text to annotate locations.

## Enable the Mode

```js
map.gm.enableDraw('text_marker');
map.gm.disableDraw();
map.gm.toggleDraw('text_marker');
map.gm.drawEnabled('text_marker');

// Alternatively, control draw modes explicitly
map.gm.enableMode('draw', 'text_marker');
map.gm.disableMode('draw', 'text_marker');
map.gm.toggleMode('draw', 'text_marker');
map.gm.isModeEnabled('draw', 'text_marker');
```

## Events

| Event        | Params | Description                         | Output                   |
|--------------|--------|-------------------------------------|--------------------------|
| `gm:drawstart` | event  | Fired when text marker drawing starts. | `map`, `shape`             |
| `gm:create`    | event  | Fired when a text marker is created.   | `map`, `shape`, `feature` |

## Behavior

- Click on the map to place the text marker.
- Enter label content in the text input dialog.
- Click outside the text field to finish creating the marker.
- The text marker appears at the clicked location with the provided text.
