import type { FeatureData } from '@/core/features/feature-data.ts';
import type { Geoman } from '@/main.ts';
import type { GeomanTransaction } from './geomanTransaction.ts';
import type { GeomanTransactionSubsystem } from './geomanTransactionSubsystem.ts';
import type {
  GeomanFeaturePropertyEditorOptions,
  GeomanFeaturePropertyEditorState,
  GeomanFeaturePropertyEditorSubscription,
  GeomanTransactionCommitResult,
  GeomanTransactionValidationResult,
} from './types.ts';

export class GeomanFeaturePropertyEditor {
  readonly id: string;

  readonly #geoman: Geoman;
  readonly #transactions: GeomanTransactionSubsystem;
  readonly #feature: FeatureData;
  readonly #validate?: GeomanFeaturePropertyEditorOptions['validate'];
  readonly #label?: string;
  readonly #subscribers = new Set<GeomanFeaturePropertyEditorSubscription>();
  readonly #unsubscribeFeatureChanges?: () => void;
  readonly #unsubscribeHistoryChanges?: () => void;

  #transaction: GeomanTransaction | null = null;
  #disposed = false;
  #validationMessages: string[] = [];
  #releasingUnavailableTransaction = false;

  constructor(
    options: GeomanFeaturePropertyEditorOptions & {
      geoman: Geoman;
      transactions: GeomanTransactionSubsystem;
    },
  ) {
    this.#geoman = options.geoman;
    this.#transactions = options.transactions;
    this.#feature = options.feature;
    this.id = options.id;
    this.#validate = options.validate;
    this.#label = options.label;
    this.#unsubscribeFeatureChanges = this.#geoman.features?.subscribe?.(() => {
      this.#releaseUnavailableTransaction();
      this.#emit();
    });
    this.#unsubscribeHistoryChanges = this.#geoman.history?.subscribe?.((_state, event) => {
      if (event?.type !== 'initial') {
        this.#emit();
      }
    });
  }

  set(propertyName: string, value: unknown): void {
    this.#assertUsable();
    const transaction = this.#ensureTransaction();
    transaction.updateProperty(this.#feature, propertyName, value);
    this.#validationMessages = [];
    this.#emit();
  }

  commit(): GeomanTransactionCommitResult {
    this.#assertUsable();
    const transaction = this.#transaction;

    if (!transaction || transaction.status !== 'active' || !transaction.isDirty()) {
      return { committed: true, messages: [], historyEntryId: null };
    }

    const result = transaction.commit();
    this.#validationMessages = result.messages;

    if (result.committed) {
      this.#transaction = null;
      this.#validationMessages = [];
    }

    this.#emit();
    return result;
  }

  cancel(): void {
    if (this.#disposed) {
      return;
    }

    if (this.#transaction?.status === 'active') {
      this.#transaction.cancel();
    }

    this.#transaction = null;
    this.#validationMessages = [];
    this.#emit();
  }

  undo(): boolean {
    if (!this.getState().canUndo) {
      return false;
    }

    const applied = this.#geoman.history?.undo?.() ?? false;
    this.#emit();
    return applied;
  }

  redo(): boolean {
    if (!this.getState().canRedo) {
      return false;
    }

    const applied = this.#geoman.history?.redo?.() ?? false;
    this.#emit();
    return applied;
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    if (this.#transaction?.status === 'active') {
      this.#transaction.cancel();
    }

    this.#transaction = null;
    this.#validationMessages = [];
    this.#disposed = true;
    this.#unsubscribeFeatureChanges?.();
    this.#unsubscribeHistoryChanges?.();
    this.#subscribers.clear();
  }

  getState(): GeomanFeaturePropertyEditorState {
    this.#releaseUnavailableTransaction();

    const activeTransaction = this.#transactions.getActive();
    const blockedTransaction =
      activeTransaction && activeTransaction !== this.#transaction ? activeTransaction : null;
    const available = !this.#disposed && this.#isFeatureAvailable();
    const dirty =
      available && this.#transaction?.status === 'active' ? this.#transaction.isDirty() : false;
    const active = available && this.#transaction?.status === 'active';
    const history = this.#geoman.history?.getState?.() ?? null;
    const blocked = Boolean(blockedTransaction);
    const values = available ? this.#readProperties() : {};
    const canCommit =
      available && active && dirty && !blocked && this.#validationMessages.length === 0;
    const canCancel = available && active && dirty && !blocked;
    const canUndo = available && !dirty && !blocked && Boolean(history?.canUndo);
    const canRedo = available && !dirty && !blocked && Boolean(history?.canRedo);

    return {
      id: this.id,
      values,
      properties: values,
      dirty,
      active,
      available,
      disposed: this.#disposed,
      blocked,
      blockReason: blockedTransaction ? `transaction "${blockedTransaction.id}" is active.` : null,
      canCommit,
      canCancel,
      canUndo,
      canRedo,
      validationMessages: [...this.#validationMessages],
      history,
    };
  }

  subscribe(callback: GeomanFeaturePropertyEditorSubscription): () => void {
    if (this.#disposed) {
      callback(this.getState());
      return () => {};
    }

    callback(this.getState());
    this.#subscribers.add(callback);

    let unsubscribed = false;
    return () => {
      if (unsubscribed) {
        return;
      }
      unsubscribed = true;
      this.#subscribers.delete(callback);
    };
  }

  #ensureTransaction(): GeomanTransaction {
    const activeTransaction = this.#transactions.getActive();

    if (activeTransaction && activeTransaction !== this.#transaction) {
      const blockReason = `transaction "${activeTransaction.id}" is active.`;
      this.#emit();
      throw new Error(`Cannot edit feature properties while ${blockReason}`);
    }

    if (this.#transaction?.status === 'active') {
      return this.#transaction;
    }

    this.#transaction = this.#transactions.start({
      id: this.id,
      label: this.#label,
      validate: () => this.#validateState(),
    });
    return this.#transaction;
  }

  #validateState(): GeomanTransactionValidationResult {
    return this.#validate?.({
      feature: this.#feature,
      id: this.id,
      values: this.#readProperties(),
      properties: this.#readProperties(),
    });
  }

  #readProperties(): Record<string, unknown> {
    try {
      return this.#feature.getTypedProperties<Record<string, unknown>>();
    } catch {
      return {};
    }
  }

  #isFeatureAvailable(): boolean {
    try {
      const current = this.#geoman.features?.get?.(this.#feature.sourceName, this.#feature.id);
      return current === this.#feature;
    } catch {
      return false;
    }
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new Error(`Feature property editor "${this.id}" is disposed.`);
    }

    if (!this.#isFeatureAvailable()) {
      throw new Error(`Feature property editor "${this.id}" feature is unavailable.`);
    }
  }

  #releaseUnavailableTransaction(): void {
    if (this.#disposed || this.#releasingUnavailableTransaction || this.#isFeatureAvailable()) {
      return;
    }

    this.#releasingUnavailableTransaction = true;
    try {
      if (this.#transaction?.status === 'active') {
        this.#transaction.cancel();
      }

      this.#transaction = null;
      this.#validationMessages = [];
    } finally {
      this.#releasingUnavailableTransaction = false;
    }
  }

  #emit(): void {
    if (this.#disposed) {
      return;
    }

    const state = this.getState();
    this.#subscribers.forEach((callback) => {
      callback(state);
    });
  }
}
