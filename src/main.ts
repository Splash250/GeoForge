/* A MapLibre Plugin For Drawing and Editing Geometry Layers
 * Copyright (C) Geoman.io - All Rights Reserved
 */
import GmControl from '@/core/controls/index.ts';
import { type EventForwarder } from '@/core/events/forwarder.ts';
import GmEvents from '@/core/events/index.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import { Features } from '@/core/features/index.ts';
import { GeomanLifecycleController } from '@/core/lifecycle/geomanLifecycleController.ts';
import { BaseMapAdapter } from '@/core/map/base/index.ts';
import { getMapAdapter } from '@/core/map/index.ts';
import { ModeController } from '@/core/modes/modeController.ts';
import { GmOptions } from '@/core/options/index.ts';
import { GeomanLineDecoratorSubsystem } from '@/decorators/line/geomanLineDecoratorSubsystem.ts';
import { GeomanContextPanelSubsystem } from '@/context-panels/geomanContextPanelSubsystem.ts';
import { GeomanGeometrySubsystem } from '@/geometry/geomanGeometrySubsystem.ts';
import { GeomanHistorySubsystem } from '@/history/index.ts';
import { GeomanLayerSubsystem } from '@/layers/index.ts';
import { BaseDraw } from '@/modes/draw/base.ts';

import { drawClassMap } from '@/modes/draw/index.ts';
import { BaseEdit } from '@/modes/edit/base.ts';
import { editClassMap } from '@/modes/edit/index.ts';
import { BaseHelper } from '@/modes/helpers/base.ts';
import { helperClassMap } from '@/modes/helpers/index.ts';
import { GeomanHtmlOverlaySubsystem } from '@/overlays/html/geomanHtmlOverlaySubsystem.ts';
import { GeomanSelectionSubsystem } from '@/selection/geomanSelectionSubsystem.ts';
import { GeomanSessionSubsystem } from '@/sessions/index.ts';
import type { GeomanSelectionOptions } from '@/selection/types.ts';
import '@/styles/map/maplibre.css';
import '@/styles/style.css';
import { GeomanToolsSubsystem } from '@/tools/geomanToolsSubsystem.ts';
import { GeomanTransactionSubsystem } from '@/transactions/geomanTransactionSubsystem.ts';
import type { ModeName } from '@/types/controls.ts';
import type { FeatureId, FeatureShape } from '@/types/features.ts';
import { type AnyMapInstance, type LngLatTuple } from '@/types/map/index.ts';
import {
  type ActionInstance,
  type ActionInstanceKey,
  type DrawModeName,
  type EditModeName,
  type HelperModeName,
} from '@/types/modes/index.ts';
import type { GmOptionsData, ModeType } from '@/types/options.ts';
import { MarkerPointer } from '@/utils/draw/marker-pointer.ts';
import { isGmDrawEvent, isModeName, isModeType } from '@/utils/guards/modes.ts';
import { typedKeys } from '@/utils/typing.ts';
import log from '@/utils/log.ts';
import { sanitizeSvgMarkup } from '@/utils/sanitizeSvgMarkup.ts';
import type { PartialDeep } from 'type-fest';

// declare module 'maplibre-gl' {
//   interface Map {
//     gm?: Geoman;
//   }
// }

const SINGLE_FEATURE_EDIT_ALLOWED_SHAPES: FeatureShape[] = [
  'marker',
  'circle_marker',
  'text_marker',
  'line',
  'polygon',
  'rectangle',
  'circle',
  'ellipse',
];

export class Geoman {
  mapAdapterInstance: BaseMapAdapter<AnyMapInstance> | null = null;
  globalLngLatBounds: [LngLatTuple, LngLatTuple] = this.getGlobalLngLatBounds();
  features: Features;
  loaded: boolean = false;
  destroyed: boolean = false;
  editableFeatureIds: Set<FeatureId> | null = null;

  options: GmOptions;
  events: GmEvents;
  control: GmControl;
  modes: ModeController;
  selection: GeomanSelectionSubsystem;
  geometry: GeomanGeometrySubsystem;
  history: GeomanHistorySubsystem;
  sessions: GeomanSessionSubsystem;
  contextPanels: GeomanContextPanelSubsystem;
  transactions: GeomanTransactionSubsystem;
  layers: GeomanLayerSubsystem;
  decorators: {
    lines: GeomanLineDecoratorSubsystem;
  };
  overlays: {
    html: GeomanHtmlOverlaySubsystem;
  };
  tools: GeomanToolsSubsystem;

