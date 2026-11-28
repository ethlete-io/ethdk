import { afterEach, describe, expect, it, vi } from 'vitest';
import { exitWhenParentGone } from './parent-watch';

describe('exitWhenParentGone', () => {
  afterEach(() => vi.useRealTimers());

  it('stays while the parent lives', () => {
    vi.useFakeTimers();
    const onGone = vi.fn();

    exitWhenParentGone({ onGone, ppid: () => 500, alive: () => true, everyMs: 1000 });
    vi.advanceTimersByTime(10_000);

    expect(onGone).not.toHaveBeenCalled();
  });

  it('fires once when the parent is gone', () => {
    vi.useFakeTimers();
    const onGone = vi.fn();
    let alive = true;

    exitWhenParentGone({ onGone, ppid: () => 500, alive: () => alive, everyMs: 1000 });
    vi.advanceTimersByTime(2000);
    alive = false;
    vi.advanceTimersByTime(10_000);

    expect(onGone).toHaveBeenCalledTimes(1);
  });

  it('fires when the process is adopted by another parent', () => {
    vi.useFakeTimers();
    const onGone = vi.fn();
    let parent = 500;

    exitWhenParentGone({ onGone, ppid: () => parent, alive: () => true, everyMs: 1000 });
    parent = 1;
    vi.advanceTimersByTime(1000);

    expect(onGone).toHaveBeenCalledTimes(1);
  });

  it('stops watching when cancelled', () => {
    vi.useFakeTimers();
    const onGone = vi.fn();

    const stop = exitWhenParentGone({ onGone, ppid: () => 500, alive: () => false, everyMs: 1000 });
    stop();
    vi.advanceTimersByTime(5000);

    expect(onGone).not.toHaveBeenCalled();
  });
});
