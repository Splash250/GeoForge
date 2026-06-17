// @vitest-environment jsdom

import { SOURCES } from '@/core/features/constants.ts';
import { SourceUpdateManager } from '@/core/features/source-update-manager.ts';
import type { Geoman } from '@/main.ts';
import type { GeoJsonUniversalDiff } from '@/types';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/core/options/layers/style.ts', () => ({ default: {} }));

function createDiff(id: string): GeoJsonUniversalDiff {
  return {
    add: [
      {
        type: 'Feature',
        id,
        properties: {},
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    ],
    update: [],
    remove: [],
  };
}

function createGeoman({
  throttlingDelay = 0,
  maxDiffItems = 5000,
  waitTimeoutMs = 5000,
  onTimeout = 'warn-and-continue',
  onDiagnostic = vi.fn(),
  updateData = vi.fn(() => Promise.resolve()),
  loaded = true,
}: {
  throttlingDelay?: number;
  maxDiffItems?: number;
  waitTimeoutMs?: number;
  onTimeout?: 'warn-and-continue' | 'throw';
  onDiagnostic?: ReturnType<typeof vi.fn>;
  updateData?: ReturnType<typeof vi.fn>;
  loaded?: boolean;
} = {}) {
  const source = {
    id: SOURCES.main,
    loaded,
    updateData,
  };
  const geoman = {
    options: {
      settings: {
        throttlingDelay,
        sourceUpdates: {
          maxDiffItems,
          waitTimeoutMs,
          onTimeout,
          onDiagnostic,
        },
      },
    },
    features: {
      sources: {
        [SOURCES.main]: source,
      },
    },
  } as unknown as Geoman;

  return { geoman, onDiagnostic, source, updateData };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SourceUpdateManager sourceUpdates settings', () => {
  test('flushes queued source updates after the outermost atomic update exits', () => {
    const { geoman, source } = createGeoman({ throttlingDelay: 1 });
    const updateManager = new SourceUpdateManager(geoman);

    updateManager.withAtomicSourcesUpdate(() => {
      updateManager.updateStorage[SOURCES.main] = [createDiff('atomic')];
    });

    expect(source.updateData).toHaveBeenCalledTimes(1);
  });

  test('uses configured maxDiffItems and reports a chunk-limit diagnostic', () => {
    const { geoman, onDiagnostic } = createGeoman({ maxDiffItems: 2 });
    const updateManager = new SourceUpdateManager(geoman);
    updateManager.updateStorage[SOURCES.main] = [createDiff('a'), createDiff('b'), createDiff('c')];

    const combinedDiff = updateManager.getCombinedDiff(SOURCES.main);

    expect(combinedDiff?.add).toBeDefined();
    expect(combinedDiff?.add?.map((feature) => feature.id)).toEqual(['a', 'b']);
    expect(updateManager.updateStorage[SOURCES.main]).toHaveLength(1);
    expect(onDiagnostic).toHaveBeenCalledOnce();
    expect(onDiagnostic).toHaveBeenCalledWith({
      type: 'chunk-limit-reached',
      sourceName: SOURCES.main,
      queuedDiffItems: 3,
      processedDiffItems: 2,
      maxDiffItems: 2,
    });
  });

  test('reports wait timeout diagnostics and resolves when configured to warn and continue', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(0), 0);
    });
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const updateData = vi.fn(() => new Promise<void>(() => undefined));
    const { geoman, onDiagnostic } = createGeoman({
      waitTimeoutMs: 25,
      onTimeout: 'warn-and-continue',
      updateData,
    });
    const updateManager = new SourceUpdateManager(geoman);
    updateManager.updateStorage[SOURCES.main] = [createDiff('pending')];

    const waitPromise = updateManager.waitForPendingUpdates(SOURCES.main);
    await vi.advanceTimersByTimeAsync(25);
    await waitPromise;

    expect(updateData).toHaveBeenCalledOnce();
    expect(onDiagnostic).toHaveBeenCalledWith({
      type: 'wait-timeout',
      sourceName: SOURCES.main,
      waitTimeoutMs: 25,
      pendingPromiseCount: 1,
    });
    expect(consoleWarn).toHaveBeenCalledWith(
      'GeoForge source update wait timed out',
      expect.objectContaining({
        sourceName: SOURCES.main,
        waitTimeoutMs: 25,
        pendingPromiseCount: 1,
      }),
    );
  });
});

describe('SourceUpdateManager destroy', () => {
  test('cancels queued throttled source updates and clears pending work', () => {
    vi.useFakeTimers();
    const updateData = vi.fn(() => new Promise<void>(() => undefined));
    const { geoman } = createGeoman({ throttlingDelay: 100, updateData });
    const updateManager = new SourceUpdateManager(geoman);

    updateManager.updateSource({ sourceName: SOURCES.main, diff: createDiff('first') });
    updateManager.updateSource({ sourceName: SOURCES.main, diff: createDiff('queued') });

    expect(updateData).toHaveBeenCalledOnce();
    expect(updateManager.updatesPending(SOURCES.main)).toBe(true);

    updateManager.destroy();
    vi.advanceTimersByTime(100);

    expect(updateData).toHaveBeenCalledOnce();
    expect(updateManager.updatesPending(SOURCES.main)).toBe(false);
    expect(updateManager.updateStorage[SOURCES.main]).toEqual([]);
  });

  test('cancels unloaded source retries after destroy', () => {
    vi.useFakeTimers();
    const updateData = vi.fn(() => Promise.resolve());
    const { geoman, source } = createGeoman({
      throttlingDelay: 100,
      loaded: false,
      updateData,
    });
    const updateManager = new SourceUpdateManager(geoman);
    updateManager.updateStorage[SOURCES.main] = [createDiff('retry')];

    updateManager.updateSourceActual(SOURCES.main);
    updateManager.destroy();
    source.loaded = true;
    vi.advanceTimersByTime(100);

    expect(updateData).not.toHaveBeenCalled();
    expect(updateManager.updatesPending(SOURCES.main)).toBe(false);
  });
});
