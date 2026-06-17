import type {
  GeomanLineDanglingEndpointValidationOptions,
  GeomanLineDegreeThresholdValidationOptions,
  GeomanLineDisconnectedComponentValidationOptions,
  GeomanLineDuplicateEndpointGroupValidationOptions,
  GeomanLineEndpointRef,
  GeomanLineNetworkGraph,
  GeomanLineNetworkNode,
  GeomanLineTopologyValidationComponent,
  GeomanLineTopologyValidationIssue,
  GeomanLineTopologyValidationMessageContext,
  GeomanLineTopologyValidationOptions,
  GeomanLineTopologyValidationResult,
  GeomanLineTopologyValidationRuleOptions,
} from './types.ts';

export function validateLineNetworkTopology(
  graph: GeomanLineNetworkGraph,
  options: GeomanLineTopologyValidationOptions = {},
): GeomanLineTopologyValidationResult {
  const issues: Array<GeomanLineTopologyValidationIssue> = [];

  if (options.danglingEndpoints !== false) {
    issues.push(...getDanglingEndpointIssues(graph, getRuleOptions(options.danglingEndpoints, {})));
  }

  if (options.duplicateEndpointGroups !== false) {
    issues.push(
      ...getDuplicateEndpointGroupIssues(
        graph,
        getRuleOptions(options.duplicateEndpointGroups, {}),
      ),
    );
  }

  if (options.disconnectedComponents !== false) {
    issues.push(
      ...getDisconnectedComponentIssues(graph, getRuleOptions(options.disconnectedComponents, {})),
    );
  }

  if (options.degreeThresholds) {
    issues.push(...getDegreeThresholdIssues(graph, getRuleOptions(options.degreeThresholds, {})));
  }

  return { issues };
}

export function getDanglingEndpointIssues(
  graph: GeomanLineNetworkGraph,
  options: GeomanLineDanglingEndpointValidationOptions = {},
): Array<GeomanLineTopologyValidationIssue> {
  return graph.danglingEndpoints.map((endpoint) => {
    const clonedEndpoint = cloneEndpointRef(endpoint);
    const context = { graph, endpoint: clonedEndpoint };

    return {
      ruleId: options.ruleId ?? 'dangling-endpoint',
      type: 'dangling-endpoint',
      severity: options.severity ?? 'warning',
      message: resolveMessage(options, context, 'Endpoint is not connected.'),
      endpoint: clonedEndpoint,
    };
  });
}

export function getDuplicateEndpointGroupIssues(
  graph: GeomanLineNetworkGraph,
  options: GeomanLineDuplicateEndpointGroupValidationOptions = {},
): Array<GeomanLineTopologyValidationIssue> {
  const minEndpoints = options.minEndpoints ?? 2;

  return graph.nodes
    .filter((node) => node.endpoints.length >= minEndpoints)
    .map((node) => {
      const endpoints = node.endpoints.map(cloneEndpointRef);
      const context = { graph, node, endpoints, degree: node.endpoints.length };

      return {
        ruleId: options.ruleId ?? 'duplicate-endpoint-group',
        type: 'duplicate-endpoint-group',
        severity: options.severity ?? 'warning',
        message: resolveMessage(options, context, 'Endpoint group has multiple endpoints.'),
        node: cloneNode(node),
        endpoints,
      };
    });
}

export function getDisconnectedComponentIssues(
  graph: GeomanLineNetworkGraph,
  options: GeomanLineDisconnectedComponentValidationOptions = {},
): Array<GeomanLineTopologyValidationIssue> {
  const components = getNetworkComponents(graph);
  const primary = components[0];

  if (!primary) {
    return [];
  }

  return components.slice(1).map((component) => {
    const context = { graph, component };

    return {
      ruleId: options.ruleId ?? 'disconnected-component',
      type: 'disconnected-component',
      severity: options.severity ?? 'warning',
      message: resolveMessage(options, context, 'Network component is disconnected.'),
      component,
    };
  });
}

