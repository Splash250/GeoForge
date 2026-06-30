import type {
  GeoJsonImportFeatureCollection,
  GeomanLineNetworkGraph,
  GeomanLineTopologyValidationIssue,
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

type GeometrySession = {
  features: {
    importGeoJson: DemoContext['geoForge']['features']['importGeoJson'];
    query: DemoContext['geoForge']['features']['query'];
    subscribe: DemoContext['geoForge']['features']['subscribe'];
  };
  dispose: () => void;
};

type SessionCapableGeoForge = DemoContext['geoForge'] & {
  sessions: {
    start: (options?: {
      ownerId?: string;
      history?: boolean;
      cleanup?: boolean;
      cleanupHistory?: boolean;
    }) => GeometrySession;
  };
};

const typedSampleNetworkGeoJson = sampleNetworkGeoJson as GeoJsonImportFeatureCollection;
const GEOMETRY_TOPOLOGY_OWNER_ID = 'demo:geometry-tools-network-topology';
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
    description:
      'Validate imported line networks for dangling endpoints and disconnected components.',
    docsPath: '/docs/custom-interaction-tools',
    sourcePath: 'examples/playground/src/demo-studio/demos/geometry-tools/geometryDemos.ts',
    code: () => buildGeometryTopologySnippet(),
    inspector: GeometryInspector,
    setup: (context) => {
      const geoForge = context.geoForge as SessionCapableGeoForge;
      const isActive = () => !context.signal.aborted && context.isCurrent();

      if (!isActive()) {
        return { teardown: () => {} };
      }

      const session = geoForge.sessions.start({
        ownerId: GEOMETRY_TOPOLOGY_OWNER_ID,
        history: false,
      });
      const importResult = session.features.importGeoJson(geometrySampleNetworkGeoJson);
      geoForge.geometry.endpointSnapping.configure({ enabled: true, maxPixelDistance: 18 });
      const state = createLiveTopologyState(geoForge, session);
      const code = buildGeometryTopologySnippet();
      const updateRuntime = () => {
        if (!isActive()) {
          return;
        }

        context.setInspectorProps({
          state: createLiveTopologyState(geoForge, session),
        });
      };
      session.features.subscribe(updateRuntime);
      const cleanup = () => {
        geoForge.geometry.endpointSnapping.disable();
        geoForge.geometry.clearLineEndpointConnectionPreview();
        session.dispose();
      };

      if (!isActive()) {
        return {
          teardown: cleanup,
        };
      }

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
  session: GeometrySession,
): GeometryInspectorState {
  const liveLineFeatures = session.features
    .query()
    .filter((feature) => feature.shape === 'line' && !feature.temporary);
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
const session = geoForge.sessions.start({
  ownerId: 'demo:geometry-tools-network-topology',
  history: false,
});
const importResult = session.features.importGeoJson(geometrySampleNetworkGeoJson);

geoForge.geometry.endpointSnapping.configure({
  enabled: true,
  maxPixelDistance: 18,
});

const getLiveLines = () => session.features
  .query()
  .filter((featureData) => featureData.shape === 'line' && !featureData.temporary);

const graph = geoForge.geometry.getLineNetworkGraph(getLiveLines());
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
  const liveLines = getLiveLines();
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

session.features.subscribe(() => {
  refreshTopology();
});

// Demo cleanup removes the preview layer and session-owned features/subscriptions.
geoForge.geometry.endpointSnapping.disable();
geoForge.geometry.clearLineEndpointConnectionPreview();
session.dispose();`;
}
