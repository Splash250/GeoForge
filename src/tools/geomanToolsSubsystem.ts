import { GM_SYSTEM_PREFIX } from '@/core/constants.ts';
import type { Geoman } from '@/main.ts';
import type {
  GmHelperToolCancelEvent,
  GmHelperToolEndEvent,
  GmHelperToolStartEvent,
} from '@/types/events/helper.ts';
import { GeomanToolInteractionListener } from './geomanToolInteractionListener.ts';
import type {
  GeomanToolCancelReason,
  GeomanToolContext,
  GeomanToolControlState,
  GeomanToolDefinition,
} from './types.ts';

export type GeomanToolsSubsystemOptions = {
  geoman: Geoman;
};

export class GeomanToolsSubsystem {
  private readonly options: GeomanToolsSubsystemOptions;
  private readonly definitions = new Map<string, GeomanToolDefinition>();
  private readonly cancellingLifecycleTokens = new Set<number>();
  private readonly endingLifecycleTokens = new Set<number>();
  private readonly startedLifecycleTokens = new Set<number>();
  private readonly interactionListener: GeomanToolInteractionListener;
  private queuedLifecycleEvents: Array<() => void> = [];
  private lifecycleEventQueueDepth = 0;
  private nextLifecycleToken = 0;
  private activeToolId: string | null = null;
  private activeLifecycleToken = 0;
  private context: GeomanToolContext | null = null;

  constructor(options: GeomanToolsSubsystemOptions) {
    this.options = options;
    this.interactionListener = new GeomanToolInteractionListener({
      geoman: this.options.geoman,
      getActiveDefinition: () => this.getActiveDefinition(),
      getContext: () => this.getContext(),
    });
  }

