import {
  getDanglingEndpointIssues,
  getDegreeThresholdIssues,
  getDisconnectedComponentIssues,
  getDuplicateEndpointGroupIssues,
  validateLineNetworkTopology,
} from '@/geometry/topologyValidators.ts';
import type {
  GeomanLineEndpointRef,
  GeomanLineNetworkGraph,
  GeomanLineNetworkNode,
} from '@/geometry/types.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { LngLatTuple } from '@/types/map/index.ts';
import { describe, expect, test, vi } from 'vitest';

const createFeature = (id: string) =>
  ({
    id,
    sourceName: 'gm_main',
    getGeoJson: vi.fn(),
  }) as unknown as FeatureData;

const createEndpoint = (
  featureId: string,
  endpoint: 'start' | 'end',
  coordinate: LngLatTuple,
  partIndex: number | null = null,
): GeomanLineEndpointRef => ({
  feature: createFeature(featureId),
  featureId,
  sourceName: 'gm_main',
  partIndex,
  endpoint,
  vertexIndex: endpoint === 'start' ? 0 : 1,
  coordinate,
  nodeKey: `${coordinate[0]},${coordinate[1]}`,
});

const createNode = (
  key: string,
  endpoints: Array<GeomanLineEndpointRef>,
): GeomanLineNetworkNode => ({
  key,
  coordinate: endpoints[0]?.coordinate ?? [0, 0],
  endpoints,
});

