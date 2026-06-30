import type { GeoJsonImportFeatureCollection } from 'maplibre-geoforge';
import type { DemoDefinition } from '../../registry/types.ts';
import { sampleNetworkGeoJson } from '../shared/sampleGeoJson.ts';
import FeatureDataInspector from './FeatureDataInspector.svelte';

type FeatureDataDemoState = {
  featureCount: number;
  importStatsSummary: string;
  exportedJson: string;
  lastAction: string;
};

type FeatureDataInspectorProps = {
  state: FeatureDataDemoState;
  onImportSample: () => void;
  onExport: () => void;
};

type ImportStats = {
  total: number;
  success: number;
  failed: number;
  overwritten: number;
};

const typedSampleNetworkGeoJson = sampleNetworkGeoJson as GeoJsonImportFeatureCollection;

export const featureDataDemos: DemoDefinition<FeatureDataInspectorProps>[] = [
  {
    id: 'feature-data-import-geojson',
    title: 'Import GeoJSON',
    description:
      'Import a sample GeoJSON network, inspect import stats, and export the live feature store.',
    docsPath: '/docs/importing-geojson',
    code: () => buildFeatureDataSnippet(),
    inspector: FeatureDataInspector,
    setup: (context) => {
      const { geoForge } = context;
      let state: FeatureDataDemoState = {
        featureCount: 0,
        importStatsSummary: '0/0 imported, 0 added, 0 overwritten, 0 failed',
        exportedJson: formatExportedJson({ type: 'FeatureCollection', features: [] }),
        lastAction: 'Waiting for import',
      };

      const isActive = () => !context.signal.aborted && context.isCurrent();

      if (!isActive()) {
        return { teardown: () => {} };
      }

      const updateRuntime = () => {
        if (!isActive()) {
          return;
        }

        context.setInspectorProps({ state, onImportSample, onExport });
        context.setCode(buildFeatureDataSnippet());
      };

      const importSample = (lastAction: string) => {
        const { stats, addedFeatures } = geoForge.features.importGeoJson(
          typedSampleNetworkGeoJson,
          {
            overwrite: true,
            history: false,
          },
        );

        const exportedGeoJson = geoForge.features.exportGeoJson();
        state = {
          featureCount: exportedGeoJson.features.length,
          importStatsSummary: summarizeStats(stats, addedFeatures.length),
          exportedJson: formatExportedJson(exportedGeoJson),
          lastAction,
        };

        return { stats, addedFeatures };
      };

      const onImportSample = () => {
        if (!isActive()) {
          return;
        }

        const { stats, addedFeatures } = importSample('Sample imported');
        updateRuntime();
        context.logEvent({
          name: 'feature-data:sample-imported',
          category: 'demo-studio',
          payload: {
            stats,
            featureIds: addedFeatures.map((featureData) => featureData.id),
          },
        });
        context.notify({
          title: 'Sample imported',
          body: summarizeStats(stats, addedFeatures.length),
          tone: stats.failed ? 'error' : 'success',
        });
      };

      const onExport = () => {
        if (!isActive()) {
          return;
        }

        const exportedGeoJson = geoForge.features.exportGeoJson();
        state = {
          ...state,
          featureCount: exportedGeoJson.features.length,
          exportedJson: formatExportedJson(exportedGeoJson),
          lastAction: 'GeoJSON exported',
        };
        updateRuntime();
        context.logEvent({
          name: 'feature-data:geojson-exported',
          category: 'demo-studio',
          payload: {
            featureCount: state.featureCount,
          },
        });
        context.notify({
          title: 'GeoJSON exported',
          body: `${state.featureCount} feature${state.featureCount === 1 ? '' : 's'} in the exported FeatureCollection.`,
          tone: 'info',
        });
      };

      const { stats, addedFeatures } = importSample('Initial sample import');
      updateRuntime();

      context.logEvent({
        name: 'feature-data:ready',
        category: 'demo-studio',
        payload: {
          stats,
          featureIds: addedFeatures.map((featureData) => featureData.id),
        },
      });
      context.notify({
        title: 'Feature data ready',
        body: summarizeStats(stats, addedFeatures.length),
        tone: stats.failed ? 'error' : 'success',
      });

      return {
        inspectorProps: { state, onImportSample, onExport },
        code: buildFeatureDataSnippet(),
        teardown: () => {
          geoForge.features.deleteAll({ history: false });
        },
      };
    },
  },
];

function summarizeStats(stats: ImportStats, addedCount: number) {
  return `${stats.success}/${stats.total} imported, ${addedCount} added, ${stats.overwritten} overwritten, ${stats.failed} failed`;
}

function formatExportedJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function buildFeatureDataSnippet() {
  return `import { sampleNetworkGeoJson } from '../shared/sampleGeoJson';

const { stats, addedFeatures } = geoForge.features.importGeoJson(sampleNetworkGeoJson, {
  overwrite: true,
  history: false,
});

console.log(stats);
console.log(addedFeatures.map((featureData) => featureData.id));

const exportedGeoJson = geoForge.features.exportGeoJson();

// Demo teardown:
geoForge.features.deleteAll({ history: false });`;
}
