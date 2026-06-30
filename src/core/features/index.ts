import { GM_PREFIX, GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import {
  FEATURE_ID_PROPERTY,
  FEATURE_PROPERTY_PREFIX,
  SOURCES,
} from '@/core/features/constants.ts';
import { FeatureData } from '@/core/features/feature-data.ts';
import { FeatureGeoJsonIO } from './featureGeoJsonIO.ts';
import { FeatureLayerFactory } from './featureLayerFactory.ts';
import { FeatureQueryService } from './featureQueryService.ts';
import { FeatureSourceHydrator } from './featureSourceHydrator.ts';
import { FeatureStoreService } from './featureStoreService.ts';
import { bringEditOverlayLayersToFront } from './layerOrder.ts';
import { SourceUpdateManager } from '@/core/features/source-update-manager.ts';
import type { BaseLayer } from '@/core/map/base/layer.ts';
import { BaseSource } from '@/core/map/base/source.ts';
import { SHAPE_NAMES } from '@/modes/constants.ts';
import {
  type FeatureId,
  type GeomanFeatureSubscriptionCallback,
  type GeomanFeatureSubscriptionEvent,
  type GeomanFeatureSubscriptionEventType,
  type GeomanFeatureSubscriptionOptions,
  type GeomanUnsubscribe,
  type FeatureMutationOptions,
  type FeatureOwnerId,
  type FeatureShape,
  type FeatureSourceName,
  type FeatureStore,
  type ImportGeoJsonOptions,
  type SourcesStorage,
} from '@/types/features.ts';
import type {
  GeoJsonImportFeature,
  GeoJsonImportFeatureCollection,
  GeoJsonShapeFeature,
  GeoJsonShapeFeatureCollection,
} from '@/types/geojson.ts';
import type { GmDrawFeatureCreatedEvent } from '@/types/events/draw.ts';
import type { LngLatTuple, ScreenPoint } from '@/types/map/index.ts';
import type { PartialLayerStyle } from '@/types/map/layers.ts';
import type { MarkerData, ShapeName } from '@/types/modes/index.ts';
import type { Geoman } from '@/main.ts';
import { includesWithType, typedKeys, typedValues } from '@/utils/typing.ts';
import type { BaseMapPointerEvent } from '@mapLib/types/events.ts';
import type { GeomanFeatureRef } from '@/history/types.ts';
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiPolygon,
  Polygon,
} from 'geojson';
import { cloneDeep } from 'lodash-es';
import log from '@/utils/log';

const HISTORY_IGNORED_SHAPES = new Set<FeatureShape>([
  'center_marker',
  'vertex_marker',
  'edge_marker',
  'snap_guide',
]);

type FeatureSubscriptionListener = (change: FeatureSubscriptionChange) => void;

export type FeatureSubscriptionChange = {
  type: GeomanFeatureSubscriptionEventType;
  name: string;
  feature?: FeatureData;
  originalEvent?: unknown;
};

export class Features {
  gm: Geoman;

  sources: SourcesStorage;
  defaultSourceName: FeatureSourceName = SOURCES.main;
  featureStoreService: FeatureStoreService;
  updateManager: SourceUpdateManager;
  layerFactory: FeatureLayerFactory;
  queryService: FeatureQueryService;
  geoJsonIO: FeatureGeoJsonIO;
  layers: Array<BaseLayer>;
  private subscriptionListeners = new Set<FeatureSubscriptionListener>();

  constructor(gm: Geoman) {
    this.gm = gm;
    this.updateManager = new SourceUpdateManager(gm);
    this.layerFactory = new FeatureLayerFactory(gm);
    this.queryService = new FeatureQueryService({
      mapAdapter: {
        coordBoundsToScreenBounds: (bounds) => this.gm.mapAdapter.coordBoundsToScreenBounds(bounds),
        queryFeaturesByScreenCoordinates: (options) =>
          this.gm.mapAdapter.queryFeaturesByScreenCoordinates(options),
      },
    });
    this.sources = Object.fromEntries(
      typedValues(SOURCES).map((name) => [name, null]),
    ) as SourcesStorage;

    this.featureStoreService = new FeatureStoreService({
      sources: this.sources,
      getIdGenerator: () => this.gm.options.settings.idGenerator,
    });
    this.geoJsonIO = new FeatureGeoJsonIO({
      defaultSourceName: () => this.defaultSourceName,
      createFeature: (options) => this.createFeature(options),
      deleteFeature: (featureId, options) => this.delete(featureId, options),
      hasFeature: (featureId) => this.has(this.defaultSourceName, featureId),
      getFeature: (sourceName, featureId) => this.get(sourceName, featureId),
      getSource: (sourceName) => this.sources[sourceName],
      getShape: (feature) => this.getFeatureShapeByGeoJson(feature),
    });
    this.layers = [];
  }

