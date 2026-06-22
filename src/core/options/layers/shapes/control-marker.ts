import type { PartialLayerStyle, StyleVariables } from '@/main.ts';

export const getControlMarkerStyles = (
  styleVariables: StyleVariables,
): Array<PartialLayerStyle> => {
  return [
    {
      type: 'circle',
      paint: {
        'circle-radius': 14,
        'circle-color': '#020617',
        'circle-opacity': 0.72,
        'circle-stroke-color': '#e0f2fe',
        'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.32,
      },
    },
    {
      type: 'circle',
      paint: {
        'circle-radius': 9,
        'circle-color': '#f8fafc',
        'circle-opacity': 1,
        'circle-stroke-color': styleVariables.lineColor,
        'circle-stroke-width': 3,
        'circle-stroke-opacity': 1,
      },
    },
  ];
};
