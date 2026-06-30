import { describe, expect, test, vi } from 'vitest';
import { applyDemoControlProfile } from '../../examples/playground/src/demo-studio/map/controlProfiles.ts';
import type { DemoContext } from '../../examples/playground/src/demo-studio/registry/types.ts';

describe('Demo Studio control profiles', () => {
  test('applies category controls through the public GeoForge control API', () => {
    const applyProfile = vi.fn();
    const updateReactivePanel = vi.fn(() => {
      throw new Error('Demo Studio should not refresh controls directly');
    });
    const geoForge = {
      control: {
        applyProfile,
        updateReactivePanel,
      },
      get options(): never {
        throw new Error('Demo Studio should not mutate control options directly');
      },
    } as unknown as DemoContext['geoForge'];

    applyDemoControlProfile(geoForge, 'draw-edit');

    expect(applyProfile).toHaveBeenCalledWith({
      draw: [
        'marker',
        'circle_marker',
        'text_marker',
        'circle',
        'ellipse',
        'line',
        'rectangle',
        'polygon',
      ],
      edit: ['drag', 'change', 'rotate', 'cut', 'delete'],
      helper: ['snapping', 'zoom_to_features'],
    });
    expect(updateReactivePanel).not.toHaveBeenCalled();
  });
});
