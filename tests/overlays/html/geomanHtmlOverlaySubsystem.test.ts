import { describe, expect, it, vi } from 'vitest';
import { GeomanHtmlOverlaySubsystem } from '../../../src/overlays/html/geomanHtmlOverlaySubsystem.ts';
import type { HtmlOverlayDefinition } from '../../../src/overlays/html/types.ts';

describe('GeomanHtmlOverlaySubsystem', () => {
  it('creates the DOM-owning manager lazily on first use and delegates operations', () => {
    const manager = {
      add: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      get: vi.fn(() => null),
      getAll: vi.fn(() => []),
      setSelected: vi.fn(),
      destroy: vi.fn(),
    };
    const managerFactory = vi.fn(() => manager);
    const subsystem = new GeomanHtmlOverlaySubsystem({
      getMapAdapter: () => ({}) as never,
      managerFactory,
    });
    const overlay: HtmlOverlayDefinition = {
      id: 'overlay-1',
      html: '<button>OK</button>',
      corners: {
        topLeft: [0, 1],
        topRight: [1, 1],
        bottomRight: [1, 0],
        bottomLeft: [0, 0],
      },
    };

    expect(managerFactory).not.toHaveBeenCalled();

    subsystem.add(overlay);
    subsystem.upsert(overlay);
    subsystem.update('overlay-1', { selected: true });
    subsystem.setSelected('overlay-1');
    subsystem.remove('overlay-1');
    subsystem.destroy();

    expect(managerFactory).toHaveBeenCalledTimes(1);
    expect(manager.add).toHaveBeenCalledWith(overlay);
    expect(manager.upsert).toHaveBeenCalledWith(overlay);
    expect(manager.update).toHaveBeenCalledWith('overlay-1', { selected: true });
    expect(manager.setSelected).toHaveBeenCalledWith('overlay-1');
    expect(manager.remove).toHaveBeenCalledWith('overlay-1');
    expect(manager.destroy).toHaveBeenCalledTimes(1);
  });

  it('does not create a manager for passive access or unused removal', () => {
    const managerFactory = vi.fn();
    const subsystem = new GeomanHtmlOverlaySubsystem({
      getMapAdapter: () => ({}) as never,
      managerFactory,
    });

    subsystem.remove('missing');

    expect(subsystem.get('missing')).toBeNull();
    expect(subsystem.getAll()).toEqual([]);
    expect(managerFactory).not.toHaveBeenCalled();
  });

  it('falls back to add when a legacy manager factory does not provide upsert', () => {
    const manager = {
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      get: vi.fn(() => null),
      getAll: vi.fn(() => []),
      setSelected: vi.fn(),
      destroy: vi.fn(),
    };
    const managerFactory = vi.fn(() => manager);
    const subsystem = new GeomanHtmlOverlaySubsystem({
      getMapAdapter: () => ({}) as never,
      managerFactory,
    });
    const overlay: HtmlOverlayDefinition = {
      id: 'overlay-1',
      html: '<button>OK</button>',
      corners: {
        topLeft: [0, 1],
        topRight: [1, 1],
        bottomRight: [1, 0],
        bottomLeft: [0, 0],
      },
    };

    subsystem.upsert(overlay);

    expect(manager.add).toHaveBeenCalledWith(overlay);
  });

  it('can create a fresh manager after destroy', () => {
    const firstManager = {
      add: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      get: vi.fn(() => null),
      getAll: vi.fn(() => []),
      setSelected: vi.fn(),
      destroy: vi.fn(),
    };
    const secondManager = {
      add: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      get: vi.fn(() => null),
      getAll: vi.fn(() => []),
      setSelected: vi.fn(),
      destroy: vi.fn(),
    };
    const managerFactory = vi
      .fn()
      .mockReturnValueOnce(firstManager)
      .mockReturnValueOnce(secondManager);
    const subsystem = new GeomanHtmlOverlaySubsystem({
      getMapAdapter: () => ({}) as never,
      managerFactory,
    });
    const overlay: HtmlOverlayDefinition = {
      id: 'overlay-1',
      html: '<button>OK</button>',
      corners: {
        topLeft: [0, 1],
        topRight: [1, 1],
        bottomRight: [1, 0],
        bottomLeft: [0, 0],
      },
    };

    subsystem.add(overlay);
    subsystem.destroy();
    subsystem.add(overlay);

    expect(managerFactory).toHaveBeenCalledTimes(2);
    expect(firstManager.destroy).toHaveBeenCalledTimes(1);
    expect(firstManager.add).toHaveBeenCalledTimes(1);
    expect(secondManager.add).toHaveBeenCalledTimes(1);
  });
});
