import { getControlMarkerStyles } from '@/core/options/layers/shapes/control-marker.ts';
import { getSecondaryControlMarkerStyles } from '@/core/options/layers/shapes/secondary-marker.ts';
import type { StyleVariables } from '@/types/index.ts';
import { describe, expect, test } from 'vitest';

const styleVariables: StyleVariables = {
  lineColor: '#38bdf8',
  lineOpacity: 0.8,
  lineWidth: 3,
  fillColor: '#4fb3ff',
  fillOpacity: 0.4,
  circleMarkerRadius: 10,
};

describe('edit marker layer styles', () => {
  test('renders primary edit handles with a large halo and visible foreground marker', () => {
    const [haloLayer, handleLayer] = getControlMarkerStyles(styleVariables);

    expect(haloLayer?.paint).toMatchObject({
      'circle-radius': 14,
      'circle-opacity': 0.72,
    });
    expect(handleLayer?.paint).toMatchObject({
      'circle-radius': 9,
      'circle-stroke-color': styleVariables.lineColor,
      'circle-stroke-width': 3,
    });
  });

  test('renders edge insertion handles with a halo and compact foreground marker', () => {
    const [haloLayer, handleLayer] = getSecondaryControlMarkerStyles(styleVariables);

    expect(haloLayer?.paint).toMatchObject({
      'circle-radius': 12,
      'circle-opacity': 0.58,
    });
    expect(handleLayer?.paint).toMatchObject({
      'circle-radius': 7,
      'circle-stroke-color': styleVariables.lineColor,
      'circle-stroke-width': 2.5,
    });
  });
});