  get featureCounter(): number {
    return this.featureStoreService.featureCounter;
  }

  set featureCounter(featureCounter: number) {
    this.featureStoreService.featureCounter = featureCounter;
  }

  get featureStore(): FeatureStore {
    return this.featureStoreService.featureStore;
  }

  set featureStore(featureStore: FeatureStore) {
    this.featureStoreService.featureStore = featureStore;
  }

  get featureStoreAllowedSources(): Array<FeatureSourceName> {
    return this.featureStoreService.allowedSources;
  }

  set featureStoreAllowedSources(allowedSources: Array<FeatureSourceName>) {
    this.featureStoreService.allowedSources = allowedSources;
  }

  get forEach() {
    return this.filteredForEach((featureData) => !featureData.temporary);
  }

  get tmpForEach() {
    return this.filteredForEach((featureData) => featureData.temporary);
  }

  get editableForEach() {
    return this.filteredForEach((featureData) => {
      return !featureData.temporary && this.gm.isFeatureEditable(featureData);
    });
  }

  init() {
    if (Object.values(this.sources).some((source) => source !== null)) {
      log.warn('features.init(): features are already initialized');
      return;
    }

    typedKeys(this.sources).forEach((sourceName) => {
      this.sources[sourceName] = this.createSource(sourceName);
    });

    // Hydrate feature store from existing sources and sync the ID counter
    // This handles remounting when sources were preserved (removeSources: false)
    this.hydrateFromExistingSources();

    if (this.gm.options.settings.useDefaultLayers) {
      this.layers = this.createLayers();
    }
  }

  /**
   * Hydrates the feature store from existing sources and syncs the ID counter.
   * This is called during init to restore state when remounting on preserved sources.
   */
  hydrateFromExistingSources() {
    const hydrator = new FeatureSourceHydrator({
      gm: this.gm,
      sources: this.sources,
      hasFeature: (sourceName, featureId) => this.has(sourceName, featureId),
      setFeature: (_sourceName, _featureId, featureData) => this.add(featureData),
    });
    const { maxCounter } = hydrator.hydrate();

    if (maxCounter > this.featureCounter) {
      this.featureCounter = maxCounter;
    }
  }

  getNewFeatureId(shapeGeoJson: GeoJsonShapeFeature): FeatureId {
    return this.featureStoreService.getNewFeatureId(shapeGeoJson);
  }

  filteredForEach(filterFn: (featureData: FeatureData) => boolean) {
    return this.featureStoreService.filteredForEach(filterFn);
  }

  has(sourceName: keyof SourcesStorage, featureId: FeatureId): boolean {
    return this.featureStoreService.has(sourceName, featureId);
  }

  get(sourceName: keyof SourcesStorage, featureId: FeatureId): FeatureData | null {
    return this.featureStoreService.get(sourceName, featureId);
  }

  add(featureData: FeatureData) {
    this.featureStoreService.add(featureData);
  }

  setDefaultSourceName(sourceName: FeatureSourceName) {
    this.defaultSourceName = sourceName;
  }

  createSource(sourceName: FeatureSourceName) {
    const source = this.gm.mapAdapter.addSource(sourceName, {
      type: 'FeatureCollection',
      features: [],
    });

    if (source) {
      return source;
    }

    throw new Error(`Features: failed to create the source: "${sourceName}"`);
  }

  delete(
    featureIdOrFeatureData: FeatureData | FeatureId | GeomanFeatureRef,
    options?: FeatureMutationOptions,
  ) {
    const featureData = this.resolveFeatureForHistory(featureIdOrFeatureData);
    const before = featureData ? cloneDeep(featureData.getGeoJson()) : null;

    this.featureStoreService.delete(featureIdOrFeatureData);

    if (featureData) {
      this.notifyFeatureChange({
        type: 'delete',
        name: `${GM_PREFIX}:remove`,
        feature: featureData,
      });
    }

    if (isHistorySuppressed(options)) {
      clearLastHistoryRecord(this.gm);
      return;
    }

    if (featureData && before && isHistoryRecordableShape(featureData.shape)) {
      this.gm.history?.record(
        [
          {
            kind: 'delete',
            ref: { sourceName: featureData.sourceName, featureId: featureData.id },
            before,
            after: null,
          },
        ],
        { label: 'feature.delete' },
      );
    }
  }