  actionInstances: { [key in ActionInstanceKey]?: ActionInstance } = {};
  markerPointer: MarkerPointer;

  constructor(map: AnyMapInstance, options: PartialDeep<GmOptionsData> = {}) {
    this.options = this.initCoreOptions(options);
    this.events = this.initCoreEvents();
    this.features = this.initCoreFeatures();
    this.control = this.initCoreControls();
    this.markerPointer = this.initMarkerPointer();
    this.modes = new ModeController(this);
    this.selection = new GeomanSelectionSubsystem({ geoman: this });
    this.geometry = new GeomanGeometrySubsystem({ geoman: this });
    this.history = new GeomanHistorySubsystem({ geoman: this });
    this.sessions = new GeomanSessionSubsystem({ geoman: this });
    this.contextPanels = new GeomanContextPanelSubsystem({ geoman: this });
    this.transactions = new GeomanTransactionSubsystem({ geoman: this });
    this.layers = new GeomanLayerSubsystem({ geoman: this });
    this.tools = new GeomanToolsSubsystem({ geoman: this });

    const mapWithGeoman = Object.assign(map, { gm: this });
    this.mapAdapterInstance = getMapAdapter(this, mapWithGeoman);
    this.decorators = {
      lines: new GeomanLineDecoratorSubsystem({
        geoman: this,
        getMap: () => this.mapAdapter.getMapInstance() as never,
      }),
    };
    this.overlays = {
      html: new GeomanHtmlOverlaySubsystem({
        getMapAdapter: () => this.mapAdapter,
      }),
    };

    this.waitForBaseMap()
      .then(this.init.bind(this))
      .catch((error) => {
        log.error('Geoman initialization failed:', error);
        // Use destroy() for proper cleanup of any registered events/resources.
        // Note: destroy() is async but we don't need to await it here since
        // we're in a fire-and-forget catch block and destroy() handles the
        // not-yet-loaded case synchronously for the critical cleanup paths.
        this.destroy();
      });
  }

  get drawClassMap() {
    return drawClassMap;
  }

  get editClassMap() {
    return editClassMap;
  }

  get helperClassMap() {
    return helperClassMap;
  }

  get mapAdapter(): BaseMapAdapter<AnyMapInstance> {
    if (this.mapAdapterInstance) {
      return this.mapAdapterInstance;
    }
    log.trace('Map adapter is not initialized');
    throw new Error('Map adapter is not initialized');
  }

  initCoreOptions(options: PartialDeep<GmOptionsData> = {}) {
    return new GmOptions(this, options);
  }

  initCoreEvents() {
    return new GmEvents(this);
  }

  initCoreFeatures() {
    return new Features(this);
  }

  initCoreControls() {
    return new GmControl(this);
  }

  initMarkerPointer() {
    return new MarkerPointer(this);
  }

  addControls(controlsElement: HTMLElement | undefined = undefined) {
    return getGeomanLifecycleController(this).addControls(controlsElement);
  }

  async waitForBaseMap(): Promise<AnyMapInstance | undefined> {
    return getGeomanLifecycleController(this).waitForBaseMap();
  }

  async waitForGeomanLoaded(): Promise<Geoman | undefined> {
    return getGeomanLifecycleController(this).waitForGeomanLoaded();
  }

  async init() {
    return getGeomanLifecycleController(this).init();
  }

  /**
   * Destroys the Geoman instance and cleans up resources.
   *
   * This method can be called at any point in the lifecycle:
   * - Before initialization completes: cancels pending init and cleans up synchronously
   * - After initialization completes: performs full cleanup including controls
   *
   * For React StrictMode compatibility, this method performs synchronous cleanup
   * of the `gm` reference on the map instance, allowing immediate re-initialization.
   */
  async destroy({ removeSources }: { removeSources: boolean } = { removeSources: false }) {
    return getGeomanLifecycleController(this).destroy({ removeSources });
  }

  removeControls() {
    return getGeomanLifecycleController(this).removeControls();
  }

  async onMapLoad() {
    return getGeomanLifecycleController(this).onMapLoad();
  }

  disableAllModes() {
    typedKeys(this.actionInstances).forEach((key) => {
      const [actionType, mode] = key.split('__');

      if (isModeType(actionType) && isModeName(mode)) {
        this.options.disableMode(actionType, mode);
      }
    });
    this.selection.deactivate({ reason: 'mode-end' });
  }

