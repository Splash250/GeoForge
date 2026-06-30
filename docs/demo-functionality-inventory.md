# GeoForge Demo Functionality Inventory

This inventory groups the currently exposed GeoForge capabilities that are good candidates for a new standalone demo page. It is based on the current package source and docs, with preferred public surfaces listed before advanced compatibility exports.

Primary references:

- `src/main.ts`
- `src/index.ts`
- `docs/public-api-boundary.md`
- `docs/geoman-instance-api.md`
- `docs/geoman-features-api.md`
- `docs/geoman-options-api.md`
- `docs/decorators.md`
- `docs/html-overlays.md`
- `docs/custom-interaction-tools.md`
- `docs/context-panels.md`
- `docs/geoman-events.md`

## Package Entry And Lifecycle

Preferred public entry points:

- `GeoForge`
- `createGeomanInstance(map, options)`
- `Geoman` compatibility alias
- Root CSS import through `geoforge/styles.css`

Instance lifecycle and setup:

- `new GeoForge(map, options)`
- `geoForge.addControls(controlsElement?)`
- `geoForge.removeControls()`
- `geoForge.waitForBaseMap()`
- `geoForge.waitForGeomanLoaded()`
- `geoForge.init()`
- `geoForge.destroy({ removeSources }?)`

Core instance subsystems:

- `geoForge.features`
- `geoForge.options`
- `geoForge.events`
- `geoForge.control`
- `geoForge.modes`
- `geoForge.selection`
- `geoForge.geometry`
- `geoForge.history`
- `geoForge.transactions`
- `geoForge.contextPanels`
- `geoForge.decorators.lines`
- `geoForge.overlays.html`
- `geoForge.tools`
- `geoForge.mapAdapter`

Demo fit:

- Startup panel showing package identity, initialization, controls, and clean teardown.
- API sample block that uses `GeoForge` as the primary name and mentions `Geoman` only as compatibility.

## Controls And Mode Management

Control lifecycle:

- `geoForge.addControls()`
- `geoForge.removeControls()`

Mode controller:

- `geoForge.modes.enable(modeType, modeName)`
- `geoForge.modes.disable(modeType, modeName)`
- `geoForge.modes.toggle(modeType, modeName)`
- `geoForge.modes.isEnabled(modeType, modeName)`
- `geoForge.modes.disableAll()`

Compatibility mode helpers:

- `enableMode(actionType, modeName)`
- `disableMode(actionType, modeName)`
- `toggleMode(actionType, modeName)`
- `isModeEnabled(actionType, modeName)`
- `disableAllModes()`
- `getActiveDrawModes()`
- `getActiveEditModes()`
- `getActiveHelperModes()`

Draw shortcuts:

- `enableDraw(shape)`
- `disableDraw()`
- `toggleDraw(shape)`
- `drawEnabled(shape)`

Edit shortcuts:

- `enableGlobalDragMode()`, `disableGlobalDragMode()`, `toggleGlobalDragMode()`, `globalDragModeEnabled()`
- `enableGlobalEditMode()`, `disableGlobalEditMode()`, `toggleGlobalEditMode()`, `globalEditModeEnabled()`
- `enableGlobalRotateMode()`, `disableGlobalRotateMode()`, `toggleGlobalRotateMode()`, `globalRotateModeEnabled()`
- `enableGlobalCutMode()`, `disableGlobalCutMode()`, `toggleGlobalCutMode()`, `globalCutModeEnabled()`
- `enableGlobalRemovalMode()`, `disableGlobalRemovalMode()`, `toggleGlobalRemovalMode()`, `globalRemovalModeEnabled()`

Demo fit:

- Toolbar section for toggling draw, edit, helper, and custom tool states.
- State inspector showing active modes and current enabled controls.

## Draw, Edit, And Helper Modes

Implemented draw modes:

- `marker`
- `circle_marker`
- `text_marker`
- `line`
- `rectangle`
- `polygon`
- `circle`
- `ellipse`

Reserved draw mode keys:

- `freehand`
- `custom_shape`

Implemented edit modes:

- `drag`
- `change`
- `rotate`
- `cut`
- `delete`

Reserved edit mode keys:

- `scale`
- `copy`
- `split`
- `union`
- `difference`
- `line_simplification`
- `lasso`

Implemented helper modes:

- `shape_markers`
- `snapping`
- `zoom_to_features`
- `click_to_edit`

Reserved helper mode keys:

- `pin`
- `snap_guides`
- `measurements`
- `auto_trace`
- `geofencing`

