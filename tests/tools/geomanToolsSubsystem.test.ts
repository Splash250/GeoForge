import { describe, expect, test, vi } from 'vitest';
import { GeomanToolsSubsystem } from '../../src/tools/geomanToolsSubsystem.ts';
import type { GeomanToolContext } from '../../src/tools/types.ts';

function createGeomanStub() {
  const map = { id: 'map' };
  const contextPanels = { id: 'contextPanels', close: vi.fn() };
  const handlers = new Map<string, Array<(event: unknown) => { next: boolean }>>();
  const attachEvents = vi.fn((eventHandlers: Record<string, unknown>) => {
    Object.entries(eventHandlers).forEach(([eventName, handler]) => {
      if (typeof handler !== 'function') {
        return;
      }

      handlers.set(eventName, [
        handler as (event: unknown) => { next: boolean },
        ...(handlers.get(eventName) ?? []),
      ]);
    });
  });
  const detachEvents = vi.fn((eventHandlers: Record<string, unknown>) => {
    Object.entries(eventHandlers).forEach(([eventName, handler]) => {
      const currentHandlers = handlers.get(eventName) ?? [];
      const nextHandlers = currentHandlers.filter((item) => item !== handler);
      if (nextHandlers.length === 0) {
        handlers.delete(eventName);
      } else {
        handlers.set(eventName, nextHandlers);
      }
    });
  });
  const geoman = {
    mapAdapter: {
      getMapInstance: vi.fn(() => map),
      setCursor: vi.fn(),
    },
    features: { id: 'features' },
    selection: {
      id: 'selection',
      activate: vi.fn(),
      deactivate: vi.fn(),
      clearHoveredFeature: vi.fn(),
      setHoveredFeature: vi.fn(),
      selectFeature: vi.fn(),
      isSelectableFeature: vi.fn((feature: unknown) => !!feature),
    },
    contextPanels,
    modes: { id: 'modes' },
    events: {
      fire: vi.fn(),
      bus: {
        attachEvents,
        detachEvents,
      },
    },
  };

  const emitMapEvent = (eventName: string, event: unknown) => {
    let result = { next: true };
    handlers.get(eventName)?.some((handler) => {
      result = handler(event);
      return !result.next;
    });
    return result;
  };

  const getHandlerCount = (eventName: string) => handlers.get(eventName)?.length ?? 0;

  return { geoman, map, emitMapEvent, getHandlerCount };
}

function createFeature(id: string, parent: unknown = null, shape = 'line') {
  return {
    id,
    sourceName: 'gm_main',
    shape,
    parent,
  };
}

function createPointerEvent(type: 'click' | 'mousemove' | 'mouseleave' | 'contextmenu') {
  const preventDefault = vi.fn();
  return {
    type,
    point: { x: 10, y: 20 },
    lngLat: { lng: 1, lat: 2 },
    originalEvent: {
      type,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      preventDefault,
    },
    target: { id: 'map' },
  };
}

function createContextMenuEvent() {
  return createPointerEvent('contextmenu');
}