  getActiveDrawModes(): Array<DrawModeName> {
    return typedKeys(this.actionInstances)
      .map((key) => {
        const instance = this.actionInstances[key];
        return instance instanceof BaseDraw ? instance.mode : null;
      })
      .filter((mode): mode is DrawModeName => mode !== null);
  }

  getActiveEditModes(): Array<EditModeName> {
    return typedKeys(this.actionInstances)
      .map((key) => {
        const instance = this.actionInstances[key];
        return instance instanceof BaseEdit ? instance.mode : null;
      })
      .filter((mode): mode is EditModeName => mode !== null);
  }

  getActiveHelperModes(): Array<HelperModeName> {
    return typedKeys(this.actionInstances)
      .map((key) => {
        const instance = this.actionInstances[key];
        return instance instanceof BaseHelper ? instance.mode : null;
      })
      .filter((mode): mode is HelperModeName => mode !== null);
  }

  getGlobalLngLatBounds(): [LngLatTuple, LngLatTuple] {
    // these coordinates are used to restrict the map to the maximum possible bounds
    // mercator projection is used for the map, so the maximum latitude is MAX_VALID_LATITUDE
    // import { MAX_VALID_LATITUDE } from 'maplibre-gl/src/geo/transform.ts';

    const MAX_VALID_LATITUDE = 85.051129;
    return [
      [-179.99999, -MAX_VALID_LATITUDE],
      [179.99999, MAX_VALID_LATITUDE],
    ];
  }

  setGlobalEventsListener(callback: EventForwarder['globalEventsListener'] = null) {
    this.events.bus.forwarder.globalEventsListener = callback;
  }

  createSvgMarkerElement(
    type: keyof GmOptions['settings']['markerIcons'],
    style: Partial<CSSStyleDeclaration> | undefined = undefined,
  ): HTMLElement {
    const markerIcons = this.options.settings.markerIcons;

    if (!markerIcons[type]) {
      log.error(`createMarkerElement: marker type "${type}" not found`);
    }

    const element = document.createElement('div');
    element.classList.add('marker-wrapper');
    element.style.lineHeight = '0';

    const rawIcon = markerIcons[type] || 'NO_ICON';
    const sanitizedIcon = sanitizeSvgMarkup(rawIcon);
    element.innerHTML = sanitizedIcon || 'NO_ICON';
    const svgElement = element.firstChild as HTMLElement;

    if (typeof svgElement !== 'object') {
      log.error(`createMarkerElement: no icon "${type}" found`);
      throw new Error(`No icon "${type}" found`);
    }

    if (style) {
      Object.assign(svgElement.style, style);
    }

    return element;
  }

  enableMode(actionType: ModeType, modeName: ModeName) {
    this.options.enableMode(actionType, modeName);
  }

  disableMode(actionType: ModeType, modeName: ModeName) {
    this.options.disableMode(actionType, modeName);
  }

  toggleMode(actionType: ModeType, modeName: ModeName) {
    this.options.toggleMode(actionType, modeName);
  }

  isModeEnabled(actionType: ModeType, modeName: ModeName) {
    return this.options.isModeEnabled(actionType, modeName);
  }

  setEditableFeatureIds(featureIds: Array<FeatureId>) {
    this.editableFeatureIds = new Set(featureIds);
  }

  clearEditableFeatureIds() {
    this.editableFeatureIds = null;
  }

  isFeatureEditable(featureData: FeatureData | null | undefined): featureData is FeatureData {
    if (!featureData || featureData.getShapeProperty('disableEdit') === true) {
      return false;
    }

    if (!this.editableFeatureIds) {
      return true;
    }

    return this.editableFeatureIds.has(featureData.id);
  }

  // helper methods for compatibility with the old API
  // draw (draw:*)
  enableDraw(shape: DrawModeName) {
    this.options.enableMode('draw', shape);
  }

  disableDraw() {
    this.getActiveDrawModes().forEach((shape) => this.options.disableMode('draw', shape));
  }

  toggleDraw(shape: DrawModeName) {
    this.options.toggleMode('draw', shape);
  }

  drawEnabled(shape: DrawModeName) {
    return this.options.isModeEnabled('draw', shape);
  }

  // drag(edit:drag)
  enableGlobalDragMode() {
    this.options.enableMode('edit', 'drag');
  }

