import { afterEach, describe, expect, it, vi } from 'vitest';
import { awaitFonts, awaitSettled } from './thumb';
import { durationOf, playwrightTimeoutOf, WaitTimeoutError, withinLimit } from './wait';

const never = new Promise<never>(() => undefined);

describe('withinLimit', () => {
  afterEach(() => vi.useRealTimers());

  it('rejects with what it waited for once the limit passed', async () => {
    vi.useFakeTimers();

    const waited = withinLimit(never, { ms: 30_000, what: 'the harness server on :44009' });
    const caught = waited.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(30_000);

    const error = await caught;

    expect(error).toBeInstanceOf(WaitTimeoutError);
    expect((error as Error).message).toBe('timed out after 30 s waiting for the harness server on :44009');
  });

  it('answers the work when it ends in time and announces nothing', async () => {
    vi.useFakeTimers();

    const announce = vi.fn();
    const waited = withinLimit(Promise.resolve('done'), { ms: 1000, what: 'x', announceAfterMs: 10, announce });

    await expect(waited).resolves.toBe('done');
    await vi.advanceTimersByTimeAsync(2000);
    expect(announce).not.toHaveBeenCalled();
  });

  it('says what it waits for once the wait gets long', async () => {
    vi.useFakeTimers();

    const announce = vi.fn();
    const caught = withinLimit(never, { ms: 300_000, what: 'the build', announceAfterMs: 5000, announce }).catch(
      () => undefined,
    );

    await vi.advanceTimersByTimeAsync(4999);
    expect(announce).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(announce).toHaveBeenCalledWith('waiting for the build (up to 5 min)');
    await vi.advanceTimersByTimeAsync(300_000);
    await caught;
  });

  it('names durations in ms, s and min', () => {
    expect(durationOf(400)).toBe('400 ms');
    expect(durationOf(15_000)).toBe('15 s');
    expect(durationOf(3_600_000)).toBe('60 min');
  });

  it('never hands Playwright a 0 timeout, which it reads as no limit', () => {
    expect(playwrightTimeoutOf(0)).toBe(1);
    expect(playwrightTimeoutOf(-20)).toBe(1);
    expect(playwrightTimeoutOf(250.2)).toBe(251);
  });
});

describe('page waits', () => {
  afterEach(() => vi.useRealTimers());

  const stuckPage = { evaluate: () => never, url: () => 'http://localhost:4410/frame.html?call=app/one' };

  it('awaitSettled names the page whose fonts and frames never came', async () => {
    vi.useFakeTimers();

    const caught = awaitSettled(stuckPage).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(15_000);

    expect(((await caught) as Error).message).toBe(
      'timed out after 15 s waiting for the fonts and the first frames of http://localhost:4410/frame.html?call=app/one',
    );
  });

  it('awaitFonts names the page whose fonts never loaded', async () => {
    vi.useFakeTimers();

    const caught = awaitFonts(stuckPage).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(15_000);

    expect(((await caught) as Error).message).toBe(
      'timed out after 15 s waiting for the fonts of http://localhost:4410/frame.html?call=app/one',
    );
  });
});