describe('GeomanToolsSubsystem', () => {
  test('registers tool definitions and returns the subsystem', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const definition = { id: 'inspect-feature', title: 'Inspect feature' };

    const result = tools.register(definition);

    expect(result).toBe(tools);
    expect(tools.get('inspect-feature')).toBe(definition);
    expect(tools.getAll()).toEqual([definition]);
  });

  test('normalizes registered tool control metadata', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });

    tools.register({
      id: 'inspect-feature',
      title: 'Inspect feature',
      control: {
        icon: '<svg />',
      },
    });
    tools.register({
      id: 'delete-feature',
      control: {
        title: 'Delete feature',
        uiEnabled: false,
        eventType: 'click',
      },
    });

    expect(tools.getToolControls()).toEqual([
      {
        toolId: 'inspect-feature',
        title: 'Inspect feature',
        icon: '<svg />',
        uiEnabled: true,
        eventType: 'toggle',
        active: false,
      },
      {
        toolId: 'delete-feature',
        title: 'Delete feature',
        icon: null,
        uiEnabled: false,
        eventType: 'click',
        active: false,
      },
    ]);
  });

  test('reports tool control active state from active tool id', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });

    tools.register({
      id: 'inspect-feature',
      control: {
        title: 'Inspect feature',
      },
    });

    expect(tools.getToolControls()[0]?.active).toBe(false);

    tools.activate('inspect-feature');
    expect(tools.getToolControls()[0]?.active).toBe(true);

    tools.deactivate('inspect-feature');
    expect(tools.getToolControls()[0]?.active).toBe(false);
  });

  test('throws on duplicate tool ids', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });

    tools.register({ id: 'inspect-feature' });

    expect(() => tools.register({ id: 'inspect-feature' })).toThrow(
      'Geoman tool "inspect-feature" is already registered',
    );
  });

  test('activates, deactivates, and reports the active tool id with stable context', () => {
    const { geoman, map } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onStart = vi.fn();
    const onEnd = vi.fn();
    tools.register({ id: 'inspect-feature', onStart, onEnd });

    tools.activate('inspect-feature');
    const startContext = onStart.mock.calls[0][0] as GeomanToolContext;
    tools.deactivate('inspect-feature');
    const endContext = onEnd.mock.calls[0][0] as GeomanToolContext;

    expect(tools.getActiveToolId()).toBeNull();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(startContext).toBe(endContext);
    expect(startContext).toEqual({
      geoman,
      map,
      features: geoman.features,
      selection: geoman.selection,
      contextPanels: geoman.contextPanels,
      modes: geoman.modes,
    });
  });

  test('activation emits a tool start event after onStart succeeds', () => {
    const { geoman, map } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onStart = vi.fn(() => {
      expect(tools.getActiveToolId()).toBe('inspect-feature');
      expect(geoman.events.fire).not.toHaveBeenCalled();
    });
    tools.register({ id: 'inspect-feature', onStart });

    tools.activate('inspect-feature');

    expect(geoman.events.fire).toHaveBeenCalledWith(
      '_gm:helper',
      expect.objectContaining({
        name: '_gm:helper:tool_start',
        actionType: 'helper',
        action: 'tool_start',
        toolId: 'inspect-feature',
      }),
    );
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ map }));
  });

  test('failed activation does not emit a tool start event', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onStartError = new Error('start failed');
    tools.register({
      id: 'inspect-feature',
      onStart: () => {
        throw onStartError;
      },
    });

    expect(() => tools.activate('inspect-feature')).toThrow(onStartError);

    expect(geoman.events.fire).not.toHaveBeenCalledWith(
      '_gm:helper',
      expect.objectContaining({ action: 'tool_start' }),
    );
  });

  test('activation does not start interactions or emit tool start when onStart deactivates it', () => {
    const { geoman, getHandlerCount } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    tools.register({
      id: 'inspect-feature',
      onStart: () => tools.deactivate('inspect-feature'),
    });

    tools.activate('inspect-feature');

    expect(tools.getActiveToolId()).toBeNull();
    expect(getHandlerCount('mousemove')).toBe(0);
    expect(getHandlerCount('click')).toBe(0);
    expect(getHandlerCount('mouseleave')).toBe(0);
    expect(geoman.events.fire).not.toHaveBeenCalledWith(
      '_gm:helper',
      expect.objectContaining({ action: 'tool_start', toolId: 'inspect-feature' }),
    );
  });

  test('activation does not emit stale original tool start when onStart activates a replacement', () => {
    const { geoman, getHandlerCount } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    tools.register({
      id: 'inspect-feature',
      onStart: () => tools.activate('measure-feature'),
    });
    tools.register({ id: 'measure-feature' });

    tools.activate('inspect-feature');

    const lifecycleEvents = geoman.events.fire.mock.calls.map(([, payload]) => ({
      action: payload.action,
      toolId: payload.toolId,
    }));
    expect(tools.getActiveToolId()).toBe('measure-feature');
    expect(getHandlerCount('mousemove')).toBe(1);
    expect(lifecycleEvents).toEqual([{ action: 'tool_start', toolId: 'measure-feature' }]);
  });

  test('activation does not emit lifecycle events when onStart cancels itself', () => {
    const { geoman, getHandlerCount } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    tools.register({
      id: 'inspect-feature',
      onStart: () => tools.cancel('api'),
    });

    tools.activate('inspect-feature');

    const lifecycleEvents = geoman.events.fire.mock.calls.map(([, payload]) => ({
      action: payload.action,
      toolId: payload.toolId,
    }));
    expect(tools.getActiveToolId()).toBeNull();
    expect(getHandlerCount('mousemove')).toBe(0);
    expect(getHandlerCount('click')).toBe(0);
    expect(getHandlerCount('mouseleave')).toBe(0);
    expect(lifecycleEvents).toEqual([]);
  });

  test('activation does not emit stale lifecycle events when a replacement cancels itself onStart', () => {
    const { geoman, getHandlerCount } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    tools.register({
      id: 'inspect-feature',
      onStart: () => tools.activate('measure-feature'),
    });
    tools.register({
      id: 'measure-feature',
      onStart: () => tools.cancel('api'),
    });

    tools.activate('inspect-feature');

    const lifecycleEvents = geoman.events.fire.mock.calls.map(([, payload]) => ({
      action: payload.action,
      toolId: payload.toolId,
    }));
    expect(tools.getActiveToolId()).toBeNull();
    expect(getHandlerCount('mousemove')).toBe(0);
    expect(getHandlerCount('click')).toBe(0);
    expect(getHandlerCount('mouseleave')).toBe(0);
    expect(lifecycleEvents).toEqual([]);
  });

  test('deactivation emits a tool end event after onEnd succeeds', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onEnd = vi.fn(() => {
      expect(tools.getActiveToolId()).toBeNull();
      expect(geoman.events.fire).toHaveBeenCalledWith(
        '_gm:helper',
        expect.objectContaining({ action: 'tool_start', toolId: 'inspect-feature' }),
      );
      expect(geoman.events.fire).not.toHaveBeenCalledWith(
        '_gm:helper',
        expect.objectContaining({ action: 'tool_end' }),
      );
    });
    tools.register({ id: 'inspect-feature', onEnd });

    tools.activate('inspect-feature');
    tools.deactivate('inspect-feature');

    expect(geoman.events.fire).toHaveBeenCalledWith(
      '_gm:helper',
      expect.objectContaining({
        name: '_gm:helper:tool_end',
        actionType: 'helper',
        action: 'tool_end',
        toolId: 'inspect-feature',
      }),
    );
  });

  test('deactivating an active tool closes open context panels', () => {
    const { geoman } = createGeomanStub();
    geoman.contextPanels = { close: vi.fn() } as never;
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });

    tools.register({ id: 'inspect-feature' });
    tools.activate('inspect-feature');
    tools.deactivate('inspect-feature');

    expect(geoman.contextPanels.close).toHaveBeenCalledWith('tool-end');
  });

  test('switching active tools emits old tool end before new tool start', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    tools.register({ id: 'inspect-feature' });
    tools.register({ id: 'measure-feature' });

    tools.activate('inspect-feature');
    tools.activate('measure-feature');

    const lifecycleEvents = geoman.events.fire.mock.calls.map(([, payload]) => ({
      action: payload.action,
      toolId: payload.toolId,
    }));
    expect(lifecycleEvents).toEqual([
      { action: 'tool_start', toolId: 'inspect-feature' },
      { action: 'tool_end', toolId: 'inspect-feature' },
      { action: 'tool_start', toolId: 'measure-feature' },
    ]);
  });

  test('failed deactivation does not emit a tool end event', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onEndError = new Error('end failed');
    tools.register({
      id: 'inspect-feature',
      onEnd: () => {
        throw onEndError;
      },
    });

    tools.activate('inspect-feature');

    expect(() => tools.deactivate('inspect-feature')).toThrow(onEndError);
    expect(geoman.events.fire).not.toHaveBeenCalledWith(
      '_gm:helper',
      expect.objectContaining({ action: 'tool_end' }),
    );
  });

  test('activating an already active tool is a no-op', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onStart = vi.fn();
    const onEnd = vi.fn();
    tools.register({ id: 'inspect-feature', onStart, onEnd });

    tools.activate('inspect-feature');
    tools.activate('inspect-feature');

    expect(tools.getActiveToolId()).toBe('inspect-feature');
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
  });

  test('rolls back active state when onStart throws', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onStartError = new Error('start failed');
    const onEnd = vi.fn();
    tools.register({
      id: 'inspect-feature',
      onStart: () => {
        throw onStartError;
      },
      onEnd,
    });

    expect(() => tools.activate('inspect-feature')).toThrow(onStartError);
    expect(tools.getActiveToolId()).toBeNull();
    tools.deactivate();

    expect(tools.getActiveToolId()).toBeNull();
    expect(onEnd).not.toHaveBeenCalled();
  });

  test('ends the current tool before starting another tool', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const order: string[] = [];
    tools.register({
      id: 'inspect-feature',
      onStart: () => order.push('inspect:start'),
      onEnd: () => order.push('inspect:end'),
    });
    tools.register({
      id: 'measure-feature',
      onStart: () => order.push('measure:start'),
      onEnd: () => order.push('measure:end'),
    });

    tools.activate('inspect-feature');
    tools.activate('measure-feature');

    expect(tools.getActiveToolId()).toBe('measure-feature');
    expect(order).toEqual(['inspect:start', 'inspect:end', 'measure:start']);
  });

  test('deactivate with a non-active id does not end another active tool', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onEnd = vi.fn();
    tools.register({ id: 'inspect-feature', onEnd });
    tools.register({ id: 'measure-feature' });

    tools.activate('inspect-feature');
    tools.deactivate('measure-feature');

    expect(tools.getActiveToolId()).toBe('inspect-feature');
    expect(onEnd).not.toHaveBeenCalled();
  });

  test('deactivate clears active state when onEnd throws', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onEndError = new Error('end failed');
    const onEnd = vi.fn(() => {
      throw onEndError;
    });
    tools.register({ id: 'inspect-feature', onEnd });

    tools.activate('inspect-feature');

    expect(() => tools.deactivate('inspect-feature')).toThrow(onEndError);
    tools.deactivate();

    expect(tools.getActiveToolId()).toBeNull();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('cancel calls onCancel before onEnd and clears active state', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const order: string[] = [];
    tools.register({
      id: 'inspect-feature',
      onCancel: () => order.push('cancel'),
      onEnd: () => order.push('end'),
    });

    tools.activate('inspect-feature');
    const result = tools.cancel('api');

    expect(result).toBe(tools);
    expect(tools.getActiveToolId()).toBeNull();
    expect(order).toEqual(['cancel', 'end']);
  });

  test('cancel emits tool cancel before tool end after onCancel succeeds', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    tools.register({ id: 'inspect-feature', onCancel: vi.fn(), onEnd: vi.fn() });

    tools.activate('inspect-feature');
    tools.cancel('api');

    const lifecycleEvents = geoman.events.fire.mock.calls.map(([, payload]) => ({
      action: payload.action,
      toolId: payload.toolId,
      reason: payload.reason,
    }));
    expect(lifecycleEvents).toEqual([
      { action: 'tool_start', toolId: 'inspect-feature', reason: undefined },
      { action: 'tool_cancel', toolId: 'inspect-feature', reason: 'api' },
      { action: 'tool_end', toolId: 'inspect-feature', reason: undefined },
    ]);
  });

  test('failed cancel does not emit a tool cancel event', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onCancelError = new Error('cancel failed');
    tools.register({
      id: 'inspect-feature',
      onCancel: () => {
        throw onCancelError;
      },
      onEnd: vi.fn(),
    });

    tools.activate('inspect-feature');

    expect(() => tools.cancel('api')).toThrow(onCancelError);
    expect(geoman.events.fire).not.toHaveBeenCalledWith(
      '_gm:helper',
      expect.objectContaining({ action: 'tool_cancel' }),
    );
  });

  test('cancel is a no-op when no tool is active', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onCancel = vi.fn();
    const onEnd = vi.fn();
    tools.register({ id: 'inspect-feature', onCancel, onEnd });

    const result = tools.cancel('api');

    expect(result).toBe(tools);
    expect(tools.getActiveToolId()).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  test('cancel deactivates the active tool when onCancel is missing', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onEnd = vi.fn();
    tools.register({ id: 'inspect-feature', onEnd });

    tools.activate('inspect-feature');
    tools.cancel('api');

    expect(tools.getActiveToolId()).toBeNull();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('cancel passes stable context and reason to onCancel', () => {
    const { geoman, map } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onStart = vi.fn();
    const onCancel = vi.fn();
    const onEnd = vi.fn();
    tools.register({ id: 'inspect-feature', onStart, onCancel, onEnd });

    tools.activate('inspect-feature');
    const startContext = onStart.mock.calls[0][0] as GeomanToolContext;
    tools.cancel('api');
    const cancelContext = onCancel.mock.calls[0][0] as GeomanToolContext;
    const cancelReason = onCancel.mock.calls[0][1] as unknown;
    const endContext = onEnd.mock.calls[0][0] as GeomanToolContext;

    expect(cancelContext).toBe(startContext);
    expect(endContext).toBe(startContext);
    expect(cancelReason).toBe('api');
    expect(cancelContext).toEqual({
      geoman,
      map,
      features: geoman.features,
      selection: geoman.selection,
      contextPanels: geoman.contextPanels,
      modes: geoman.modes,
    });
  });

  test('cancel defaults the reason to api', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onCancel = vi.fn();
    tools.register({ id: 'inspect-feature', onCancel });

    tools.activate('inspect-feature');
    tools.cancel();

    expect(onCancel).toHaveBeenCalledWith(expect.any(Object), 'api');
  });

  test('cancel leaves a replacement tool active when onCancel activates it', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const order: string[] = [];
    tools.register({
      id: 'inspect-feature',
      onCancel: () => {
        order.push('inspect:cancel');
        tools.activate('measure-feature');
      },
      onEnd: () => order.push('inspect:end'),
    });
    tools.register({
      id: 'measure-feature',
      onStart: () => order.push('measure:start'),
      onEnd: () => order.push('measure:end'),
    });

    tools.activate('inspect-feature');
    tools.cancel('api');

    expect(tools.getActiveToolId()).toBe('measure-feature');
    expect(order).toEqual(['inspect:cancel', 'inspect:end', 'measure:start']);
  });

  test('cancel does not call onEnd twice when onCancel deactivates the current tool', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onEnd = vi.fn();
    tools.register({
      id: 'inspect-feature',
      onCancel: () => tools.deactivate('inspect-feature'),
      onEnd,
    });

    tools.activate('inspect-feature');
    tools.cancel('api');

    expect(tools.getActiveToolId()).toBeNull();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('cancel emits old tool cancel before old tool end when onCancel deactivates it', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    tools.register({
      id: 'inspect-feature',
      onCancel: () => tools.deactivate('inspect-feature'),
      onEnd: vi.fn(),
    });

    tools.activate('inspect-feature');
    tools.cancel('api');

    const lifecycleEvents = geoman.events.fire.mock.calls.map(([, payload]) => ({
      action: payload.action,
      toolId: payload.toolId,
      reason: payload.reason,
    }));
    expect(lifecycleEvents).toEqual([
      { action: 'tool_start', toolId: 'inspect-feature', reason: undefined },
      { action: 'tool_cancel', toolId: 'inspect-feature', reason: 'api' },
      { action: 'tool_end', toolId: 'inspect-feature', reason: undefined },
    ]);
  });

  test('cancel emits old tool cancel before old tool end and replacement start when onCancel activates a replacement', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    tools.register({
      id: 'inspect-feature',
      onCancel: () => tools.activate('measure-feature'),
      onEnd: vi.fn(),
    });
    tools.register({ id: 'measure-feature' });

    tools.activate('inspect-feature');
    tools.cancel('api');

    const lifecycleEvents = geoman.events.fire.mock.calls.map(([, payload]) => ({
      action: payload.action,
      toolId: payload.toolId,
      reason: payload.reason,
    }));
    expect(tools.getActiveToolId()).toBe('measure-feature');
    expect(lifecycleEvents).toEqual([
      { action: 'tool_start', toolId: 'inspect-feature', reason: undefined },
      { action: 'tool_cancel', toolId: 'inspect-feature', reason: 'api' },
      { action: 'tool_end', toolId: 'inspect-feature', reason: undefined },
      { action: 'tool_start', toolId: 'measure-feature', reason: undefined },
    ]);
  });

  test('recursive cancel does not double-call hooks or corrupt active state', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onCancel = vi.fn(() => tools.cancel('api'));
    const onEnd = vi.fn();
    tools.register({ id: 'inspect-feature', onCancel, onEnd });

    tools.activate('inspect-feature');
    tools.cancel('api');

    expect(tools.getActiveToolId()).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('cancel clears active state and propagates when onEnd throws after onCancel succeeds', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onEndError = new Error('end failed');
    const onCancel = vi.fn();
    const onEnd = vi.fn(() => {
      throw onEndError;
    });
    tools.register({ id: 'inspect-feature', onCancel, onEnd });

    tools.activate('inspect-feature');

    expect(() => tools.cancel('api')).toThrow(onEndError);

    expect(tools.getActiveToolId()).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('cancel clears active state and propagates when onCancel throws', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onCancelError = new Error('cancel failed');
    const onEnd = vi.fn();
    tools.register({
      id: 'inspect-feature',
      onCancel: () => {
        throw onCancelError;
      },
      onEnd,
    });

    tools.activate('inspect-feature');

    expect(() => tools.cancel('api')).toThrow(onCancelError);
    tools.cancel('api');

    expect(tools.getActiveToolId()).toBeNull();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('throws when activating an unregistered tool id', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });

    expect(() => tools.activate('missing-tool')).toThrow(
      'Geoman tool "missing-tool" is not registered',
    );
  });

  test('activating an unregistered tool id does not end another active tool', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onEnd = vi.fn();
    tools.register({ id: 'inspect-feature', onEnd });

    tools.activate('inspect-feature');

    expect(() => tools.activate('missing-tool')).toThrow(
      'Geoman tool "missing-tool" is not registered',
    );

    expect(tools.getActiveToolId()).toBe('inspect-feature');
    expect(onEnd).not.toHaveBeenCalled();
  });

  test('destroy ends the active tool and clears active state', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onEnd = vi.fn();
    tools.register({ id: 'inspect-feature', onEnd });

    tools.activate('inspect-feature');
    tools.destroy();

    expect(tools.getActiveToolId()).toBeNull();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('destroy does not call onCancel for the active tool', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onCancel = vi.fn();
    const onEnd = vi.fn();
    tools.register({ id: 'inspect-feature', onCancel, onEnd });

    tools.activate('inspect-feature');
    tools.destroy();

    expect(tools.getActiveToolId()).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('destroy does not emit tool cancel or tool end lifecycle events', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    tools.register({ id: 'inspect-feature', onCancel: vi.fn(), onEnd: vi.fn() });

    tools.activate('inspect-feature');
    geoman.events.fire.mockClear();
    tools.destroy();

    expect(geoman.events.fire).not.toHaveBeenCalledWith(
      '_gm:helper',
      expect.objectContaining({ action: 'tool_cancel' }),
    );
    expect(geoman.events.fire).not.toHaveBeenCalledWith(
      '_gm:helper',
      expect.objectContaining({ action: 'tool_end' }),
    );
  });

  test('destroy clears internal state when onEnd throws', () => {
    const { geoman } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onEnd = vi.fn(() => {
      throw new Error('end failed');
    });
    tools.register({ id: 'inspect-feature', onEnd });

    tools.activate('inspect-feature');

    expect(() => tools.destroy()).not.toThrow();

    expect(tools.getActiveToolId()).toBeNull();
    expect(tools.get('inspect-feature')).toBeNull();
    expect(tools.getAll()).toEqual([]);
    expect(geoman.mapAdapter.getMapInstance).toHaveBeenCalledTimes(1);

    const onStart = vi.fn();
    tools.register({ id: 'post-destroy-tool', onStart });
    tools.activate('post-destroy-tool');

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(geoman.mapAdapter.getMapInstance).toHaveBeenCalledTimes(2);
  });

  test('active tool receives feature hover with previousFeature when hover changes', () => {
    const { geoman, map, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const featureA = createFeature('line-1');
    const featureB = createFeature('line-2');
    const onFeatureHover = vi.fn();
    geoman.features = {
      getFeatureByMouseEvent: vi.fn().mockReturnValueOnce(featureA).mockReturnValueOnce(featureB),
    } as never;
    tools.register({ id: 'inspect-feature', onFeatureHover });

    tools.activate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    emitMapEvent('mousemove', createPointerEvent('mousemove'));

    expect(onFeatureHover).toHaveBeenCalledTimes(2);
    expect(onFeatureHover).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      expect.objectContaining({
        feature: featureA,
        previousFeature: null,
        sourceName: 'gm_main',
        point: { x: 10, y: 20 },
        lngLat: { lng: 1, lat: 2 },
        originalEvent: expect.objectContaining({ type: 'mousemove' }),
        map,
      }),
    );
    expect(onFeatureHover).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({
        feature: featureB,
        previousFeature: featureA,
        sourceName: 'gm_main',
        map,
      }),
    );
  });

  test('active tool receives feature hover end when hover clears and when deactivated', () => {
    const { geoman, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const featureA = createFeature('line-1');
    const featureB = createFeature('line-2');
    const onFeatureHoverEnd = vi.fn();
    geoman.features = {
      getFeatureByMouseEvent: vi
        .fn()
        .mockReturnValueOnce(featureA)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(featureB),
    } as never;
    tools.register({ id: 'inspect-feature', onFeatureHoverEnd });

    tools.activate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    tools.deactivate('inspect-feature');

    expect(onFeatureHoverEnd).toHaveBeenCalledTimes(2);
    expect(onFeatureHoverEnd).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      expect.objectContaining({
        feature: featureA,
        sourceName: 'gm_main',
        reason: 'feature-leave',
      }),
    );
    expect(onFeatureHoverEnd).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ feature: featureB, sourceName: 'gm_main', reason: 'tool-end' }),
    );
  });

  test('active tool receives feature click and handled true stops later map handlers', () => {
    const { geoman, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const feature = createFeature('line-1');
    const onFeatureClick = vi.fn(() => ({ handled: true }));
    geoman.features = {
      getFeatureByMouseEvent: vi.fn(() => feature),
    } as never;
    tools.register({ id: 'inspect-feature', onFeatureClick });

    tools.activate('inspect-feature');
    const result = emitMapEvent('click', createPointerEvent('click'));

    expect(result).toEqual({ next: false });
    expect(onFeatureClick).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ feature, sourceName: 'gm_main' }),
    );
  });

  test('active tool receives blank map click without clearing selection implicitly', () => {
    const { geoman, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onBlankMapClick = vi.fn();
    geoman.features = {
      getFeatureByMouseEvent: vi.fn(() => null),
    } as never;
    tools.register({ id: 'inspect-feature', onBlankMapClick });

    tools.activate('inspect-feature');
    const result = emitMapEvent('click', createPointerEvent('click'));

    expect(result).toEqual({ next: true });
    expect(onBlankMapClick).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        point: { x: 10, y: 20 },
        lngLat: { lng: 1, lat: 2 },
        originalEvent: expect.objectContaining({ type: 'click' }),
      }),
    );
    expect(geoman.selection.selectFeature).not.toHaveBeenCalled();
    expect(geoman.selection.setHoveredFeature).not.toHaveBeenCalled();
    expect(geoman.selection.activate).not.toHaveBeenCalled();
  });

  test('active tool receives feature context menu and handled true prevents browser menu', () => {
    const { geoman, map, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const feature = createFeature('line-1');
    const onFeatureContextMenu = vi.fn(() => ({ handled: true }));
    const event = createContextMenuEvent();
    geoman.features = {
      getFeatureByMouseEvent: vi.fn(() => feature),
    } as never;
    tools.register({ id: 'inspect-feature', onFeatureContextMenu });

    tools.activate('inspect-feature');
    const result = emitMapEvent('contextmenu', event);

    expect(result).toEqual({ next: false });
    expect(event.originalEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(onFeatureContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({ contextPanels: geoman.contextPanels }),
      expect.objectContaining({
        feature,
        sourceName: 'gm_main',
        point: { x: 10, y: 20 },
        lngLat: { lng: 1, lat: 2 },
        originalEvent: event.originalEvent,
        map,
      }),
    );
  });

  test('context menu feature lookup uses tool selection sourceNames when provided', () => {
    const { geoman, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const feature = createFeature('line-1');
    const getFeatureByMouseEvent = vi.fn(() => feature);
    const onFeatureContextMenu = vi.fn(() => ({ handled: true }));

    geoman.features = {
      defaultSourceName: 'gm_main',
      getFeatureByMouseEvent,
    } as never;

    tools.register({
      id: 'inspect-standby-feature',
      selection: {
        sourceNames: ['gm_standby'],
        allowedShapes: ['line'],
      },
      onFeatureContextMenu,
    });

    tools.activate('inspect-standby-feature');
    emitMapEvent('contextmenu', createContextMenuEvent());

    expect(getFeatureByMouseEvent).toHaveBeenCalledWith({
      event: expect.objectContaining({ type: 'contextmenu' }),
      sourceNames: ['gm_standby'],
    });
    expect(onFeatureContextMenu).toHaveBeenCalled();
  });

  test('active tool receives blank context menu when no feature is hit', () => {
    const { geoman, map, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onContextMenu = vi.fn();
    const event = createContextMenuEvent();
    geoman.features = {
      getFeatureByMouseEvent: vi.fn(() => null),
    } as never;
    tools.register({ id: 'inspect-feature', onContextMenu });

    tools.activate('inspect-feature');
    const result = emitMapEvent('contextmenu', event);

    expect(result).toEqual({ next: true });
    expect(event.originalEvent.preventDefault).not.toHaveBeenCalled();
    expect(onContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({ contextPanels: geoman.contextPanels }),
      expect.objectContaining({
        point: { x: 10, y: 20 },
        lngLat: { lng: 1, lat: 2 },
        originalEvent: event.originalEvent,
        map,
      }),
    );
  });

  test('selection-enabled tool activates selection and applies hover styling by default', () => {
    const { geoman, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const feature = createFeature('line-1');
    geoman.features = {
      getFeatureByMouseEvent: vi.fn(() => feature),
    } as never;
    tools.register({ id: 'inspect-feature', selection: true });

    tools.activate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    tools.deactivate('inspect-feature');

    expect(geoman.selection.activate).toHaveBeenCalledTimes(1);
    expect(geoman.selection.setHoveredFeature).toHaveBeenCalledWith(feature);
    expect(geoman.mapAdapter.setCursor).toHaveBeenCalledWith('pointer');
    expect(geoman.selection.clearHoveredFeature).toHaveBeenCalled();
    expect(geoman.selection.deactivate).toHaveBeenCalledWith({ reason: 'mode-end' });
    expect(geoman.mapAdapter.setCursor).toHaveBeenLastCalledWith('');
  });

  test('selection-enabled tool clears hover styling when no feature is hovered', () => {
    const { geoman, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const feature = createFeature('line-1');
    geoman.features = {
      getFeatureByMouseEvent: vi.fn().mockReturnValueOnce(feature).mockReturnValueOnce(null),
    } as never;
    tools.register({ id: 'inspect-feature', selection: { hover: true } });

    tools.activate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    emitMapEvent('mousemove', createPointerEvent('mousemove'));

    expect(geoman.selection.setHoveredFeature).toHaveBeenCalledTimes(1);
    expect(geoman.selection.clearHoveredFeature).toHaveBeenCalledTimes(1);
    expect(geoman.mapAdapter.setCursor).toHaveBeenLastCalledWith('');
  });

  test('selection-enabled tool filters hover and click interactions by allowed shapes', () => {
    const { geoman, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const polygon = createFeature('polygon-1', null, 'polygon');
    const line = createFeature('line-1');
    const onFeatureClick = vi.fn();
    const onBlankMapClick = vi.fn();
    geoman.features = {
      getFeatureByMouseEvent: vi
        .fn()
        .mockReturnValueOnce(polygon)
        .mockReturnValueOnce(polygon)
        .mockReturnValueOnce(line),
    } as never;
    tools.register({
      id: 'measure-line',
      selection: { allowedShapes: ['line'] },
      onFeatureClick,
      onBlankMapClick,
    });

    tools.activate('measure-line');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    emitMapEvent('click', createPointerEvent('click'));
    emitMapEvent('click', createPointerEvent('click'));

    expect(geoman.selection.setHoveredFeature).not.toHaveBeenCalled();
    expect(onBlankMapClick).toHaveBeenCalledTimes(1);
    expect(onFeatureClick).toHaveBeenCalledTimes(1);
    expect(onFeatureClick).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ feature: line }),
    );
  });

  test('selection-enabled tool does not apply hover styling after hover hook deactivates it', () => {
    const { geoman, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const feature = createFeature('line-1');
    geoman.features = {
      getFeatureByMouseEvent: vi.fn(() => feature),
    } as never;
    tools.register({
      id: 'inspect-feature',
      selection: true,
      onFeatureHover: () => {
        tools.deactivate('inspect-feature');
      },
    });

    tools.activate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));

    expect(geoman.selection.setHoveredFeature).not.toHaveBeenCalled();
    expect(geoman.mapAdapter.setCursor).toHaveBeenLastCalledWith('');
  });

  test('inactive tools do not receive feature interaction hooks or attach listeners', () => {
    const { geoman, getHandlerCount } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const onFeatureHover = vi.fn();
    tools.register({ id: 'inspect-feature', onFeatureHover });

    expect(getHandlerCount('mousemove')).toBe(0);
    expect(onFeatureHover).not.toHaveBeenCalled();
  });

  test('feature interaction hooks use parent fallback for non-selectable marker child features', () => {
    const { geoman, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const parentFeature = createFeature('line-1');
    const childFeature = createFeature('marker-1', parentFeature);
    const onFeatureClick = vi.fn();
    geoman.features = {
      getFeatureByMouseEvent: vi.fn(() => childFeature),
    } as never;
    geoman.selection.isSelectableFeature = vi.fn((feature) => feature === parentFeature);
    tools.register({ id: 'inspect-feature', onFeatureClick });

    tools.activate('inspect-feature');
    emitMapEvent('click', createPointerEvent('click'));

    expect(onFeatureClick).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ feature: parentFeature, sourceName: 'gm_main' }),
    );
  });

  test('deactivation cleans hover state and detaches interaction listeners', () => {
    const { geoman, emitMapEvent, getHandlerCount } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const feature = createFeature('line-1');
    const onFeatureHover = vi.fn();
    const onFeatureHoverEnd = vi.fn();
    geoman.features = {
      getFeatureByMouseEvent: vi.fn(() => feature),
    } as never;
    tools.register({ id: 'inspect-feature', onFeatureHover, onFeatureHoverEnd });

    tools.activate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    tools.deactivate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));

    expect(getHandlerCount('mousemove')).toBe(0);
    expect(getHandlerCount('click')).toBe(0);
    expect(getHandlerCount('mouseleave')).toBe(0);
    expect(onFeatureHover).toHaveBeenCalledTimes(1);
    expect(onFeatureHoverEnd).toHaveBeenCalledTimes(1);
  });

  test('hover end during tool end can activate a replacement tool without detaching it', () => {
    const { geoman, emitMapEvent, getHandlerCount } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const featureA = createFeature('line-1');
    const featureB = createFeature('line-2');
    const onMeasureHover = vi.fn();
    let activatedReplacement = false;
    geoman.features = {
      getFeatureByMouseEvent: vi.fn().mockReturnValueOnce(featureA).mockReturnValueOnce(featureB),
    } as never;
    tools.register({
      id: 'inspect-feature',
      onFeatureHoverEnd: () => {
        if (!activatedReplacement) {
          activatedReplacement = true;
          tools.activate('measure-feature');
        }
      },
    });
    tools.register({ id: 'measure-feature', onFeatureHover: onMeasureHover });

    tools.activate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    tools.deactivate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));

    expect(tools.getActiveToolId()).toBe('measure-feature');
    expect(getHandlerCount('mousemove')).toBe(1);
    expect(onMeasureHover).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ feature: featureB, previousFeature: null }),
    );
  });

  test('hover deactivation during mousemove does not keep stale hover state for next activation', () => {
    const { geoman, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const feature = createFeature('line-1');
    const onFeatureHover = vi.fn(() => {
      tools.deactivate('inspect-feature');
    });
    geoman.features = {
      getFeatureByMouseEvent: vi.fn(() => feature),
    } as never;
    tools.register({ id: 'inspect-feature', onFeatureHover });

    tools.activate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    tools.activate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));

    expect(onFeatureHover).toHaveBeenCalledTimes(2);
    expect(onFeatureHover).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ feature, previousFeature: null }),
    );
  });

  test('hover end deactivation during mousemove does not restore stale replacement hover state', () => {
    const { geoman, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const featureA = createFeature('line-1');
    const featureB = createFeature('line-2');
    const onFeatureHover = vi.fn();
    const onFeatureHoverEnd = vi.fn(() => {
      tools.deactivate('inspect-feature');
    });
    geoman.features = {
      getFeatureByMouseEvent: vi
        .fn()
        .mockReturnValueOnce(featureA)
        .mockReturnValueOnce(featureB)
        .mockReturnValueOnce(featureB),
    } as never;
    tools.register({ id: 'inspect-feature', onFeatureHover, onFeatureHoverEnd });

    tools.activate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    tools.activate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));

    expect(onFeatureHover).toHaveBeenCalledTimes(2);
    expect(onFeatureHover).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ feature: featureB, previousFeature: null }),
    );
    expect(onFeatureHoverEnd).toHaveBeenCalledTimes(1);
  });

  test('hover end tool switch during mousemove does not restore stale hover state', () => {
    const { geoman, emitMapEvent } = createGeomanStub();
    const tools = new GeomanToolsSubsystem({ geoman: geoman as never });
    const featureA = createFeature('line-1');
    const featureB = createFeature('line-2');
    const featureC = createFeature('line-3');
    const onInspectHover = vi.fn();
    const onMeasureHover = vi.fn();
    const onFeatureHoverEnd = vi.fn(() => {
      tools.activate('measure-feature');
    });
    geoman.features = {
      getFeatureByMouseEvent: vi
        .fn()
        .mockReturnValueOnce(featureA)
        .mockReturnValueOnce(featureB)
        .mockReturnValueOnce(featureC),
    } as never;
    tools.register({
      id: 'inspect-feature',
      onFeatureHover: onInspectHover,
      onFeatureHoverEnd,
    });
    tools.register({ id: 'measure-feature', onFeatureHover: onMeasureHover });

    tools.activate('inspect-feature');
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    emitMapEvent('mousemove', createPointerEvent('mousemove'));
    emitMapEvent('mousemove', createPointerEvent('mousemove'));

    expect(tools.getActiveToolId()).toBe('measure-feature');
    expect(onInspectHover).toHaveBeenCalledTimes(1);
    expect(onMeasureHover).toHaveBeenCalledTimes(1);
    expect(onMeasureHover).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ feature: featureC, previousFeature: null }),
    );
  });
});
