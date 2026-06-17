import type { FeatureData } from '@/core/features/feature-data.ts';
import type { Geoman } from '@/main.ts';
import type { LngLatTuple } from '@/types/map/index.ts';
import bearing from '@turf/bearing';
import distance from '@turf/distance';
import { point } from '@turf/helpers';
import type { LineString, MultiLineString } from 'geojson';
import { LineEndpointConnectionPreviewRenderer } from './lineEndpointConnectionPreviewRenderer.ts';
import {
  applyLineMergePlan,
  getLineMergePlan,
  type GeomanLineMergePlan,
  type GeomanLineMergePlanOptions,
  type GeomanLineMergePlanResult,
} from './lineMergePlanner.ts';
import { buildLineNetworkGraph } from './networkGraph.ts';
import { validateLineNetworkTopology } from './topologyValidators.ts';
import type {
  GeomanDistanceFormatOptions,
  GeomanLineEdgeHit,
  GeomanLineEndpointConnectionOptions,
  GeomanLineEndpointConnectionPreview,
  GeomanLineEndpointConnectionPreviewOptions,
  GeomanLineEndpointConnectionPreviewRenderOptions,
  GeomanLineEndpointConnectionResult,
  GeomanLineEndpointConnectionUpdate,
  GeomanLineEndpointHit,
  GeomanLineEndpointName,
  GeomanLineNetworkGraph,
  GeomanLineNetworkGraphOptions,
  GeomanLineTopologyValidationOptions,
  GeomanLineTopologyValidationResult,
  GeomanLineSplitAtPointOptions,
  GeomanLineSplitAtPointResult,
  GeomanLineSegmentContext,
  GeomanLineSegment,
  GeomanLineSegmentHit,
  GeomanLineSegmentInput,
  GeomanLineSegmentMetadata,
  GeomanLineSegmentRemovalOptions,
  GeomanLineSegmentRemovalResult,
  GeomanLineVertexHit,
  GeomanLineVertexInsertionOptions,
  GeomanLineVertexInsertionResult,
  GeomanNearestEdgeOptions,
  GeomanNearestLineEndpointOptions,
  GeomanNearestSegmentOptions,
  GeomanNearestVertexOptions,
  GeomanSegmentMeasurementFormatOptions,
  GeomanSegmentPointInput,
} from './types.ts';

export type GeomanGeometrySubsystemOptions = {
  geoman: Geoman;
};

type ProjectedPoint = { x: number; y: number };

export class GeomanGeometrySubsystem {
  private readonly geoman: Geoman;
  private readonly lineEndpointConnectionPreviewRenderer: LineEndpointConnectionPreviewRenderer;

  constructor(options: GeomanGeometrySubsystemOptions) {
    this.geoman = options.geoman;
    this.lineEndpointConnectionPreviewRenderer = new LineEndpointConnectionPreviewRenderer({
      getMap: () => this.geoman.mapAdapterInstance?.getMapInstance() as never,
    });
  }

  getLineSegments(feature: FeatureData): Array<GeomanLineSegment> {
    const geometry = feature.getGeoJson().geometry;

    if (geometry.type !== 'LineString') {
      return [];
    }

    const coordinates = (geometry as LineString).coordinates as Array<LngLatTuple>;
    const segments: Array<GeomanLineSegment> = [];

    for (let index = 0; index < coordinates.length - 1; index += 1) {
      const start = coordinates[index];
      const end = coordinates[index + 1];

      if (!start || !end) {
        continue;
      }

      segments.push({
        feature,
        segmentIndex: index,
        start,
        end,
        midpoint: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
        lengthMeters: this.measureSegment({ start, end }),
      });
    }

    return segments;
  }

  measureSegment(segment: GeomanLineSegmentInput): number {
    return distance(point(segment.start), point(segment.end), { units: 'kilometers' }) * 1000;
  }

  measureSegmentBearing(segment: GeomanLineSegmentInput): number {
    return bearing(point(segment.start), point(segment.end));
  }

  formatDistanceMeters(distanceMeters: number, options: GeomanDistanceFormatOptions = {}): string {
    const maximumFractionDigits = options.maximumFractionDigits ?? 2;

    if (Math.abs(distanceMeters) >= 1000) {
      return `${(distanceMeters / 1000).toFixed(maximumFractionDigits)} km`;
    }

    return `${distanceMeters.toFixed(maximumFractionDigits)} m`;
  }