Demo fit:

- Main drawing rail with all implemented shapes.
- Separate "planned/reserved" section in docs or debug drawer, not as primary enabled UI.

## Features And GeoJSON

Feature store operations:

- `geoForge.features.forEach(...)`
- `geoForge.features.filteredForEach(...)`
- `geoForge.features.has(sourceName, featureId)`
- `geoForge.features.get(sourceName, featureId)`
- `geoForge.features.add(featureData)`
- `geoForge.features.delete(featureOrIdOrRef)`
- `geoForge.features.deleteAll()`
- `geoForge.features.getAll()`

Feature source operations:

- `geoForge.features.setDefaultSourceName(sourceName)`
- `geoForge.features.createSource(sourceName)`
- Built-in sources: `gm_main`, `gm_temporary`, `gm_standby`

Feature creation and conversion:

- `geoForge.features.createFeature({ featureId, shapeGeoJson, sourceName, imported })`
- `geoForge.features.addGeoJsonFeature(...)`
- `geoForge.features.createMarkerFeature(...)`
- `geoForge.features.updateMarkerFeaturePosition(markerFeatureData, coordinates)`
- `geoForge.features.getFeatureShapeByGeoJson(feature)`
- `geoForge.features.convertSourceToGm(source)`

Feature queries:

- `geoForge.features.getFeatureByMouseEvent(...)`
- `geoForge.features.getFeaturesByGeoJsonBounds(...)`
- `geoForge.features.getFeaturesByScreenBounds(...)`

GeoJSON import/export:

- `geoForge.features.importGeoJson(geoJson, options?)`
- `geoForge.features.importGeoJsonFeature(feature)`
- `geoForge.features.exportGeoJson(options?)`
- `geoForge.features.exportGeoJsonFromSource(sourceName, options?)`
- `geoForge.features.asGeoJsonFeatureCollection(...)`

Feature identity:

- Preserves valid existing feature ids where possible.
- Generates ids for imported features without ids.
- Exports identity through `__gm_id`.
- Reimport can preserve identity.

Demo fit:

- Import/export drawer with live GeoJSON preview.
- Feature table listing id, source, shape, and selected/editable state.

## Selection And Single Feature Editing

Selection subsystem:

- `geoForge.selection.configure(options)`
- `geoForge.selection.activate()`
- `geoForge.selection.deactivate({ reason })`
- `geoForge.selection.destroy()`
- `geoForge.selection.isActive()`
- `geoForge.selection.getState()`
- `geoForge.selection.getSelectedFeatureId()`
- `geoForge.selection.getSelectedFeature()`
- `geoForge.selection.getHoveredFeature()`
- `geoForge.selection.setHoveredFeature(featureOrNull)`
- `geoForge.selection.clearHoveredFeature()`
- `geoForge.selection.selectFeature(featureOrIdOrNull, { reason })`
- `geoForge.selection.clearSelection({ reason, restoreGlobalEditability? })`
- `geoForge.selection.isSelectableFeature(feature, { reason })`

Selection options:

- `allowedShapes`
- `clearOnMapClick`
- `clearOnEscape`
- `styles.hover`
- `styles.selected`
- `selectableFeatureFilter`
- `beforeSelect`

Single-feature editing helpers:

- `enableSingleFeatureEditMode(options?)`
- `disableSingleFeatureEditMode()`
- `toggleSingleFeatureEditMode(options?)`
- `singleFeatureEditModeEnabled()`
- `getSelectedFeature()`
- `setEditableFeatureIds(featureIds)`
- `clearEditableFeatureIds()`
- `isFeatureEditable(featureData)`

Demo fit:

- Click-to-edit workflow where the selected feature becomes the only editable feature.
- Highlight style controls for hover and selected states.

## Line Decorators

Preferred high-level surface:

- `geoForge.decorators.lines.isStarted()`
- `geoForge.decorators.lines.start(options?)`
- `geoForge.decorators.lines.configure(options)`
- `geoForge.decorators.lines.configureManualSync(options)`
- `geoForge.decorators.lines.syncFromFeatures(features, resolveDecorators?)`
- `geoForge.decorators.lines.sync()`
- `geoForge.decorators.lines.clear()`
- `geoForge.decorators.lines.destroy()`

Decorator kinds:

- `arrowhead`
- `symbol`
- `text`

Configuration:

- `resolveDecorators(feature)`
- `sourceNames`
- `syncOnRender`
- `layerPosition`: `default`, `below-lines`, `above-lines`

Placement:

