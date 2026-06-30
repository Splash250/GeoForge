import type { DemoCategoryId, DemoContext } from '../registry/types.ts';
import type { ModeName, ModeType } from 'maplibre-geoforge';

type ControlProfile = Partial<Record<ModeType, readonly ModeName[]>>;

const allControlModes = {
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
  helper: ['snapping', 'zoom_to_features', 'click_to_edit'],
} satisfies Record<ModeType, ModeName[]>;

const controlProfiles = {
  'draw-edit': {
    draw: allControlModes.draw,
    edit: allControlModes.edit,
    helper: ['snapping', 'zoom_to_features'] as const,
  },
  'line-decorators': {
    helper: ['zoom_to_features'] as const,
  },
  overlays: {
    helper: ['zoom_to_features'] as const,
  },
  'feature-data': {
    helper: ['zoom_to_features'] as const,
  },
  'geometry-tools': {
    edit: ['drag', 'change', 'cut', 'delete'] as const,
    helper: ['snapping', 'zoom_to_features'] as const,
  },
  'workflow-systems': {
    helper: ['click_to_edit', 'zoom_to_features'] as const,
  },
} satisfies Record<DemoCategoryId, ControlProfile>;

export function applyDemoControlProfile(
  geoForge: DemoContext['geoForge'],
  categoryId: DemoCategoryId,
) {
  geoForge.control.applyProfile(controlProfiles[categoryId]);
}
