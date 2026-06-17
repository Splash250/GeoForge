import {
  createContextPanelActionButton,
  createContextPanelDescriptionList,
  createContextPanelTextInput,
  createContextPanelValidationList,
  defineGeomanContextPanel,
} from '@/context-panels/index.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { Geoman } from '@/main.ts';

const TOOL_ID = 'playground-external-inspector';
const PANEL_ID = 'playground-external-inspector-panel';

const inspectorIcon = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M5 5h14v14H5z" fill="none" stroke="currentColor" stroke-width="2" />
  <path d="M8 9h8M8 13h5M8 17h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
</svg>`;

type ExternalInspectorPanelData = {
  feature: FeatureData;
};

export function registerExternalInspectorTool(geoman: Geoman) {
  if (!geoman.contextPanels.get(PANEL_ID)) {
    const externalInspectorPanel = defineGeomanContextPanel<ExternalInspectorPanelData>({
      id: PANEL_ID,
      title: 'Feature Inspector',
      className: 'gm-external-inspector-panel',
      transaction: {
        id: ({ data }) => `external-inspector:${data.feature.sourceName}:${data.feature.id}`,
        closeBehavior: 'cancel',
        closeOnCommit: true,
        refreshData: ({ data }) => ({ feature: data.feature }),
      },
      render: ({ data, transaction, close }) => {
        if (!transaction) {
          throw new Error('External inspector example requires a transaction context.');
        }

        const geoJson = data.feature.getGeoJson();
        const geometry = geoJson.geometry;
        const labelField = createContextPanelTextInput({
          label: 'Label',
          ariaLabel: 'Feature label',
          value: geoJson.properties.label,
          hint: 'Stored as a generic feature property',
          onChange: (label) => {
            transaction.current.updateProperty(data.feature, 'label', label);
          },
        });
        const description = createContextPanelDescriptionList([
          ['Feature ID', data.feature.id],
          ['Source', data.feature.sourceName],
          ['Geometry', geometry.type],
          ['Coordinates', getCoordinateSummary(geometry.coordinates)],
        ]);
        const validation = createContextPanelValidationList(transaction.validation.messages);
        const save = createContextPanelActionButton({
          label: 'Save',
          ariaLabel: 'Save inspector edit',
          onAction: () => {
            labelField.applyChange();
            transaction.commit();
          },
        });
        const cancel = createContextPanelActionButton({
          label: 'Cancel',
          ariaLabel: 'Cancel inspector edit',
          onAction: () => transaction.cancel({ refresh: true }),
        });
        const closeButton = createContextPanelActionButton({
          label: 'Close',
          ariaLabel: 'Close inspector',
          onAction: close,
        });
        const actions = document.createElement('div');
        const content = document.createElement('div');

        actions.className = 'gm-context-panel-actions';
        actions.append(save, cancel, closeButton);
        content.append(description, labelField, validation, actions);

        return content;
      },
    });

    geoman.contextPanels.register(
      externalInspectorPanel as Parameters<Geoman['contextPanels']['register']>[0],
    );
  }

  geoman.tools.register({
    id: TOOL_ID,
    title: 'Feature inspector',
    control: {
      icon: inspectorIcon,
    },
    selection: {
      cursor: 'pointer',
    },
    onStart: ({ contextPanels }) => {
      contextPanels.close('api');
    },
    onFeatureClick: ({ contextPanels }, event) => {
      contextPanels.open(PANEL_ID, { feature: event.feature });
      return { handled: true };
    },
    onBlankMapClick: ({ contextPanels }) => {
      contextPanels.close('blank-map');
      return { handled: true };
    },
    onCancel: ({ contextPanels }) => {
      contextPanels.close('api');
    },
    onEnd: ({ contextPanels }) => {
      contextPanels.close('api');
    },
  });
}

function getCoordinateSummary(coordinates: unknown): string {
  const coordinateCount = getCoordinateCount(coordinates);
  return `${coordinateCount} coordinate${coordinateCount === 1 ? '' : 's'}`;
}

function getCoordinateCount(coordinates: unknown): number {
  if (!Array.isArray(coordinates)) {
    return 0;
  }

  if (typeof coordinates[0] === 'number') {
    return 1;
  }

  return coordinates.reduce((count, item) => count + getCoordinateCount(item), 0);
}
