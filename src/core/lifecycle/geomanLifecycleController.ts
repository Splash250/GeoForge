import defaultMarker from '@/assets/images/markers/default-marker.png';
import { GM_PREFIX, GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import type GmControl from '@/core/controls/index.ts';
import type { GmControlLoadEvent, GmEventName, GmSystemEvent } from '@/types/index.ts';
import type { AnyMapInstance } from '@/types/map/index.ts';
import { withPromiseTimeoutRace } from '@/utils/behavior.ts';
import log from 'loglevel';

type MapWithLifecycleEvents = AnyMapInstance & {
  once(type: string, listener: (ev: unknown) => void): unknown;
  off(type: string, listener: (ev: unknown) => void): unknown;
};

type GeomanLifecycleTarget = {
  control: GmControl;
  mapAdapter: {
    mapInstance: AnyMapInstance;
    addControl(control: GmControl): void;
    removeControl(control: GmControl): void;
    removeImage(id: string): void;
    loadImage(options: { id: string; image: string }): Promise<void>;
    isLoaded(): boolean;
  };
  mapAdapterInstance: { mapInstance: object } | null;
  loaded: boolean;
  destroyed: boolean;
  features: {
    init(): void;
    updateManager?: { destroy(): void };
    sources: Record<string, { remove(): void } | null>;
  };
  decorators: { lines: { destroy(): void } };
  geometry?: { destroy(): void };
  history?: { clear(): void };
  overlays: { html: { destroy(): void } };
  contextPanels: { destroy(): void };
  transactions: { destroy(): void };
  tools: { destroy(): void };
  selection: { destroy(): void };
  events: {
    fire(eventName: GmEventName, payload: GmSystemEvent): void;
    bus: { detachAllEvents(): void };
  };
  disableAllModes(): void;
};

const customControlMounts = new WeakSet<GeomanLifecycleTarget>();

const isMapWithLifecycleEvents = (map: unknown): map is MapWithLifecycleEvents => {
  return !!(
    map &&
    typeof map === 'object' &&
    'once' in map &&
    typeof (map as MapWithLifecycleEvents).once === 'function' &&
    'off' in map &&
    typeof (map as MapWithLifecycleEvents).off === 'function'
  );
};

export class GeomanLifecycleController<
  TGeoman extends GeomanLifecycleTarget = GeomanLifecycleTarget,
> {
  constructor(private readonly geoman: TGeoman) {}

  async addControls(controlsElement: HTMLElement | undefined = undefined): Promise<void> {
    if (controlsElement) {
      this.geoman.control.createControls(controlsElement);
      customControlMounts.add(this.geoman);
    } else {
      customControlMounts.delete(this.geoman);
      this.geoman.mapAdapter.addControl(this.geoman.control);
    }
    await this.onMapLoad();
  }

  async waitForBaseMap(): Promise<AnyMapInstance | undefined> {
    const map = this.geoman.mapAdapter.mapInstance;
    if (!isMapWithLifecycleEvents(map)) {
      log.error('Map instance does not have a "once" method', map);
      return;
    }

    // Fast path: if already loaded, return immediately
    if (this.geoman.mapAdapter.isLoaded()) {
      return map;
    }

    // Fix for race condition (see https://github.com/maplibre/maplibre-gl-js/issues/4024):
    // The map might finish loading between our isLoaded() check above and registering
    // the 'load' event listener. Since MapLibre's 'load' event only fires once, we would
    // miss it and timeout after 60 seconds. Solution: re-check isLoaded() after
    // registering the listener to close the race window.
    let onLoad: ((ev: unknown) => void) | undefined;
    let isLoadListenerRegistered = false;
    await withPromiseTimeoutRace(
      new Promise((resolve) => {
        onLoad = () => {
          isLoadListenerRegistered = false;
          resolve(map);
        };
        map.once('load', onLoad);
        isLoadListenerRegistered = true;

        // Check if map loaded between the isLoaded() check above and the once() call.
        // If so, remove the listener and resolve immediately. Since the map is already
        // loaded, the 'load' event won't fire again, so we must clean up the listener.
        if (this.geoman.mapAdapter.isLoaded()) {
          map.off('load', onLoad);
          isLoadListenerRegistered = false;
          resolve(map);
        }
      }),
      'waitForBaseMap failed',
      () => {
        if (onLoad && isLoadListenerRegistered) {
          map.off('load', onLoad);
          isLoadListenerRegistered = false;
        }
      },
    );
    return map;
  }

  async waitForGeomanLoaded(): Promise<TGeoman | undefined> {
    if (this.geoman.loaded) {
      return this.geoman;
    }

    // If destroyed (e.g., initialization failed), return undefined immediately
    // to prevent callers from waiting on a timeout
    if (this.geoman.destroyed) {
      return;
    }

    const map = await this.waitForBaseMap();
    if (!map) {
      log.error('Map instance is not available', map);
      return;
    }
    if (!isMapWithLifecycleEvents(map)) {
      log.error('Map instance does not have lifecycle event methods', map);
      return;
    }

    // Same race condition fix as waitForBaseMap - check loaded state after
    // registering the listener to close the timing window
    const eventName = `${GM_PREFIX}:loaded`;
    let onLoaded: ((ev: unknown) => void) | undefined;
    let isLoadedListenerRegistered = false;
    await withPromiseTimeoutRace(
      new Promise((resolve) => {
        onLoaded = () => {
          isLoadedListenerRegistered = false;
          resolve(this.geoman);
        };
        map.once(eventName, onLoaded);
        isLoadedListenerRegistered = true;

        // Check if loaded between the this.loaded check above and the once() call.
        // If so, remove the listener and resolve immediately.
        if (this.geoman.loaded) {
          map.off(eventName, onLoaded);
          isLoadedListenerRegistered = false;
          resolve(this.geoman);
        }
      }),
      'waitForGeomanLoaded failed',
      () => {
        if (onLoaded && isLoadedListenerRegistered) {
          map.off(eventName, onLoaded);
          isLoadedListenerRegistered = false;
        }
      },
    );
    return this.geoman;
  }

  async init() {
    // Check if destroyed before continuing initialization
    if (this.geoman.destroyed) {
      return;
    }
    this.geoman.features.init();

    // Check again after features init, before async controls
    if (this.geoman.destroyed) {
      return;
    }
    await this.addControls();
  }

  /**
   * Destroys the Geoman instance and cleans up resources.
   *
   * This method can be called at any point in the lifecycle:
   * - Before initialization completes: cancels pending init and cleans up synchronously
   * - After initialization completes: performs full cleanup including controls
   *
   * For React StrictMode compatibility, this method performs synchronous cleanup
   * of the `gm` reference on the map instance, allowing immediate re-initialization.
   */
  async destroy({ removeSources }: { removeSources: boolean } = { removeSources: false }) {
    // Mark as destroyed early to prevent init() from continuing
    this.geoman.destroyed = true;

    // Synchronously remove gm reference to allow re-initialization
    // This is critical for React StrictMode compatibility
    if (this.geoman.mapAdapterInstance && 'gm' in this.geoman.mapAdapterInstance.mapInstance) {
      delete (this.geoman.mapAdapterInstance.mapInstance as { gm?: unknown }).gm;
    }
    this.geoman.features.updateManager?.destroy();
    this.geoman.decorators.lines.destroy();
    this.geoman.geometry?.destroy();
    this.geoman.history?.clear();
    this.geoman.overlays.html.destroy();
    this.geoman.contextPanels.destroy();
    this.geoman.transactions.destroy();
    this.geoman.tools.destroy();
    this.geoman.selection.destroy();

    const removedCustomControls = this.removeDirectMountedControls();

    // Only perform full cleanup if initialization completed
    if (this.geoman.loaded) {
      // removeControls() will detach events via control.onRemove()
      if (!removedCustomControls) {
        this.removeControls();
      }
      this.geoman.events.bus.detachAllEvents();
      // Remove images that were added during initialization
      this.geoman.mapAdapter.removeImage('default-marker');
    } else if (!removedCustomControls) {
      // If not loaded, detach any events that may have been registered
      this.geoman.events.bus.detachAllEvents();
    }

    if (removeSources) {
      for (const source of Object.values(this.geoman.features.sources)) {
        if (source) {
          source.remove();
        }
      }
    }
  }

  removeControls() {
    if (this.removeDirectMountedControls()) {
      return;
    }

    this.geoman.disableAllModes();
    this.geoman.mapAdapter.removeControl(this.geoman.control);
  }

  private removeDirectMountedControls() {
    if (!customControlMounts.has(this.geoman)) {
      return false;
    }

    customControlMounts.delete(this.geoman);
    this.geoman.disableAllModes();
    this.geoman.control.onRemove();
    return true;
  }

  async onMapLoad() {
    if (this.geoman.loaded || this.geoman.destroyed) {
      return;
    }

    await this.geoman.mapAdapter.loadImage({
      id: 'default-marker',
      image: defaultMarker,
    });

    // Check if destroyed after async operation
    if (this.geoman.destroyed) {
      return;
    }

    const payload: GmControlLoadEvent = {
      name: `${GM_SYSTEM_PREFIX}:control:load`,
      level: 'system',
      actionType: 'control',
      action: 'loaded',
    };
    this.geoman.events.fire(`${GM_SYSTEM_PREFIX}:control`, payload);
    this.geoman.loaded = true;
  }
}