- `frequency`: number, meter string, pixel string, `allvertices`, `endonly`, `single`
- `offsets.start`
- `offsets.end`
- `segment`: `first`, `middle`, `last`, `all`
- `anchor`: `front`, `middle`, `back`
- `offsetPercent`
- `lineOffsetPx`

Rotation:

- `mode`: `line`, `fixed`, `viewport`
- `angle`

Animation:

- `property`: `rotate`, `opacity`, `size`, `fontSize`, `offset`
- `from`
- `to`
- `durationMs`
- `delayMs`
- `iterationCount`: number or `infinite`
- `direction`: `normal`, `reverse`, `alternate`, `alternate-reverse`
- `easing`: `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`

Arrowhead options:

- `size`
- `frequency`
- `offset`
- `fillPaint`
- `linePaint`
- `fillLayout`
- `lineLayout`

Symbol options:

- `imageId`
- `size`
- `opacity`
- `color`
- `rotate`
- `animation`

Text options:

- `text`
- `fontSize`
- `color`
- `opacity`
- `haloColor`
- `haloWidth`
- `haloBlur`
- `rotate`
- `animation`

Advanced compatibility exports:

- `LineDecoratorManager`
- `GeomanLineDecoratorSubsystem`
- `ArrowheadManager`
- `SymbolDecoratorRenderer`
- `TextDecoratorRenderer`
- `normalizeLineDecorators`
- `createLinePlacements`
- `addLineDecoratorLayer`
- `positionLineDecoratorLayers`
- Arrowhead/source/unit/geometry helpers

Demo fit:

- Dedicated line-decorator lab with arrowheads, labels, icons, placement controls, layer position controls, and animation presets.

## HTML Overlays

Preferred high-level surface:

- `geoForge.overlays.html.add(definition)`
- `geoForge.overlays.html.upsert(definition)`
- `geoForge.overlays.html.update(id, patch)`
- `geoForge.overlays.html.setSelected(idOrNull)`
- `geoForge.overlays.html.remove(id)`
- `geoForge.overlays.html.get(id)`
- `geoForge.overlays.html.getAll()`
- `geoForge.overlays.html.destroy()`

Overlay definition:

- `id`
- `corners.topLeft`
- `corners.topRight`
- `corners.bottomRight`
- `corners.bottomLeft`
- `html`
- `iframe`
- `selected`
- `visible`

Iframe options:

- `title`
- `sandbox`
- `allow`
- `referrerPolicy`
- `interactable`
- `pointerMode`: `none`, `selected`, `always`

Validation and behavior:

- Follows map render, move, zoom, rotate, pitch, and resize.
- Invalid projected rectangles are hidden.
- Validation failure reasons include `missing-corner`, `self-intersecting`, `too-small`, `non-finite`, `not-rectangle`, and `invalid-ring`.

Demo fit:

- Overlay editor that pins an iframe/card to four map coordinates.
- Selection toggle demonstrating pointer interaction modes.

## Custom Interaction Tools

Preferred high-level surface:

- `geoForge.tools.register(definition)`
- `geoForge.tools.activate(id)`
- `geoForge.tools.deactivate(id?)`
- `geoForge.tools.cancel(reason?)`
- `geoForge.tools.getActiveToolId()`
- `geoForge.tools.get(id)`
- `geoForge.tools.getAll()`
- `geoForge.tools.getToolControls()`
- `geoForge.tools.destroy()`

Tool definition:

- `id`
- `title`
- `group`
- `control.title`
- `control.icon`
- `control.uiEnabled`
- `control.eventType`: `toggle`, `click`
- `selection`
- Lifecycle hooks: `onStart`, `onCancel`, `onEnd`
- Feature hooks: `onFeatureHover`, `onFeatureHoverEnd`, `onFeatureClick`, `onFeatureContextMenu`
- Map hooks: `onBlankMapClick`, `onContextMenu`

Tool context:

- `geoman`
- `map`
- `features`
- `selection`
- `contextPanels`
- `modes`

Selection config:

- `enabled`
- `hover`
- `cursor`
- `allowedShapes`
- `sourceNames`

Demo fit:

- Example custom tools such as inspect feature, split line segment, connect endpoints, and open context panel.

## Context Panels

Preferred high-level surface:

- `geoForge.contextPanels.register(definition)`
- `geoForge.contextPanels.unregister(id)`
- `geoForge.contextPanels.open(id, data?)`
- `geoForge.contextPanels.update(data?)`
- `geoForge.contextPanels.close(reason?)`
- `geoForge.contextPanels.get(id)`
- `geoForge.contextPanels.getAll()`
- `geoForge.contextPanels.getState()`
- `geoForge.contextPanels.destroy()`

