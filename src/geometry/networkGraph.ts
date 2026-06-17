import type { FeatureData } from '@/core/features/feature-data.ts';
import type { LngLatTuple } from '@/types/map/index.ts';
import type { LineString, MultiLineString } from 'geojson';
import type {
  GeomanLineEndpointName,
  GeomanLineEndpointRef,
  GeomanLineNetworkEdge,
  GeomanLineNetworkGraph,
  GeomanLineNetworkGraphOptions,
  GeomanLineNetworkNode,
  GeomanNearbyLineEndpointPair,
} from './types.ts';

export function buildLineNetworkGraph(
  features: Iterable<FeatureData>,
  options: GeomanLineNetworkGraphOptions = {},
): GeomanLineNetworkGraph {
  const endpointTolerance = options.coordinateDistanceTolerance ?? options.endpointTolerance ?? 0;
  const edges: Array<GeomanLineNetworkEdge> = [];
  const endpoints: Array<GeomanLineEndpointRef> = [];

  for (const feature of features) {
    for (const part of getLineCoordinateParts(feature)) {
      const start = createEndpoint(
        feature,
        part.partIndex,
        'start',
        0,
        part.coordinates[0],
        endpointTolerance,
      );
      const end = createEndpoint(
        feature,
        part.partIndex,
        'end',
        part.coordinates.length - 1,
        part.coordinates[part.coordinates.length - 1],
        endpointTolerance,
      );

      endpoints.push(start, end);
      edges.push({
        feature,
        featureId: feature.id,
        sourceName: feature.sourceName,
        start,
        end,
      });
    }
  }

  const nodes = getEndpointNodes(endpoints, endpointTolerance);
  const danglingEndpoints = nodes.flatMap((node) =>
    node.endpoints.length === 1 ? [cloneEndpoint(node.endpoints[0])] : [],
  );

  return {
    nodes: nodes.map((node) => ({
      ...node,
      coordinate: [...node.coordinate] as LngLatTuple,
      endpoints: node.endpoints.map(cloneEndpoint),
    })),
    edges: edges.map((edge) => ({
      ...edge,
      start: cloneEndpoint(edge.start),
      end: cloneEndpoint(edge.end),
    })),
    danglingEndpoints,
    nearbyEndpointPairs: getNearbyEndpointPairs(endpoints, endpointTolerance),
  };
}

function getLineCoordinateParts(
  feature: FeatureData,
): Array<{ partIndex: number | null; coordinates: Array<LngLatTuple> }> {
  const geometry = feature.getGeoJson().geometry;

  if (geometry.type === 'LineString') {
    const coordinates = (geometry as LineString).coordinates as Array<LngLatTuple>;

    return coordinates.length >= 2 ? [{ partIndex: null, coordinates }] : [];
  }

  if (geometry.type === 'MultiLineString') {
    const coordinates = (geometry as MultiLineString).coordinates as Array<Array<LngLatTuple>>;

    return coordinates.flatMap((partCoordinates, partIndex) =>
      partCoordinates.length >= 2 ? [{ partIndex, coordinates: partCoordinates }] : [],
    );
  }

  return [];
}

function createEndpoint(
  feature: FeatureData,
  partIndex: number | null,
  endpoint: GeomanLineEndpointName,
  vertexIndex: number,
  coordinate: LngLatTuple | undefined,
  endpointTolerance: number,
): GeomanLineEndpointRef {
  if (!coordinate) {
    throw new Error('Line endpoint coordinate is missing.');
  }

  const clonedCoordinate = [...coordinate] as LngLatTuple;

  return {
    feature,
    featureId: feature.id,
    sourceName: feature.sourceName,
    partIndex,
    endpoint,
    vertexIndex,
    coordinate: clonedCoordinate,
    nodeKey: getNodeKey(clonedCoordinate, endpointTolerance),
  };
}

function getNodeKey(coordinate: LngLatTuple, endpointTolerance: number): string {
  if (endpointTolerance <= 0) {
    return `${coordinate[0]},${coordinate[1]}`;
  }

  return `${coordinate[0]},${coordinate[1]}`;
}

