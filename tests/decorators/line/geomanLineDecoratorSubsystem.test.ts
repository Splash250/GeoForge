import { describe, expect, it, vi } from 'vitest';
import type { Feature } from 'geojson';
import { GeomanLineDecoratorSubsystem } from '../../../src/decorators/line/geomanLineDecoratorSubsystem.ts';
import type { LineDecoratorManager } from '../../../src/decorators/line/lineDecoratorManager.ts';
import type { LineDecoratorOptions } from '../../../src/decorators/line/types.ts';
import type { Geoman } from '../../../src/main.ts';

type ManagerMock = Pick<
  LineDecoratorManager,
  'bindToGeoman' | 'clear' | 'destroy' | 'updateFromFeatures'
>;

function createManagerMock(overrides: Partial<ManagerMock> = {}): LineDecoratorManager {
  return {
    bindToGeoman: vi.fn(),
    clear: vi.fn(),
    destroy: vi.fn(),
    updateFromFeatures: vi.fn(),
    ...overrides,
  } as unknown as LineDecoratorManager;
}

describe('GeomanLineDecoratorSubsystem', () => {
  it('does not create a manager until started', () => {
    const managerFactory = vi.fn();
    const subsystem = new GeomanLineDecoratorSubsystem({
      geoman: { destroyed: false } as unknown as Geoman,
      getMap: () => ({}) as never,
      managerFactory,
    });

    expect(subsystem.isStarted()).toBe(false);
    expect(managerFactory).not.toHaveBeenCalled();
  });

  it('creates, binds, reconfigures, and destroys the owned manager', () => {
    const bindToGeoman = vi.fn();
    const clear = vi.fn();
    const destroy = vi.fn();
    const managerFactory = vi.fn(() => createManagerMock({ bindToGeoman, clear, destroy }));
    const geoman = { destroyed: false } as unknown as Geoman;
    const firstResolve = vi.fn(() => []);
    const secondResolve = vi.fn(() => []);
    const subsystem = new GeomanLineDecoratorSubsystem({
      geoman,
      getMap: () => ({}) as never,
      managerFactory,
    });

    subsystem.start({ resolveDecorators: firstResolve, layerPosition: 'below-lines' });
    subsystem.start({ resolveDecorators: firstResolve, layerPosition: 'below-lines' });
    subsystem.configure({ resolveDecorators: secondResolve, layerPosition: 'above-lines' });
    subsystem.clear();
    subsystem.destroy();

    expect(managerFactory).toHaveBeenCalledTimes(2);
    expect(managerFactory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ layerPosition: 'below-lines' }),
    );
    expect(managerFactory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ layerPosition: 'above-lines' }),
    );
    expect(bindToGeoman).toHaveBeenCalledTimes(2);
    expect(bindToGeoman).toHaveBeenLastCalledWith({
      geoman,
      resolveDecorators: secondResolve,
      syncOnRender: true,
    });
    expect(clear).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it('replaces and rebinds the started manager when layer position is explicitly cleared', () => {
    const firstDestroy = vi.fn();
    const firstBindToGeoman = vi.fn();
    const secondBindToGeoman = vi.fn();
    const managers = [
      createManagerMock({ bindToGeoman: firstBindToGeoman, destroy: firstDestroy }),
      createManagerMock({ bindToGeoman: secondBindToGeoman }),
    ];
    const managerFactory = vi.fn(() => managers.shift() ?? createManagerMock());
    const geoman = { destroyed: false } as unknown as Geoman;
    const resolveDecorators = vi.fn(() => []);
    const subsystem = new GeomanLineDecoratorSubsystem({
      geoman,
      getMap: () => ({}) as never,
      managerFactory,
    });

    subsystem.start({ resolveDecorators, layerPosition: 'above-lines' });
    subsystem.configure({ layerPosition: undefined });

    expect(managerFactory).toHaveBeenCalledTimes(2);
    expect(managerFactory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ layerPosition: 'above-lines' }),
    );
    expect(managerFactory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ layerPosition: undefined }),
    );
    expect(firstDestroy).toHaveBeenCalledTimes(1);
    expect(firstBindToGeoman).toHaveBeenCalledTimes(1);
    expect(secondBindToGeoman).toHaveBeenCalledWith({
      geoman,
      resolveDecorators,
      syncOnRender: true,
    });
  });

  it('syncs caller-provided features without binding to Geoman events', () => {
    const updateFromFeatures = vi.fn();
    const bindToGeoman = vi.fn();
    const destroy = vi.fn();
    const managerFactory = vi.fn(() =>
      createManagerMock({ updateFromFeatures, bindToGeoman, destroy }),
    );
    const geoman = { destroyed: false } as unknown as Geoman;
    const feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: {},
    } as Feature;
    const resolveDecorators = vi.fn<(feature: Feature) => LineDecoratorOptions[]>(() => []);
    const subsystem = new GeomanLineDecoratorSubsystem({
      geoman,
      getMap: () => ({}) as never,
      managerFactory,
    });

    subsystem.syncFromFeatures([feature], resolveDecorators);

    expect(managerFactory).toHaveBeenCalledTimes(1);
    expect(updateFromFeatures).toHaveBeenCalledWith([feature], resolveDecorators);
    expect(bindToGeoman).not.toHaveBeenCalled();
  });

  it('keeps a configured manual sync resolver and exposes sync()', () => {
    const updateFromFeatures = vi.fn();
    const managerFactory = vi.fn(() => createManagerMock({ updateFromFeatures }));
    const geoman = { destroyed: false } as unknown as Geoman;
    const feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: {},
    } as Feature;
    const resolveFeatures = vi.fn(() => [feature]);
    const resolveDecorators = vi.fn<(feature: Feature) => LineDecoratorOptions[]>(() => []);
    const subsystem = new GeomanLineDecoratorSubsystem({
      geoman,
      getMap: () => ({}) as never,
      managerFactory,
    });

    subsystem.configureManualSync({ resolveFeatures, resolveDecorators });
    subsystem.sync();

    expect(updateFromFeatures).toHaveBeenCalledWith([feature], resolveDecorators);
  });

  it('can bind to Geoman after an earlier manual sync', () => {
    const firstDestroy = vi.fn();
    const secondBindToGeoman = vi.fn();
    const managers = [
      createManagerMock({ destroy: firstDestroy }),
      createManagerMock({ bindToGeoman: secondBindToGeoman }),
    ];
    const managerFactory = vi.fn(() => managers.shift() ?? createManagerMock());
    const geoman = { destroyed: false } as unknown as Geoman;
    const feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: {},
    } as Feature;
    const subsystem = new GeomanLineDecoratorSubsystem({
      geoman,
      getMap: () => ({}) as never,
      managerFactory,
    });

    subsystem.syncFromFeatures([feature]);
    subsystem.start({ layerPosition: 'above-lines' });

    expect(managerFactory).toHaveBeenCalledTimes(2);
    expect(firstDestroy).toHaveBeenCalledTimes(1);
    expect(managerFactory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ layerPosition: 'above-lines' }),
    );
    expect(secondBindToGeoman).toHaveBeenCalledWith({
      geoman,
      resolveDecorators: undefined,
      syncOnRender: true,
    });
    expect(subsystem.isStarted()).toBe(true);
  });

  it('does not bind a manual-only manager when configuring layer position', () => {
    const firstBindToGeoman = vi.fn();
    const firstDestroy = vi.fn();
    const secondBindToGeoman = vi.fn();
    const managers = [
      createManagerMock({ bindToGeoman: firstBindToGeoman, destroy: firstDestroy }),
      createManagerMock({ bindToGeoman: secondBindToGeoman }),
    ];
    const managerFactory = vi.fn(() => managers.shift() ?? createManagerMock());
    const subsystem = new GeomanLineDecoratorSubsystem({
      geoman: { destroyed: false } as unknown as Geoman,
      getMap: () => ({}) as never,
      managerFactory,
    });

    subsystem.configureManualSync({ resolveFeatures: () => [] });
    subsystem.configure({ layerPosition: 'below-lines' });

    expect(managerFactory).toHaveBeenCalledTimes(2);
    expect(firstDestroy).toHaveBeenCalledTimes(1);
    expect(firstBindToGeoman).not.toHaveBeenCalled();
    expect(secondBindToGeoman).not.toHaveBeenCalled();
    expect(subsystem.isStarted()).toBe(false);
  });
});
