import { buildLineNetworkGraph } from '@/geometry/networkGraph.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { LngLatTuple } from '@/types/map/index.ts';
import { describe, expect, test, vi } from 'vitest';

const createFeature = (
  id: string,
  coordinates: Array<LngLatTuple>,
  properties: Record<string, unknown> = { shape: 'line' },
) =>
  ({
    id,
    sourceName: 'gm_main',
    getGeoJson: vi.fn(() => ({
      type: 'Feature',
      id,
      properties,
      geometry: {
        type: 'LineString',
        coordinates,
      },
    })),
  }) as unknown as FeatureData;

const createMultiLineFeature = (
  id: string,
  coordinates: Array<Array<LngLatTuple>>,
  properties: Record<string, unknown> = { shape: 'line' },
) =>
  ({
    id,
    sourceName: 'gm_main',
    getGeoJson: vi.fn(() => ({
      type: 'Feature',
      id,
      properties,
      geometry: {
        type: 'MultiLineString',
        coordinates,
      },
    })),
  }) as unknown as FeatureData;

describe('buildLineNetworkGraph', () => {
  test('extracts line network nodes, edges, and dangling endpoints', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1, 0],
      [2, 0],
    ]);

    const graph = buildLineNetworkGraph([lineA, lineB], { endpointTolerance: 0 });

    expect(graph.edges).toHaveLength(2);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.danglingEndpoints).toEqual([
      {
        feature: lineA,
        featureId: 'line-a',
        sourceName: 'gm_main',
        partIndex: null,
        endpoint: 'start',
        vertexIndex: 0,
        coordinate: [0, 0],
        nodeKey: '0,0',
      },
      {
        feature: lineB,
        featureId: 'line-b',
        sourceName: 'gm_main',
        partIndex: null,
        endpoint: 'end',
        vertexIndex: 1,
        coordinate: [2, 0],
        nodeKey: '2,0',
      },
    ]);
  });

  test('matches endpoints by tolerance and reports nearby endpoint pairs', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1.0004, 0],
      [2, 0],
    ]);

    const graph = buildLineNetworkGraph([lineA, lineB], { endpointTolerance: 0.001 });

    expect(graph.nodes).toHaveLength(3);
    expect(graph.nearbyEndpointPairs).toEqual([
      {
        a: expect.objectContaining({ featureId: 'line-a', endpoint: 'end' }),
        b: expect.objectContaining({ featureId: 'line-b', endpoint: 'start' }),
        distance: expect.any(Number),
      },
    ]);
    expect(graph.nearbyEndpointPairs[0]?.distance).toBeCloseTo(0.0004, 6);
  });

  test('groups endpoints by actual tolerance distance across coordinate bucket boundaries', () => {
    const lineA = createFeature('line-a', [
      [-1, 0],
      [0.0009, 0],
    ]);
    const lineB = createFeature('line-b', [
      [0.0011, 0],
      [2, 0],
    ]);

    const graph = buildLineNetworkGraph([lineA, lineB], { endpointTolerance: 0.001 });

    expect(graph.nodes).toHaveLength(3);
    expect(
      graph.nodes.some(
        (node) =>
          node.endpoints.some(
            (endpoint) => endpoint.featureId === 'line-a' && endpoint.endpoint === 'end',
          ) &&
          node.endpoints.some(
            (endpoint) => endpoint.featureId === 'line-b' && endpoint.endpoint === 'start',
          ),
      ),
    ).toBe(true);
    expect(graph.nearbyEndpointPairs[0]?.distance).toBeCloseTo(0.0002, 6);
  });

  test('does not group endpoints outside diagonal tolerance', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [0.0008, 0.0008],
    ]);
    const lineB = createFeature('line-b', [
      [0, 0],
      [2, 2],
    ]);

    const graph = buildLineNetworkGraph([lineA, lineB], { endpointTolerance: 0.001 });

    expect(
      graph.nodes.some(
        (node) =>
          node.endpoints.some(
            (endpoint) => endpoint.featureId === 'line-a' && endpoint.endpoint === 'end',
          ) &&
          node.endpoints.some(
            (endpoint) => endpoint.featureId === 'line-b' && endpoint.endpoint === 'start',
          ),
      ),
    ).toBe(false);
  });

  test('groups endpoint tolerance transitively as one connected component', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [0.0004, 0],
    ]);
    const lineB = createFeature('line-b', [
      [0.0012, 0],
      [2, 0],
    ]);
    const lineC = createFeature('line-c', [
      [0.002, 0],
      [3, 0],
    ]);

    const graph = buildLineNetworkGraph([lineA, lineB, lineC], { endpointTolerance: 0.001 });

    const connectedNode = graph.nodes.find((node) =>
      node.endpoints.some(
        (endpoint) => endpoint.featureId === 'line-a' && endpoint.endpoint === 'end',
      ),
    );

    expect(connectedNode?.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ featureId: 'line-a', endpoint: 'end' }),
        expect.objectContaining({ featureId: 'line-b', endpoint: 'start' }),
        expect.objectContaining({ featureId: 'line-c', endpoint: 'start' }),
      ]),
    );
    expect(
      graph.nearbyEndpointPairs.some((pair) => {
        const endpoints = [pair.a, pair.b];

        return (
          endpoints.some(
            (endpoint) => endpoint.featureId === 'line-a' && endpoint.endpoint === 'end',
          ) &&
          endpoints.some(
            (endpoint) => endpoint.featureId === 'line-c' && endpoint.endpoint === 'start',
          )
        );
      }),
    ).toBe(false);
  });

  test('uses stable tolerant node keys independent of input feature order', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1.0004, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1, 0],
      [2, 0],
    ]);

    const graphA = buildLineNetworkGraph([lineA, lineB], { endpointTolerance: 0.001 });
    const graphB = buildLineNetworkGraph([lineB, lineA], { endpointTolerance: 0.001 });

    const getJoinedNodeKey = (graph: ReturnType<typeof buildLineNetworkGraph>) =>
      graph.nodes.find(
        (node) =>
          node.endpoints.some(
            (endpoint) => endpoint.featureId === 'line-a' && endpoint.endpoint === 'end',
          ) &&
          node.endpoints.some(
            (endpoint) => endpoint.featureId === 'line-b' && endpoint.endpoint === 'start',
          ),
      )?.key;

    expect(getJoinedNodeKey(graphA)).toBe('tolerance:1,0|1.0004,0');
    expect(getJoinedNodeKey(graphB)).toBe('tolerance:1,0|1.0004,0');
  });

  test('accepts coordinateDistanceTolerance as an alias for endpointTolerance', () => {
    const lineA = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createFeature('line-b', [
      [1.0004, 0],
      [2, 0],
    ]);

    const graph = buildLineNetworkGraph([lineA, lineB], {
      coordinateDistanceTolerance: 0.001,
    });

    expect(graph.nodes).toHaveLength(3);
    expect(
      graph.nodes.some(
        (node) =>
          node.endpoints.some(
            (endpoint) => endpoint.featureId === 'line-a' && endpoint.endpoint === 'end',
          ) &&
          node.endpoints.some(
            (endpoint) => endpoint.featureId === 'line-b' && endpoint.endpoint === 'start',
          ),
      ),
    ).toBe(true);
  });

  test('builds independent edges for each MultiLineString part', () => {
    const multiLine = createMultiLineFeature('multi-line-a', [
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [
        [10, 0],
        [11, 0],
      ],
    ]);

    const graph = buildLineNetworkGraph([multiLine], { endpointTolerance: 0 });

    expect(graph.edges).toHaveLength(2);
    expect(graph.edges[0]?.start).toEqual(
      expect.objectContaining({
        featureId: 'multi-line-a',
        partIndex: 0,
        endpoint: 'start',
        vertexIndex: 0,
        coordinate: [0, 0],
      }),
    );
    expect(graph.edges[0]?.end).toEqual(
      expect.objectContaining({
        featureId: 'multi-line-a',
        partIndex: 0,
        endpoint: 'end',
        vertexIndex: 2,
        coordinate: [2, 0],
      }),
    );
    expect(graph.edges[1]?.start).toEqual(
      expect.objectContaining({
        featureId: 'multi-line-a',
        partIndex: 1,
        endpoint: 'start',
        vertexIndex: 0,
        coordinate: [10, 0],
      }),
    );
    expect(graph.edges[1]?.end).toEqual(
      expect.objectContaining({
        featureId: 'multi-line-a',
        partIndex: 1,
        endpoint: 'end',
        vertexIndex: 1,
        coordinate: [11, 0],
      }),
    );
    expect(graph.danglingEndpoints).toEqual([
      expect.objectContaining({ partIndex: 0, endpoint: 'start', vertexIndex: 0 }),
      expect.objectContaining({ partIndex: 0, endpoint: 'end', vertexIndex: 2 }),
      expect.objectContaining({ partIndex: 1, endpoint: 'start', vertexIndex: 0 }),
      expect.objectContaining({ partIndex: 1, endpoint: 'end', vertexIndex: 1 }),
    ]);
  });

  test('reports nearby endpoint pairs between different MultiLineString parts of the same feature', () => {
    const multiLine = createMultiLineFeature('multi-line-a', [
      [
        [0, 0],
        [1, 0],
      ],
      [
        [1.0004, 0],
        [2, 0],
      ],
    ]);

    const graph = buildLineNetworkGraph([multiLine], { endpointTolerance: 0.001 });

    expect(graph.nearbyEndpointPairs).toEqual([
      {
        a: expect.objectContaining({
          featureId: 'multi-line-a',
          partIndex: 0,
          endpoint: 'end',
        }),
        b: expect.objectContaining({
          featureId: 'multi-line-a',
          partIndex: 1,
          endpoint: 'start',
        }),
        distance: expect.any(Number),
      },
    ]);
    expect(graph.nearbyEndpointPairs[0]?.distance).toBeCloseTo(0.0004, 6);
    expect(
      graph.nearbyEndpointPairs.some(
        (pair) => pair.a.featureId === pair.b.featureId && pair.a.partIndex === pair.b.partIndex,
      ),
    ).toBe(false);
  });

  test('groups connected LineString and MultiLineString endpoints in the same node', () => {
    const line = createFeature('line-a', [
      [0, 0],
      [1, 0],
    ]);
    const multiLine = createMultiLineFeature('multi-line-a', [
      [
        [1, 0],
        [2, 0],
      ],
      [
        [10, 0],
        [11, 0],
      ],
    ]);

    const graph = buildLineNetworkGraph([line, multiLine], { endpointTolerance: 0 });
    const connectedNode = graph.nodes.find((node) => node.key === '1,0');

    expect(connectedNode?.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          featureId: 'line-a',
          partIndex: null,
          endpoint: 'end',
        }),
        expect.objectContaining({
          featureId: 'multi-line-a',
          partIndex: 0,
          endpoint: 'start',
        }),
      ]),
    );
  });

  test('ignores unsupported geometries when building a line network graph', () => {
    const pointFeature = {
      id: 'point-1',
      sourceName: 'gm_main',
      getGeoJson: vi.fn(() => ({
        type: 'Feature',
        id: 'point-1',
        properties: { shape: 'marker' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      })),
    } as unknown as FeatureData;

    expect(buildLineNetworkGraph([pointFeature], { endpointTolerance: 0 })).toEqual({
      nodes: [],
      edges: [],
      danglingEndpoints: [],
      nearbyEndpointPairs: [],
    });
  });
});
