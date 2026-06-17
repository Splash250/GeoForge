# Public API Boundary

Application code should import from `maplibre-geoforge` and prefer the high-level `Geoman` instance APIs. The package root also retains additional constants, utilities, guards, adapters, and compatibility exports so existing integrations can migrate gradually.

This page identifies the preferred stable API plus selected advanced and deprecated compatibility exports that should guide new code and migration. It is boundary guidance, not a complete root export inventory or permission to remove exports.

## Stable Root Exports

These exports are the preferred public API for new application code.

| Export | Use |
| --- | --- |
| `Geoman` | Main package instance for modes, features, tools, decorators, overlays, selection, transactions, and history. |
| `createGeomanInstance` | Async helper that creates a `Geoman` instance and waits for package initialization. |
| `GeomanGeometrySubsystem` | Geometry helper subsystem exposed through `geoman.geometry`. |
| `GeomanContextPanelSubsystem` | Context panel subsystem exposed through `geoman.contextPanels`. |
| `GeomanToolsSubsystem` | Custom interaction tool subsystem exposed through `geoman.tools`. |
| `GeomanSelectionSubsystem` | Selection subsystem exposed through `geoman.selection`. |
| `GeomanTransactionSubsystem` | Transaction subsystem exposed through `geoman.transactions`. |
| `GeomanTransaction` | Transaction object returned by `geoman.transactions.start(...)`. |
| `GeomanHistorySubsystem` | History subsystem exposed through `geoman.history`. |
| `defineGeomanContextPanel` | Helper for defining context panel descriptors. |
| `createContextPanelValidationList` | Helper for rendering context panel validation content. |
| `createContextPanelActionButton` | Helper for rendering context panel action buttons. |
| `SOURCES` | Geoman source-name constants. |
| `GM_PREFIX` | Public Geoman event prefix. |

## Advanced Compatibility Exports

These exports remain available for integrations that need lower-level ownership of MapLibre sources, overlay lifecycle, or decorator lifecycle. New code should prefer the corresponding high-level `Geoman` subsystem when possible.

| Export | Preferred path |
| --- | --- |
| `LineDecoratorManager` | Prefer `geoman.decorators.lines` unless the application owns decorator sources directly. |
| `GeomanLineDecoratorSubsystem` | Prefer the instance at `geoman.decorators.lines`. |
| `HtmlOverlayManager` | Prefer `geoman.overlays.html` unless the application owns overlay manager construction and cleanup directly. |
| `GeomanHtmlOverlaySubsystem` | Prefer the instance at `geoman.overlays.html`. |

## Deprecated Compatibility Exports

These exports are retained to avoid breaking existing consumers. They are not preferred for new application code.

| Export | Replacement guidance |
| --- | --- |
| `BaseAction` | Prefer high-level `Geoman` modes, tools, and subsystems. |
| `BaseDraw` | Prefer high-level draw modes through `geoman.modes`. |
| `BaseDrag` | Prefer high-level edit modes through `geoman.modes`. |
| `BaseGroupEdit` | Prefer high-level edit modes through `geoman.modes`. |
| `BaseEdit` | Prefer high-level edit modes through `geoman.modes`. |
| `BaseHelper` | Prefer high-level helper modes through `geoman.modes`. |
| `LineDrawer` | Prefer Geoman draw modes and `geoman.history`. |
| `MarkerPointer` | Prefer Geoman draw modes and map interaction APIs. |
| `HtmlOverlayElement` | Prefer `geoman.overlays.html`. |
| `ArrowheadManager` | Prefer line decorator options through `geoman.decorators.lines`. |
| `generateArrowheads` | Prefer line decorator options through `geoman.decorators.lines`. |
| `isInMeters` | Compatibility utility for decorator unit parsing. |
| `isInPercent` | Compatibility utility for decorator unit parsing. |
| `isInPixels` | Compatibility utility for decorator unit parsing. |
| `parseNumeric` | Compatibility utility for decorator unit parsing. |
| `distanceBetween` | Compatibility geometry utility for decorator internals. |
| `bearingBetween` | Compatibility geometry utility for decorator internals. |
| `destinationPoint` | Compatibility geometry utility for decorator internals. |
| `interpolateOnLine` | Compatibility geometry utility for decorator internals. |
| `pixelsToMeters` | Compatibility geometry utility for decorator internals. |
| `toLngLat` | Compatibility geometry utility for decorator internals. |
| `definedProps` | Compatibility utility for decorator internals. |
| `modulus` | Compatibility utility for decorator internals. |
| `ensureArrowheadSource` | Prefer `ArrowheadManager` only when direct source ownership is required. |
| `resolveIds` | Prefer `ArrowheadManager` only when direct source ownership is required. |
| `updateArrowheadSource` | Prefer `ArrowheadManager` only when direct source ownership is required. |
| `clearArrowheadSource` | Prefer `ArrowheadManager` only when direct source ownership is required. |
| `ensureSymbolDecoratorSource` | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `resolveSymbolDecoratorIds` | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `updateSymbolDecoratorSource` | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `clearSymbolDecoratorSource` | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `ensureSymbolImage` | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `ensureTextDecoratorSource` | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `resolveTextDecoratorIds` | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `updateTextDecoratorSource` | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `clearTextDecoratorSource` | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `SymbolDecoratorRenderer` | Prefer `geoman.decorators.lines`. |
| `TextDecoratorRenderer` | Prefer `geoman.decorators.lines`. |
| `normalizeLineDecorators` | Prefer line decorator options through `geoman.decorators.lines`. |
| `addLineDecoratorLayer` | Prefer `geoman.decorators.lines`. |
| `positionLineDecoratorLayers` | Prefer `geoman.decorators.lines`. |
| `createLinePlacements` | Prefer line decorator options through `geoman.decorators.lines`. |

## Unsupported Public Surfaces

The package intentionally does not expose a supported React hook API from the root entry point and does not provide a supported `./react` subpath export. Use the framework-agnostic `Geoman` instance APIs from the package root.

The only supported package subpaths today are:

- `maplibre-geoforge`
- `maplibre-geoforge/dist/maplibre-geoforge.css`

Do not rely on deep imports from `src`, `dist`, or internal folders. Deep imports can change without notice.

## Compatibility Rules

- Keep stable exports available unless a breaking package release explicitly says otherwise.
- Keep advanced and deprecated compatibility exports until Sewergy consumer usage is reviewed and removal is explicitly approved.
- Prefer documentation and deprecation clarity over export removal.
- Add new package subpaths only after consumer import usage is checked and the subpath is explicitly approved.
