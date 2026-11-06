import { describe, expect, it } from 'vitest';
import { changedAtOf, isWatchBuildCurrent, WatchState, watchLineOf } from './harness-watch';

describe('watchLineOf', () => {
  it.each([
    ['ethlete-studio: ❯ Building...', 'start'],
    ['ethlete-studio: ✔ Building...', null],
    ['ethlete-studio: ❯ Changes detected. Rebuilding...', 'start'],
    ['ethlete-studio: ✔ Changes detected. Rebuilding...', null],
    ['ethlete-studio: Application bundle generation complete. [0.907 seconds] - 2026-11-06T11:00:17.449Z', 'built'],
    ['ethlete-studio: Application bundle generation failed. [0.879 seconds] - 2026-11-06T11:00:23.419Z', 'failed'],
    [
      "ethlete-studio: ✘ [ERROR] TS2322: Type 'string' is not assignable to type 'number'. [plugin angular-compiler]",
      null,
    ],
    ['Waiting for ethlete-studio:build:development in another nx process', 'busy'],
    ['> nx run ethlete-studio:build:development --watch', null],
  ])('reads %s as %s', (line, kind) => {
    expect(watchLineOf(line)).toBe(kind);
  });
});

const built = (startedAt: number, endedAt: number): WatchState['last'] => ({ startedAt, endedAt, ok: true, log: [] });

const current = (state: WatchState, changedAt: number | null, now: number, waitingSince = now) =>
  isWatchBuildCurrent({ state, changedAt, waitingSince, now, settle: 1_000, slack: 50 });

describe('isWatchBuildCurrent', () => {
  it('waits for the first build', () => {
    expect(current({ last: null, inFlight: { startedAt: 0, prime: false } }, null, 5_000)).toBe(false);
  });

  it('serves the last build when no input changed', () => {
    expect(current({ last: built(0, 100), inFlight: null }, null, 200)).toBe(true);
  });

  it('serves the last build while only the warm-up rebuild runs', () => {
    expect(current({ last: built(0, 100), inFlight: { startedAt: 150, prime: true } }, null, 200)).toBe(true);
  });

  it('waits while a rebuild of a change runs', () => {
    expect(current({ last: built(0, 100), inFlight: { startedAt: 150, prime: false } }, null, 200)).toBe(false);
  });

  it('serves a build that started after the change', () => {
    expect(current({ last: built(1_100, 1_900), inFlight: null }, 1_000, 2_000)).toBe(true);
  });

  it('waits for the watcher to pick up a change newer than the last build', () => {
    expect(current({ last: built(0, 100), inFlight: null }, 1_000, 1_200, 1_100)).toBe(false);
    expect(current({ last: built(990, 1_500), inFlight: null }, 1_000, 1_600, 1_100)).toBe(false);
  });

  it('serves the last build once the watcher ignored a change for the settle time', () => {
    expect(current({ last: built(0, 100), inFlight: null }, 1_000, 2_100, 1_100)).toBe(true);
    expect(current({ last: built(0, 100), inFlight: { startedAt: 2_000, prime: true } }, 1_000, 2_100, 1_100)).toBe(
      false,
    );
  });
});

describe('changedAtOf', () => {
  const confirmed = new Map([
    ['a.ts', '1'],
    ['b.ts', '1'],
  ]);
  const mtimeOf = (path: string) => ({ 'a.ts': 10, 'b.ts': 20, 'c.ts': 30 })[path] ?? null;

  it('is null when every input matches', () => {
    expect(changedAtOf({ confirmed, inputs: confirmed, mtimeOf, now: 99 })).toBeNull();
  });

  it('is the latest modification time of a changed or added input', () => {
    expect(
      changedAtOf({
        confirmed,
        inputs: new Map([
          ['a.ts', '2'],
          ['b.ts', '1'],
        ]),
        mtimeOf,
        now: 99,
      }),
    ).toBe(10);
    expect(
      changedAtOf({
        confirmed,
        inputs: new Map([
          ['a.ts', '2'],
          ['b.ts', '1'],
          ['c.ts', '1'],
        ]),
        mtimeOf,
        now: 99,
      }),
    ).toBe(30);
  });

  it('is now for a removed input', () => {
    expect(changedAtOf({ confirmed, inputs: new Map([['a.ts', '1']]), mtimeOf, now: 99 })).toBe(99);
  });
});
