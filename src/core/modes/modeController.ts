import { GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import type { Geoman } from '@/main.ts';
import type { ModeName } from '@/types/controls.ts';
import type { ModeType } from '@/types/options.ts';
import type { AnyEventName, BaseEventListener } from '@/types/map/index.ts';
import type { DrawModeName, EditModeName, HelperModeName } from '@/types/modes/index.ts';

export type GeomanModeState = {
  activeDrawModes: Array<DrawModeName>;
  activeEditModes: Array<EditModeName>;
  activeHelperModes: Array<HelperModeName>;
  activeModes: Array<{ type: ModeType; name: ModeName }>;
};

export type GeomanModeSubscriptionCallback = (state: GeomanModeState) => void;

const MODE_SUBSCRIPTION_EVENT_NAMES = [
  `${GM_SYSTEM_PREFIX}:draw`,
  `${GM_SYSTEM_PREFIX}:edit`,
  `${GM_SYSTEM_PREFIX}:helper`,
] as const satisfies ReadonlyArray<AnyEventName>;

export class ModeController {
  constructor(private readonly geoman: Geoman) {}

  enable(modeType: ModeType, modeName: ModeName) {
    this.geoman.options.enableMode(modeType, modeName);
  }

  disable(modeType: ModeType, modeName: ModeName) {
    this.geoman.options.disableMode(modeType, modeName);
  }

  toggle(modeType: ModeType, modeName: ModeName) {
    this.geoman.options.toggleMode(modeType, modeName);
  }

  isEnabled(modeType: ModeType, modeName: ModeName) {
    return this.geoman.options.isModeEnabled(modeType, modeName);
  }

  disableAll() {
    this.geoman.disableAllModes();
  }

  getState(): GeomanModeState {
    const activeDrawModes = this.geoman.getActiveDrawModes();
    const activeEditModes = this.geoman.getActiveEditModes();
    const activeHelperModes = this.geoman.getActiveHelperModes();

    return {
      activeDrawModes,
      activeEditModes,
      activeHelperModes,
      activeModes: [
        ...activeDrawModes.map((name) => ({ type: 'draw' as const, name })),
        ...activeEditModes.map((name) => ({ type: 'edit' as const, name })),
        ...activeHelperModes.map((name) => ({ type: 'helper' as const, name })),
      ],
    };
  }

  subscribe(callback: GeomanModeSubscriptionCallback): () => void {
    callback(this.getState());

    const listeners = MODE_SUBSCRIPTION_EVENT_NAMES.map((eventName) => {
      const listener: BaseEventListener = (event) => {
        if (isModeLifecycleEvent(event)) {
          callback(this.getState());
        }
      };
      this.geoman.mapAdapter.on(eventName, listener);
      return { eventName, listener };
    });

    let unsubscribed = false;
    return () => {
      if (unsubscribed) {
        return;
      }
      unsubscribed = true;
      listeners.forEach(({ eventName, listener }) => {
        this.geoman.mapAdapter.off(eventName, listener);
      });
    };
  }
}

function isModeLifecycleEvent(event: unknown): event is { action: string } {
  if (!event || typeof event !== 'object' || !('action' in event)) {
    return false;
  }
  const action = (event as { action: unknown }).action;
  return action === 'mode_started' || action === 'mode_ended';
}