Definition:

- `id`
- `title`
- `placement`: currently `right`
- `className`
- `transaction`
- `render(context)`
- `onClose(event)`

Render context:

- `id`
- `title`
- `data`
- `feature`
- `geoman`
- `map`
- `close()`
- `transaction`

Transaction integration:

- `transaction.current`
- `transaction.validation.messages`
- `transaction.validation.hasErrors`
- `transaction.isDirty()`
- `transaction.commit({ close? })`
- `transaction.cancel({ close?, refresh? })`
- Definition options: `id`, `closeBehavior`, `closeOnCommit`, `validate`, `refreshData`

Helper exports:

- `defineGeomanContextPanel`
- `createContextPanelDescriptionList`
- `createContextPanelTextInput`
- `createContextPanelValidationList`
- `createContextPanelActionButton`

Close reasons:

- `api`
- `replacement`
- `blank-map`
- `tool-end`
- `draw-start`
- `feature-removed`
- `destroy`

Demo fit:

- Feature inspector and editor panel with validation, commit, cancel, and undo history integration.

## Geometry And Network Utilities

Segment measurement:

- `geoForge.geometry.getLineSegments(feature)`
- `geoForge.geometry.measureSegment(segment)`
- `geoForge.geometry.measureSegmentBearing(segment)`
- `geoForge.geometry.formatDistanceMeters(distanceMeters, options?)`
- `geoForge.geometry.formatSegmentMeasurement(segment, options?)`

Segment metadata:

- `geoForge.geometry.getLineSegmentContext(feature, point, options?)`
- `geoForge.geometry.getLineSegmentMetadata(feature, segmentIndex)`
- `geoForge.geometry.getLineSegmentProperty(feature, segmentIndex, propertyName)`
- `geoForge.geometry.updateLineSegmentProperty(feature, segmentIndex, propertyName, value)`

Line editing helpers:

- `geoForge.geometry.getLineVertexInsertion(feature, options)`
- `geoForge.geometry.insertLineVertex(feature, options)`
- `geoForge.geometry.getLineSplitAtPoint(feature, options)`
- `geoForge.geometry.splitLineAtPoint(feature, options)`
- `geoForge.geometry.getLineSegmentRemoval(feature, options)`
- `geoForge.geometry.removeLineSegment(feature, options)`

Nearest hit testing:

- `geoForge.geometry.getNearestVertex(feature, point, options?)`
- `geoForge.geometry.getNearestEdge(feature, point, options?)`
- `geoForge.geometry.getNearestSegment(feature, point, options?)`
- `geoForge.geometry.getNearestLineEndpoint(features, point, options?)`

Line networks:

- `geoForge.geometry.getLineNetworkGraph(features, options?)`
- `geoForge.geometry.validateLineNetworkTopology(graph, options?)`
- `geoForge.geometry.getLineMergePlan(features, options?)`
- `geoForge.geometry.applyLineMergePlan(plan)`

Endpoint connection:

- `geoForge.geometry.getLineEndpointConnection(options)`
- `geoForge.geometry.connectLineEndpoints(options)`
- `geoForge.geometry.getLineEndpointConnectionPreview(options)`
- `geoForge.geometry.renderLineEndpointConnectionPreview(preview, options?)`
- `geoForge.geometry.clearLineEndpointConnectionPreview(options?)`
- `geoForge.geometry.destroyLineEndpointConnectionPreview(options?)`

Validation issue types:

- `dangling-endpoint`
- `duplicate-endpoint-group`
- `disconnected-component`
- `degree-threshold`

Demo fit:

- Network utility demo showing dangling endpoints, nearby endpoints, merge planning, endpoint snap preview, and topology validation messages.

## History And Undo/Redo

Preferred high-level surface:

- `geoForge.history.configure(options)`
- `geoForge.history.getState()`
- `geoForge.history.canUndo()`
- `geoForge.history.canRedo()`
- `geoForge.history.getLastRecordedEntryId()`
- `geoForge.history.getLastRecordedEntry()`
- `geoForge.history.consumeLastRecordedEntryId()`
- `geoForge.history.clear()`
- `geoForge.history.suspend(callback)`
- `geoForge.history.record(operations, options?)`
- `geoForge.history.undo()`
- `geoForge.history.redo()`

History options:

- `enabled`
- `maxEntries`

