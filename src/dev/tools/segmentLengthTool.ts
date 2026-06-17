import {
  createContextPanelActionButton,
  createContextPanelDescriptionList,
  createContextPanelTextInput,
  createContextPanelValidationList,
  defineGeomanContextPanel,
} from '@/context-panels/index.ts';
import type { FeatureData } from '@/core/features/feature-data.ts';
import type { GeomanLineSegmentContext } from '@/geometry/types.ts';
import type { Geoman } from '@/main.ts';
import ml from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';

type SegmentLengthPanelData = {
  feature: FeatureData;
  segmentContext: GeomanLineSegmentContext;
};

const segmentLengthIcon = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4 17 17 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <path d="M7 20 20 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.45" />
  <path d="M5 13 11 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <path d="M13 5 19 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
</svg>`;

export function registerSegmentLengthTool(geoman: Geoman, map: MapLibreMap) {
  let popup: ml.Popup | null = null;

  const clearPopup = () => {
    popup?.remove();
    popup = null;
  };

  const showPopup = (lngLat: { lng: number; lat: number }, lengthMeters: number) => {
    clearPopup();
    popup = new ml.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'gm-segment-length-popup',
      offset: 12,
    })
      .setLngLat(lngLat)
      .setHTML(
        `<strong>Segment length:</strong> ${geoman.geometry.formatDistanceMeters(lengthMeters)}`,
      )
      .addTo(map);
  };

  if (!geoman.contextPanels.get('playground-segment-length-panel')) {
    const segmentLengthPanel = defineGeomanContextPanel<SegmentLengthPanelData>({
      id: 'playground-segment-length-panel',
      title: 'Segment Length',
      className: 'gm-segment-length-context-panel',
      transaction: {
        id: 'segment-value-edit',
        closeBehavior: 'cancel',
        closeOnCommit: true,
        refreshData: ({ data, geoman }) => ({
          segmentContext: {
            ...data.segmentContext,
            metadata: geoman.geometry.getLineSegmentMetadata(
              data.feature,
              data.segmentContext.segment.segmentIndex,
            ),
          },
        }),
      },
      render: ({ data, transaction }) => {
        if (!transaction) {
          throw new Error('Segment value panel requires a transaction context.');
        }

        const segmentValue = data.segmentContext.metadata?.segmentValue;
        const segmentIndex = data.segmentContext.segment.segmentIndex;
        const content = document.createElement('div');
        const actions = document.createElement('div');

        const segmentValueField = createContextPanelTextInput({
          label: 'Set segment value',
          ariaLabel: 'Segment value',
          value: segmentValue,
          hint: 'Stored on this segment',
          inputMode: 'decimal',
          parse: parseSegmentValueInput,
          onChange: (nextSegmentValue) => {
            transaction.current.updateProperties(data.feature, {
              segments: getNextSegmentMetadata(
                data.feature,
                segmentIndex,
                'segmentValue',
                nextSegmentValue,
              ),
            });
          },
        });
        const validation = createContextPanelValidationList(transaction.validation.messages);
        const saveButton = createContextPanelActionButton({
          label: 'Save',
          ariaLabel: 'Save segment edit',
          onAction: () => {
            segmentValueField.applyChange();
            transaction.commit();
          },
        });
        const cancelButton = createContextPanelActionButton({
          label: 'Cancel',
          ariaLabel: 'Cancel segment edit',
          onAction: () => {
            transaction.cancel({ refresh: true });
          },
        });
        const splitButton = createContextPanelActionButton({
          label: 'Split',
          ariaLabel: 'Split segment edit',
          onAction: () => {
            segmentValueField.applyChange();

            const insertion = geoman.geometry.getLineVertexInsertion(data.feature, {
              segmentIndex,
              coordinate: data.segmentContext.segment.midpoint,
              metadataMode: 'duplicate',
            });

            if (!insertion) {
              return;
            }

            transaction.current.updateGeometry(data.feature, insertion.geometry);
            transaction.current.updateProperties(data.feature, insertion.properties);

            segmentValueField.input.disabled = true;
            splitButton.disabled = true;
          },
        });

        content.className = 'gm-segment-length-context-panel__content';
        actions.className = 'gm-segment-length-context-panel__actions';
        actions.append(saveButton, cancelButton, splitButton);
        content.append(
          createContextPanelDescriptionList([
            [
              'Length',
              geoman.geometry.formatDistanceMeters(data.segmentContext.segment.lengthMeters),
            ],
            ['Segment value', segmentValue],
          ]),
          segmentValueField,
          validation,
          actions,
        );

        return content;
      },
    });

    geoman.contextPanels.register(
      segmentLengthPanel as Parameters<Geoman['contextPanels']['register']>[0],
    );
  }

  geoman.tools.register({
    id: 'playground-segment-length',
    title: 'Segment length',
    control: {
      icon: segmentLengthIcon,
    },
    selection: {
      allowedShapes: ['line'],
    },
    onFeatureClick: ({ geoman }, event) => {
      const segment = geoman.geometry.getNearestSegment(event.feature, event.point, {
        maxPixelDistance: 16,
      });

      if (!segment) {
        clearPopup();
        return;
      }

      showPopup(event.lngLat, segment.lengthMeters);
      return { handled: true };
    },
    onFeatureContextMenu: ({ geoman, contextPanels }, event) => {
      const segmentContext = geoman.geometry.getLineSegmentContext(event.feature, event.point, {
        maxPixelDistance: 16,
      });

      if (!segmentContext) {
        contextPanels.close('blank-map');
        return { handled: true };
      }

      contextPanels.open('playground-segment-length-panel', {
        feature: event.feature,
        point: [event.point.x, event.point.y],
        lngLat: event.lngLat,
        segmentContext,
      });

      return { handled: true };
    },
    onContextMenu: ({ contextPanels }) => {
      contextPanels.close('blank-map');
      return { handled: true };
    },
    onBlankMapClick: clearPopup,
    onCancel: clearPopup,
    onEnd: clearPopup,
  });
}

function parseSegmentValueInput(value: string) {
  const numericValue = Number(value);
  return value === '' ? undefined : Number.isFinite(numericValue) ? numericValue : value;
}

function getNextSegmentMetadata(
  feature: FeatureData,
  segmentIndex: number,
  propertyName: string,
  value: unknown,
) {
  const segments = feature.getGeoJson().properties.segments;
  const nextSegments = (Array.isArray(segments) ? segments : [])
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object' && !Array.isArray(item),
    )
    .map((metadata) => ({ ...metadata }));
  let target = nextSegments.find((metadata) => metadata.index === segmentIndex);

  if (!target) {
    target = { index: segmentIndex };
    nextSegments.push(target);
  }

  if (value === undefined) {
    delete target[propertyName];
  } else {
    target[propertyName] = value;
  }

  return nextSegments;
}