  disableGlobalDragMode() {
    this.options.disableMode('edit', 'drag');
  }

  toggleGlobalDragMode() {
    this.options.toggleMode('edit', 'drag');
  }

  globalDragModeEnabled() {
    return this.options.isModeEnabled('edit', 'drag');
  }

  // edit (edit:change)
  enableGlobalEditMode() {
    this.options.enableMode('edit', 'change');
  }

  disableGlobalEditMode() {
    this.options.disableMode('edit', 'change');
  }

  toggleGlobalEditMode() {
    this.options.toggleMode('edit', 'change');
  }

  globalEditModeEnabled() {
    return this.options.isModeEnabled('edit', 'change');
  }

  /**
   * Enables the high-level single-feature interaction workflow.
   *
   * Internally this composes the generic `helper:click_to_edit` selection
   * primitive with `edit:change`. With no selected feature, no feature is
   * editable. With one selected feature, only that feature is editable.
   */
  enableSingleFeatureEditMode(options: GeomanSelectionOptions = {}) {
    this.disableDraw();
    this.selection.configure({
      ...options,
      allowedShapes: options.allowedShapes ?? SINGLE_FEATURE_EDIT_ALLOWED_SHAPES,
    });
    this.options.enableMode('helper', 'click_to_edit');
    this.options.enableMode('edit', 'change');
    return this;
  }

  /**
   * Disables the single-feature interaction workflow and clears its selection scope.
   */
  disableSingleFeatureEditMode() {
    this.options.disableMode('helper', 'click_to_edit');
    this.options.disableMode('edit', 'change');
    return this;
  }

  /**
   * Toggles the high-level single-feature interaction workflow.
   */
  toggleSingleFeatureEditMode(options: GeomanSelectionOptions = {}) {
    if (this.singleFeatureEditModeEnabled()) {
      return this.disableSingleFeatureEditMode();
    }

    return this.enableSingleFeatureEditMode(options);
  }

  /**
   * Returns whether the single-feature interaction workflow is active.
   */
  singleFeatureEditModeEnabled() {
    return this.options.isModeEnabled('helper', 'click_to_edit');
  }

  /**
   * Returns the selected editable feature, or null when no feature is selected.
   */
  getSelectedFeature(): FeatureData | null {
    return this.selection.getSelectedFeature();
  }

  // rotate (edit:rotate)
  enableGlobalRotateMode() {
    this.options.enableMode('edit', 'rotate');
  }

  disableGlobalRotateMode() {
    this.options.disableMode('edit', 'rotate');
  }

  toggleGlobalRotateMode() {
    this.options.toggleMode('edit', 'rotate');
  }

  globalRotateModeEnabled() {
    return this.options.isModeEnabled('edit', 'rotate');
  }

  // cut (edit:cut)
  enableGlobalCutMode() {
    this.options.enableMode('edit', 'cut');
  }

  disableGlobalCutMode() {
    this.options.disableMode('edit', 'cut');
  }

  toggleGlobalCutMode() {
    this.options.toggleMode('edit', 'cut');
  }

  globalCutModeEnabled() {
    return this.options.isModeEnabled('edit', 'cut');
  }

  // remove (edit:delete)
  enableGlobalRemovalMode() {
    this.options.enableMode('edit', 'delete');
  }

  disableGlobalRemovalMode() {
    this.options.disableMode('edit', 'delete');
  }

  toggleGlobalRemovalMode() {
    this.options.toggleMode('edit', 'delete');
  }

  globalRemovalModeEnabled() {
    return this.options.isModeEnabled('edit', 'delete');
  }
}

export const GeoForge = Geoman;

const geomanLifecycleControllers = new WeakMap<Geoman, GeomanLifecycleController<Geoman>>();

function getGeomanLifecycleController(geoman: Geoman): GeomanLifecycleController<Geoman> {
  let lifecycleController = geomanLifecycleControllers.get(geoman);
  if (!lifecycleController) {
    lifecycleController = new GeomanLifecycleController(geoman);
    geomanLifecycleControllers.set(geoman, lifecycleController);
  }
  return lifecycleController;
}

export const createGeomanInstance = async (
  map: AnyMapInstance,
  options: PartialDeep<GmOptionsData>,
) => {
  const geoman = new Geoman(map, options);
  const result = await geoman.waitForGeomanLoaded();

  // If initialization failed (destroyed or returned undefined), throw an error
  if (!result || geoman.destroyed) {
    throw new Error('Geoman initialization failed');
  }

  return geoman;
};