function getEndpointNodes(
  endpoints: Array<GeomanLineEndpointRef>,
  endpointTolerance: number,
): Array<GeomanLineNetworkNode> {
  if (endpointTolerance <= 0) {
    return getExactEndpointNodes(endpoints);
  }

  const nodeIndexes = new Array<number>(endpoints.length).fill(-1);
  const nodes: Array<GeomanLineNetworkNode> = [];

  for (let index = 0; index < endpoints.length; index += 1) {
    if (nodeIndexes[index] !== -1) {
      continue;
    }

    const endpointsInNode: Array<GeomanLineEndpointRef> = [];
    const queue = [index];
    nodeIndexes[index] = nodes.length;

    while (queue.length > 0) {
      const endpointIndex = queue.shift();

      if (endpointIndex === undefined) {
        continue;
      }

      const endpoint = endpoints[endpointIndex];

      if (!endpoint) {
        continue;
      }

      endpointsInNode.push(endpoint);

      for (let candidateIndex = 0; candidateIndex < endpoints.length; candidateIndex += 1) {
        if (nodeIndexes[candidateIndex] !== -1) {
          continue;
        }

        const candidate = endpoints[candidateIndex];

        if (
          candidate &&
          getCoordinateDistance(endpoint.coordinate, candidate.coordinate) <= endpointTolerance
        ) {
          nodeIndexes[candidateIndex] = nodes.length;
          queue.push(candidateIndex);
        }
      }
    }

    nodes.push(createNode(endpointsInNode, getTolerantNodeKey(endpointsInNode)));
  }

  return nodes;
}

function getExactEndpointNodes(
  endpoints: Array<GeomanLineEndpointRef>,
): Array<GeomanLineNetworkNode> {
  const nodeMap = new Map<string, Array<GeomanLineEndpointRef>>();

  for (const endpoint of endpoints) {
    const endpointsInNode = nodeMap.get(endpoint.nodeKey);

    if (endpointsInNode) {
      endpointsInNode.push(endpoint);
      continue;
    }

    nodeMap.set(endpoint.nodeKey, [endpoint]);
  }

  return Array.from(nodeMap.entries()).map(([nodeKey, endpointsInNode]) =>
    createNode(endpointsInNode, nodeKey),
  );
}

function createNode(
  endpoints: Array<GeomanLineEndpointRef>,
  fallbackKey: string,
): GeomanLineNetworkNode {
  const firstEndpoint = endpoints[0];
  const coordinate = firstEndpoint?.coordinate ?? [0, 0];

  return {
    key: fallbackKey,
    coordinate: [...coordinate] as LngLatTuple,
    endpoints,
  };
}

function getNearbyEndpointPairs(
  endpoints: Array<GeomanLineEndpointRef>,
  endpointTolerance: number,
): Array<GeomanNearbyLineEndpointPair> {
  if (endpointTolerance <= 0) {
    return [];
  }

  const pairs: Array<GeomanNearbyLineEndpointPair> = [];

  for (let i = 0; i < endpoints.length; i += 1) {
    for (let j = i + 1; j < endpoints.length; j += 1) {
      const a = endpoints[i];
      const b = endpoints[j];

      if (!a || !b || isSameGraphEdge(a, b)) {
        continue;
      }

      const distance = getCoordinateDistance(a.coordinate, b.coordinate);

      if (distance > 0 && distance <= endpointTolerance) {
        pairs.push({
          a: cloneEndpoint(a),
          b: cloneEndpoint(b),
          distance,
        });
      }
    }
  }

  return pairs;
}

function isSameGraphEdge(a: GeomanLineEndpointRef, b: GeomanLineEndpointRef): boolean {
  return (
    a.sourceName === b.sourceName && a.featureId === b.featureId && a.partIndex === b.partIndex
  );
}

function getCoordinateDistance(a: LngLatTuple, b: LngLatTuple): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function getTolerantNodeKey(endpoints: Array<GeomanLineEndpointRef>): string {
  const coordinates = new Map<string, LngLatTuple>();

  for (const endpoint of endpoints) {
    coordinates.set(endpoint.nodeKey, endpoint.coordinate);
  }

  const coordinateKeys = Array.from(coordinates.entries())
    .sort(([, a], [, b]) => a[0] - b[0] || a[1] - b[1])
    .map(([nodeKey]) => nodeKey);

  return `tolerance:${coordinateKeys.join('|')}`;
}

function cloneEndpoint(endpoint: GeomanLineEndpointRef): GeomanLineEndpointRef {
  return {
    ...endpoint,
    coordinate: [...endpoint.coordinate] as LngLatTuple,
  };
}