  register(definition: GeomanToolDefinition) {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Geoman tool "${definition.id}" is already registered`);
    }

    this.definitions.set(definition.id, definition);
    this.options.geoman.control?.updateReactivePanel?.();
    return this;
  }

  activate(id: string) {
    if (this.activeToolId === id) {
      return this;
    }

    const definition = this.getRegisteredDefinition(id);
    this.endActiveTool();
    this.activeToolId = id;
    const lifecycleToken = ++this.nextLifecycleToken;
    this.activeLifecycleToken = lifecycleToken;

    try {
      definition.onStart?.(this.getContext());

      if (!this.isActiveLifecycle(id, lifecycleToken)) {
        return this;
      }

      this.interactionListener.start();
      this.startedLifecycleTokens.add(lifecycleToken);
      this.emitToolStart(id);
    } catch (error) {
      this.startedLifecycleTokens.delete(lifecycleToken);

      if (this.isActiveLifecycle(id, lifecycleToken)) {
        this.clearActiveLifecycle();
        this.interactionListener.stop(definition);
      }

      throw error;
    }

    return this;
  }

  deactivate(id?: string) {
    if (id !== undefined && this.activeToolId !== id) {
      return this;
    }

    this.endActiveTool();
    return this;
  }

  cancel(reason: GeomanToolCancelReason = 'api') {
    const cancelledToolId = this.activeToolId;
    const cancelledLifecycleToken = this.activeLifecycleToken;

    if (cancelledToolId === null || this.cancellingLifecycleTokens.has(cancelledLifecycleToken)) {
      return this;
    }

    const definition = this.definitions.get(cancelledToolId);
    const lifecycleStarted = this.startedLifecycleTokens.has(cancelledLifecycleToken);
    let cancelError: unknown;
    let lifecycleError: unknown;

    this.cancellingLifecycleTokens.add(cancelledLifecycleToken);
    this.beginLifecycleEventQueue();

    try {
      definition?.onCancel?.(this.getContext(), reason);
    } catch (error) {
      cancelError = error;
    } finally {
      this.cancellingLifecycleTokens.delete(cancelledLifecycleToken);
    }

    try {
      if (cancelError === undefined && lifecycleStarted) {
        this.emitToolCancel(cancelledToolId, reason, { immediate: true });
      }

      if (this.isActiveLifecycle(cancelledToolId, cancelledLifecycleToken)) {
        this.endActiveTool();
      }
    } catch (error) {
      lifecycleError = error;
    }

    try {
      this.flushLifecycleEventQueue();
    } catch (error) {
      if (lifecycleError === undefined) {
        lifecycleError = error;
      }
    }

    if (cancelError !== undefined) {
      throw cancelError;
    }

    if (lifecycleError !== undefined) {
      throw lifecycleError;
    }

    return this;
  }

  getActiveToolId() {
    return this.activeToolId;
  }

  get(id: string) {
    return this.definitions.get(id) ?? null;
  }

  getAll() {
    return Array.from(this.definitions.values());
  }

  getToolControls(): Array<GeomanToolControlState> {
    return this.getAll().flatMap((definition) => {
      if (!definition.control) {
        return [];
      }

      return [
        {
          toolId: definition.id,
          title: definition.control.title ?? definition.title ?? definition.id,
          icon: definition.control.icon ?? null,
          uiEnabled: definition.control.uiEnabled ?? true,
          eventType: definition.control.eventType ?? 'toggle',
          active: this.activeToolId === definition.id,
        },
      ];
    });
  }

  destroy() {
    try {
      this.endActiveTool({ emitLifecycleEvent: false });
    } catch {
      // Destroy must not let consumer teardown hooks interrupt Geoman cleanup.
    } finally {
      this.activeToolId = null;
      this.activeLifecycleToken = 0;
      this.definitions.clear();
      this.context = null;
      this.startedLifecycleTokens.clear();
      this.queuedLifecycleEvents = [];
      this.lifecycleEventQueueDepth = 0;
    }
  }

  private getRegisteredDefinition(id: string) {
    const definition = this.definitions.get(id);

    if (!definition) {
      throw new Error(`Geoman tool "${id}" is not registered`);
    }

    return definition;
  }

  private getActiveDefinition() {
    if (this.activeToolId === null) {
      return null;
    }

    return this.definitions.get(this.activeToolId) ?? null;
  }

  private endActiveTool({ emitLifecycleEvent = true }: { emitLifecycleEvent?: boolean } = {}) {
    const endingToolId = this.activeToolId;
    const endingLifecycleToken = this.activeLifecycleToken;
    if (
      endingToolId === null ||
      endingLifecycleToken === 0 ||
      this.endingLifecycleTokens.has(endingLifecycleToken)
    ) {
      return;
    }

    const definition = this.definitions.get(endingToolId);
    const lifecycleStarted = this.startedLifecycleTokens.has(endingLifecycleToken);
    let interactionError: unknown;

    this.endingLifecycleTokens.add(endingLifecycleToken);

    try {
      try {
        if (lifecycleStarted) {
          this.interactionListener.stop(definition ?? null);
        }
      } catch (error) {
        interactionError = error;
      }

      if (this.isActiveLifecycle(endingToolId, endingLifecycleToken)) {
        this.clearActiveLifecycle();
      }

      let endError: unknown;
      try {
        definition?.onEnd?.(this.getContext());
      } catch (error) {
        endError = error;
      }

      this.startedLifecycleTokens.delete(endingLifecycleToken);

      if (
        interactionError === undefined &&
        endError === undefined &&
        emitLifecycleEvent &&
        lifecycleStarted
      ) {
        this.emitToolEnd(endingToolId);
      }

      if (endError !== undefined && interactionError === undefined) {
        throw endError;
      }

      if (interactionError !== undefined) {
        throw interactionError;
      }
    } finally {
      this.endingLifecycleTokens.delete(endingLifecycleToken);
    }
  }

  private isActiveLifecycle(toolId: string, lifecycleToken: number) {
    return this.activeToolId === toolId && this.activeLifecycleToken === lifecycleToken;
  }

  private clearActiveLifecycle() {
    this.activeToolId = null;
    this.activeLifecycleToken = 0;
  }

  private beginLifecycleEventQueue() {
    this.lifecycleEventQueueDepth += 1;
  }

  private flushLifecycleEventQueue() {
    this.lifecycleEventQueueDepth -= 1;

    if (this.lifecycleEventQueueDepth > 0) {
      return;
    }

    const queuedEvents = this.queuedLifecycleEvents;
    this.queuedLifecycleEvents = [];

    for (const emit of queuedEvents) {
      emit();
    }
  }

  private emitLifecycleEvent(emit: () => void) {
    if (this.lifecycleEventQueueDepth > 0) {
      this.queuedLifecycleEvents.push(emit);
      return;
    }

    emit();
  }

  private getContext(): GeomanToolContext {
    if (!this.context) {
      const geoman = this.options.geoman;
      this.context = {
        geoman,
        map: geoman.mapAdapter.getMapInstance(),
        features: geoman.features,
        selection: geoman.selection,
        contextPanels: geoman.contextPanels,
        modes: geoman.modes,
      };
    }

    return this.context;
  }

  private emitToolStart(toolId: string) {
    const event: GmHelperToolStartEvent = {
      name: `${GM_SYSTEM_PREFIX}:helper:tool_start`,
      level: 'system',
      actionType: 'helper',
      action: 'tool_start',
      toolId,
    };

    this.emitLifecycleEvent(() => {
      this.options.geoman.events.fire(`${GM_SYSTEM_PREFIX}:helper`, event);
    });
  }

  private emitToolEnd(toolId: string) {
    const event: GmHelperToolEndEvent = {
      name: `${GM_SYSTEM_PREFIX}:helper:tool_end`,
      level: 'system',
      actionType: 'helper',
      action: 'tool_end',
      toolId,
    };

    this.emitLifecycleEvent(() => {
      this.options.geoman.events.fire(`${GM_SYSTEM_PREFIX}:helper`, event);
    });
  }

  private emitToolCancel(
    toolId: string,
    reason: GeomanToolCancelReason,
    { immediate = false }: { immediate?: boolean } = {},
  ) {
    const event: GmHelperToolCancelEvent = {
      name: `${GM_SYSTEM_PREFIX}:helper:tool_cancel`,
      level: 'system',
      actionType: 'helper',
      action: 'tool_cancel',
      toolId,
      reason,
    };

    const emit = () => {
      this.options.geoman.events.fire(`${GM_SYSTEM_PREFIX}:helper`, event);
    };

    if (immediate) {
      emit();
      return;
    }

    this.emitLifecycleEvent(emit);
  }
}