// export all possible types to make them available in rollup-dts
export * from '@/types/index.ts';

// constants
export { controlIcons } from '@/core/options/icons.ts';
export { default as defaultLayerStyles } from '@/core/options/layers/style.ts';
export { customShapeRectangle, customShapeTriangle } from '@/core/options/shapes.ts';

// core classes
export { GmOptions } from '@/core/options/index.ts';
export type {
  GeomanModeState,
  GeomanModeSubscriptionCallback,
} from '@/core/modes/modeController.ts';
export type {
  GeomanControlProfile,
  GeomanControlVisibilityOptions,
} from '@/core/controls/index.ts';
export { drawClassMap, editClassMap, helperClassMap };

// utils
export { mergeByTypeCustomizer } from '@/core/options/utils.ts';
export { convertToThrottled } from '@/utils/behavior.ts';
export { isGeoJsonFeatureInPolygon, moveFeatureData, moveGeoJson } from '@/utils/features.ts';
export {
  boundsContains,
  boundsToBBox,
  calculatePerimeter,
  convertToLineStringFeatureCollection,
  eachCoordinateWithPath,
  eachSegmentWithPath,
  findCoordinateWithPath,
  geoJsonPointToLngLat,
  getEuclideanDistance,
  getEuclideanSegmentNearestPoint,
  getGeoJsonCoordinatesCount,
  getGeoJsonFirstPoint,
  getLngLatDiff,
  isEqualPosition,
  isMultiPolygonFeature,
  isPolygonFeature,
  lngLatToGeoJsonPoint,
  twoCoordsToLineString,
} from '@/utils/geojson.ts';
export { formatArea, formatDistance, toMod } from '@/utils/number.ts';
export { includesWithType, typedKeys } from '@/utils/typing.ts';

// decorators
export {
  LineDecoratorManager,
  GeomanLineDecoratorSubsystem,
  GeomanLineDecoratorAuthoringSession,
  normalizeLineDecorators,
  addLineDecoratorLayer,
  positionLineDecoratorLayers,
  createLinePlacements,
  loadSvgSymbolImage,
  validateSvgSymbolMarkup,
  isInMeters,
  isInPercent,
  isInPixels,
  parseNumeric,
  distanceBetween,
  bearingBetween,
  destinationPoint,
  interpolateOnLine,
  pixelsToMeters,
  toLngLat,
  definedProps,
  modulus,
  generateArrowheads,
  ensureArrowheadSource,
  resolveIds,
  updateArrowheadSource,
  clearArrowheadSource,
  ArrowheadManager,
  ensureSymbolDecoratorSource,
  resolveSymbolDecoratorIds,
  updateSymbolDecoratorSource,
  clearSymbolDecoratorSource,
  ensureSymbolImage,
  ensureTextDecoratorSource,
  resolveTextDecoratorIds,
  updateTextDecoratorSource,
  clearTextDecoratorSource,
  SymbolDecoratorRenderer,
  TextDecoratorRenderer,
} from '@/decorators/index.ts';
export type {
  ArrowFrequencyUnit,
  ArrowOffsetUnit,
  ArrowSizeUnit,
  ArrowheadFeatureCollection,
  ArrowheadManagerOptions,
  ArrowheadOptions,
  ArrowheadSourceIds,
  ArrowheadsGeneratorConfig,
  BaseArrowheadOptions,
  CreateLinePlacementsOptions,
  EnsureArrowheadSourceOptions,
  EnsureSymbolDecoratorSourceOptions,
  EnsureTextDecoratorSourceOptions,
  InterpolatedPoint,
  LineDecoratorAnimationDirection,
  LineDecoratorAnimationEasing,
  LineDecoratorAnimationOptions,
  LineDecoratorAnimationProperty,
  LineDecoratorAuthoringDecoratorInput,
  LineDecoratorAuthoringDecoratorResolver,
  LineDecoratorAuthoringFeatureInput,
  LineDecoratorAuthoringFeatureTarget,
  LineDecoratorAuthoringLineStyle,
  LineDecoratorAuthoringSession,
  LineDecoratorAuthoringSessionOptions,
  LineDecoratorGeomanSyncOptions,
  LineDecoratorKind,
  LineDecoratorLayerPosition,
  LineDecoratorManagerOptions,
  LineDecoratorOptions,
  LineDecoratorPlacementOptions,
  LineDecoratorRenderer,
  LineDecoratorRendererKind,
  LineDecoratorRenderItem,
  LineDecoratorRotationMode,
  LineDecoratorRotationOptions,
  LinePlacement,
  LinePlacementFrequency,
  LinePlacementOptions,
  LineSymbolAnchor,
  LineSymbolDecoratorOptions,
  LineSymbolSegmentPlacementOptions,
  LineSymbolSegmentTarget,
  LineTextDecoratorOptions,
  NormalizedLngLat,
  SvgSymbolImageMap,
  SvgSymbolImageRegistration,
  SvgSymbolImageRegistrationResult,
  SymbolDecoratorRendererOptions,
  SymbolDecoratorSourceIds,
  SymbolImageInput,
  SymbolImageMap,
  SymbolImageRegistration,
  TextDecoratorRendererOptions,
  TextDecoratorSourceIds,
  GeomanLineDecoratorConfigureOptions,
  GeomanLineDecoratorManualSyncOptions,
  GeomanLineDecoratorSubsystemOptions,
} from '@/decorators/index.ts';
export type { CreateLineDecoratorAuthoringSessionOptions } from '@/decorators/line/lineDecoratorAuthoringSession.ts';

