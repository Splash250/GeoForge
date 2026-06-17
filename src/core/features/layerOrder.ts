import type { BaseLayer } from '@/core/map/base/layer.ts';

type MapWithLayerOrder = {
  getLayer?: (id: string) => unknown;
  moveLayer?: (id: string, beforeId?: string) => unknown;
};

const EDIT_OVERLAY_LAYER_MARKERS = [
  '-center_marker__',
  '-vertex_marker__',
  '-edge_marker__',
  '-snap_guide__',
] as const;

export function bringEditOverlayLayersToFront({
  layers,
  map,
}: {
  layers: Array<BaseLayer>;
  map: MapWithLayerOrder | null | undefined;
}) {
  if (typeof map?.moveLayer !== 'function') {
    return;
  }

  layers
    .map((layer) => layer.id)
    .filter((layerId) => EDIT_OVERLAY_LAYER_MARKERS.some((marker) => layerId.includes(marker)))
    .forEach((layerId) => {
      if (typeof map.getLayer !== 'function' || map.getLayer(layerId)) {
        map.moveLayer?.(layerId);
      }
    });
}