  formatSegmentMeasurement(
    segment: GeomanLineSegmentInput,
    options: GeomanSegmentMeasurementFormatOptions = {},
  ): string {
    return this.formatDistanceMeters(this.measureSegment(segment), options);
  }

  getLineSegmentContext(
    feature: FeatureData,
    pointInput: GeomanSegmentPointInput,
    options: GeomanNearestSegmentOptions = {},
  ): GeomanLineSegmentContext | null {
    const segment = this.getNearestSegment(feature, pointInput, options);

    if (!segment) {
      return null;
    }

    return {
      segment,
      metadata: this.getLineSegmentMetadata(feature, segment.segmentIndex),
    };
  }

  getLineSegmentMetadata(
    feature: FeatureData,
    segmentIndex: number,
  ): GeomanLineSegmentMetadata | null {
    const segments = feature.getGeoJson().properties.segments;

    if (!Array.isArray(segments)) {
      return null;
    }

    const metadata = segments.find(
      (item): item is GeomanLineSegmentMetadata =>
        isLineSegmentMetadata(item) && item.index === segmentIndex,
    );

    return metadata ? (cloneRecord(metadata) as GeomanLineSegmentMetadata) : null;
  }

  getLineSegmentProperty(
    feature: FeatureData,
    segmentIndex: number,
    propertyName: string,
  ): unknown {
    return this.getLineSegmentMetadata(feature, segmentIndex)?.[propertyName];
  }

  updateLineSegmentProperty(
    feature: FeatureData,
    segmentIndex: number,
    propertyName: string,
    value: unknown,
  ): void {
    if (propertyName === 'index') {
      throw new Error('Segment metadata index cannot be updated.');
    }

    const segments = feature.getGeoJson().properties.segments;
    const nextSegments = (Array.isArray(segments) ? segments : [])
      .filter(isObjectRecord)
      .map((metadata) => ({ ...metadata }));
    let target = nextSegments.find(
      (metadata): metadata is GeomanLineSegmentMetadata =>
        isLineSegmentMetadata(metadata) && metadata.index === segmentIndex,
    );

    if (!target) {
      if (value === undefined) {
        return;
      }

      target = { index: segmentIndex };
      nextSegments.push(target);
    }

    if (value === undefined) {
      delete target[propertyName];
    } else {
      target[propertyName] = value;
    }

    feature.updateProperties({ segments: nextSegments });
  }

  getLineVertexInsertion(
    feature: FeatureData,
    options: GeomanLineVertexInsertionOptions,
  ): GeomanLineVertexInsertionResult | null {
    const geometry = feature.getGeoJson().geometry;

    if (geometry.type !== 'LineString') {
      return null;
    }

    const coordinates = (geometry as LineString).coordinates as Array<LngLatTuple>;

    if (
      !Number.isInteger(options.segmentIndex) ||
      options.segmentIndex < 0 ||
      options.segmentIndex >= coordinates.length - 1
    ) {
      return null;
    }

    const nextCoordinates = coordinates.map((coordinate) => [...coordinate] as LngLatTuple);
    nextCoordinates.splice(options.segmentIndex + 1, 0, [...options.coordinate] as LngLatTuple);

    return {
      geometry: {
        type: 'LineString',
        coordinates: nextCoordinates,
      },
      properties: {
        segments: getNextInsertedSegmentMetadata(
          feature.getGeoJson().properties.segments,
          options.segmentIndex,
          options.metadataMode ?? 'duplicate',
        ),
      },
    };
  }

  insertLineVertex(
    feature: FeatureData,
    options: GeomanLineVertexInsertionOptions,
  ): GeomanLineVertexInsertionResult | null {
    const insertion = this.getLineVertexInsertion(feature, options);

    if (!insertion) {
      return null;
    }

    const appliedInsertion = cloneLineMutationResult(insertion);

    this.withAtomicSourcesUpdate(() => {
      feature.updateGeometry(appliedInsertion.geometry);
      feature.updateProperties(appliedInsertion.properties);
    });

    return insertion;
  }

  getLineSplitAtPoint(
    feature: FeatureData,
    options: GeomanLineSplitAtPointOptions,
  ): GeomanLineSplitAtPointResult | null {
    if ('segmentIndex' in options) {
      return this.getLineVertexInsertion(feature, {
        segmentIndex: options.segmentIndex,
        coordinate: options.coordinate,
        metadataMode: options.metadataMode,
      });
    }

    const segment = this.getNearestSegment(feature, options.point, {
      maxPixelDistance: options.maxPixelDistance,
    });

    if (!segment) {
      return null;
    }

    return this.getLineVertexInsertion(feature, {
      segmentIndex: segment.segmentIndex,
      coordinate: this.unproject(
        closestProjectedPointOnSegment(
          normalizePoint(options.point),
          this.project(segment.start),
          this.project(segment.end),
        ),
      ),
      metadataMode: options.metadataMode,
    });
  }

