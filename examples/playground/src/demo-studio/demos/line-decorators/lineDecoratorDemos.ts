import type { GeoJsonImportFeature } from 'maplibre-geoforge';
import type { DemoContext, DemoDefinition } from '../../registry/types.ts';
import { ensureBaseSymbolImages } from '../shared/symbolImages.ts';
import AdvancedDecoratorInspector from './AdvancedDecoratorInspector.svelte';
import LineDecoratorsInspector from './LineDecoratorsInspector.svelte';
import {
  applyAdvancedLineStyleToFeatures,
  createAdvancedCustomSvgImageManager,
  createAdvancedDecoratorState,
  getAdvancedDecoratorCode,
  getAdvancedDecoratorLineFeature,
  getAdvancedDecoratorRenderState,
  syncAdvancedDecorators,
  type AdvancedCustomSvgEnsureError,
  type AdvancedDecoratorSyncTarget,
  type AdvancedDecoratorState,
} from './advancedDecoratorAuthoring.ts';
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

type AdvancedDecoratorInspectorProps = {
  state: AdvancedDecoratorState;
  onStateChange: (state: AdvancedDecoratorState) => void;
};

export const lineDecoratorDemos: DemoDefinition[] = [
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

      const getRouteFeatures = () =>
        importedRouteFeatures.map((featureData) => featureData.getGeoJson());

      const syncDecorators = (nextState: LineDecoratorDemoState) => {
        geoForge.decorators.lines.configure({ layerPosition: nextState.layerPosition });
        geoForge.decorators.lines.syncFromFeatures(getRouteFeatures(), () =>
          nextState.decorators.length
            ? nextState.decorators
            : [createDecoratorFromState(nextState)],
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
  {
    id: 'line-decorators-advanced-authoring',
    title: 'Advanced decorator authoring',
    description:
      'Author symbol, text, and arrowhead decorators with placement and animation controls.',
    docsPath: '/docs/decorators',
    code: () => getAdvancedDecoratorCode(createAdvancedDecoratorState()),
    inspector: AdvancedDecoratorInspector,
    setup: async (context) => {
      const { map, geoForge } = context;
      let state = createAdvancedDecoratorState();
      let syncVersion = 0;
      const customSvgImageManager = createAdvancedCustomSvgImageManager(svgToImage);
      const isLatestSetup = () => !context.signal.aborted && context.isCurrent();
      const emptyTeardown = () => ({ teardown: () => {} });
      const cleanupAndEmptyTeardown = () => {
        customSvgImageManager.cleanup(map);
        return emptyTeardown();
      };

      if (!isLatestSetup()) {
        return emptyTeardown();
      }

      await ensureBaseSymbolImages(map);
      await customSvgImageManager.ensure(map, state, { isCurrent: isLatestSetup });

      if (!isLatestSetup()) {
        return cleanupAndEmptyTeardown();
      }

      let importResult: ReturnType<typeof geoForge.features.importGeoJson>;
      try {
        importResult = runWithoutHistory(geoForge, () =>
          geoForge.features.importGeoJson(getAdvancedDecoratorLineFeature(state), {
            overwrite: true,
          }),
        );
      } catch (error) {
        customSvgImageManager.cleanup(map);
        throw error;
      }
      const importedLineFeatures = importResult.addedFeatures;

      if (!importedLineFeatures.length) {
        customSvgImageManager.cleanup(map);
        const message = `Unable to import advanced decorator line (${importResult.stats.success}/${importResult.stats.total} features imported).`;
        context.notify({
          title: 'Advanced line import failed',
          body: message,
          tone: 'error',
        });
        throw new Error(message);
      }

      const getLineFeatures = () =>
        importedLineFeatures.map((featureData) => featureData.getGeoJson());

      const syncRuntime = (nextState: AdvancedDecoratorState) => {
        runWithoutHistory(geoForge, () => {
          applyAdvancedLineStyleToFeatures(importedLineFeatures, nextState);
        });
        syncAdvancedDecorators({
          geoForge: geoForge as AdvancedDecoratorSyncTarget,
          state: nextState,
          features: getLineFeatures(),
        });
      };

      const updateInspector = (nextState: AdvancedDecoratorState) => {
        const code = getAdvancedDecoratorCode(nextState);
        context.setInspectorProps({
          state: nextState,
          onStateChange,
        } satisfies AdvancedDecoratorInspectorProps);
        context.setCode(code);
      };

      const applyState = async (nextState: AdvancedDecoratorState) => {
        const version = ++syncVersion;
        state = nextState;
        updateInspector(state);
        const isLatestState = () =>
          !context.signal.aborted && context.isCurrent() && version === syncVersion;

        try {
          const imageResult = await customSvgImageManager.ensure(map, state, {
            isCurrent: isLatestState,
          });

          if (!isLatestState()) {
            return;
          }

          const renderState = getAdvancedDecoratorRenderState(state, imageResult);
          context.setCode(getAdvancedDecoratorCode(renderState));
          syncRuntime(renderState);
        } catch (error) {
          if (!isLatestState()) {
            return;
          }

          const readyImageIds = (error as AdvancedCustomSvgEnsureError).readyImageIds;
          const renderState = getAdvancedDecoratorRenderState(state, {
            customImageReady: false,
            readyImageIds,
          });
          const message =
            error instanceof Error ? error.message : 'Unable to load custom SVG image.';
          context.logEvent({
            name: 'line-decorators-advanced-authoring:custom-svg-error',
            category: 'demo-studio',
            payload: { message },
          });
          context.notify({
            title: 'Custom SVG failed',
            body: message,
            tone: 'error',
          });
          context.setCode(getAdvancedDecoratorCode(renderState));
          syncRuntime(renderState);
          return;
        }
      };

      const onStateChange = (nextState: AdvancedDecoratorState) => {
        if (context.signal.aborted || !context.isCurrent()) {
          return;
        }

        void applyState(nextState).catch((error) => {
          const message =
            error instanceof Error ? error.message : 'Unable to apply advanced decorator state.';
          context.logEvent({
            name: 'line-decorators-advanced-authoring:state-error',
            category: 'demo-studio',
            payload: { message },
          });
          context.notify({
            title: 'Advanced decorators failed',
            body: message,
            tone: 'error',
          });
        });
      };

      syncRuntime(state);
      updateInspector(state);

      context.logEvent({
        name: 'line-decorators-advanced-authoring:ready',
        category: 'demo-studio',
        payload: {
          routeFeatureIds: importedLineFeatures.map((featureData) => featureData.id),
          stats: importResult.stats,
        },
      });
      context.notify({
        title: 'Advanced decorators ready',
        body: 'The seeded line is synced from the advanced decorator authoring state.',
        tone: 'success',
      });

      return {
        inspectorProps: {
          state,
          onStateChange,
        } satisfies AdvancedDecoratorInspectorProps,
        code: getAdvancedDecoratorCode(state),
        teardown: () => {
          syncVersion++;
          geoForge.decorators.lines.destroy();
          customSvgImageManager.cleanup(map);
          runWithoutHistory(geoForge, () => {
            importedLineFeatures.forEach((featureData) => {
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

function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(32, 32);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to load SVG image'));
    };

    image.src = url;
  });
}
