import { describe, expect, it, vi } from 'vitest';

import { isMaplibreMapLoaded } from '@/core/map/maplibre/loaded-state.ts';

describe('isMaplibreMapLoaded', () => {
  it('uses public loaded() when available', () => {
    const map = { loaded: vi.fn(() => true), _loaded: false };

    expect(isMaplibreMapLoaded(map)).toBe(true);
    expect(map.loaded).toHaveBeenCalledOnce();
  });

  it('falls back to _loaded when public loaded() reports false during reinitialization', () => {
    const map = { loaded: vi.fn(() => false), _loaded: true };

    expect(isMaplibreMapLoaded(map)).toBe(true);
    expect(map.loaded).toHaveBeenCalledOnce();
  });

  it('falls back to private _loaded for compatibility', () => {
    expect(isMaplibreMapLoaded({ _loaded: true })).toBe(true);
    expect(isMaplibreMapLoaded({ _loaded: false })).toBe(false);
  });
});