Operation kinds:

- `create`
- `update`
- `delete`

Demo fit:

- Undo/redo strip with counts, last operation label, and disabled states.
- Transaction-backed panel edits that create history entries on commit.

## Transactions

Preferred high-level surface:

- `geoForge.transactions.start(options?)`
- `geoForge.transactions.getActive()`
- `geoForge.transactions.destroy()`

Transaction object:

- `transaction.id`
- `transaction.status`: `active`, `committed`, `cancelled`
- `transaction.geoman`
- `transaction.validate`
- `transaction.updateProperty(feature, name, value)`
- `transaction.updateProperties(feature, properties)`
- `transaction.updateGeometry(feature, geometry)`
- `transaction.getChanges()`
- `transaction.isDirty()`
- `transaction.commit()`
- `transaction.cancel()`

Validation result:

- `void`
- `boolean`
- `string`
- `string[]`
- `{ valid, messages? }`

Commit result:

- `committed`
- `messages`
- `historyEntryId`

Demo fit:

- Editable context panel demonstrating preview changes, validation errors, commit, cancel, and history entry id.

## Events And Diagnostics

Global listener:

- `setGlobalEventsListener(callbackOrNull)`

Mode events:

- `gm:globaldrawmodetoggled`
- `gm:globaleditmodetoggled`
- `gm:globalremovemodetoggled`
- `gm:globalrotatemodetoggled`
- `gm:globaldragmodetoggled`
- `gm:globalcutmodetoggled`
- `gm:globalsnappingmodetoggled`
- `gm:globalzoom_to_featuresmodetoggled`

Draw and edit events:

- `_gm:draw`
- `gm:create`
- `_gm:edit`
- `gm:editstart`
- `gm:editend`
- `gm:remove`
- `gm:rotate`
- `gm:rotatestart`
- `gm:rotateend`
- `gm:drag`
- `gm:dragstart`
- `gm:dragend`
- `gm:cut`

Helper and interaction events:

- `_gm:helper`
- `_gm:control`
- `gm:featurehover`
- `gm:featurehoverend`
- `gm:featureclick`
- `gm:mapblankclick`
- `gm:toolstart`
- `gm:toolcancel`
- `gm:toolend`

History events:

- `gm:historyrecord`
- `gm:historychange`
- `gm:undo`
- `gm:redo`

Demo fit:

- Event console with filters for draw, edit, helpers, custom tools, history, and system diagnostics.

## Styling, Assets, And Configuration

Exported style/config helpers:

- `controlIcons`
- `defaultLayerStyles`
- `customShapeRectangle`
- `customShapeTriangle`

Constants:

- `GM_PREFIX`
- `IS_PRO`
- `DRAW_MODES`
- `EXTRA_DRAW_MODES`
- `SHAPE_NAMES`
- `SOURCES`
- `HELPER_MODES`
- `EDIT_MODES`
- `FEATURE_PROPERTY_PREFIX`
- `FEATURE_ID_PROPERTY`

Utility exports:

- GeoJSON helpers
- geometry helpers
- numeric helpers
- event guard helpers such as `isGm...`
- `createSvgMarkerElement`

Demo fit:

- Style preset selector and debug constants panel.
- Avoid showing deprecated internals as a first-class user workflow.

## Advanced Compatibility Exports

The package still exposes several lower-level building blocks for compatibility or advanced use. These can support debug/demo internals, but the primary demo should prefer the high-level `geoForge.*` subsystems.

Examples:

- `BaseAction`
- `BaseDraw`
- `BaseDrag`
- `BaseGroupEdit`
- `BaseEdit`
- `BaseHelper`
- `SnappingHelper`
- `ShapeMarkersHelper`
- `LineDrawer`
- `MarkerPointer`
- map adapters and base adapter classes
- decorator source managers and renderers
- HTML overlay geometry/homography helpers

Demo fit:

- Keep advanced exports in an API reference panel or hidden developer drawer.

## Suggested Demo Page Categories

Recommended first-level demo sections:

- Map setup and controls
- Draw and edit modes
- Feature selection and inspector
- Line decorator lab
- HTML overlay lab
- Custom tools
- Context panel transactions
- Geometry and network tools
- Import/export
- History and events
- API/reference drawer

Recommended initial demo narrative:

- Draw or import features.
- Select a feature and inspect/edit it in a context panel.
- Decorate lines with arrows, text, and symbols.
- Run topology utilities on line networks.
- Place an HTML overlay.
- Watch history, transactions, and events update live.