  deleteAll(options?: FeatureMutationOptions) {
    const hadFeatures = this.featureStore.size > 0;
    const operations = Array.from(this.featureStore.values())
      .filter((featureData) => isHistoryRecordableShape(featureData.shape))
      .map((featureData) => ({
        kind: 'delete' as const,
        ref: { sourceName: featureData.sourceName, featureId: featureData.id },
        before: cloneDeep(featureData.getGeoJson()),
        after: null,
      }));

    this.featureStoreService.clear();

    if (hadFeatures) {
      this.notifyFeatureChange({
        type: 'delete',
        name: `${GM_PREFIX}:remove`,
      });
    }

    if (isHistorySuppressed(options)) {
      clearLastHistoryRecord(this.gm);
      return;
    }

    if (operations.length > 0) {
      this.gm.history?.record(operations, { label: 'feature.deleteAll' });
    }
  }

  getFeatureByMouseEvent({
    event,
    sourceNames,
  }: {
    event: BaseMapPointerEvent;
    sourceNames: Array<FeatureSourceName>;
  }): FeatureData | null {
    return this.queryService.getFeatureByMouseEvent({
      event,
      sourceNames,
    });
  }

  getFeaturesByGeoJsonBounds({
    geoJson,
    sourceNames,
  }: {
    geoJson: Feature<Polygon | MultiPolygon | LineString>;
    sourceNames: Array<FeatureSourceName>;
  }): Array<FeatureData> {
    return this.queryService.getFeaturesByGeoJsonBounds({ geoJson, sourceNames });
  }

  getFeaturesByScreenBounds({
    bounds,
    sourceNames,
  }: {
    bounds: [ScreenPoint, ScreenPoint];
    sourceNames: Array<FeatureSourceName>;
  }) {
    return this.queryService.getFeaturesByScreenBounds({ bounds, sourceNames });
  }

  createFeature({
    featureId,
    ownerId,
    shapeGeoJson,
    parent,
    sourceName,
    imported,
    history,
  }: {
    featureId?: FeatureId;
    ownerId?: FeatureOwnerId;
    shapeGeoJson: GeoJsonShapeFeature;
    parent?: FeatureData;
    sourceName: FeatureSourceName;
    imported?: boolean;
  } & FeatureMutationOptions): FeatureData | null {
    const source = this.sources[sourceName];
    if (!source) {
      log.error('Features.createFeature Missing source for feature creation');
      return null;
    }

    const id =
      featureId ??
      shapeGeoJson.properties[FEATURE_ID_PROPERTY] ??
      this.getNewFeatureId(shapeGeoJson);

    if (this.get(sourceName, id)) {
      log.error(
        `Features.createFeature: feature with the id "${id}" already exists in source "${sourceName}"`,
        this.get(sourceName, id),
      );
      return null;
    }

    const featureData = new FeatureData({
      gm: this.gm,
      id,
      ownerId,
      parent: parent || null,
      source,
      geoJsonShapeFeature: cloneDeep(shapeGeoJson),
    });

    this.add(featureData);
    if (history === false) {
      clearLastHistoryRecord(this.gm);
    } else if (isHistoryRecordableShape(featureData.shape)) {
      this.gm.history?.record(
        [
          {
            kind: 'create',
            ref: { sourceName: featureData.sourceName, featureId: featureData.id },
            before: null,
            after: cloneDeep(featureData.getGeoJson()),
          },
        ],
        { label: 'feature.create' },
      );
    }
    if (!featureData.temporary && !imported) {
      this.fireFeatureCreatedEvent(featureData);
    }
    this.notifyFeatureChange({
      type: 'create',
      name: `${GM_PREFIX}:create`,
      feature: featureData,
    });
    this.featureCounter += 1;
    return featureData;
  }

  importGeoJson(
    geoJson: GeoJsonImportFeatureCollection | GeoJsonImportFeature,
    options?: ImportGeoJsonOptions,
  ) {
    return this.geoJsonIO.importGeoJson(geoJson, options);
  }

