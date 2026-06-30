import type { DrawModeName, GeoJsonImportFeatureCollection } from 'maplibre-geoforge';
import type { DemoContext, DemoDefinition } from '../../registry/types.ts';
import { sampleNetworkGeoJson } from '../shared/sampleGeoJson.ts';
import DrawEditInspector from './DrawEditInspector.svelte';

type DrawEditShapeTool =
  | 'marker'
  | 'line'
  | 'polygon'
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'text_marker'
  | 'circle_marker';

type DrawEditMode = 'drag' | 'change' | 'rotate' | 'cut' | 'delete';

type DrawEditDemoState = {
  activeDrawShape: DrawEditShapeTool | '';
  activeEditMode: DrawEditMode | '';
  featureCount: number;
  lastAction: string;
};

type DrawEditInspectorProps = {
  state: DrawEditDemoState;
  onSelectShape: (shape: DrawEditShapeTool) => void;
  onSelectEditMode: (mode: DrawEditMode) => void;
  onClearFeatures: () => void;
};

type CountableFeatureData = {
  temporary?: boolean;
};

type FeatureStoreCountSource = {
  featureStore: {
    values: () => Iterable<CountableFeatureData>;
  };
};

const typedSampleNetworkGeoJson = sampleNetworkGeoJson as GeoJsonImportFeatureCollection;
const drawEditSampleNetworkGeoJson = {
  ...typedSampleNetworkGeoJson,
  features: typedSampleNetworkGeoJson.features.map((feature) => ({
    ...feature,
    id: `draw-edit-${String(feature.id ?? feature.properties?.name ?? 'network')}`.toLowerCase(),
    properties: {
      ...feature.properties,
    },
  })),
} satisfies GeoJsonImportFeatureCollection;

export const drawEditDemos: DemoDefinition<DrawEditInspectorProps>[] = [
  {
    id: 'draw-edit-modes',
    title: 'Shape drawing and edit modes',
    description: 'Activate drawing tools and global edit modes against seeded line features.',
    docsPath: '/docs/modes-handling',
    code: () => buildDrawEditSnippet(),
    inspector: DrawEditInspector,
    setup: (context) => {
      const { geoForge } = context;
      const isActive = () => !context.signal.aborted && context.isCurrent();

      if (!isActive()) {
        return { teardown: () => {} };
      }

      let state: DrawEditDemoState = {
        activeDrawShape: '',
        activeEditMode: '',
        featureCount: 0,
        lastAction: 'Waiting for setup',
      };

      const refreshFeatureCount = () => countUserFacingFeatures(geoForge.features);

      const updateRuntime = (lastAction = state.lastAction) => {
        if (!isActive()) {
          return;
        }

        state = {
          ...state,
          featureCount: refreshFeatureCount(),
          lastAction,
        };
        context.setInspectorProps({
          state,
          onSelectShape,
          onSelectEditMode,
          onClearFeatures,
        });
        context.setCode(buildDrawEditSnippet());
      };

      const handleFeatureMutation = () => {
        updateRuntime('Feature collection updated');
      };

      const unsubscribeFeatures = geoForge.features.subscribe(handleFeatureMutation);

      const onSelectShape = (shape: DrawEditShapeTool) => {
        if (!isActive()) {
          return;
        }

        geoForge.disableAllModes();
        geoForge.enableDraw(shape as DrawModeName);
        state = {
          ...state,
          activeDrawShape: shape,
          activeEditMode: '',
        };
        updateRuntime(`Draw ${formatShapeLabel(shape)} active`);
        context.logEvent({
          name: 'draw-edit:draw-mode-selected',
          category: 'demo-studio',
          payload: { shape, featureCount: state.featureCount },
        });
      };

      const onSelectEditMode = (mode: DrawEditMode) => {
        if (!isActive()) {
          return;
        }

        geoForge.disableAllModes();
        enableEditMode(geoForge, mode);
        state = {
          ...state,
          activeDrawShape: '',
          activeEditMode: mode,
        };
        updateRuntime(`${formatEditModeLabel(mode)} mode active`);
        context.logEvent({
          name: 'draw-edit:edit-mode-selected',
          category: 'demo-studio',
          payload: { mode, featureCount: state.featureCount },
        });
      };

      const onClearFeatures = () => {
        if (!isActive()) {
          return;
        }

        geoForge.disableAllModes();
        geoForge.features.deleteAll({ history: false });
        state = {
          ...state,
          activeDrawShape: '',
          activeEditMode: '',
        };
        updateRuntime('Features cleared');
        context.logEvent({
          name: 'draw-edit:features-cleared',
          category: 'demo-studio',
          payload: { featureCount: state.featureCount },
        });
        context.notify({
          title: 'Features cleared',
          body: 'Drawing and edit modes are disabled.',
          tone: 'info',
        });
      };

      const importResult = geoForge.features.importGeoJson(drawEditSampleNetworkGeoJson, {
        overwrite: true,
        history: false,
      });
      updateRuntime('Seeded sample features');

      context.logEvent({
        name: 'draw-edit:ready',
        category: 'demo-studio',
        payload: {
          stats: importResult.stats,
          featureIds: importResult.addedFeatures.map((featureData) => featureData.id),
          featureCount: state.featureCount,
        },
      });
      context.notify({
        title: 'Draw/edit ready',
        body: `${state.featureCount} seeded features are ready for draw and edit modes.`,
        tone: importResult.stats.failed ? 'error' : 'success',
      });

      return {
        inspectorProps: {
          state,
          onSelectShape,
          onSelectEditMode,
          onClearFeatures,
        },
        code: buildDrawEditSnippet(),
        teardown: () => {
          unsubscribeFeatures();
          geoForge.disableAllModes();
          geoForge.features.deleteAll({ history: false });
        },
      };
    },
  },
];

