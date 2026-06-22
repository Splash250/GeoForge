import type {
  FeatureData,
  GeoJsonImportFeatureCollection,
  GeomanLineNetworkGraph,
  GeomanLineTopologyValidationIssue,
  SnappingHelper,
} from 'maplibre-geoforge';
import type { DemoContext, DemoDefinition } from '../../registry/types.ts';
import { sampleNetworkGeoJson } from '../shared/sampleGeoJson.ts';
import GeometryInspector from './GeometryInspector.svelte';

type GeometryTopologyIssueState = {
  rule: string;
  type: string;
  severity: string;
  message: string;
};

type GeometryInspectorState = {
  lineCount: number;
  danglingEndpointCount: number;
  nearbyEndpointPairCount: number;
  issues: Array<GeometryTopologyIssueState>;
};

type GeometryInspectorProps = {
  state: GeometryInspectorState;
};

const geometryMutationEventNames = [
  'gm:create',
  'gm:edit',
  'gm:drag',
  'gm:remove',
  'gm:historychange',
] as const;
const typedSampleNetworkGeoJson = sampleNetworkGeoJson as GeoJsonImportFeatureCollection;
const geometrySampleNetworkGeoJson = {
  ...typedSampleNetworkGeoJson,
  features: typedSampleNetworkGeoJson.features.map((feature) => ({
    ...feature,
    id: `geometry-${String(feature.id ?? feature.properties?.name ?? 'network')}`.toLowerCase(),
    properties: {
      ...feature.properties,
    },
  })),
} satisfies GeoJsonImportFeatureCollection;

export const geometryDemos: DemoDefinition<GeometryInspectorProps>[] = [
  {
    id: 'geometry-tools-network-topology',
    title: 'Network topology',
    description: 'Validate imported line networks for dangling endpoints and disconnected components.',
    docsPath: '/docs/custom-interaction-tools',
    code: () => buildGeometryTopologySnippet(),
    inspector: GeometryInspector,
    setup: (context) => {
      const { geoForge } = context;
      const isActive = () => !context.signal.aborted && context.isCurrent();

      if (!isActive()) {
        return { teardown: () => {} };
      }

      let importedFeatures: FeatureData[] = [];
      const importResult = runWithoutHistory(geoForge, () =>
        geoForge.features.importGeoJson(geometrySampleNetworkGeoJson),
      );
      importedFeatures = importResult.addedFeatures;
      const lineEndpointSnapping = getLineEndpointSnappingConfigurator(geoForge);
      lineEndpointSnapping?.configureLineEndpointSnapping({ enabled: true, maxPixelDistance: 18 });
      const state = createLiveTopologyState(geoForge, importedFeatures);
      const code = buildGeometryTopologySnippet();
      const updateRuntime = () => {
        if (!isActive()) {
          return;
        }

        context.setInspectorProps({
          state: createLiveTopologyState(geoForge, importedFeatures),
        });
      };
      const cleanup = () => {
        geometryMutationEventNames.forEach((eventName) => {
          context.map.off(eventName, updateRuntime);
        });
        lineEndpointSnapping?.configureLineEndpointSnapping({ enabled: false });
        geoForge.geometry.clearLineEndpointConnectionPreview();
        runWithoutHistory(geoForge, () => {
          importedFeatures.forEach((featureData) => {
            geoForge.features.delete(featureData);
          });
        });
      };

      if (!isActive()) {
        return {
          teardown: cleanup,
        };
      }

      geometryMutationEventNames.forEach((eventName) => {
        context.map.on(eventName, updateRuntime);
      });
      context.setInspectorProps({ state });
      context.setCode(code);
      context.logEvent({
        name: 'geometry-tools:network-topology-ready',
        category: 'demo-studio',
        payload: {
          stats: importResult.stats,
          lineCount: state.lineCount,
          danglingEndpointCount: state.danglingEndpointCount,
          nearbyEndpointPairCount: state.nearbyEndpointPairCount,
          issueCount: state.issues.length,
        },
      });
      context.notify({
        title: 'Topology ready',
        body: `${state.lineCount} lines, ${state.danglingEndpointCount} dangling endpoints, ${state.issues.length} topology issues.`,
        tone: state.issues.length ? 'info' : 'success',
      });

      return {
        inspectorProps: { state },
        code,
        teardown: cleanup,
      };
    },
  },
];