  importGeoJsonFeature(
    shapeGeoJson: GeoJsonImportFeature,
    options?: Pick<ImportGeoJsonOptions, 'ownerId' | 'history'>,
  ): FeatureData | null {
    return this.geoJsonIO.importGeoJsonFeature(shapeGeoJson, options);
  }

  getByOwner(ownerId: FeatureOwnerId): Array<FeatureData> {
    return Array.from(this.featureStore.values()).filter(
      (featureData) => featureData.ownerId === ownerId,
    );
  }

  deleteByOwner(
    ownerId: FeatureOwnerId,
    options?: FeatureMutationOptions,
  ): Array<GeomanFeatureRef> {
    const features = this.getByOwner(ownerId);
    const deletedRefs = features.map((featureData) => ({
      sourceName: featureData.sourceName,
      featureId: featureData.id,
    }));

    features.forEach((featureData) => this.delete(featureData, options));

    return deletedRefs;
  }

  subscribe(
    callback: GeomanFeatureSubscriptionCallback,
    options: GeomanFeatureSubscriptionOptions = {},
  ): GeomanUnsubscribe {
    const listener: FeatureSubscriptionListener = (change) => {
      if (!shouldNotifySubscription(change, options)) {
        return;
      }
      callback(this.createSubscriptionEvent(change, options));
    };
    this.subscriptionListeners.add(listener);

    let unsubscribed = false;
    return () => {
      if (unsubscribed) {
        return;
      }
      unsubscribed = true;
      this.subscriptionListeners.delete(listener);
    };
  }

  /**
   * Emits public feature subscription updates for actual feature-store mutations.
   *
   * @internal
   */
  notifyFeatureChange(change: FeatureSubscriptionChange): void {
    this.subscriptionListeners.forEach((listener) => {
      listener(change);
    });
  }

  getAll(): FeatureCollection {
    return this.geoJsonIO.getAll();
  }

  private createSubscriptionEvent(
    change: FeatureSubscriptionChange,
    options: GeomanFeatureSubscriptionOptions,
  ): GeomanFeatureSubscriptionEvent {
    const features = this.getSubscribedFeatures(options);

    return {
      type: change.type,
      name: change.name,
      sourceNames: getSubscribedSourceNames(features, options),
      features,
      geoJson: {
        type: 'FeatureCollection',
        features: features.map((feature) => cloneDeep(feature.getGeoJson())),
      },
      feature: change.feature,
      originalEvent: change.originalEvent,
    };
  }

