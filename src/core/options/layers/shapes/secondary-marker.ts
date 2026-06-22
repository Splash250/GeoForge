import type { PartialLayerStyle, StyleVariables } from '@/main.ts';

export const getSecondaryControlMarkerStyles = (
  styleVariables: StyleVariables,
): Array<PartialLayerStyle> => {
  return [
    {
      type: 'circle',
      paint: {
        'circle-radius': 12,
        'circle-color': '#020617',
        'circle-opacity': 0.58,
        'circle-stroke-color': '#bae6fd',
        'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.28,
      },
    },
    {
      type: 'circle',
      paint: {
        'circle-radius': 7,
        'circle-color': '#f8fafc',
        'circle-opacity': 0.9,
        'circle-stroke-color': styleVariables.lineColor,
        'circle-stroke-width': 2.5,
        'circle-stroke-opacity': 1,
      },
    },
  ];
};