  splitLineAtPoint(
    feature: FeatureData,
    options: GeomanLineSplitAtPointOptions,
  ): GeomanLineSplitAtPointResult | null {
    const split = this.getLineSplitAtPoint(feature, options);

    if (!split) {
      return null;
    }

    const appliedSplit = cloneLineMutationResult(split);

    this.withAtomicSourcesUpdate(() => {
      feature.updateGeometry(appliedSplit.geometry);
      feature.updateProperties(appliedSplit.properties);
    });

    return split;
  }

  getLineSegmentRemoval(
    feature: FeatureData,
    options: GeomanLineSegmentRemovalOptions,
  ): GeomanLineSegmentRemovalResult | null {
    const geometry = feature.getGeoJson().geometry;

    if (geometry.type !== 'LineString') {
      return null;
    }

    const coordinates = (geometry as LineString).coordinates as Array<LngLatTuple>;

    if (
      !Number.isInteger(options.segmentIndex) ||
      options.segmentIndex < 0 ||
      options.segmentIndex >= coordinates.length - 1 ||
      coordinates.length <= 2
    ) {
      return null;
    }

    const nextCoordinates = coordinates.map((coordinate) => [...coordinate] as LngLatTuple);
    nextCoordinates.splice(options.segmentIndex + 1, 1);

    return {
      geometry: {
        type: 'LineString',
        coordinates: nextCoordinates,
      },
      properties: {
        segments: getNextRemovedSegmentMetadata(
          feature.getGeoJson().properties.segments,
          options.segmentIndex,
        ),
      },
    };
  }

  removeLineSegment(
    feature: FeatureData,
    options: GeomanLineSegmentRemovalOptions,
  ): GeomanLineSegmentRemovalResult | null {
    const removal = this.getLineSegmentRemoval(feature, options);

    if (!removal) {
      return null;
    }

    const appliedRemoval = cloneLineMutationResult(removal);

    this.withAtomicSourcesUpdate(() => {
      feature.updateGeometry(appliedRemoval.geometry);
      feature.updateProperties(appliedRemoval.properties);
    });

    return removal;
  }

  getNearestVertex(
    feature: FeatureData,
    pointInput: GeomanSegmentPointInput,
    options: GeomanNearestVertexOptions = {},
  ): GeomanLineVertexHit | null {
    const geometry = feature.getGeoJson().geometry;

    if (geometry.type !== 'LineString') {
      return null;
    }

    const maxPixelDistance = options.maxPixelDistance ?? 12;
    const point = normalizePoint(pointInput);
    const coordinates = (geometry as LineString).coordinates as Array<LngLatTuple>;
    let nearest: GeomanLineVertexHit | null = null;

    for (let vertexIndex = 0; vertexIndex < coordinates.length; vertexIndex += 1) {
      const coordinate = coordinates[vertexIndex];

      if (!coordinate) {
        continue;
      }

      const projected = this.project(coordinate);
      const distancePixels = Math.hypot(point.x - projected.x, point.y - projected.y);

      if (!nearest || distancePixels < nearest.distancePixels) {
        nearest = {
          feature,
          vertexIndex,
          coordinate: [...coordinate] as LngLatTuple,
          distancePixels,
        };
      }
    }

    if (!nearest || nearest.distancePixels > maxPixelDistance) {
      return null;
    }

    return nearest;
  }

  getNearestEdge(
    feature: FeatureData,
    pointInput: GeomanSegmentPointInput,
    options: GeomanNearestEdgeOptions = {},
  ): GeomanLineEdgeHit | null {
    const segment = this.getNearestSegment(feature, pointInput, options);

    if (!segment) {
      return null;
    }

    return {
      ...segment,
      edgeIndex: segment.segmentIndex,
      start: [...segment.start] as LngLatTuple,
      end: [...segment.end] as LngLatTuple,
      midpoint: [...segment.midpoint] as LngLatTuple,
    };
  }