  private getSubscribedFeatures(options: GeomanFeatureSubscriptionOptions): Array<FeatureData> {
    const sourceNames = options.sourceNames ? new Set(options.sourceNames) : null;

    return Array.from(this.featureStore.values()).filter((featureData) => {
      if (!options.includeTemporary && featureData.temporary) {
        return false;
      }
      if (sourceNames && !sourceNames.has(featureData.sourceName)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Exports GeoJSON from Geoman's internal state.
   *
   * This is the recommended method for most use cases as it always returns the latest
   * feature data, even during event handlers before MapLibre has committed changes.
   *
   * @param options - Export options
   * @param options.allowedShapes - Filter to only include specific shape types
   * @param options.idPropertyName - Property name to use for feature IDs (default: 'gm_id')
   * @returns GeoJSON FeatureCollection with all features
   *
   * @example
   * // Export all features
   * const geoJson = geoman.features.exportGeoJson();
   *
   * // Export only polygons and circles
   * const shapes = geoman.features.exportGeoJson({ allowedShapes: ['polygon', 'circle'] });
   */
  exportGeoJson(
    {
      allowedShapes,
      idPropertyName,
    }: {
      allowedShapes?: Array<FeatureShape>;
      idPropertyName?: string;
    } = { allowedShapes: undefined },
  ): GeoJsonShapeFeatureCollection {
    return this.geoJsonIO.exportGeoJson({ allowedShapes, idPropertyName });
  }

  /**
   * Exports GeoJSON directly from MapLibre's underlying source data.
   *
   * This method reads from MapLibre's serialized source state, which may lag slightly
   * behind Geoman's internal state during rapid updates or in event handlers.
   *
   * Use this method when you specifically need to verify what MapLibre has committed
   * to its source, for debugging, or for synchronization with external systems that
   * read directly from MapLibre sources.
   *
   * For most use cases, prefer `exportGeoJson()` which uses Geoman's internal state
   * and is always up-to-date.
   *
   * @param options - Export options
   * @param options.allowedShapes - Filter to only include specific shape types
   * @param options.idPropertyName - Property name to use for feature IDs (default: 'gm_id')
   * @returns GeoJSON FeatureCollection from MapLibre's source
   *
   * @example
   * // Export features as stored in MapLibre source
   * const geoJson = geoman.features.exportGeoJsonFromSource();
   *
   * // Verify MapLibre has committed the data
   * await geoman.features.waitForPendingUpdates();
   * const committed = geoman.features.exportGeoJsonFromSource();
   */
  exportGeoJsonFromSource(
    {
      allowedShapes,
      idPropertyName,
    }: {
      allowedShapes?: Array<FeatureShape>;
      idPropertyName?: string;
    } = { allowedShapes: undefined },
  ): GeoJsonShapeFeatureCollection {
    return this.geoJsonIO.exportGeoJsonFromSource({ allowedShapes, idPropertyName });
  }

  asGeoJsonFeatureCollection({
    shapeTypes,
    sourceNames,
    idPropertyName,
    useMapLibreSource = false,
  }: {
    shapeTypes?: Array<FeatureShape>;
    sourceNames: Array<FeatureSourceName>;
    idPropertyName?: string;
    useMapLibreSource?: boolean;
  }): GeoJsonShapeFeatureCollection {
    return this.geoJsonIO.asGeoJsonFeatureCollection({
      shapeTypes,
      sourceNames,
      idPropertyName,
      useMapLibreSource,
    });
  }

  convertSourceToGm(inputSource: BaseSource): Array<FeatureData> {
    // adds an externally created source to the features store
    // the method converts the source/layers to internal format
    // original source/layers are removed

    const features: Array<FeatureData> = [];
    const shapeGeoJson = inputSource.getGeoJson();
    const sourceGeoJsonFeatures =
      'features' in shapeGeoJson ? shapeGeoJson.features : [shapeGeoJson];
    const baseSource = this.gm.mapAdapter.getSource(inputSource.id);
    baseSource.remove();

    sourceGeoJsonFeatures.forEach((sourceFeature) => {
      const featureData = this.addGeoJsonFeature({
        shapeGeoJson: sourceFeature as GeoJsonImportFeature,
        defaultSource: true,
      });

      if (featureData) {
        features.push(featureData);
      }
    });
    return features;
  }

  addGeoJsonFeature({
    shapeGeoJson,
    sourceName,
    defaultSource,
  }: {
    shapeGeoJson: GeoJsonImportFeature;
    sourceName?: FeatureSourceName;
    defaultSource?: boolean;
  }): FeatureData | null {
    let targetSourceName: FeatureSourceName | null;
    if (defaultSource) {
      targetSourceName = this.defaultSourceName;
      if (sourceName) {
        log.warn('features.addGeoJsonFeature: default source is set, sourceName is ignored');
      }
    } else {
      targetSourceName = sourceName || null;
    }

    if (!targetSourceName) {
      log.error('features.addGeoJsonFeature: missing sourceName');
      return null;
    }

    const shape = this.getFeatureShapeByGeoJson(shapeGeoJson);

    if (!shape) {
      log.error('features.addGeoJsonFeature: unknown shape', shape);
      return null;
    }

    return this.createFeature({
      featureId: shapeGeoJson.id as FeatureId | undefined,
      shapeGeoJson: {
        ...shapeGeoJson,
        properties: { ...shapeGeoJson.properties, shape },
      },
      sourceName: targetSourceName,
    });
  }

  createLayers(): Array<BaseLayer> {
    const layers: Array<BaseLayer> = [];

    typedKeys(this.sources).forEach((sourceName) => {
      typedKeys(this.gm.options.layerStyles).forEach((shapeName) => {
        const styles = this.gm.options.layerStyles[shapeName][sourceName];
        styles.forEach((partialStyle) => {
          const layer = this.createGenericLayer({
            sourceName,
            shapeNames: [shapeName],
            partialStyle,
          });

          if (layer) {
            layers.push(layer);
          }
        });
      });
    });

    return layers;
  }

  bringEditOverlayLayersToFront() {
    bringEditOverlayLayersToFront({
      layers: this.layers,
      map: this.gm.mapAdapterInstance?.getMapInstance(),
    });
  }

  createGenericLayer({
    sourceName,
    shapeNames,
    partialStyle,
  }: {
    sourceName: FeatureSourceName;
    shapeNames: Array<FeatureShape>;
    partialStyle: PartialLayerStyle;
  }): BaseLayer | null {
    return this.layerFactory.createGenericLayer({ sourceName, shapeNames, partialStyle });
  }

  getGenericLayerName({
    sourceName,
    shapeNames,
    partialStyle,
  }: {
    sourceName: FeatureSourceName;
    shapeNames: Array<FeatureShape>;
    partialStyle: PartialLayerStyle;
  }): string | null {
    return this.layerFactory.getGenericLayerName({ sourceName, shapeNames, partialStyle });
  }

  getFeatureShapeByGeoJson(shapeGeoJson: Feature): ShapeName | null {
    const SHAPE_MAP: { [key in Geometry['type']]?: ShapeName } = {
      Point: 'marker',
      LineString: 'line',
      MultiLineString: 'line',
      Polygon: 'polygon',
      MultiPolygon: 'polygon',
    };

    const properties = shapeGeoJson.properties;
    if (properties?.shape && SHAPE_NAMES.includes(properties?.shape)) {
      return properties?.shape;
    }

    return SHAPE_MAP[shapeGeoJson.geometry.type] || null;
  }

  createMarkerFeature({
    parentFeature,
    coordinate,
    type,
    sourceName,
  }: {
    type: MarkerData['type'];
    coordinate: LngLatTuple;
    parentFeature: FeatureData;
    sourceName: FeatureSourceName;
  }) {
    return this.createFeature({
      sourceName,
      parent: parentFeature,
      shapeGeoJson: {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: coordinate,
        },
        properties: {
          [`${FEATURE_PROPERTY_PREFIX}shape`]: `${type}_marker`,
        },
      },
    });
  }

  updateMarkerFeaturePosition(markerFeatureData: FeatureData, coordinates: LngLatTuple) {
    markerFeatureData.updateGeoJsonGeometry({
      type: 'Point',
      coordinates,
    });
  }

  fireFeatureCreatedEvent(featureData: FeatureData) {
    if (includesWithType(featureData.shape, SHAPE_NAMES)) {
      const payload: GmDrawFeatureCreatedEvent = {
        name: `${GM_SYSTEM_PREFIX}:draw:feature_created`,
        level: 'system',
        actionType: 'draw',
        mode: featureData.shape,
        action: 'feature_created',
        featureData,
      };
      this.gm.events.fire(`${GM_SYSTEM_PREFIX}:draw`, payload);
    }
  }

  private resolveFeatureForHistory(
    featureIdOrFeatureData: FeatureData | FeatureId | GeomanFeatureRef,
  ): FeatureData | null {
    if (featureIdOrFeatureData instanceof FeatureData) {
      return featureIdOrFeatureData;
    }

    if (isGeomanFeatureRef(featureIdOrFeatureData)) {
      return this.get(featureIdOrFeatureData.sourceName, featureIdOrFeatureData.featureId);
    }

    for (const featureData of this.featureStore.values()) {
      if (featureData.id === featureIdOrFeatureData) {
        return featureData;
      }
    }

    return null;
  }
}

function isHistoryRecordableShape(shape: FeatureShape): boolean {
  return !HISTORY_IGNORED_SHAPES.has(shape);
}

function isHistorySuppressed(options?: FeatureMutationOptions): boolean {
  return options?.history === false;
}

function clearLastHistoryRecord(geoman: Geoman): void {
  geoman.history?.record([]);
}

function isGeomanFeatureRef(value: unknown): value is GeomanFeatureRef {
  return (
    typeof value === 'object' && value !== null && 'sourceName' in value && 'featureId' in value
  );
}

function shouldNotifySubscription(
  change: FeatureSubscriptionChange,
  options: GeomanFeatureSubscriptionOptions,
): boolean {
  if (!change.feature) {
    return true;
  }
  if (!options.includeTemporary && change.feature.temporary) {
    return false;
  }
  if (options.sourceNames && !options.sourceNames.includes(change.feature.sourceName)) {
    return false;
  }
  return true;
}

function getSubscribedSourceNames(
  features: Array<FeatureData>,
  options: GeomanFeatureSubscriptionOptions,
): Array<FeatureSourceName> {
  if (options.sourceNames) {
    return [...options.sourceNames];
  }
  return Array.from(new Set(features.map((feature) => feature.sourceName)));
}