// selection
export { GeomanSelectionSubsystem } from '@/selection/index.ts';
export type {
  GeomanSelectionChangeReason,
  GeomanSelectionEventPayload,
  GeomanSelectionFilterReason,
  GeomanSelectionOptions,
  GeomanSelectionState,
  SelectionFeatureState,
  SelectionLayerStyleOptions,
  SelectionStyle,
} from '@/selection/index.ts';

// tools
export { GeomanToolsSubsystem } from '@/tools/index.ts';
export type {
  GeomanToolBlankMapClickEvent,
  GeomanToolCancelReason,
  GeomanToolControlEventType,
  GeomanToolControlOptions,
  GeomanToolControlState,
  GeomanToolContext,
  GeomanToolContextMenuEvent,
  GeomanToolDefinition,
  GeomanToolFeatureClickEvent,
  GeomanToolFeatureContextMenuEvent,
  GeomanToolFeatureHoverEndEvent,
  GeomanToolFeatureHoverEndReason,
  GeomanToolFeatureHoverEvent,
  GeomanToolInteractionHookResult,
  GeomanToolSelectionConfig,
  GeomanToolSelectionOptions,
  GeomanToolsSubsystemOptions,
} from '@/tools/index.ts';

// geometry
export { GeomanGeometrySubsystem } from '@/geometry/index.ts';
export type {
  GeomanDistanceFormatOptions,
  GeomanEndpointSnappingConfigureOptions,
  GeomanEndpointSnappingFacade,
  GeomanEndpointSnappingState,
  GeomanGeometrySubsystemOptions,
  GeomanLineDegreeThresholdValidationOptions,
  GeomanLineDanglingEndpointValidationOptions,
  GeomanLineDisconnectedComponentValidationOptions,
  GeomanLineDuplicateEndpointGroupValidationOptions,
  GeomanLineEdgeHit,
  GeomanLineEndpointConnectionEndpoint,
  GeomanLineEndpointConnectionOptions,
  GeomanLineEndpointConnectionPreview,
  GeomanLineEndpointConnectionPreviewOptions,
  GeomanLineEndpointConnectionPreviewRenderIds,
  GeomanLineEndpointConnectionPreviewRenderOptions,
  GeomanLineEndpointConnectionPreviewRenderStyle,
  GeomanLineEndpointConnectionResult,
  GeomanLineEndpointConnectionUpdate,
  GeomanLineEndpointHit,
  GeomanLineEndpointName,
  GeomanLineEndpointRef,
  GeomanLineMergeApplyOptions,
  GeomanLineMergePlan,
  GeomanLineMergePlanOptions,
  GeomanLineMergePlanResult,
  GeomanLineMergePropertyStrategy,
  GeomanLineMergeRejectionReason,
  GeomanLineNetworkEdge,
  GeomanLineNetworkGraph,
  GeomanLineNetworkGraphOptions,
  GeomanLineNetworkNode,
  GeomanLineSegment,
  GeomanLineSegmentContext,
  GeomanLineSegmentHit,
  GeomanLineSegmentInput,
  GeomanLineSegmentMetadata,
  GeomanLineSegmentRemovalOptions,
  GeomanLineSegmentRemovalResult,
  GeomanLineSplitAtPointOptions,
  GeomanLineSplitAtPointResult,
  GeomanLineTopologyValidationComponent,
  GeomanLineTopologyValidationIssue,
  GeomanLineTopologyValidationIssueType,
  GeomanLineTopologyValidationMessage,
  GeomanLineTopologyValidationMessageContext,
  GeomanLineTopologyValidationOptions,
  GeomanLineTopologyValidationResult,
  GeomanLineTopologyValidationRuleOptions,
  GeomanLineTopologyValidationSeverity,
  GeomanLineVertexHit,
  GeomanLineVertexInsertionMetadataMode,
  GeomanLineVertexInsertionOptions,
  GeomanLineVertexInsertionResult,
  GeomanNearbyLineEndpointPair,
  GeomanNearestEdgeOptions,
  GeomanNearestLineEndpointOptions,
  GeomanNearestSegmentOptions,
  GeomanNearestVertexOptions,
  GeomanSegmentMeasurementFormatOptions,
  GeomanSegmentPointInput,
  LineEndpointConnectionPreviewRendererOptions,
} from '@/geometry/index.ts';

