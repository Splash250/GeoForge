import { GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import {
  controlsStoreContextKey,
  createControlsStore,
  type ControlsStore,
} from '@/core/controls/components/controls-store.ts';
import GmReactiveControls from '@/core/controls/components/gm-controls.svelte';
import { systemControls } from '@/core/controls/defaults.ts';
import { BaseControl } from '@/core/map/base/control.ts';
import {
  type BaseControlsPosition,
  type ControlOptions,
  type EventHandlers,
  type GenericSystemControl,
  type GenericSystemControls,
  type GmBaseModeEvent,
  isGmModeEvent,
  type ModeAction,
  type ModeName,
  type ModeType,
  type SystemControls,
} from '@/main.ts';
import type { GmHelperEvent, GmHelperToolLifecycleEvent } from '@/types/events/helper.ts';
import { typedKeys } from '@/utils/typing.ts';
import { cloneDeep } from 'lodash-es';
import log from '@/utils/log';
import { mount, unmount } from 'svelte';

export type GeomanControlProfile = Partial<Record<ModeType, readonly ModeName[]>> & {
  deactivateHidden?: boolean;
};

export type GeomanControlVisibilityOptions = {
  deactivateIfActive?: boolean;
};

export default class GMControl extends BaseControl {
  controls: SystemControls = cloneDeep(systemControls);
  controlsStore: ControlsStore = createControlsStore();
  reactiveControls: Record<string, unknown> | null = null;
  container: HTMLElement | undefined = undefined;
  private reactivePanelUpdateDepth = 0;
  eventHandlers: EventHandlers = {
    [`${GM_SYSTEM_PREFIX}:draw`]: this.handleModeEvent.bind(this),
    [`${GM_SYSTEM_PREFIX}:edit`]: this.handleModeEvent.bind(this),
    [`${GM_SYSTEM_PREFIX}:helper`]: this.handleHelperEvent.bind(this),
  };

  onAdd(): HTMLElement {
    this.createControls();
    this.gm.events.bus.attachEvents(this.eventHandlers);

    if (!this.container) {
      // container must be created in .createControls()
      throw new Error('Controls container is not initialized');
    }
    return this.container;
  }

  createControls(containerElement: HTMLElement | undefined = undefined) {
    if (this.controlsAdded()) {
      log.warn("Can't add controls: controls already added");
      return;
    }

    this.container = containerElement || this.createHtmlContainer();
    this.createReactivePanel();
  }

  onRemove() {
    this.gm.events.bus.detachEvents(this.eventHandlers);

    // Destroy the Svelte component
    if (this.reactiveControls) {
      unmount(this.reactiveControls);
      this.reactiveControls = null;
    }

    // Remove the container from the DOM
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = undefined;
  }

  handleModeEvent(event: GmBaseModeEvent) {
    if (!isGmModeEvent(event)) {
      return { next: true };
    }

    const trackModes: Array<ModeAction> = ['mode_started', 'mode_ended'];

    if (trackModes.includes(event.action) && this.canUpdateReactivePanel()) {
      this.updateReactivePanel();
    }

    return { next: true };
  }

  handleHelperEvent(event: GmHelperEvent) {
    if (isGmModeEvent(event)) {
      return this.handleModeEvent(event);
    }

    const trackTools: Array<GmHelperToolLifecycleEvent['action']> = [
      'tool_start',
      'tool_end',
      'tool_cancel',
    ];

    if (
      trackTools.includes(event.action as GmHelperToolLifecycleEvent['action']) &&
      this.canUpdateReactivePanel()
    ) {
      this.updateReactivePanel();
    }

    return { next: true };
  }

  controlsAdded() {
    return !!this.reactiveControls;
  }

  createReactivePanel() {
    if (!this.container) {
      log.error("Can't create reactive panel: container is not initialized");
      return;
    }

    this.syncModeStates();

    const controlsContext = new Map();
    controlsContext.set('gm', this.gm);
    controlsContext.set(controlsStoreContextKey, this.controlsStore);

    this.reactiveControls = mount(GmReactiveControls, {
      target: this.container,
      context: controlsContext,
    });

    this.updateReactivePanel();
  }

  updateReactivePanel() {
    if (!this.canUpdateReactivePanel()) {
      return;
    }

    this.controlsStore.update(() => ({
      controls: this.controls,
      options: this.gm.options.controls,
      settings: this.gm.options.settings,
      toolControls: this.gm.tools.getToolControls(),
    }));
  }

  applyProfile(profile: GeomanControlProfile): GeomanControlProfile {
    const deactivateHidden = profile.deactivateHidden ?? true;

    this.batchReactivePanelUpdates(() => {
      typedKeys(this.controls).forEach((modeType) => {
        const visibleModes = new Set<ModeName>(profile[modeType] ?? []);
        const section = this.controls[modeType];

        Object.keys(section).forEach((modeName) => {
          const mode = modeName as ModeName;
          this.setModeVisibilityInternal(modeType, mode, visibleModes.has(mode), {
            deactivateIfActive: deactivateHidden,
          });
        });
      });
    });

    this.updateReactivePanel();

    return this.getProfile();
  }

  setModeVisibility(
    modeType: ModeType,
    modeName: ModeName,
    visible: boolean,
    options: GeomanControlVisibilityOptions = {},
  ): void {
    this.batchReactivePanelUpdates(() => {
      this.setModeVisibilityInternal(modeType, modeName, visible, options);
    });
    this.updateReactivePanel();
  }

  getProfile(): Record<ModeType, ModeName[]> {
    return typedKeys(this.controls).reduce(
      (profile, modeType) => {
        const section = this.controls[modeType];
        profile[modeType] = Object.keys(section).filter((modeName): modeName is ModeName => {
          const controlOptions = this.gm.options.getControlOptions({
            modeType,
            modeName: modeName as ModeName,
          });
          return controlOptions?.uiEnabled === true;
        });

        return profile;
      },
      { draw: [], edit: [], helper: [] } as Record<ModeType, ModeName[]>,
    );
  }

  private setModeVisibilityInternal(
    modeType: ModeType,
    modeName: ModeName,
    visible: boolean,
    options: GeomanControlVisibilityOptions,
  ): void {
    const controlOptions = this.gm.options.getControlOptions({ modeType, modeName });

    if (!controlOptions) {
      return;
    }

    controlOptions.uiEnabled = visible;

    if (
      !visible &&
      options.deactivateIfActive === true &&
      this.gm.options.isModeEnabled(modeType, modeName)
    ) {
      this.gm.options.disableMode(modeType, modeName);
    }
  }

  private batchReactivePanelUpdates(callback: () => void): void {
    this.reactivePanelUpdateDepth += 1;

    try {
      callback();
    } finally {
      this.reactivePanelUpdateDepth -= 1;
    }
  }

  private canUpdateReactivePanel(): boolean {
    return this.reactivePanelUpdateDepth === 0;
  }

  createHtmlContainer() {
    const container = document.createElement('div');
    container.classList.add('geoman-controls');
    return container;
  }

  syncModeStates() {
    this.eachControlWithOptions(({ control }) => {
      this.gm.options.syncModeState(control.type, control.targetMode);
    });
  }

  eachControlWithOptions(
    callback: ({
      control,
    }: {
      control: GenericSystemControl;
      controlOptions: ControlOptions;
    }) => void,
  ) {
    return typedKeys(this.controls).forEach((modeType) => {
      const section = this.controls[modeType];

      return Object.keys(section).forEach((modeName) => {
        const mode = modeName as ModeName;
        const control = this.getControl({ modeType: modeType, modeName: mode });
        const controlOptions = this.gm.options.getControlOptions({
          modeType: modeType,
          modeName: mode,
        });

        if (control && controlOptions) {
          callback({ control, controlOptions });
        }
        // else {
        //   log.warn(`Can't find control section for: ${actionType}:${modeName}`, !!actionType, !!modeName);
        // }
      });
    });
  }

  getControl({
    modeType,
    modeName,
  }: {
    modeType: ModeType;
    modeName: ModeName;
  }): GenericSystemControl | null {
    if (modeType && modeName) {
      const section = this.controls[modeType] as GenericSystemControls;
      return (section[modeName] || null) as GenericSystemControl | null;
    }

    return null;
  }

  getDefaultPosition(): BaseControlsPosition {
    return this.gm.options.settings.controlsPosition;
  }
}
