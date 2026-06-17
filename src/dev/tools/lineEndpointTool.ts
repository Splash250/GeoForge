import type { FeatureData } from '@/core/features/feature-data.ts';
import type { Geoman } from '@/main.ts';
import type { Map as MapLibreMap } from 'maplibre-gl';

const TOOL_ID = 'playground-line-endpoint-connect';

const endpointConnectIcon = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="6" cy="12" r="2" fill="currentColor" />
  <circle cx="18" cy="12" r="2" fill="currentColor" />
  <path d="M8 12h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
</svg>`;

type PendingEndpoint = {
  feature: FeatureData;
  endpoint: 'start' | 'end';
  partIndex?: number | null;
};

type LineEndpointSnappingConfigurator = {
  configureLineEndpointSnapping: (options: { enabled: boolean; maxPixelDistance?: number }) => void;
};

export function registerLineEndpointTool(geoman: Geoman, map: MapLibreMap) {
  let pendingEndpoint: PendingEndpoint | null = null;
  const status = document.createElement('div');
  status.dataset.testid = 'playground-line-endpoint-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Endpoint connect: choose a line endpoint';
  status.style.position = 'absolute';
  status.style.right = '12px';
  status.style.bottom = '12px';
  status.style.zIndex = '2';
  status.style.padding = '6px 8px';
  status.style.background = '#ffffff';
  status.style.border = '1px solid #d1d5db';
  status.style.fontSize = '12px';

  map.getContainer().append(status);

  geoman.tools.register({
    id: TOOL_ID,
    title: 'Endpoint connect',
    control: {
      icon: endpointConnectIcon,
    },
    selection: {
      cursor: 'crosshair',
      allowedShapes: ['line'],
    },
    onStart: ({ geoman }) => {
      pendingEndpoint = null;
      status.textContent = 'Endpoint connect: choose a line endpoint';
      const snapping = getLineEndpointSnappingConfigurator(geoman);
      snapping?.configureLineEndpointSnapping?.({ enabled: true, maxPixelDistance: 14 });
    },
    onFeatureClick: ({ geoman }, event) => {
      const endpoint = geoman.geometry.getNearestLineEndpoint([event.feature], event.point, {
        maxPixelDistance: 14,
      });

      if (!endpoint) {
        return { handled: false };
      }

      if (!pendingEndpoint) {
        pendingEndpoint = {
          feature: endpoint.feature,
          endpoint: endpoint.endpoint,
          partIndex: endpoint.partIndex,
        };
        status.textContent = `Endpoint connect: selected ${endpoint.endpoint}`;
        return { handled: true };
      }

      const preview = geoman.geometry.getLineEndpointConnectionPreview({
        from: pendingEndpoint,
        candidates: [event.feature],
        point: event.point,
        maxPixelDistance: 14,
      });

      if (preview) {
        const transaction = geoman.transactions.start({ id: 'playground-endpoint-connect' });
        for (const update of preview.connection.updates) {
          transaction.updateGeometry(update.feature, update.geometry);
        }
        transaction.commit();
        geoman.geometry.clearLineEndpointConnectionPreview();
        status.textContent = 'Endpoint connect: committed';
      } else {
        geoman.geometry.clearLineEndpointConnectionPreview();
      }

      pendingEndpoint = null;
      return { handled: true };
    },
    onFeatureHover: ({ geoman }, event) => {
      if (!pendingEndpoint) {
        return;
      }

      const preview = geoman.geometry.getLineEndpointConnectionPreview({
        from: pendingEndpoint,
        candidates: [event.feature],
        point: event.point,
        maxPixelDistance: 14,
        excludeFeatures: [pendingEndpoint.feature],
      });

      geoman.geometry.renderLineEndpointConnectionPreview(preview, {
        beforeId: getLineEndpointPreviewBeforeId(map),
      });
    },
    onFeatureHoverEnd: ({ geoman }) => {
      geoman.geometry.clearLineEndpointConnectionPreview();
    },
    onBlankMapClick: ({ geoman }) => {
      geoman.geometry.clearLineEndpointConnectionPreview();
      pendingEndpoint = null;
      status.textContent = 'Endpoint connect: choose a line endpoint';
    },
    onCancel: ({ geoman }) => {
      geoman.geometry.clearLineEndpointConnectionPreview();
      pendingEndpoint = null;
    },
    onEnd: ({ geoman }) => {
      geoman.geometry.clearLineEndpointConnectionPreview();
      pendingEndpoint = null;
      const snapping = getLineEndpointSnappingConfigurator(geoman);
      snapping?.configureLineEndpointSnapping?.({ enabled: false });
      status.textContent = 'Endpoint connect: inactive';
    },
  });
}

function getLineEndpointPreviewBeforeId(map: MapLibreMap): string | undefined {
  const markerLayerId = 'gm_main-vertex_marker__circle-layer-0';
  return map.getLayer(markerLayerId) ? markerLayerId : undefined;
}

function getLineEndpointSnappingConfigurator(
  geoman: Geoman,
): LineEndpointSnappingConfigurator | null {
  const snapping = geoman.actionInstances.helper__snapping;
  if (!snapping || !('configureLineEndpointSnapping' in snapping)) {
    return null;
  }

  const candidate = snapping as Record<string, unknown>;
  return typeof candidate.configureLineEndpointSnapping === 'function'
    ? (snapping as LineEndpointSnappingConfigurator)
    : null;
}