// context panels
export {
  GeomanContextPanelSubsystem,
  defineGeomanContextPanel,
  createContextPanelValidationList,
  createContextPanelActionButton,
} from '@/context-panels/index.ts';
export type {
  ContextPanelActionButtonOptions,
  GeomanContextPanelCloseEvent,
  GeomanContextPanelCloseReason,
  GeomanContextPanelDefinition,
  GeomanContextPanelFeatureRef,
  GeomanContextPanelOpenData,
  GeomanContextPanelPlacement,
  GeomanContextPanelRenderContext,
  GeomanContextPanelRenderResult,
  GeomanContextPanelState,
  GeomanContextPanelSubsystemOptions,
  GeomanContextPanelTransactionCloseBehavior,
  GeomanContextPanelTransactionCloseContext,
  GeomanContextPanelTransactionDefinitionContext,
  GeomanContextPanelTransactionOptions,
  GeomanContextPanelTransactionRefreshContext,
  GeomanContextPanelTransactionRenderContext,
  GeomanContextPanelTransactionValidationContext,
} from '@/context-panels/index.ts';

// transactions
export {
  GeomanFeaturePropertyEditor,
  GeomanTransaction,
  GeomanTransactionSubsystem,
} from '@/transactions/index.ts';
export type {
  GeomanFeaturePropertyEditorOptions,
  GeomanFeaturePropertyEditorState,
  GeomanFeaturePropertyEditorSubscription,
  GeomanFeaturePropertyEditorValidationContext,
  GeomanFeaturePropertyEditorValidator,
  GeomanTransactionChange,
  GeomanTransactionCommitResult,
  GeomanTransactionFeatureRef,
  GeomanTransactionOptions,
  GeomanTransactionStatus,
  GeomanTransactionSubsystemOptions,
  GeomanTransactionValidationResult,
  GeomanTransactionValidator,
} from '@/transactions/index.ts';

// history
export { GeomanHistorySubsystem } from '@/history/index.ts';
export type {
  GeomanFeatureMutationKind,
  GeomanFeatureMutationRecord,
  GeomanFeatureRef,
  GeomanHistoryEntry,
  GeomanHistoryOperation,
  GeomanHistoryOperationKind,
  GeomanHistoryOptions,
  GeomanHistoryOptionsPartial,
  GeomanHistoryState,
  GeomanHistorySubscriptionCallback,
  GeomanHistorySubscriptionEvent,
  GeomanHistorySubscriptionEventType,
} from '@/history/index.ts';

// sessions
export { GeomanSessionSubsystem } from '@/sessions/index.ts';
export type {
  GeomanSession,
  GeomanSessionFeatureFacade,
  GeomanSessionOptions,
  GeomanSessionSubsystemOptions,
} from '@/sessions/index.ts';

// layers
export {
  GeomanLayerSubsystem,
  buildRasterProxyUrl,
  createRasterProxyPolicy,
  createRasterProxyTransformer,
} from '@/layers/index.ts';
export type {
  DiscoverRasterLayersOptions,
  DiscoveredRasterLayer,
  GeomanRasterLayer,
  RasterLayerDefaults,
  RasterLayerInput,
  RasterLayerSubscriptionCallback,
  RasterLayerSubscriptionEvent,
  RasterLayerSyncOptions,
  RasterNetworkDiagnosticEvent,
  RasterNetworkPolicy,
  RasterProxyPolicy,
  RasterProxyPolicyOptions,
  RasterProxyOptions,
} from '@/layers/index.ts';