function enableEditMode(geoForge: DemoContext['geoForge'], mode: DrawEditMode) {
  const modeHandlers = {
    drag: () => geoForge.enableGlobalDragMode(),
    change: () => geoForge.enableGlobalEditMode(),
    rotate: () => geoForge.enableGlobalRotateMode(),
    cut: () => geoForge.enableGlobalCutMode(),
    delete: () => geoForge.enableGlobalRemovalMode(),
  } satisfies Record<DrawEditMode, () => void>;

  modeHandlers[mode]();
}

function countUserFacingFeatures(features: FeatureStoreCountSource): number {
  let count = 0;

  for (const featureData of features.featureStore.values()) {
    if (!featureData.temporary) {
      count += 1;
    }
  }

  return count;
}

function formatShapeLabel(shape: DrawEditShapeTool) {
  return shape.replace('_', ' ');
}

function formatEditModeLabel(mode: DrawEditMode) {
  return mode === 'change' ? 'Change/edit' : mode;
}

function buildDrawEditSnippet() {
  return `import { sampleNetworkGeoJson } from '../shared/sampleGeoJson';

const drawEditSampleNetworkGeoJson = {
  ...sampleNetworkGeoJson,
  features: sampleNetworkGeoJson.features.map((feature) => ({
    ...feature,
    id: \`draw-edit-\${String(feature.id ?? feature.properties?.name ?? 'network')}\`.toLowerCase(),
    properties: { ...feature.properties },
  })),
};

geoForge.features.importGeoJson(drawEditSampleNetworkGeoJson, {
  overwrite: true,
  history: false,
});

const unsubscribeFeatures = geoForge.features.subscribe(() => {
  console.log('Feature collection updated', geoForge.features.exportGeoJson());
});

function activateDraw(shape) {
  geoForge.disableAllModes();
  geoForge.enableDraw(shape);
}

function activateEdit(mode) {
  geoForge.disableAllModes();

  const modeHandlers = {
    drag: () => geoForge.enableGlobalDragMode(),
    change: () => geoForge.enableGlobalEditMode(),
    rotate: () => geoForge.enableGlobalRotateMode(),
    cut: () => geoForge.enableGlobalCutMode(),
    delete: () => geoForge.enableGlobalRemovalMode(),
  };

  modeHandlers[mode]?.();
}

function clearFeatures() {
  geoForge.disableAllModes();
  geoForge.features.deleteAll({ history: false });
}

function cleanup() {
  unsubscribeFeatures();
  geoForge.disableAllModes();
  geoForge.features.deleteAll({ history: false });
}`;
}
