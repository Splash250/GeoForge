# Mode Handling

Modes can be enabled, disabled, toggled, or queried through `geoman.modes`, `map.gm`, or `map.gm.options`. The mode-name TypeScript unions include implemented keys and reserved compatibility keys, but only implemented keys have runtime mode classes in this package.

## Example

```ts
// Enable mode
map.gm.options.enableMode('edit', 'drag');

// Disable mode
map.gm.options.disableMode('edit', 'drag');

// Toggle mode
map.gm.options.toggleMode('edit', 'drag');

// Check mode state
map.gm.options.isModeEnabled('edit', 'drag');

// Check whether a mode has a runtime implementation
map.gm.options.isModeAvailable('edit', 'drag');
```

Use `isModeAvailable(actionType, modeName)` before exposing optional controls for mode keys that may be reserved or environment-dependent.

## Implemented Modes

### Draw

- `marker`
- `ellipse`
- `circle`
- `circle_marker`
- `text_marker`
- `line`
- `rectangle`
- `polygon`

### Edit

- `drag`
- `change`
- `rotate`
- `cut`
- `delete`

### Helper

- `shape_markers`
- `snapping`
- `zoom_to_features`
- `click_to_edit`

## Reserved Mode Keys

The following keys are retained in the type surface and configuration shape for compatibility or future work, but they do not have runtime mode classes in this package today.

### Reserved Draw Keys

- `freehand`
- `custom_shape`

### Reserved Edit Keys

- `scale`
- `copy`
- `split`
- `union`
- `difference`
- `line_simplification`
- `lasso`

### Reserved Helper Keys

- `pin`
- `snap_guides`
- `measurements`
- `auto_trace`
- `geofencing`

Enabling a reserved key is not the same as enabling a supported editing workflow. Keep application UI focused on implemented modes unless your integration provides its own custom behavior.

See the [Geoman Instance API](geoman-instance-api.md) for helper methods and the broader type surface.
