# Public API Boundary

Application code should import from `maplibre-geoforge` and prefer the high-level `GeoForge` instance APIs. The package root also retains additional constants, utilities, guards, adapters, and compatibility exports so existing integrations can migrate gradually.

This page identifies the preferred stable API plus selected advanced and deprecated compatibility exports that should guide new code and migration. It is boundary guidance, not a complete root export inventory or permission to remove exports.

## Stable Root Exports

These exports are the preferred public API for new application code.

| Export                             | Use                                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GeoForge`                         | Preferred main package instance for modes, features, tools, decorators, overlays, selection, transactions, and history. |
| `Geoman`                           | Compatibility alias for existing integrations that have not migrated to `GeoForge`.                                     |
| `createGeomanInstance`             | Compatibility async helper that creates an instance and waits for package initialization.                               |
| `GeomanGeometrySubsystem`          | Geometry helper subsystem exposed through `geoForge.geometry`.                                                          |
| `GeomanContextPanelSubsystem`      | Context panel subsystem exposed through `geoForge.contextPanels`.                                                       |
| `GeomanToolsSubsystem`             | Custom interaction tool subsystem exposed through `geoForge.tools`.                                                     |
| `GeomanSelectionSubsystem`         | Selection subsystem exposed through `geoForge.selection`.                                                               |
| `GeomanTransactionSubsystem`       | Transaction subsystem exposed through `geoForge.transactions`.                                                          |
| `GeomanTransaction`                | Transaction object returned by `geoForge.transactions.start(...)`.                                                      |
| `GeomanFeaturePropertyEditor`      | Form helper object returned by `geoForge.transactions.featureProperties(...)`.                                          |
| `GeomanHistorySubsystem`           | History subsystem exposed through `geoForge.history`.                                                                   |
| `GeomanSessionSubsystem`           | Session lifecycle subsystem exposed through `geoForge.sessions` for scoped setup and cleanup.                           |
| `GeomanLayerSubsystem`             | Raster layer subsystem exposed through `geoForge.layers` for WMS/WMTS discovery and MapLibre raster overlays.           |
| `buildRasterProxyUrl`              | Helper for routing cross-origin WMS/WMTS request URLs through an application-owned proxy path.                          |
| `createRasterProxyTransformer`     | Helper for creating reusable raster proxy transformers for `transformRequestUrl` and `transformTileUrl`.                |
| `GeomanControlProfile`             | Type for runtime control visibility profiles used by `geoForge.control.applyProfile(...)`.                              |
| `GeomanControlVisibilityOptions`   | Type for granular control visibility updates.                                                                           |
| `FeatureOwnerId`                   | Runtime owner identifier for scoped feature imports and cleanup.                                                        |
| `defineGeomanContextPanel`         | Helper for defining context panel descriptors.                                                                          |
| `createContextPanelValidationList` | Helper for rendering context panel validation content.                                                                  |
| `createContextPanelActionButton`   | Helper for rendering context panel action buttons.                                                                      |
| `SOURCES`                          | GeoForge source-name constants.                                                                                         |
| `GM_PREFIX`                        | Public event prefix retained for compatibility.                                                                         |

## Advanced Compatibility Exports

These exports remain available for integrations that need lower-level ownership of MapLibre sources, overlay lifecycle, or decorator lifecycle. New code should prefer the corresponding high-level `GeoForge` subsystem when possible.

| Export                         | Preferred path                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `LineDecoratorManager`         | Prefer `geoForge.decorators.lines` unless the application owns decorator sources directly.                     |
| `GeomanLineDecoratorSubsystem` | Prefer the instance at `geoForge.decorators.lines`.                                                            |
| `HtmlOverlayManager`           | Prefer `geoForge.overlays.html` unless the application owns overlay manager construction and cleanup directly. |
| `GeomanHtmlOverlaySubsystem`   | Prefer the instance at `geoForge.overlays.html`.                                                               |

## Deprecated Compatibility Exports

These exports are retained to avoid breaking existing consumers. They are not preferred for new application code.

| Export                        | Replacement guidance                                                         |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `BaseAction`                  | Prefer high-level `GeoForge` modes, tools, and subsystems.                   |
| `BaseDraw`                    | Prefer high-level draw modes through `geoForge.modes`.                       |
| `BaseDrag`                    | Prefer high-level edit modes through `geoForge.modes`.                       |
| `BaseGroupEdit`               | Prefer high-level edit modes through `geoForge.modes`.                       |
| `BaseEdit`                    | Prefer high-level edit modes through `geoForge.modes`.                       |
| `BaseHelper`                  | Prefer high-level helper modes through `geoForge.modes`.                     |
| `LineDrawer`                  | Prefer GeoForge draw modes and `geoForge.history`.                           |
| `MarkerPointer`               | Prefer GeoForge draw modes and map interaction APIs.                         |
| `HtmlOverlayElement`          | Prefer `geoForge.overlays.html`.                                             |
| `ArrowheadManager`            | Prefer line decorator options through `geoForge.decorators.lines`.           |
| `generateArrowheads`          | Prefer line decorator options through `geoForge.decorators.lines`.           |
| `isInMeters`                  | Compatibility utility for decorator unit parsing.                            |
| `isInPercent`                 | Compatibility utility for decorator unit parsing.                            |
| `isInPixels`                  | Compatibility utility for decorator unit parsing.                            |
| `parseNumeric`                | Compatibility utility for decorator unit parsing.                            |
| `distanceBetween`             | Compatibility geometry utility for decorator internals.                      |
| `bearingBetween`              | Compatibility geometry utility for decorator internals.                      |
| `destinationPoint`            | Compatibility geometry utility for decorator internals.                      |
| `interpolateOnLine`           | Compatibility geometry utility for decorator internals.                      |
| `pixelsToMeters`              | Compatibility geometry utility for decorator internals.                      |
| `toLngLat`                    | Compatibility geometry utility for decorator internals.                      |
| `definedProps`                | Compatibility utility for decorator internals.                               |
| `modulus`                     | Compatibility utility for decorator internals.                               |
| `ensureArrowheadSource`       | Prefer `ArrowheadManager` only when direct source ownership is required.     |
| `resolveIds`                  | Prefer `ArrowheadManager` only when direct source ownership is required.     |
| `updateArrowheadSource`       | Prefer `ArrowheadManager` only when direct source ownership is required.     |
| `clearArrowheadSource`        | Prefer `ArrowheadManager` only when direct source ownership is required.     |
| `ensureSymbolDecoratorSource` | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `resolveSymbolDecoratorIds`   | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `updateSymbolDecoratorSource` | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `clearSymbolDecoratorSource`  | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `ensureSymbolImage`           | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `ensureTextDecoratorSource`   | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `resolveTextDecoratorIds`     | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `updateTextDecoratorSource`   | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `clearTextDecoratorSource`    | Prefer `LineDecoratorManager` only when direct source ownership is required. |
| `SymbolDecoratorRenderer`     | Prefer `geoForge.decorators.lines`.                                          |
| `TextDecoratorRenderer`       | Prefer `geoForge.decorators.lines`.                                          |
| `normalizeLineDecorators`     | Prefer line decorator options through `geoForge.decorators.lines`.           |
| `addLineDecoratorLayer`       | Prefer `geoForge.decorators.lines`.                                          |
| `positionLineDecoratorLayers` | Prefer `geoForge.decorators.lines`.                                          |
| `createLinePlacements`        | Prefer line decorator options through `geoman.decorators.lines`.             |

## Unsupported Public Surfaces

The package intentionally does not expose a supported React hook API from the root entry point and does not provide a supported `./react` subpath export. Use the framework-agnostic `GeoForge` instance APIs from the package root.

The only supported package subpaths today are:

- `maplibre-geoforge`
- `maplibre-geoforge/dist/maplibre-geoforge.css`

Do not rely on deep imports from `src`, `dist`, or internal folders. Deep imports can change without notice.

## Compatibility Rules

- Keep stable exports available unless a breaking package release explicitly says otherwise.
- Keep advanced and deprecated compatibility exports until downstream consumer usage is reviewed and removal is explicitly approved.
- Prefer documentation and deprecation clarity over export removal.
- Add new package subpaths only after consumer import usage is checked and the subpath is explicitly approved.
- Prefer `geoForge.control.applyProfile(...)`, `setModeVisibility(...)`, and `getProfile()` for runtime control visibility instead of mutating `geoForge.options.controls` or refreshing controls manually.
- Prefer `geoForge.sessions.start(...)` for scoped setup, preview data, subscriptions, and cleanup. Active sessions require unique ownerIds; disposing a session releases its ownerId and makes its `session.features.*` facade throw on later use. Use lower-level `geoForge.features.importGeoJson(..., { ownerId })`, `getByOwner(...)`, and `deleteByOwner(...)` only when a session object is unnecessary.
