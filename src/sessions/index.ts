import type { FeatureData } from '@/core/features/feature-data.ts';
import type { Geoman } from '@/main.ts';
import type {
  FeatureMutationOptions,
  FeatureOwnerId,
  GeomanFeatureQueryOptions,
  GeomanFeatureSubscriptionCallback,
  GeomanFeatureSubscriptionOptions,
  GeomanUnsubscribe,
  ImportGeoJsonOptions,
} from '@/types/features.ts';
import type {
  GeoJsonImportFeature,
  GeoJsonImportFeatureCollection,
  GeoJsonShapeFeatureCollection,
} from '@/types/geojson.ts';
import type { GeomanFeatureRef } from '@/history/types.ts';
import { cloneDeep } from 'lodash-es';

export type GeomanSessionOptions = {
  /** Runtime owner for all session-scoped feature work. Generated when omitted. */
  ownerId?: FeatureOwnerId;
  /**
   * Default history behavior for session feature imports and explicit session feature cleanup.
   * Per-operation options override this value.
   */
  history?: boolean;
  /** Delete session-owned features during dispose. Defaults to true. */
  cleanup?: boolean;
  /** History behavior for dispose cleanup. Defaults to false. */
  cleanupHistory?: boolean;
};

export type GeomanSessionSubsystemOptions = {
  geoman: Geoman;
};

export type GeomanSessionFeatureFacade = {
  importGeoJson(
    geoJson: GeoJsonImportFeatureCollection | GeoJsonImportFeature,
    options?: ImportGeoJsonOptions,
  ): ReturnType<Geoman['features']['importGeoJson']>;
  importGeoJsonFeature(
    geoJsonFeature: GeoJsonImportFeature,
    options?: Pick<ImportGeoJsonOptions, 'ownerId' | 'history'>,
  ): FeatureData | null;
  query(options?: GeomanFeatureQueryOptions): Array<FeatureData>;
  count(options?: GeomanFeatureQueryOptions): number;
  getAll(): GeoJsonShapeFeatureCollection;
  deleteAll(options?: FeatureMutationOptions): Array<GeomanFeatureRef>;
  clear(options?: FeatureMutationOptions): Array<GeomanFeatureRef>;
  subscribe(
    callback: GeomanFeatureSubscriptionCallback,
    options?: GeomanFeatureSubscriptionOptions,
  ): GeomanUnsubscribe;
};

export type GeomanSession = {
  readonly ownerId: FeatureOwnerId;
  readonly disposed: boolean;
  readonly features: GeomanSessionFeatureFacade;
  dispose(): void;
};

export class GeomanSessionSubsystem {
  private geoman: Geoman;
  private nextSessionId = 1;
  private activeOwnerIds = new Set<FeatureOwnerId>();

  constructor(options: GeomanSessionSubsystemOptions) {
    this.geoman = options.geoman;
  }

  start(options: GeomanSessionOptions = {}): GeomanSession {
    const ownerId = options.ownerId ?? this.createOwnerId();
    if (this.activeOwnerIds.has(ownerId)) {
      throw new Error(`A GeoForge session with ownerId "${String(ownerId)}" is already active.`);
    }

    this.activeOwnerIds.add(ownerId);
    return new GeomanFeatureSession({
      geoman: this.geoman,
      ownerId,
      history: options.history,
      cleanup: options.cleanup ?? true,
      cleanupHistory: options.cleanupHistory,
      releaseOwner: () => {
        this.activeOwnerIds.delete(ownerId);
      },
    });
  }

