import { describe, expect, it, vi } from 'vitest';
import { ModeController } from '../../src/core/modes/modeController.ts';
import type { Geoman } from '../../src/main.ts';

function createGeomanStub() {
  return {
    options: {
      enableMode: vi.fn(),
      disableMode: vi.fn(),
      toggleMode: vi.fn(),
      isModeEnabled: vi.fn(() => true),
    },
    disableAllModes: vi.fn(),
  } as unknown as Geoman;
}

describe('ModeController', () => {
  it('delegates mode operations through one direct API', () => {
    const geoman = createGeomanStub();
    const modes = new ModeController(geoman);

    modes.enable('edit', 'drag');
    modes.disable('edit', 'drag');
    modes.toggle('edit', 'drag');
    const enabled = modes.isEnabled('edit', 'drag');
    modes.disableAll();

    expect(geoman.options.enableMode).toHaveBeenCalledWith('edit', 'drag');
    expect(geoman.options.disableMode).toHaveBeenCalledWith('edit', 'drag');
    expect(geoman.options.toggleMode).toHaveBeenCalledWith('edit', 'drag');
    expect(geoman.options.isModeEnabled).toHaveBeenCalledWith('edit', 'drag');
    expect(geoman.disableAllModes).toHaveBeenCalledTimes(1);
    expect(enabled).toBe(true);
  });
});