  getNearestSegment(
    feature: FeatureData,
    pointInput: GeomanSegmentPointInput,
    options: GeomanNearestSegmentOptions = {},
  ): GeomanLineSegmentHit | null {
    const maxPixelDistance = options.maxPixelDistance ?? 12;
    const point = normalizePoint(pointInput);
    let nearest: GeomanLineSegmentHit | null = null;

    for (const segment of this.getLineSegments(feature)) {
      const start = this.project(segment.start);
      const end = this.project(segment.end);
      const distancePixels = distanceToProjectedSegment(point, start, end);

      if (!nearest || distancePixels < nearest.distancePixels) {
        nearest = {
          ...segment,
          distancePixels,
        };
      }
    }

    if (!nearest || nearest.distancePixels > maxPixelDistance) {
      return null;
    }

    return nearest;
  }

  getLineNetworkGraph(
    features: Iterable<FeatureData>,
    options: GeomanLineNetworkGraphOptions = {},
  ): GeomanLineNetworkGraph {
    return buildLineNetworkGraph(features, options);
  }

  validateLineNetworkTopology(
    graph: GeomanLineNetworkGraph,
    options: GeomanLineTopologyValidationOptions = {},
  ): GeomanLineTopologyValidationResult {
    return validateLineNetworkTopology(graph, options);
  }

  getLineMergePlan(
    features: Iterable<FeatureData>,
    options: GeomanLineMergePlanOptions = {},
  ): GeomanLineMergePlanResult {
    return getLineMergePlan(features, options);
  }

  applyLineMergePlan(plan: GeomanLineMergePlan): void {
    this.withAtomicSourcesUpdate(() => {
      applyLineMergePlan(plan, {
        removeFeature: (feature) => this.geoman.features.delete(feature),
        restoreFeature: (feature) => {
          this.geoman.features.add(feature);
          feature.addGeoJson(feature.getGeoJson());
        },
      });
    });
  }

  getNearestLineEndpoint(
    features: Iterable<FeatureData>,
    pointInput: GeomanSegmentPointInput,
    options: GeomanNearestLineEndpointOptions = {},
  ): GeomanLineEndpointHit | null {
    const maxPixelDistance = options.maxPixelDistance ?? 12;
    const point = normalizePoint(pointInput);
    const endpointNames = new Set<GeomanLineEndpointName>(options.endpoints ?? ['start', 'end']);
    const excludedFeatures = new Set(options.excludeFeatures ?? []);
    let nearest: GeomanLineEndpointHit | null = null;

    if (endpointNames.size === 0) {
      return null;
    }

    for (const feature of features) {
      if (excludedFeatures.has(feature)) {
        continue;
      }

      for (const part of getLineCoordinateParts(feature)) {
        for (const endpoint of endpointNames) {
          const vertexIndex = getEndpointVertexIndex(part.coordinates, endpoint);

          if (vertexIndex === null) {
            continue;
          }

          const coordinate = part.coordinates[vertexIndex];

          if (!coordinate) {
            continue;
          }

          const projected = this.project(coordinate);
          const distancePixels = Math.hypot(point.x - projected.x, point.y - projected.y);

          if (!nearest || distancePixels < nearest.distancePixels) {
            nearest = {
              feature,
              featureId: feature.id,
              sourceName: feature.sourceName,
              partIndex: part.partIndex,
              endpoint,
              vertexIndex,
              coordinate: [...coordinate] as LngLatTuple,
              nodeKey: `${coordinate[0]},${coordinate[1]}`,
              distancePixels,
            };
          }
        }
      }
    }

    if (!nearest || nearest.distancePixels > maxPixelDistance) {
      return null;
    }

    return nearest;
  }

  getLineEndpointConnection(
    options: GeomanLineEndpointConnectionOptions,
  ): GeomanLineEndpointConnectionResult | null {
    const fromPart = getLineCoordinatePart(options.from.feature, options.from.partIndex ?? null);
    const toPart = getLineCoordinatePart(options.to.feature, options.to.partIndex ?? null);

    if (!fromPart || !toPart) {
      return null;
    }

    const fromIndex = getEndpointVertexIndex(fromPart.coordinates, options.from.endpoint);
    const toIndex = getEndpointVertexIndex(toPart.coordinates, options.to.endpoint);

    if (fromIndex === null || toIndex === null) {
      return null;
    }

    const connectionCoordinate = [...toPart.coordinates[toIndex]] as LngLatTuple;
    const nextFromCoordinates = fromPart.coordinates.map(
      (coordinate) => [...coordinate] as LngLatTuple,
    );
    nextFromCoordinates[fromIndex] = connectionCoordinate;

    return {
      updates: [
        {
          feature: options.from.feature,
          geometry: getUpdatedLineGeometry(
            options.from.feature,
            fromPart.partIndex,
            nextFromCoordinates,
          ),
          properties: {},
        },
      ],
    };
  }

