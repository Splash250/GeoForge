import GMControl from '@/core/controls/index.ts';
import { GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import type { ControlOptions, ModeName, ModeType } from '@/main.ts';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/core/controls/components/gm-controls.svelte', () => ({ default: {} }));

type ControlOptionsByMode = Record<ModeType, Partial<Record<ModeName, ControlOptions>>>;

const createControlOptions = (control: GMControl): ControlOptionsByMode => {
  return Object.fromEntries(
    Object.entries(control.controls).map(([modeType, controls]) => [
      modeType,
      Object.fromEntries(
        Object.keys(controls).map((modeName) => [
          modeName,
          {
            title: modeName,
            icon: null,
            uiEnabled: true,
            active: false,
          },
        ]),
      ),
    ]),
  ) as ControlOptionsByMode;
};

const createControl = () => {
  const activeModes = new Set<string>();
  const gm = {
    options: null as unknown as {
      controls: ControlOptionsByMode;
      settings: Record<string, never>;
      getControlOptions: (input: {
        modeType: ModeType;
        modeName: ModeName;
      }) => ControlOptions | null;
      syncModeState: ReturnType<typeof vi.fn>;
      disableMode: ReturnType<typeof vi.fn>;
      isModeEnabled: ReturnType<typeof vi.fn>;
    },
    tools: {
      getToolControls: vi.fn(() => []),
    },
    events: {
      bus: {
        attachEvents: vi.fn(),
        detachEvents: vi.fn(),
      },
    },
  };

  const control = new GMControl(gm as never);
  const optionsControls = createControlOptions(control);

  gm.options = {
    controls: optionsControls,
    settings: {},
    getControlOptions: ({ modeType, modeName }) => optionsControls[modeType][modeName] ?? null,
    syncModeState: vi.fn(),
    disableMode: vi.fn((modeType: ModeType, modeName: ModeName) => {
      activeModes.delete(`${modeType}:${modeName}`);
      const controlOptions = optionsControls[modeType][modeName];
      if (controlOptions) {
        controlOptions.active = false;
      }
    }),
    isModeEnabled: vi.fn((modeType: ModeType, modeName: ModeName) =>
      activeModes.has(`${modeType}:${modeName}`),
    ),
  };

  const setActive = (modeType: ModeType, modeName: ModeName) => {
    activeModes.add(`${modeType}:${modeName}`);
    const controlOptions = optionsControls[modeType][modeName];
    if (controlOptions) {
      controlOptions.active = true;
    }
  };

  vi.spyOn(control, 'updateReactivePanel').mockImplementation(() => undefined);

  return { control, gm, setActive };
};

describe('GMControl control profiles', () => {
  test("applyProfile({ draw: ['marker'], helper: ['zoom_to_features'] }) enables only those controls", () => {
    const { control } = createControl();

    control.applyProfile({ draw: ['marker'], helper: ['zoom_to_features'] });

    expect(control.getProfile()).toEqual({
      draw: ['marker'],
      edit: [],
      helper: ['zoom_to_features'],
    });
  });

  test('applyProfile calls updateReactivePanel exactly once', () => {
    const { control } = createControl();

    control.applyProfile({ draw: ['marker'] });

    expect(control.updateReactivePanel).toHaveBeenCalledTimes(1);
  });

  test('hidden active controls are disabled by default', () => {
    const { control, gm, setActive } = createControl();
    setActive('draw', 'marker');

    control.applyProfile({ draw: ['line'] });

    expect(gm.options.disableMode).toHaveBeenCalledWith('draw', 'marker');
    expect(gm.options.controls.draw.marker?.active).toBe(false);
  });

  test('applyProfile batches refreshes when hidden active controls emit mode lifecycle events', () => {
    const { control, gm, setActive } = createControl();
    setActive('draw', 'marker');
    gm.options.disableMode.mockImplementationOnce((modeType: ModeType, modeName: ModeName) => {
      gm.options.controls[modeType][modeName]!.active = false;
      control.handleModeEvent({
        level: 'system',
        name: `${GM_SYSTEM_PREFIX}:draw:mode_ended`,
        actionType: modeType,
        action: 'mode_ended',
      });
    });

    control.applyProfile({ draw: ['line'] });

    expect(control.updateReactivePanel).toHaveBeenCalledTimes(1);
  });

  test('hidden active controls stay active when deactivateHidden: false', () => {
    const { control, gm, setActive } = createControl();
    setActive('draw', 'marker');

    control.applyProfile({ draw: ['line'], deactivateHidden: false });

    expect(gm.options.disableMode).not.toHaveBeenCalled();
    expect(gm.options.controls.draw.marker?.active).toBe(true);
    expect(gm.options.controls.draw.marker?.uiEnabled).toBe(false);
  });

  test("setModeVisibility('edit', 'cut', false, { deactivateIfActive: true }) hides and disables cut", () => {
    const { control, gm, setActive } = createControl();
    setActive('edit', 'cut');

    control.setModeVisibility('edit', 'cut', false, { deactivateIfActive: true });

    expect(gm.options.controls.edit.cut?.uiEnabled).toBe(false);
    expect(gm.options.disableMode).toHaveBeenCalledWith('edit', 'cut');
    expect(gm.options.controls.edit.cut?.active).toBe(false);
    expect(control.updateReactivePanel).toHaveBeenCalledTimes(1);
  });

  test('setModeVisibility batches refreshes when disabling emits mode lifecycle events', () => {
    const { control, gm, setActive } = createControl();
    setActive('edit', 'cut');
    gm.options.disableMode.mockImplementationOnce((modeType: ModeType, modeName: ModeName) => {
      gm.options.controls[modeType][modeName]!.active = false;
      control.handleModeEvent({
        level: 'system',
        name: `${GM_SYSTEM_PREFIX}:edit:mode_ended`,
        actionType: modeType,
        action: 'mode_ended',
      });
    });

    control.setModeVisibility('edit', 'cut', false, { deactivateIfActive: true });

    expect(control.updateReactivePanel).toHaveBeenCalledTimes(1);
  });

  test('getProfile returns copies, so mutating returned arrays does not mutate control state', () => {
    const { control } = createControl();
    control.applyProfile({ draw: ['marker'] });

    const profile = control.getProfile();
    profile.draw.push('line');

    expect(control.getProfile().draw).toEqual(['marker']);
  });
});