  private createOwnerId(): FeatureOwnerId {
    const random =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${(this.nextSessionId++).toString(36)}`;

    return `session:${random}`;
  }
}

type GeomanFeatureSessionOptions = {
  geoman: Geoman;
  ownerId: FeatureOwnerId;
  history?: boolean;
  cleanup: boolean;
  cleanupHistory?: boolean;
  releaseOwner: () => void;
};

class GeomanFeatureSession implements GeomanSession {
  readonly ownerId: FeatureOwnerId;
  readonly features: GeomanSessionFeatureFacade;
  private geoman: Geoman;
  private defaultHistory?: boolean;
  private cleanupOnDispose: boolean;
  private cleanupHistory?: boolean;
  private releaseOwner: () => void;
  private subscriptions = new Set<GeomanUnsubscribe>();
  private isDisposed = false;

  constructor(options: GeomanFeatureSessionOptions) {
    this.geoman = options.geoman;
    this.ownerId = options.ownerId;
    this.defaultHistory = options.history;
    this.cleanupOnDispose = options.cleanup;
    this.cleanupHistory = options.cleanupHistory;
    this.releaseOwner = options.releaseOwner;
    this.features = this.createFeatureFacade();
  }

  get disposed(): boolean {
    return this.isDisposed;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    try {
      this.subscriptions.forEach((unsubscribe) => unsubscribe());
      this.subscriptions.clear();

      if (this.cleanupOnDispose) {
        this.geoman.features.deleteByOwner(this.ownerId, {
          history: this.cleanupHistory ?? false,
        });
      }
    } finally {
      this.releaseOwner();
    }
  }

  private createFeatureFacade(): GeomanSessionFeatureFacade {
    return {
      importGeoJson: (geoJson, options) =>
        this.withActiveSession(() =>
          this.geoman.features.importGeoJson(geoJson, this.withSessionImportOptions(options)),
        ),
      importGeoJsonFeature: (geoJsonFeature, options) =>
        this.withActiveSession(() =>
          this.geoman.features.importGeoJsonFeature(
            geoJsonFeature,
            this.withSessionImportOptions(options),
          ),
        ),
      query: (options) =>
        this.withActiveSession(() =>
          this.geoman.features.query(this.withSessionQueryOptions(options)),
        ),
      count: (options) =>
        this.withActiveSession(() =>
          this.geoman.features.count(this.withSessionQueryOptions(options)),
        ),
      getAll: () =>
        this.withActiveSession(() => ({
          type: 'FeatureCollection',
          features: this.geoman.features
            .query({ ownerId: this.ownerId })
            .map((feature) => cloneDeep(feature.getGeoJson())),
        })),
      deleteAll: (options) =>
        this.withActiveSession(() =>
          this.geoman.features.deleteByOwner(
            this.ownerId,
            this.withSessionMutationOptions(options),
          ),
        ),
      clear: (options) =>
        this.withActiveSession(() =>
          this.geoman.features.deleteByOwner(
            this.ownerId,
            this.withSessionMutationOptions(options),
          ),
        ),
      subscribe: (callback, options) =>
        this.withActiveSession(() => this.subscribe(callback, options)),
    };
  }

  private subscribe(
    callback: GeomanFeatureSubscriptionCallback,
    options?: GeomanFeatureSubscriptionOptions,
  ): GeomanUnsubscribe {
    const unsubscribe = this.geoman.features.subscribe(callback, {
      ...options,
      ownerId: options?.ownerId ?? this.ownerId,
    });
    let unsubscribed = false;
    const trackedUnsubscribe = () => {
      if (unsubscribed) {
        return;
      }
      unsubscribed = true;
      this.subscriptions.delete(trackedUnsubscribe);
      unsubscribe();
    };

    this.subscriptions.add(trackedUnsubscribe);
    return trackedUnsubscribe;
  }

  private withSessionImportOptions<
    TOptions extends Pick<ImportGeoJsonOptions, 'ownerId' | 'history'>,
  >(options?: TOptions): TOptions & Pick<ImportGeoJsonOptions, 'ownerId' | 'history'> {
    return {
      ...this.sessionHistoryDefaults(),
      ...options,
      ownerId: options?.ownerId ?? this.ownerId,
    } as TOptions & Pick<ImportGeoJsonOptions, 'ownerId' | 'history'>;
  }

  private withSessionQueryOptions(options?: GeomanFeatureQueryOptions): GeomanFeatureQueryOptions {
    return {
      ...options,
      ownerId: options?.ownerId ?? this.ownerId,
    };
  }

  private withSessionMutationOptions(options?: FeatureMutationOptions): FeatureMutationOptions {
    return {
      ...this.sessionHistoryDefaults(),
      ...options,
    };
  }

  private sessionHistoryDefaults(): FeatureMutationOptions {
    return this.defaultHistory === undefined ? {} : { history: this.defaultHistory };
  }

  private withActiveSession<TResult>(callback: () => TResult): TResult {
    if (this.isDisposed) {
      throw new Error(`GeoForge session "${String(this.ownerId)}" is disposed.`);
    }
    return callback();
  }
}
