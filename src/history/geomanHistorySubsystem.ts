import type { Geoman } from '@/main.ts';
import { cloneDeep } from 'lodash-es';
import type {
  GeomanHistoryEntry,
  GeomanHistoryOperation,
  GeomanHistoryOptions,
  GeomanHistoryOptionsPartial,
  GeomanHistorySubscriptionCallback,
  GeomanHistorySubscriptionEvent,
  GeomanHistoryState,
} from './types.ts';
import type { AnyEventName, BaseEventListener } from '@/types/map/index.ts';

const HISTORY_SUBSCRIPTION_EVENT_NAMES = [
  'gm:historyrecord',
  'gm:historychange',
  'gm:undo',
  'gm:redo',
] as const satisfies ReadonlyArray<AnyEventName>;

export type GeomanHistorySubsystemOptions = {
  geoman: Geoman;
};

let historyEntryCounter = 0;

export class GeomanHistorySubsystem {
  private readonly geoman: Geoman;
  private options: GeomanHistoryOptions;
  private undoStack: GeomanHistoryEntry[] = [];
  private redoStack: GeomanHistoryEntry[] = [];
  private suspensionDepth = 0;
  private lastRecordedEntryId: string | null = null;
  private lastRecordedEntry: GeomanHistoryEntry | null = null;

  constructor({ geoman }: GeomanHistorySubsystemOptions) {
    this.geoman = geoman;
    this.options = {
      enabled: geoman.options.settings.history.enabled,
      maxEntries: geoman.options.settings.history.maxEntries,
    };
  }

  configure(options: GeomanHistoryOptionsPartial): void {
    this.options = {
      ...this.options,
      ...options,
    };
    this.enforceCapacity();
    this.fireChange();
  }

  getState(): GeomanHistoryState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      maxEntries: this.options.maxEntries,
      enabled: this.options.enabled,
    };
  }

  subscribe(callback: GeomanHistorySubscriptionCallback): () => void {
    callback(this.getState(), { type: 'initial', name: null });
    let suppressNextChange = false;

    const listeners = HISTORY_SUBSCRIPTION_EVENT_NAMES.map((eventName) => {
      const listener: BaseEventListener = (originalEvent) => {
        const event = createHistorySubscriptionEvent(String(eventName), originalEvent);
        if (event.type === 'change' && suppressNextChange) {
          suppressNextChange = false;
          return;
        }
        if (event.type === 'record' || event.type === 'undo' || event.type === 'redo') {
          suppressNextChange = true;
        }
        callback(this.getState(), event);
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

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getLastRecordedEntryId(): string | null {
    return this.lastRecordedEntryId;
  }

  getLastRecordedEntry(): GeomanHistoryEntry | null {
    return this.lastRecordedEntry ? cloneDeep(this.lastRecordedEntry) : null;
  }

  consumeLastRecordedEntryId(): string | null {
    const entryId = this.lastRecordedEntryId;
    this.lastRecordedEntryId = null;
    this.lastRecordedEntry = null;
    return entryId;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.lastRecordedEntryId = null;
    this.lastRecordedEntry = null;
    this.fireChange();
  }

  suspend<T>(callback: () => T): T {
    this.suspensionDepth += 1;
    try {
      return callback();
    } finally {
      this.suspensionDepth -= 1;
    }
  }

  record(
    operations: GeomanHistoryOperation[],
    options: { label?: string } = {},
  ): GeomanHistoryEntry | null {
    if (!this.options.enabled || this.suspensionDepth > 0 || operations.length === 0) {
      this.lastRecordedEntryId = null;
      this.lastRecordedEntry = null;
      return null;
    }

    const entry: GeomanHistoryEntry = {
      id: `gm-history-${++historyEntryCounter}`,
      label: options.label,
      createdAt: Date.now(),
      operations: cloneDeep(operations),
    };

    this.undoStack.push(entry);
    this.redoStack = [];
    this.lastRecordedEntryId = entry.id;
    this.lastRecordedEntry = cloneDeep(entry);
    this.enforceCapacity();
    this.fire('gm:historyrecord', { entry: cloneDeep(entry) });
    this.fireChange();
    return cloneDeep(entry);
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) {
      return false;
    }

    this.lastRecordedEntryId = null;
    this.lastRecordedEntry = null;
    this.suspend(() => {
      for (const operation of [...entry.operations].reverse()) {
        this.applySnapshot(operation.ref, operation.before);
      }
    });

    this.redoStack.push(entry);
    this.fire('gm:undo', { entry: cloneDeep(entry) });
    this.fireChange();
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) {
      return false;
    }

    this.lastRecordedEntryId = null;
    this.lastRecordedEntry = null;
    this.suspend(() => {
      for (const operation of entry.operations) {
        this.applySnapshot(operation.ref, operation.after);
      }
    });

    this.undoStack.push(entry);
    this.fire('gm:redo', { entry: cloneDeep(entry) });
    this.fireChange();
    return true;
  }

  private enforceCapacity(): void {
    const maxEntries = Math.max(0, Math.floor(this.options.maxEntries));
    if (this.undoStack.length > maxEntries) {
      this.undoStack = this.undoStack.slice(this.undoStack.length - maxEntries);
    }
    if (this.redoStack.length > maxEntries) {
      this.redoStack = this.redoStack.slice(this.redoStack.length - maxEntries);
    }
  }

  private applySnapshot(
    ref: GeomanHistoryOperation['ref'],
    snapshot: GeomanHistoryOperation['before'],
  ): void {
    if (!snapshot) {
      this.geoman.features.delete(ref);
      return;
    }

    const existing = this.geoman.features.get(ref.sourceName, ref.featureId);
    if (existing) {
      existing.restoreGeoJsonSnapshot(cloneDeep(snapshot));
      return;
    }

    this.geoman.features.createFeature({
      featureId: ref.featureId,
      shapeGeoJson: cloneDeep(snapshot),
      sourceName: ref.sourceName,
      imported: true,
    });
  }

  private fire(name: string, payload: Record<string, unknown>): void {
    const map = this.geoman.mapAdapter.getMapInstance() as {
      fire: (eventName: string, eventPayload: Record<string, unknown>) => void;
    };
    map.fire(name, payload);
  }

  private fireChange(): void {
    this.fire('gm:historychange', { state: this.getState() });
  }
}

function createHistorySubscriptionEvent(
  name: string,
  originalEvent: unknown,
): GeomanHistorySubscriptionEvent {
  const event = originalEvent as { entry?: GeomanHistoryEntry } | undefined;

  if (name === 'gm:historyrecord') {
    return {
      type: 'record',
      name,
      entry: event?.entry ? cloneDeep(event.entry) : undefined,
      originalEvent,
    };
  }
  if (name === 'gm:undo') {
    return {
      type: 'undo',
      name,
      entry: event?.entry ? cloneDeep(event.entry) : undefined,
      originalEvent,
    };
  }
  if (name === 'gm:redo') {
    return {
      type: 'redo',
      name,
      entry: event?.entry ? cloneDeep(event.entry) : undefined,
      originalEvent,
    };
  }

  return { type: 'change', name: 'gm:historychange', originalEvent };
}
