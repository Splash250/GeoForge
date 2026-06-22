import type { GeoJsonImportFeature } from 'maplibre-geoforge';
import type { DemoContext, DemoDefinition } from '../../registry/types.ts';
import { ensureBaseSymbolImages } from '../shared/symbolImages.ts';
import LineDecoratorsInspector from './LineDecoratorsInspector.svelte';
import {
  buildLineDecoratorSnippet,
  createDecoratorFromState,
  initialLineDecoratorState,
} from './state.ts';
import type { LineDecoratorDemoState } from './types.ts';

const routeFeature: GeoJsonImportFeature = {
  type: 'Feature',
  id: 'decorator-route',
  geometry: {
    type: 'LineString',
    coordinates: [
      [19.025, 47.491],
      [19.04, 47.497],
      [19.055, 47.493],
      [19.071, 47.501],
    ],
  },
  properties: {
    lineColor: '#2563eb',
    lineWidth: 5,
    lineOpacity: 0.82,
  },
};

type LineDecoratorsInspectorProps = {
  state: LineDecoratorDemoState;
  onStateChange: (state: LineDecoratorDemoState) => void;
};

export const lineDecoratorDemos: DemoDefinition<LineDecoratorsInspectorProps>[] = [
  {
    id: 'line-decorators-arrowheads',
    title: 'Arrowheads',
    description: 'Tune live route decorator controls against an imported GeoForge route.',
    docsPath: '/docs/decorators',
    code: () => buildLineDecoratorSnippet(createInitialState()),
    inspector: LineDecoratorsInspector,
    setup: async (context) => {
      const { map, geoForge } = context;
      let state = createInitialState();

      if (context.signal.aborted || !context.isCurrent()) {
        return { teardown: () => {} };
      }

      await ensureBaseSymbolImages(map);

      if (context.signal.aborted || !context.isCurrent()) {
        return { teardown: () => {} };
      }

      const importResult = runWithoutHistory(geoForge, () =>
        geoForge.features.importGeoJson(routeFeature, { overwrite: true }),
      );
      const importedRouteFeatures = importResult.addedFeatures;

      if (!importedRouteFeatures.length) {
        const message = `Unable to import seeded route (${importResult.stats.success}/${importResult.stats.total} features imported).`;
        context.notify({
          title: 'Route import failed',
          body: message,
          tone: 'error',
        });
        throw new Error(message);
      }

      const getRouteFeatures = () => importedRouteFeatures.map((featureData) => featureData.getGeoJson());

      const syncDecorators = (nextState: LineDecoratorDemoState) => {
        geoForge.decorators.lines.configure({ layerPosition: nextState.layerPosition });
        geoForge.decorators.lines.syncFromFeatures(getRouteFeatures(), () =>
          nextState.decorators.length ? nextState.decorators : [createDecoratorFromState(nextState)]
        );
      };

      const updateRuntime = (nextState: LineDecoratorDemoState) => {
        const code = buildLineDecoratorSnippet(nextState);
        context.setInspectorProps({ state: nextState, onStateChange });
        context.setCode(code);
      };

      const onStateChange = (nextState: LineDecoratorDemoState) => {
        if (context.signal.aborted || !context.isCurrent()) {
          return;
        }

        state = nextState;
        syncDecorators(state);
        updateRuntime(state);
      };

      syncDecorators(state);
      updateRuntime(state);

      context.logEvent({
        name: 'line-decorators:ready',
        category: 'demo-studio',
        payload: {
          routeFeatureIds: importedRouteFeatures.map((featureData) => featureData.id),
          stats: importResult.stats,
        },
      });
      context.notify({
        title: 'Line decorators ready',
        body: 'Manual sync is rendering decorators from the imported GeoForge route.',
        tone: 'success',
      });

      return {
        inspectorProps: { state, onStateChange },
        code: buildLineDecoratorSnippet(state),
        teardown: () => {
          geoForge.decorators.lines.destroy();
          runWithoutHistory(geoForge, () => {
            importedRouteFeatures.forEach((featureData) => {
              geoForge.features.delete(featureData);
            });
          });
        },
      };
    },
  },
];

function createInitialState(): LineDecoratorDemoState {
  return {
    ...initialLineDecoratorState,
    decorators: [],
  };
}

function runWithoutHistory<T>(geoForge: DemoContext['geoForge'], callback: () => T): T {
  const history = geoForge.history as { suspend?: <TResult>(callback: () => TResult) => TResult };

  return history.suspend ? history.suspend(callback) : callback();
}
