import type { FeatureData } from '@/core/features/feature-data.ts';
import type { FeatureSourceName } from '@/types/features.ts';
import type { LngLatTuple, ScreenPoint } from '@/types/map/index.ts';

export type GeomanLineSegmentInput = {
  start: LngLatTuple;
  end: LngLatTuple;
};

export type GeomanDistanceFormatOptions = {
  maximumFractionDigits?: number;
};

export type GeomanSegmentMeasurementFormatOptions = GeomanDistanceFormatOptions;

export type GeomanLineVertexInsertionMetadataMode = 'duplicate' | 'first' | 'none';

export type GeomanLineVertexInsertionOptions = {
  segmentIndex: number;
  coordinate: LngLatTuple;
  metadataMode?: GeomanLineVertexInsertionMetadataMode;
};

export type GeomanLineVertexInsertionResult = {
  geometry: {
    type: 'LineString';
    coordinates: Array<LngLatTuple>;
  };
  properties: {
    segments: Array<Record<string, unknown>>;
  };
};

export type GeomanLineSplitAtPointOptions =
  | {
      segmentIndex: number;
      coordinate: LngLatTuple;
      metadataMode?: GeomanLineVertexInsertionMetadataMode;
    }
  | {
      point: GeomanSegmentPointInput;
      maxPixelDistance?: number;
      metadataMode?: GeomanLineVertexInsertionMetadataMode;
    };

export type GeomanLineSplitAtPointResult = GeomanLineVertexInsertionResult;

export type GeomanLineSegmentRemovalOptions = {
  segmentIndex: number;
};

export type GeomanLineSegmentRemovalResult = GeomanLineVertexInsertionResult;

export type GeomanLineEndpointName = 'start' | 'end';

export type GeomanLineEndpointRef = {
  feature: FeatureData;
  featureId: string | number;
  sourceName: string;
  partIndex: number | null;
  endpoint: GeomanLineEndpointName;
  vertexIndex: number;
  coordinate: LngLatTuple;
  nodeKey: string;
};

export type GeomanLineNetworkEdge = {
  feature: FeatureData;
  featureId: string | number;
  sourceName: string;
  start: GeomanLineEndpointRef;
  end: GeomanLineEndpointRef;
};

export type GeomanLineNetworkNode = {
  key: string;
  coordinate: LngLatTuple;
  endpoints: Array<GeomanLineEndpointRef>;
};

export type GeomanNearbyLineEndpointPair = {
  a: GeomanLineEndpointRef;
  b: GeomanLineEndpointRef;
  distance: number;
};

export type GeomanLineNetworkGraphOptions = {
  coordinateDistanceTolerance?: number;
  endpointTolerance?: number;
};

export type GeomanLineNetworkGraph = {
  nodes: Array<GeomanLineNetworkNode>;
  edges: Array<GeomanLineNetworkEdge>;
  danglingEndpoints: Array<GeomanLineEndpointRef>;
  nearbyEndpointPairs: Array<GeomanNearbyLineEndpointPair>;
};

export type GeomanLineEndpointConnectionEndpoint = {
  feature: FeatureData;
  endpoint: GeomanLineEndpointName;
  partIndex?: number | null;
};

export type GeomanLineEndpointConnectionOptions = {
  from: GeomanLineEndpointConnectionEndpoint;
  to: GeomanLineEndpointConnectionEndpoint;
};

export type GeomanLineEndpointConnectionUpdate = {
  feature: FeatureData;
  geometry:
    | {
        type: 'LineString';
        coordinates: Array<LngLatTuple>;
      }
    | {
        type: 'MultiLineString';
        coordinates: Array<Array<LngLatTuple>>;
      };
  properties: Record<string, unknown>;
};

export type GeomanLineEndpointConnectionResult = {
  updates: Array<GeomanLineEndpointConnectionUpdate>;
};

export type GeomanNearestLineEndpointOptions = {
  maxPixelDistance?: number;
  endpoints?: Array<GeomanLineEndpointName>;
  excludeFeatures?: Iterable<FeatureData>;
};

export type GeomanEndpointSnappingConfigureOptions = {
  enabled: boolean;
  maxPixelDistance?: number;
  endpoints?: Array<GeomanLineEndpointName>;
  excludeFeatures?: Iterable<FeatureData>;
  sourceNames?: Array<FeatureSourceName>;
};

export type GeomanEndpointSnappingState = GeomanEndpointSnappingConfigureOptions & {
  available: boolean;
  applied: boolean;
};

export type GeomanEndpointSnappingFacade = {
  configure(options: GeomanEndpointSnappingConfigureOptions): boolean;
  disable(): boolean;
  getState(): GeomanEndpointSnappingState;
};

export type GeomanLineEndpointHit = GeomanLineEndpointRef & {
  distancePixels: number;
};

