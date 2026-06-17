import { describe, expect, test, vi } from 'vitest';
import { EventForwarder } from '../../src/core/events/forwarder.ts';

function createForwarder() {
  const map = { id: 'map' };
  const fire = vi.fn();
  const forwarder = new EventForwarder({
    mapAdapter: {
      fire,
      getMapInstance: vi.fn(() => map),
    },
    options: {
      settings: {
        awaitDataUpdatesOnEvents: false,
      },
    },
  } as never);

  return { fire, forwarder, map };
}

describe('tool lifecycle event forwarding', () => {
  test('forwards custom tool lifecycle events as public map events', async () => {
    const { fire, forwarder, map } = createForwarder();

    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:tool_start',
      level: 'system',
      actionType: 'helper',
      action: 'tool_start',
      toolId: 'inspect-feature',
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:tool_cancel',
      level: 'system',
      actionType: 'helper',
      action: 'tool_cancel',
      toolId: 'inspect-feature',
      reason: 'api',
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:tool_end',
      level: 'system',
      actionType: 'helper',
      action: 'tool_end',
      toolId: 'inspect-feature',
    } as never);

    expect(fire).toHaveBeenCalledWith(
      'gm:toolstart',
      expect.objectContaining({
        name: 'gm:toolstart',
        actionType: 'helper',
        action: 'tool_start',
        toolId: 'inspect-feature',
        map,
      }),
    );
    expect(fire).toHaveBeenCalledWith(
      'gm:toolcancel',
      expect.objectContaining({
        name: 'gm:toolcancel',
        actionType: 'helper',
        action: 'tool_cancel',
        toolId: 'inspect-feature',
        reason: 'api',
        map,
      }),
    );
    expect(fire).toHaveBeenCalledWith(
      'gm:toolend',
      expect.objectContaining({
        name: 'gm:toolend',
        actionType: 'helper',
        action: 'tool_end',
        toolId: 'inspect-feature',
        map,
      }),
    );
  });

  test('does not forward malformed custom tool lifecycle events', async () => {
    const { fire, forwarder } = createForwarder();

    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:tool_start',
      level: 'system',
      actionType: 'helper',
      action: 'tool_start',
      toolId: '',
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:tool_end',
      level: 'system',
      actionType: 'draw',
      action: 'tool_end',
      toolId: 'inspect-feature',
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:tool_cancel',
      level: 'system',
      actionType: 'helper',
      action: 'tool_cancel',
      toolId: 'inspect-feature',
      reason: 'unknown',
    } as never);
    await forwarder.processEvent('_gm:helper', {
      name: '_gm:helper:tool_error',
      level: 'system',
      actionType: 'helper',
      action: 'tool_error',
      toolId: 'inspect-feature',
    } as never);

    expect(fire).not.toHaveBeenCalledWith('gm:toolstart', expect.anything());
    expect(fire).not.toHaveBeenCalledWith('gm:toolend', expect.anything());
    expect(fire).not.toHaveBeenCalledWith('gm:toolcancel', expect.anything());
    expect(fire).not.toHaveBeenCalledWith('gm:toolerror', expect.anything());
  });
});
