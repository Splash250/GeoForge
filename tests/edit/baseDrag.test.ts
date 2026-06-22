import { EditChange } from '@/modes/edit/change.ts';
import type { Geoman } from '@/main.ts';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/options/layers/style.ts', () => ({ default: {} }));
vi.mock('@/core/controls/components/gm-controls.svelte', () => ({ default: {} }));
vi.mock('@/main.ts', () => ({}));

describe('BaseDrag edit mode lifecycle', () => {
  it('does not start whole-feature drag handling while change mode is active', () => {
    const action = new EditChange({
      options: {
        settings: {
          throttlingDelay: 0,
        },
      },
    } as Geoman);

    expect(action.onMouseDown({} as never)).toEqual({ next: true });
    expect(action.onMouseMove({} as never)).toEqual({ next: true });
    expect(action.onMouseUp({} as never)).toEqual({ next: true });
    expect(action.flags.actionInProgress).toBe(false);
  });
});