export type GeomanLineEndpointConnectionPreviewOptions = {
  from: GeomanLineEndpointConnectionEndpoint;
  candidates: Iterable<FeatureData>;
  point: GeomanSegmentPointInput;
  maxPixelDistance?: number;
  endpoints?: Array<GeomanLineEndpointName>;
  excludeFeatures?: Iterable<FeatureData>;
};

export type GeomanLineEndpointConnectionPreview = {
  from: GeomanLineEndpointConnectionEndpoint;
  to: GeomanLineEndpointHit;
  connection: GeomanLineEndpointConnectionResult;
};

export type GeomanLineEndpointConnectionPreviewRenderIds = {
  sourceId: string;
  layerId: string;
};

export type GeomanLineEndpointConnectionPreviewRenderStyle = {
  color?: string;
  width?: number;
  opacity?: number;
  dasharray?: Array<number>;
};

export type GeomanLineEndpointConnectionPreviewRenderOptions = {
  ids?: Partial<GeomanLineEndpointConnectionPreviewRenderIds>;
  style?: GeomanLineEndpointConnectionPreviewRenderStyle;
  beforeId?: string;
};

export type GeomanLineTopologyValidationSeverity = 'info' | 'warning' | 'error';

export type GeomanLineTopologyValidationIssueType =
  | 'dangling-endpoint'
  | 'duplicate-endpoint-group'
  | 'disconnected-component'
  | 'degree-threshold';

export type GeomanLineTopologyValidationComponent = {
  nodeKeys: Array<string>;
  edgeFeatureIds: Array<string | number>;
};

export type GeomanLineTopologyValidationIssue = {
  ruleId: string;
  type: GeomanLineTopologyValidationIssueType;
  severity: GeomanLineTopologyValidationSeverity;
  message: string;
  endpoint?: GeomanLineEndpointRef;
  endpoints?: Array<GeomanLineEndpointRef>;
  node?: GeomanLineNetworkNode;
  component?: GeomanLineTopologyValidationComponent;
  degree?: number;
};

export type GeomanLineTopologyValidationMessageContext = {
  graph: GeomanLineNetworkGraph;
  endpoint?: GeomanLineEndpointRef;
  endpoints?: Array<GeomanLineEndpointRef>;
  node?: GeomanLineNetworkNode;
  component?: GeomanLineTopologyValidationComponent;
  degree?: number;
};

export type GeomanLineTopologyValidationMessage =
  | string
  | ((context: GeomanLineTopologyValidationMessageContext) => string);

export type GeomanLineTopologyValidationRuleOptions = {
  ruleId?: string;
  severity?: GeomanLineTopologyValidationSeverity;
  message?: GeomanLineTopologyValidationMessage;
};

export type GeomanLineDanglingEndpointValidationOptions = GeomanLineTopologyValidationRuleOptions;

export type GeomanLineDuplicateEndpointGroupValidationOptions =
  GeomanLineTopologyValidationRuleOptions & {
    minEndpoints?: number;
  };

export type GeomanLineDisconnectedComponentValidationOptions =
  GeomanLineTopologyValidationRuleOptions;

export type GeomanLineDegreeThresholdValidationOptions = GeomanLineTopologyValidationRuleOptions & {
  minDegree?: number;
  maxDegree?: number;
};

export type GeomanLineTopologyValidationOptions = {
  danglingEndpoints?: boolean | GeomanLineDanglingEndpointValidationOptions;
  duplicateEndpointGroups?: boolean | GeomanLineDuplicateEndpointGroupValidationOptions;
  disconnectedComponents?: boolean | GeomanLineDisconnectedComponentValidationOptions;
  degreeThresholds?: boolean | GeomanLineDegreeThresholdValidationOptions;
};

export type GeomanLineTopologyValidationResult = {
  issues: Array<GeomanLineTopologyValidationIssue>;
};

export type GeomanLineSegment = GeomanLineSegmentInput & {
  feature: FeatureData;
  segmentIndex: number;
  midpoint: LngLatTuple;
  lengthMeters: number;
};

export type GeomanNearestSegmentOptions = {
  maxPixelDistance?: number;
};

export type GeomanLineSegmentHit = GeomanLineSegment & {
  distancePixels: number;
};

export type GeomanNearestVertexOptions = {
  maxPixelDistance?: number;
};

export type GeomanLineVertexHit = {
  feature: FeatureData;
  vertexIndex: number;
  coordinate: LngLatTuple;
  distancePixels: number;
};

export type GeomanNearestEdgeOptions = GeomanNearestSegmentOptions;

export type GeomanLineEdgeHit = GeomanLineSegmentHit & {
  edgeIndex: number;
};

export type GeomanLineSegmentMetadata = Record<string, unknown> & {
  index: number;
};

export type GeomanLineSegmentContext = {
  segment: GeomanLineSegmentHit;
  metadata: GeomanLineSegmentMetadata | null;
};

export type GeomanSegmentPointInput = ScreenPoint | { x: number; y: number };