function createLiveTopologyState(
  geoForge: DemoContext['geoForge'],
  importedFeatures: FeatureData[],
): GeometryInspectorState {
  const liveLineFeatures = importedFeatures.filter((feature) => {
    if (feature.shape !== 'line' || feature.temporary) {
      return false;
    }

    return geoForge.features.get(feature.sourceName, feature.id) === feature;
  });
  const graph = geoForge.geometry.getLineNetworkGraph(liveLineFeatures);
  const validationResult = geoForge.geometry.validateLineNetworkTopology(graph, {
    danglingEndpoints: true,
    duplicateEndpointGroups: false,
    disconnectedComponents: true,
  });

  return createTopologyState(graph, validationResult.issues);
}

function createTopologyState(
  graph: GeomanLineNetworkGraph,
  issues: Array<GeomanLineTopologyValidationIssue>,
): GeometryInspectorState {
  return {
    lineCount: graph.edges.length,
    danglingEndpointCount: graph.danglingEndpoints.length,
    nearbyEndpointPairCount: graph.nearbyEndpointPairs.length,
    issues: issues.map(toIssueState),
  };
}

function toIssueState(issue: GeomanLineTopologyValidationIssue): GeometryTopologyIssueState {
  return {
    rule: issue.ruleId,
    type: issue.type,
    severity: issue.severity,
    message: issue.message,
  };
}

function runWithoutHistory<T>(geoForge: DemoContext['geoForge'], callback: () => T): T {
  const history = geoForge.history as { suspend?: <TResult>(callback: () => TResult) => TResult };

  return history.suspend ? history.suspend(callback) : callback();
}

function getLineEndpointSnappingConfigurator(geoForge: DemoContext['geoForge']) {
  const snapping = geoForge.actionInstances.helper__snapping;

  if (!snapping || !('configureLineEndpointSnapping' in snapping)) {
    return null;
  }

  return snapping as SnappingHelper;
}

function buildGeometryTopologySnippet() {
  return `import { sampleNetworkGeoJson } from '../shared/sampleGeoJson';

const geometrySampleNetworkGeoJson = {
  ...sampleNetworkGeoJson,
  features: sampleNetworkGeoJson.features.map((feature) => ({
    ...feature,
    id: \`geometry-\${String(feature.id ?? feature.properties?.name ?? 'network')}\`.toLowerCase(),
    properties: { ...feature.properties },
  })),
};

function runWithoutHistory(callback) {
  const suspend = geoForge.history.suspend?.bind(geoForge.history);
  return suspend ? suspend(callback) : callback();
}

const importResult = runWithoutHistory(() =>
  geoForge.features.importGeoJson(geometrySampleNetworkGeoJson),
);

const graph = geoForge.geometry.getLineNetworkGraph(importResult.addedFeatures);
const validationResult = geoForge.geometry.validateLineNetworkTopology(graph, {
  danglingEndpoints: true,
  duplicateEndpointGroups: false,
  disconnectedComponents: true,
});

console.log({
  stats: importResult.stats,
  lineCount: graph.edges.length,
  danglingEndpointCount: graph.danglingEndpoints.length,
  nearbyEndpointPairCount: graph.nearbyEndpointPairs.length,
  issues: validationResult.issues,
});

const refreshTopology = () => {
  const liveLines = importResult.addedFeatures.filter((featureData) => {
    return featureData.shape === 'line' &&
      !featureData.temporary &&
      geoForge.features.get(featureData.sourceName, featureData.id) === featureData;
  });
  const liveGraph = geoForge.geometry.getLineNetworkGraph(liveLines);
  const liveValidation = geoForge.geometry.validateLineNetworkTopology(liveGraph, {
    danglingEndpoints: true,
    duplicateEndpointGroups: false,
    disconnectedComponents: true,
  });

  console.log({
    lineCount: liveGraph.edges.length,
    danglingEndpointCount: liveGraph.danglingEndpoints.length,
    nearbyEndpointPairCount: liveGraph.nearbyEndpointPairs.length,
    issues: liveValidation.issues,
  });
};

['gm:create', 'gm:edit', 'gm:drag', 'gm:remove', 'gm:historychange'].forEach((eventName) => {
  map.on(eventName, refreshTopology);
});

// Demo cleanup removes the preview layer and only FeatureData entries this import added.
geoForge.geometry.clearLineEndpointConnectionPreview();
['gm:create', 'gm:edit', 'gm:drag', 'gm:remove', 'gm:historychange'].forEach((eventName) => {
  map.off(eventName, refreshTopology);
});
runWithoutHistory(() => {
  importResult.addedFeatures.forEach((featureData) => {
    geoForge.features.delete(featureData);
  });
});`;
}