describe('line topology validators', () => {
  test('reports dangling endpoint issues with consumer messages', () => {
    const dangling = createEndpoint('line-a', 'start', [0, 0]);
    const graph: GeomanLineNetworkGraph = {
      nodes: [createNode('0,0', [dangling])],
      edges: [],
      danglingEndpoints: [dangling],
      nearbyEndpointPairs: [],
    };

    const issues = getDanglingEndpointIssues(graph, {
      severity: 'error',
      message: ({ endpoint }) => `Open endpoint: ${endpoint?.featureId}`,
    });

    expect(issues).toEqual([
      expect.objectContaining({
        ruleId: 'dangling-endpoint',
        type: 'dangling-endpoint',
        severity: 'error',
        message: 'Open endpoint: line-a',
        endpoint: expect.objectContaining({
          featureId: 'line-a',
          partIndex: null,
          endpoint: 'start',
          coordinate: [0, 0],
        }),
      }),
    ]);
    expect(issues[0]?.endpoint).not.toBe(dangling);
    expect(issues[0]?.endpoint?.coordinate).toEqual(dangling.coordinate);
    expect(issues[0]?.endpoint?.coordinate).not.toBe(dangling.coordinate);
  });

  test('reports duplicate endpoint groups by configurable endpoint count', () => {
    const endpointA = createEndpoint('line-a', 'end', [1, 0]);
    const endpointB = createEndpoint('line-b', 'start', [1, 0]);
    const graph: GeomanLineNetworkGraph = {
      nodes: [createNode('1,0', [endpointA, endpointB])],
      edges: [],
      danglingEndpoints: [],
      nearbyEndpointPairs: [],
    };

    expect(getDuplicateEndpointGroupIssues(graph)).toEqual([
      expect.objectContaining({
        ruleId: 'duplicate-endpoint-group',
        type: 'duplicate-endpoint-group',
        node: expect.objectContaining({ key: '1,0' }),
        endpoints: [endpointA, endpointB],
      }),
    ]);
    expect(getDuplicateEndpointGroupIssues(graph, { minEndpoints: 3 })).toEqual([]);
  });

  test('reports disconnected graph components beyond the primary component', () => {
    const aStart = createEndpoint('line-a', 'start', [0, 0]);
    const aEnd = createEndpoint('line-a', 'end', [1, 0]);
    const bStart = createEndpoint('line-b', 'start', [10, 0]);
    const bEnd = createEndpoint('line-b', 'end', [11, 0]);
    const graph: GeomanLineNetworkGraph = {
      nodes: [
        createNode('0,0', [aStart]),
        createNode('1,0', [aEnd]),
        createNode('10,0', [bStart]),
        createNode('11,0', [bEnd]),
      ],
      edges: [
        {
          feature: aStart.feature,
          featureId: 'line-a',
          sourceName: 'gm_main',
          start: aStart,
          end: aEnd,
        },
        {
          feature: bStart.feature,
          featureId: 'line-b',
          sourceName: 'gm_main',
          start: bStart,
          end: bEnd,
        },
      ],
      danglingEndpoints: [aStart, aEnd, bStart, bEnd],
      nearbyEndpointPairs: [],
    };

    const issues = getDisconnectedComponentIssues(graph);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: 'disconnected-component',
      type: 'disconnected-component',
      component: {
        nodeKeys: ['10,0', '11,0'],
        edgeFeatureIds: ['line-b'],
      },
    });
  });

  test('keeps disconnected parts from the same feature as distinct endpoint identities', () => {
    const firstPartStart = createEndpoint('line-a', 'start', [0, 0], 0);
    const firstPartEnd = createEndpoint('line-a', 'end', [1, 0], 0);
    const secondPartStart = createEndpoint('line-a', 'start', [10, 0], 1);
    const secondPartEnd = createEndpoint('line-a', 'end', [11, 0], 1);
    const graph: GeomanLineNetworkGraph = {
      nodes: [
        createNode('0,0', [firstPartStart]),
        createNode('1,0', [firstPartEnd]),
        createNode('10,0', [secondPartStart]),
        createNode('11,0', [secondPartEnd]),
      ],
      edges: [
        {
          feature: firstPartStart.feature,
          featureId: 'line-a',
          sourceName: 'gm_main',
          start: firstPartStart,
          end: firstPartEnd,
        },
        {
          feature: secondPartStart.feature,
          featureId: 'line-a',
          sourceName: 'gm_main',
          start: secondPartStart,
          end: secondPartEnd,
        },
      ],
      danglingEndpoints: [firstPartStart, firstPartEnd, secondPartStart, secondPartEnd],
      nearbyEndpointPairs: [],
    };

    const issues = getDisconnectedComponentIssues(graph);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: 'disconnected-component',
      type: 'disconnected-component',
      component: {
        nodeKeys: ['10,0', '11,0'],
        edgeFeatureIds: ['line-a'],
      },
    });
  });

  test('reports endpoint degree thresholds', () => {
    const endpoints = [
      createEndpoint('line-a', 'end', [1, 0]),
      createEndpoint('line-b', 'start', [1, 0]),
      createEndpoint('line-c', 'start', [1, 0]),
    ];
    const graph: GeomanLineNetworkGraph = {
      nodes: [createNode('1,0', endpoints)],
      edges: [],
      danglingEndpoints: [],
      nearbyEndpointPairs: [],
    };

    expect(getDegreeThresholdIssues(graph, { maxDegree: 2 })).toEqual([
      expect.objectContaining({
        ruleId: 'degree-threshold',
        type: 'degree-threshold',
        degree: 3,
      }),
    ]);
    expect(getDegreeThresholdIssues(graph, { minDegree: 4 })).toEqual([
      expect.objectContaining({
        degree: 3,
      }),
    ]);
  });

  test('runs configured validators as one pure validation pass', () => {
    const dangling = createEndpoint('line-a', 'start', [0, 0]);
    const graph: GeomanLineNetworkGraph = {
      nodes: [createNode('0,0', [dangling])],
      edges: [],
      danglingEndpoints: [dangling],
      nearbyEndpointPairs: [],
    };

    expect(
      validateLineNetworkTopology(graph, {
        danglingEndpoints: { message: 'Endpoint is not connected.' },
        duplicateEndpointGroups: false,
        disconnectedComponents: true,
        degreeThresholds: { minDegree: 2 },
      }).issues.map((issue) => issue.type),
    ).toEqual(['dangling-endpoint', 'degree-threshold']);
  });

  test('reports duplicate endpoint groups with mixed LineString and MultiLineString refs', () => {
    const lineEndpoint = createEndpoint('line-a', 'end', [1, 0]);
    const multiLineEndpoint = createEndpoint('multi-line-a', 'start', [1, 0], 0);
    const graph: GeomanLineNetworkGraph = {
      nodes: [createNode('1,0', [lineEndpoint, multiLineEndpoint])],
      edges: [],
      danglingEndpoints: [],
      nearbyEndpointPairs: [],
    };

    const result = validateLineNetworkTopology(graph, {
      danglingEndpoints: false,
      disconnectedComponents: false,
      duplicateEndpointGroups: true,
    });

    expect(result.issues).toEqual([
      expect.objectContaining({
        ruleId: 'duplicate-endpoint-group',
        type: 'duplicate-endpoint-group',
        endpoints: [
          expect.objectContaining({ featureId: 'line-a', partIndex: null }),
          expect.objectContaining({ featureId: 'multi-line-a', partIndex: 0 }),
        ],
      }),
    ]);
  });
});