  getLineEndpointConnectionPreview(
    options: GeomanLineEndpointConnectionPreviewOptions,
  ): GeomanLineEndpointConnectionPreview | null {
    const to = this.getNearestLineEndpoint(options.candidates, options.point, {
      maxPixelDistance: options.maxPixelDistance,
      endpoints: options.endpoints,
      excludeFeatures: options.excludeFeatures,
    });

    if (!to) {
      return null;
    }

    const connection = this.getLineEndpointConnection({
      from: options.from,
      to: { feature: to.feature, endpoint: to.endpoint, partIndex: to.partIndex },
    });

    if (!connection) {
      return null;
    }

    return {
      from: options.from,
      to,
      connection,
    };
  }

  renderLineEndpointConnectionPreview(
    preview: GeomanLineEndpointConnectionPreview | null,
    options: GeomanLineEndpointConnectionPreviewRenderOptions = {},
  ): void {
    this.lineEndpointConnectionPreviewRenderer.render(preview, options);
  }

  clearLineEndpointConnectionPreview(
    options: GeomanLineEndpointConnectionPreviewRenderOptions = {},
  ): void {
    this.lineEndpointConnectionPreviewRenderer.clear(options);
  }

  destroyLineEndpointConnectionPreview(
    options: GeomanLineEndpointConnectionPreviewRenderOptions = {},
  ): void {
    this.lineEndpointConnectionPreviewRenderer.destroy(options);
  }

  destroy(): void {
    this.lineEndpointConnectionPreviewRenderer.destroy();
  }

  connectLineEndpoints(
    options: GeomanLineEndpointConnectionOptions,
  ): GeomanLineEndpointConnectionResult | null {
    const connection = this.getLineEndpointConnection(options);

    if (!connection) {
      return null;
    }

    const appliedConnection = cloneLineEndpointConnectionResult(connection);

    this.withAtomicSourcesUpdate(() => {
      for (const update of appliedConnection.updates) {
        update.feature.updateGeometry(update.geometry);

        if (Object.keys(update.properties).length > 0) {
          update.feature.updateProperties(update.properties);
        }
      }
    });

    return connection;
  }

  private project(lngLat: LngLatTuple): ProjectedPoint {
    return normalizePoint(this.geoman.mapAdapter.project(lngLat));
  }

  private unproject(point: ProjectedPoint): LngLatTuple {
    return [...this.geoman.mapAdapter.unproject([point.x, point.y])] as LngLatTuple;
  }

  private withAtomicSourcesUpdate<T>(callback: () => T): T {
    const updateManager = this.geoman.features?.updateManager;

    if (updateManager?.withAtomicSourcesUpdate) {
      return updateManager.withAtomicSourcesUpdate(callback);
    }

    return callback();
  }
}

function normalizePoint(pointInput: GeomanSegmentPointInput): ProjectedPoint {
  if (Array.isArray(pointInput)) {
    return { x: pointInput[0], y: pointInput[1] };
  }

  return { x: pointInput.x, y: pointInput.y };
}

function isLineSegmentMetadata(item: unknown): item is GeomanLineSegmentMetadata {
  return (
    isObjectRecord(item) &&
    Number.isInteger((item as { index?: unknown }).index) &&
    Number((item as { index?: unknown }).index) >= 0
  );
}

