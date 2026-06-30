import type { Feature } from 'geojson';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Geoman } from '@/main.ts';
import type { FeatureSourceName } from '@/types/features.ts';
import { LineDecoratorManager, type LineDecoratorManagerOptions } from './lineDecoratorManager.ts';
import type { LineDecoratorLayerPosition } from './layerPosition.ts';
import {
  GeomanLineDecoratorAuthoringSession,
  type LineDecoratorAuthoringSession,
  type LineDecoratorAuthoringSessionOptions,
} from './lineDecoratorAuthoringSession.ts';
import type { LineDecoratorOptions } from './types.ts';

export type GeomanLineDecoratorSubsystemOptions = {
  geoman: Geoman;
  getMap: () => MapLibreMap;
  managerFactory?: (options: LineDecoratorManagerOptions) => LineDecoratorManager;
};

export type GeomanLineDecoratorConfigureOptions = {
  resolveDecorators?: (feature: Feature) => LineDecoratorOptions[] | null | undefined;
  sourceNames?: Array<FeatureSourceName>;
  syncOnRender?: boolean;
  layerPosition?: LineDecoratorLayerPosition;
};

export type GeomanLineDecoratorManualSyncOptions = {
  resolveFeatures?: () => Feature[];
  resolveDecorators?: (feature: Feature) => LineDecoratorOptions[] | null | undefined;
};

export class GeomanLineDecoratorSubsystem {
  private manager: LineDecoratorManager | null = null;
  private options: GeomanLineDecoratorConfigureOptions = {};
  private manualSyncOptions: GeomanLineDecoratorManualSyncOptions = {};
  private geomanSyncStarted = false;
  private managerLayerPosition: LineDecoratorLayerPosition | undefined;
  private activeAuthoringSession: object | null = null;

  constructor(private readonly subsystemOptions: GeomanLineDecoratorSubsystemOptions) {}

  isStarted() {
    return this.geomanSyncStarted;
  }

  start(options: GeomanLineDecoratorConfigureOptions = {}) {
    if (this.geomanSyncStarted) {
      return;
    }

    this.options = {
      ...this.options,
      ...options,
    };

    this.ensureManager();
    this.bindManager();
    this.geomanSyncStarted = true;
  }

  configure(options: GeomanLineDecoratorConfigureOptions) {
    const hasLayerPositionOption = Object.prototype.hasOwnProperty.call(options, 'layerPosition');
    const layerPositionChanged =
      hasLayerPositionOption && options.layerPosition !== this.options.layerPosition;

    this.options = {
      ...this.options,
      ...options,
    };

    if (!this.manager) {
      return;
    }

    if (layerPositionChanged) {
      this.replaceManager();
    }

    if (this.geomanSyncStarted) {
      this.bindManager();
    }
  }

  configureManualSync(options: GeomanLineDecoratorManualSyncOptions) {
    this.manualSyncOptions = {
      ...this.manualSyncOptions,
      ...options,
    };

    this.ensureManager();
  }

  syncFromFeatures(
    features: Feature[],
    resolveDecorators?: (feature: Feature) => LineDecoratorOptions[] | null | undefined,
  ) {
    this.ensureManager().updateFromFeatures(features, resolveDecorators);
  }

  sync() {
    const features = this.manualSyncOptions.resolveFeatures?.() ?? [];
    this.syncFromFeatures(features, this.manualSyncOptions.resolveDecorators);
  }

  createAuthoringSession(
    options: LineDecoratorAuthoringSessionOptions,
  ): LineDecoratorAuthoringSession {
    if (this.activeAuthoringSession) {
      throw new Error('A line decorator authoring session is already active.');
    }

    const sessionToken = {};
    this.activeAuthoringSession = sessionToken;

    return new GeomanLineDecoratorAuthoringSession({
      geoman: this.subsystemOptions.geoman,
      getMap: this.subsystemOptions.getMap,
      options,
      syncFromFeatures: (features, resolveDecorators, layerPosition) => {
        this.configure({ layerPosition });
        this.syncFromFeatures(features, resolveDecorators);
      },
      clear: () => this.clear(),
      isActive: () => this.activeAuthoringSession === sessionToken,
      release: () => {
        if (this.activeAuthoringSession === sessionToken) {
          this.activeAuthoringSession = null;
        }
      },
    });
  }

  clear() {
    this.manager?.clear();
  }

  destroy() {
    this.manager?.destroy();
    this.manager = null;
    this.geomanSyncStarted = false;
    this.managerLayerPosition = undefined;
    this.activeAuthoringSession = null;
  }

  private createManager() {
    const factory =
      this.subsystemOptions.managerFactory ??
      ((managerOptions: LineDecoratorManagerOptions) => new LineDecoratorManager(managerOptions));

    this.managerLayerPosition = this.options.layerPosition;

    return factory({
      map: this.subsystemOptions.getMap(),
      layerPosition: this.options.layerPosition,
    });
  }

  private ensureManager(): LineDecoratorManager {
    if (this.manager && this.managerLayerPosition === this.options.layerPosition) {
      return this.manager;
    }

    return this.replaceManager();
  }

  private replaceManager(): LineDecoratorManager {
    this.manager?.destroy();
    this.manager = this.createManager();

    return this.manager;
  }

  private bindManager() {
    this.manager?.bindToGeoman({
      geoman: this.subsystemOptions.geoman,
      resolveDecorators: this.options.resolveDecorators,
      sourceNames: this.options.sourceNames,
      syncOnRender: this.options.syncOnRender ?? true,
    });
  }
}