// guards
export {
  isGmDrawFreehandDrawerEvent,
  isGmDrawLineDrawerEvent,
  isGmDrawShapeEvent,
} from '@/utils/guards/events/draw.ts';
export { isGmEditEvent } from '@/utils/guards/events/edit.ts';
export {
  isGmFeatureBeforeCreateEvent,
  isGmFeatureBeforeUpdateEvent,
} from '@/utils/guards/events/features.ts';
export { isGmHelperEvent } from '@/utils/guards/events/helper.ts';
export { isGmControlEvent, isGmEvent } from '@/utils/guards/events/index.ts';
export {
  isActionType,
  isBaseMapEventName,
  isDrawModeName,
  isEditModeName,
  isHelperModeName,
  isMapPointerEvent,
  isMapWithOnceMethod,
  isModeName,
  isNonEmptyArray,
  isPointerEventName,
} from '@/utils/guards/index.ts';
export { isGmDrawEvent };

// features
export { FeatureData } from '@/core/features/feature-data.ts';

// base adapter classes
export { BaseMapAdapter } from '@/core/map/base/index.ts';
export { BaseLayer } from '@/core/map/base/layer.ts';
export { BaseDomMarker } from '@/core/map/base/marker.ts';
export { BasePopup } from '@/core/map/base/popup.ts';
export { BaseSource } from '@/core/map/base/source.ts';

// base actions
/**
 * @deprecated Internal action base class. Prefer high-level `Geoman` modes, tools, and subsystems.
 */
export { BaseAction } from '@/modes/base-action.ts';
/**
 * @deprecated Internal draw base class. Prefer high-level `Geoman` draw modes.
 */
export { BaseDraw } from '@/modes/draw/base.ts';
/**
 * @deprecated Internal drag base class. Prefer high-level `Geoman` edit modes.
 */
export { BaseDrag } from '@/modes/edit/base-drag.ts';
/**
 * @deprecated Internal group edit base class. Prefer high-level `Geoman` edit modes.
 */
export { BaseGroupEdit } from '@/modes/edit/base-group.ts';
/**
 * @deprecated Internal edit base class. Prefer high-level `Geoman` edit modes.
 */
export { BaseEdit } from '@/modes/edit/base.ts';
/**
 * @deprecated Internal helper base class. Prefer high-level `Geoman` helper modes.
 */
export { BaseHelper } from '@/modes/helpers/base.ts';

// specific actions
export { SnappingHelper } from '@/modes/helpers/snapping.ts';
export { ShapeMarkersHelper } from '@/modes/helpers/shape-markers.ts';
/**
 * @deprecated Internal drawing helper. Use Geoman draw modes and `geoman.history` instead.
 */
export { LineDrawer } from '@/utils/draw/line-drawer.ts';
/**
 * @deprecated Internal drawing helper. Use Geoman draw modes and map interaction APIs instead.
 */
export { MarkerPointer } from '@/utils/draw/marker-pointer.ts';

export { GM_PREFIX, IS_PRO } from '@/core/constants.ts';
export { DRAW_MODES } from '@/modes/constants.ts';
export { EXTRA_DRAW_MODES } from '@/modes/constants.ts';
export { SHAPE_NAMES } from '@/modes/constants.ts';
export {
  FEATURE_PROPERTY_PREFIX,
  FEATURE_ID_PROPERTY,
  SOURCES,
} from '@/core/features/constants.ts';
export { HELPER_MODES } from '@/modes/constants.ts';
export { EDIT_MODES } from '@/modes/constants.ts';
export { isGmModeEvent } from '@/utils/guards/events/mode.ts';

// HTML overlays
export {
  HtmlOverlayManager,
  GeomanHtmlOverlaySubsystem,
  HtmlOverlayElement,
} from '@/overlays/html/index.ts';
export type {
  HtmlOverlayCornerName,
  HtmlOverlayCorners,
  HtmlOverlayDefinition,
  HtmlOverlayIframeOptions,
  HtmlOverlayPointerMode,
  HtmlOverlayReferrerPolicy,
  HtmlOverlaySandboxToken,
  HtmlOverlayValidationFailureReason,
  HtmlOverlayValidationResult,
} from '@/overlays/html/index.ts';
