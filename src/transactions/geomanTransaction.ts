import type { FeatureData } from '@/core/features/feature-data.ts';
import type { Geoman } from '@/main.ts';
import type { BasicGeometry, GeoJsonShapeFeature } from '@/types/geojson.ts';
import { cloneDeep } from 'lodash-es';
import type {
  GeomanTransactionChange,
  GeomanTransactionCommitResult,
  GeomanTransactionFeatureRef,
  GeomanTransactionStatus,
  GeomanTransactionValidator,
} from './types.ts';

export type GeomanTransactionConstructorOptions = {
  geoman: Geoman;
  id: string;
  validate?: GeomanTransactionValidator;
  onDone: (transaction: GeomanTransaction) => void;
};

type TouchedFeature = {
  feature: FeatureData;
  ref: GeomanTransactionFeatureRef;
  before: GeoJsonShapeFeature;
};

export class GeomanTransaction {
  #onDone: (transaction: GeomanTransaction) => void;
  #status: GeomanTransactionStatus = 'active';
  #touchedFeatures = new Map<string, TouchedFeature>();

  readonly id: string;
  readonly geoman: Geoman;
  readonly validate?: GeomanTransactionValidator;

  constructor(options: GeomanTransactionConstructorOptions) {
    this.geoman = options.geoman;
    this.id = options.id;
    this.validate = options.validate;
    this.#onDone = options.onDone;
  }

  get status(): GeomanTransactionStatus {
    return this.#status;
  }

  updateProperty(feature: FeatureData, name: string, value: unknown): this {
    this.#assertActive();
    this.#withPreviewUpdate(() => {
      this.#captureFeature(feature);
      feature.updateProperty(name, value);
    });

    return this;
  }

  updateProperties(feature: FeatureData, properties: Record<string, unknown>): this {
    this.#assertActive();
    this.#withPreviewUpdate(() => {
      this.#captureFeature(feature);
      feature.updateProperties(properties);
    });

    return this;
  }

  updateGeometry(feature: FeatureData, geometry: BasicGeometry): this {
    this.#assertActive();
    this.#withPreviewUpdate(() => {
      this.#captureFeature(feature);
      feature.updateGeometry(geometry);
    });

    return this;
  }

  getChanges(): GeomanTransactionChange[] {
    return Array.from(this.#touchedFeatures.values()).map((entry) => ({
      feature: entry.feature,
      ref: entry.ref,
      before: cloneDeep(entry.before),
      after: cloneDeep(entry.feature.getGeoJson()),
    }));
  }

  isDirty(): boolean {
    return this.#touchedFeatures.size > 0;
  }

  commit(): GeomanTransactionCommitResult {
    this.#assertActive();

    const messages = normalizeValidationMessages(
      this.validate?.({
        id: this.id,
        getChanges: () => this.getChanges(),
        isDirty: () => this.isDirty(),
      }),
    );

    if (messages.length > 0) {
      return { committed: false, messages, historyEntryId: null };
    }

    const changes = this.getChanges();

    const historyEntry = this.geoman.history?.record(
      changes.map((change) => ({
        kind: 'update' as const,
        ref: {
          sourceName: change.ref.sourceName,
          featureId: change.ref.id,
        },
        before: change.before,
        after: change.after,
      })),
      { label: this.id },
    );

    this.#status = 'committed';
    this.#touchedFeatures.clear();
    this.#onDone(this);

    return { committed: true, messages: [], historyEntryId: historyEntry?.id ?? null };
  }

  cancel(): void {
    if (this.#status !== 'active') {
      return;
    }

    this.#withPreviewUpdate(() => {
      for (const entry of Array.from(this.#touchedFeatures.values()).reverse()) {
        entry.feature.restoreGeoJsonSnapshot(entry.before);
      }
    });

    this.#status = 'cancelled';
    this.#touchedFeatures.clear();
    this.#onDone(this);
  }

  #captureFeature(feature: FeatureData): void {
    const key = getFeatureKey(feature);

    if (this.#touchedFeatures.has(key)) {
      return;
    }

    this.#touchedFeatures.set(key, {
      feature,
      ref: { id: feature.id, sourceName: feature.sourceName },
      before: cloneDeep(feature.getGeoJson()),
    });
  }

  #assertActive(): void {
    if (this.#status !== 'active') {
      throw new Error(`Geoman transaction "${this.id}" is already ${this.#status}.`);
    }
  }

  #withAtomicUpdate<T>(callback: () => T): T {
    const updateManager = this.geoman.features?.updateManager;

    if (updateManager?.withAtomicSourcesUpdate) {
      return updateManager.withAtomicSourcesUpdate(callback);
    }

    return callback();
  }

  #withPreviewUpdate<T>(callback: () => T): T {
    const runAtomic = () => this.#withAtomicUpdate(callback);

    if (this.geoman.history?.suspend) {
      return this.geoman.history.suspend(runAtomic);
    }

    return runAtomic();
  }
}

function getFeatureKey(feature: FeatureData): string {
  return `${feature.sourceName}:${String(feature.id)}`;
}

function normalizeValidationMessages(
  result: ReturnType<NonNullable<GeomanTransactionValidator>>,
): string[] {
  if (result === undefined || result === true) {
    return [];
  }

  if (result === false) {
    return ['Transaction validation failed.'];
  }

  if (typeof result === 'string') {
    return [result];
  }

  if (Array.isArray(result)) {
    return result;
  }

  return result.valid
    ? []
    : result.messages?.length
      ? result.messages
      : ['Transaction validation failed.'];
}