function isObjectRecord(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

function getNextInsertedSegmentMetadata(
  segments: unknown,
  segmentIndex: number,
  metadataMode: 'duplicate' | 'first' | 'none',
): Array<Record<string, unknown>> {
  if (!Array.isArray(segments)) {
    return [];
  }

  const nextSegments: Array<Record<string, unknown>> = [];

  for (const item of segments) {
    if (!isObjectRecord(item)) {
      continue;
    }

    if (!isLineSegmentMetadata(item)) {
      nextSegments.push(cloneRecord(item));
      continue;
    }

    if (item.index < segmentIndex) {
      nextSegments.push(cloneRecord(item));
      continue;
    }

    if (item.index === segmentIndex) {
      if (metadataMode !== 'none') {
        nextSegments.push(cloneRecord(item));
      }

      if (metadataMode === 'duplicate') {
        nextSegments.push({ ...cloneRecord(item), index: item.index + 1 });
      }

      continue;
    }

    nextSegments.push({ ...cloneRecord(item), index: item.index + 1 });
  }

  return nextSegments;
}

function getNextRemovedSegmentMetadata(
  segments: unknown,
  segmentIndex: number,
): Array<Record<string, unknown>> {
  if (!Array.isArray(segments)) {
    return [];
  }

  const nextSegments: Array<Record<string, unknown>> = [];

  for (const item of segments) {
    if (!isObjectRecord(item)) {
      continue;
    }

    if (!isLineSegmentMetadata(item)) {
      nextSegments.push(cloneRecord(item));
      continue;
    }

    if (item.index < segmentIndex) {
      nextSegments.push(cloneRecord(item));
      continue;
    }

    if (item.index === segmentIndex) {
      continue;
    }

    nextSegments.push({ ...cloneRecord(item), index: item.index - 1 });
  }

  return nextSegments;
}

function cloneRecord(item: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(item) as Record<string, unknown>;
}

function cloneLineMutationResult(
  mutation: GeomanLineVertexInsertionResult,
): GeomanLineVertexInsertionResult {
  return structuredClone(mutation) as GeomanLineVertexInsertionResult;
}

function cloneLineEndpointConnectionResult(
  connection: GeomanLineEndpointConnectionResult,
): GeomanLineEndpointConnectionResult {
  return {
    updates: connection.updates.map((update) => ({
      feature: update.feature,
      geometry: {
        type: 'LineString',
        coordinates: update.geometry.coordinates.map(
          (coordinate) => [...coordinate] as LngLatTuple,
        ),
      },
      properties: cloneRecord(update.properties),
    })),
  };
}

type LineCoordinatePart = {
  partIndex: number | null;
  coordinates: Array<LngLatTuple>;
};

function getLineCoordinateParts(feature: FeatureData): Array<LineCoordinatePart> {
  const geometry = feature.getGeoJson().geometry;

  if (geometry.type === 'LineString') {
    const coordinates = (geometry as LineString).coordinates as Array<LngLatTuple>;
    return coordinates.length >= 2 ? [{ partIndex: null, coordinates }] : [];
  }

  if (geometry.type === 'MultiLineString') {
    return ((geometry as MultiLineString).coordinates as Array<Array<LngLatTuple>>)
      .map((coordinates, partIndex) => ({ partIndex, coordinates }))
      .filter((part) => part.coordinates.length >= 2);
  }

  return [];
}

function getLineCoordinatePart(
  feature: FeatureData,
  partIndex: number | null,
): LineCoordinatePart | null {
  const parts = getLineCoordinateParts(feature);

  if (partIndex === null) {
    return parts[0] ?? null;
  }

  return parts.find((part) => part.partIndex === partIndex) ?? null;
}

function getUpdatedLineGeometry(
  feature: FeatureData,
  partIndex: number | null,
  coordinates: Array<LngLatTuple>,
): GeomanLineEndpointConnectionUpdate['geometry'] {
  const geometry = feature.getGeoJson().geometry;

  if (geometry.type === 'MultiLineString' && partIndex !== null) {
    const nextCoordinates = (
      (geometry as MultiLineString).coordinates as Array<Array<LngLatTuple>>
    ).map((partCoordinates, index) =>
      index === partIndex
        ? coordinates.map((coordinate) => [...coordinate] as LngLatTuple)
        : partCoordinates.map((coordinate) => [...coordinate] as LngLatTuple),
    );

    return {
      type: 'MultiLineString',
      coordinates: nextCoordinates,
    };
  }

  return {
    type: 'LineString',
    coordinates: coordinates.map((coordinate) => [...coordinate] as LngLatTuple),
  };
}

function getEndpointVertexIndex(
  coordinates: Array<LngLatTuple>,
  endpoint: GeomanLineEndpointName,
): number | null {
  if (endpoint === 'start') {
    return 0;
  }

  if (endpoint === 'end') {
    return coordinates.length - 1;
  }

  return null;
}

function distanceToProjectedSegment(
  point: ProjectedPoint,
  start: ProjectedPoint,
  end: ProjectedPoint,
): number {
  const projected = closestProjectedPointOnSegment(point, start, end);

  return Math.hypot(point.x - projected.x, point.y - projected.y);
}

function closestProjectedPointOnSegment(
  point: ProjectedPoint,
  start: ProjectedPoint,
  end: ProjectedPoint,
): ProjectedPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return { ...start };
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
}
