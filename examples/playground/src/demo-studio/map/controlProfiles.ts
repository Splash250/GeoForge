import type { DemoCategoryId, DemoContext } from '../registry/types.ts';
import type { ControlOptions, ModeName, ModeType } from 'maplibre-geoforge';

type ControlProfile = {
  draw?: ModeName[];
  edit?: ModeName[];
  helper?: ModeName[];
};

const allControlModes = {
  draw: ['marker', 'circle_marker', 'text_marker', 'circle', 'ellipse', 'line', 'rectangle', 'polygon'],
  edit: ['drag', 'change', 'rotate', 'cut', 'delete'],
  helper: ['snapping', 'zoom_to_features', 'click_to_edit'],
} satisfies Record<ModeType, ModeName[]>;

const controlProfiles = {
  'draw-edit': {
    draw: allControlModes.draw,
    edit: allControlModes.edit,
    helper: ['snapping', 'zoom_to_features'],
  },
  'line-decorators': {
    helper: ['zoom_to_features'],
  },
  overlays: {
    helper: ['zoom_to_features'],
  },
  'feature-data': {
    helper: ['zoom_to_features'],
  },
  'geometry-tools': {
    edit: ['drag', 'change', 'cut', 'delete'],
    helper: ['snapping', 'zoom_to_features'],
  },
  'workflow-systems': {
    helper: ['click_to_edit', 'zoom_to_features'],
  },
} satisfies Record<DemoCategoryId, ControlProfile>;

export function applyDemoControlProfile(
  geoForge: DemoContext['geoForge'],
  categoryId: DemoCategoryId,
) {
  const profile = controlProfiles[categoryId];

  for (const modeType of Object.keys(allControlModes) as ModeType[]) {
    const profileModes = profile as Partial<Record<ModeType, readonly ModeName[]>>;
    const visibleModes = new Set(profileModes[modeType] ?? []);
    const controls = geoForge.options.controls[modeType] as Partial<Record<ModeName, ControlOptions>>;

    for (const modeName of Object.keys(controls) as ModeName[]) {
      const control = controls[modeName];

      if (!control) {
        continue;
      }

      const visible = visibleModes.has(modeName);
      control.uiEnabled = visible;

      if (!visible && control.active) {
        geoForge.options.disableMode(modeType, modeName);
      }
    }
  }

  geoForge.control.updateReactivePanel();
}
