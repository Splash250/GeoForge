import { withPromiseTimeoutRace } from '@/utils/behavior.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('withPromiseTimeoutRace', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs cleanup once when timeout wins', async () => {
    vi.useFakeTimers();
    const cleanup = vi.fn();

    const timeoutPromise = withPromiseTimeoutRace(
      new Promise(() => undefined),
      'test timeout',
      cleanup,
    );
    const assertion = expect(timeoutPromise).rejects.toThrow('test timeout');

    await vi.runAllTimersAsync();

    await assertion;
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('rejects with the timeout error when cleanup throws', async () => {
    vi.useFakeTimers();
    const cleanup = vi.fn(() => {
      throw new Error('cleanup failed');
    });

    const timeoutPromise = withPromiseTimeoutRace(
      new Promise(() => undefined),
      'test timeout',
      cleanup,
    );
    const assertion = expect(timeoutPromise).rejects.toThrow('test timeout');

    await vi.runAllTimersAsync();

    await assertion;
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not run cleanup when wrapped promise resolves', async () => {
    vi.useFakeTimers();
    const cleanup = vi.fn();

    await expect(
      withPromiseTimeoutRace(Promise.resolve('resolved'), 'test timeout', cleanup),
    ).resolves.toBeUndefined();

    expect(cleanup).not.toHaveBeenCalled();
  });
});
