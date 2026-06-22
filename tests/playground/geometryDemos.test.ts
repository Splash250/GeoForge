import { describe, expect, test, vi } from 'vitest';
import type { DemoContext } from '../../examples/playground/src/demo-studio/registry/types.ts';

type GeometryInspectorProps = {
  state: {
    lineCount: number;
    danglingEndpointCount: number;
    nearbyEndpointPairCount: number;
    issues: Array<unknown>;
  };
};

type LineFeatureDouble = {
  id: string;
  sourceName: 'gm_main';
  shape: 'line';
  temporary: false;
  getGeoJson: () => {
    type: 'Feature';
    id: string;
    properties: { shape: 'line' };
    geometry: { type: 'LineString'; coordinates: number[][] };
  };
};

vi.mock('../../examples/playground/src/demo-studio/demos/geometry-tools/GeometryInspector.svelte', () => ({
  default: {},
}));

function createLineFeature(id: string, coordinates: number[][]): LineFeatureDouble {
  return {
    id,
    sourceName: 'gm_main',
    shape: 'line',
    temporary: false,
    getGeoJson: () => ({
      type: 'Feature',
      id,
      properties: { shape: 'line' },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    }),
  };
}

describe('geometryDemos', () => {
  test('recomputes network topology after live geometry mutation events', async () => {
    const { geometryDemos } = await import(
      '../../examples/playground/src/demo-studio/demos/geometry-tools/geometryDemos.ts'
    );
    const lineA = createLineFeature('geometry-network-a', [
      [0, 0],
      [1, 0],
    ]);
    const lineB = createLineFeature('geometry-network-b', [
      [1.1, 0],
      [2, 0],
    ]);
    const featureStore = new Map([
      [lineA.id, lineA],
      [lineB.id, lineB],
    ]);
    const inspectorProps: GeometryInspectorProps[] = [];
    const mutationHandlers = new Map<string, () => void>();
    const configureLineEndpointSnapping = vi.fn();
    const context: DemoContext = {
      geoForge: {
        actionInstances: {
          helper__snapping: {
            configureLineEndpointSnapping,
          },
        },
        features: {
          get: vi.fn((_sourceName: string, featureId: string) => featureStore.get(featureId) ?? null),
          importGeoJson: vi.fn(() => ({
            stats: { total: 2, success: 2, failed: 0, overwritten: 0 },
            addedFeatures: [lineA, lineB],
          })),
          delete: vi.fn((feature: LineFeatureDouble) => {
            featureStore.delete(feature.id);
          }),
        },
        geometry: {
          getLineNetworkGraph: vi.fn((features) => {
            const lines = Array.from(features as Iterable<LineFeatureDouble>);
            const endpoints = lines.flatMap((feature) => {
              const coordinates = feature.getGeoJson().geometry.coordinates;
              return [coordinates[0], coordinates[coordinates.length - 1]];
            });
            const endpointGroups = new Map<string, unknown[]>();

            endpoints.forEach((coordinate) => {
              const key = coordinate?.join(',');
              if (!key) {
                return;
              }

              endpointGroups.set(key, [...(endpointGroups.get(key) ?? []), coordinate]);
            });

            return {
              edges: lines,
              nodes: Array.from(endpointGroups.values()).map((endpoints) => ({ endpoints })),
              danglingEndpoints: Array.from(endpointGroups.values())
                .filter((endpoints) => endpoints.length === 1)
                .flat(),
              nearbyEndpointPairs: [],
            };
          }),
          validateLineNetworkTopology: vi.fn((graph) => ({
            issues: graph.danglingEndpoints.map(() => ({
              ruleId: 'dangling-endpoint',
              type: 'dangling-endpoint',
              severity: 'error',
              message: 'Endpoint is not connected.',
            })),
          })),
          clearLineEndpointConnectionPreview: vi.fn(),
        },
        history: {
          suspend: vi.fn(<TResult>(callback: () => TResult) => callback()),
        },
      } as unknown as DemoContext['geoForge'],
      map: {
        on: vi.fn((eventName: string, handler: () => void) => {
          mutationHandlers.set(eventName, handler);
        }),
        off: vi.fn(),
      } as unknown as DemoContext['map'],
      signal: new AbortController().signal,
      isCurrent: () => true,
      setInspectorProps: (props) => inspectorProps.push(props as GeometryInspectorProps),
      setCode: vi.fn(),
      logEvent: vi.fn(),
      notify: vi.fn(),
    };

    const result = await Promise.resolve(geometryDemos[0].setup(context));
    const initialInspectorProps = result.inspectorProps as GeometryInspectorProps;

    expect(initialInspectorProps.state.danglingEndpointCount).toBe(4);
    expect(configureLineEndpointSnapping).toHaveBeenCalledWith({
      enabled: true,
      maxPixelDistance: 18,
    });

    lineA.getGeoJson = () => ({
      type: 'Feature',
      id: lineA.id,
      properties: { shape: 'line' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1.1, 0],
        ],
      },
    });
    mutationHandlers.get('gm:historychange')?.();

    expect(inspectorProps.at(-1)?.state.danglingEndpointCount).toBe(2);

    result.teardown();

    expect(configureLineEndpointSnapping).toHaveBeenLastCalledWith({ enabled: false });
  });
});