export function getDegreeThresholdIssues(
  graph: GeomanLineNetworkGraph,
  options: GeomanLineDegreeThresholdValidationOptions = {},
): Array<GeomanLineTopologyValidationIssue> {
  const minDegree = options.minDegree;
  const maxDegree = options.maxDegree;

  if (minDegree === undefined && maxDegree === undefined) {
    return [];
  }

  return graph.nodes.flatMap((node) => {
    const degree = node.endpoints.length;
    const belowMinimum = minDegree !== undefined && degree < minDegree;
    const aboveMaximum = maxDegree !== undefined && degree > maxDegree;

    if (!belowMinimum && !aboveMaximum) {
      return [];
    }

    const context = { graph, node, endpoints: node.endpoints, degree };

    return [
      {
        ruleId: options.ruleId ?? 'degree-threshold',
        type: 'degree-threshold' as const,
        severity: options.severity ?? 'warning',
        message: resolveMessage(options, context, 'Endpoint group degree is outside threshold.'),
        node: cloneNode(node),
        endpoints: node.endpoints.map(cloneEndpointRef),
        degree,
      },
    ];
  });
}

function getNetworkComponents(
  graph: GeomanLineNetworkGraph,
): Array<GeomanLineTopologyValidationComponent> {
  const endpointNodeKeys = new Map<string, string>();
  const adjacency = new Map<string, Set<string>>();
  const edgeFeatureIdsByNode = new Map<string, Set<string | number>>();

  for (const node of graph.nodes) {
    adjacency.set(node.key, new Set());
    edgeFeatureIdsByNode.set(node.key, new Set());

    for (const endpoint of node.endpoints) {
      endpointNodeKeys.set(getEndpointRefKey(endpoint), node.key);
    }
  }

  for (const edge of graph.edges) {
    const startNodeKey = endpointNodeKeys.get(getEndpointRefKey(edge.start));
    const endNodeKey = endpointNodeKeys.get(getEndpointRefKey(edge.end));

    if (!startNodeKey || !endNodeKey) {
      continue;
    }

    adjacency.get(startNodeKey)?.add(endNodeKey);
    adjacency.get(endNodeKey)?.add(startNodeKey);
    edgeFeatureIdsByNode.get(startNodeKey)?.add(edge.featureId);
    edgeFeatureIdsByNode.get(endNodeKey)?.add(edge.featureId);
  }

  const visited = new Set<string>();
  const components: Array<GeomanLineTopologyValidationComponent> = [];

  for (const node of graph.nodes) {
    if (visited.has(node.key)) {
      continue;
    }

    const nodeKeys: Array<string> = [];
    const edgeFeatureIds = new Set<string | number>();
    const queue = [node.key];
    visited.add(node.key);

    for (let index = 0; index < queue.length; index += 1) {
      const nodeKey = queue[index];
      if (!nodeKey) {
        continue;
      }

      nodeKeys.push(nodeKey);
      for (const featureId of edgeFeatureIdsByNode.get(nodeKey) ?? []) {
        edgeFeatureIds.add(featureId);
      }

      for (const nextNodeKey of adjacency.get(nodeKey) ?? []) {
        if (!visited.has(nextNodeKey)) {
          visited.add(nextNodeKey);
          queue.push(nextNodeKey);
        }
      }
    }

    components.push({
      nodeKeys,
      edgeFeatureIds: Array.from(edgeFeatureIds),
    });
  }

  return components.sort((a, b) => b.nodeKeys.length - a.nodeKeys.length);
}

function getEndpointRefKey(endpoint: GeomanLineEndpointRef): string {
  return [
    endpoint.sourceName,
    endpoint.featureId,
    endpoint.partIndex ?? 'line',
    endpoint.endpoint,
    endpoint.vertexIndex,
  ].join(':');
}

function resolveMessage(
  options: GeomanLineTopologyValidationRuleOptions,
  context: GeomanLineTopologyValidationMessageContext,
  fallback: string,
): string {
  if (typeof options.message === 'function') {
    return options.message(context);
  }

  return options.message ?? fallback;
}

function getRuleOptions<T extends GeomanLineTopologyValidationRuleOptions>(
  option: boolean | T | undefined,
  fallback: T,
): T {
  return option && typeof option === 'object' ? option : fallback;
}

function cloneNode(node: GeomanLineNetworkNode): GeomanLineNetworkNode {
  return {
    ...node,
    coordinate: [...node.coordinate],
    endpoints: node.endpoints.map(cloneEndpointRef),
  };
}

function cloneEndpointRef(endpoint: GeomanLineEndpointRef): GeomanLineEndpointRef {
  return {
    ...endpoint,
    coordinate: [...endpoint.coordinate],
  };
}
