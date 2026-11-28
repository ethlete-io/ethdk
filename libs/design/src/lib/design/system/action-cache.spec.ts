import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { withRunSignal } from '../run-abort';
import { ActionDep, cachedActionsOf, createActionCache } from './action-cache';

describe('cachedActionsOf', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'action-cache-'));

    dirs.push(dir);

    const cache = createActionCache(dir);
    const pictures: Record<string, string> = { closed: 'closed-1', open: 'open-1', hover: 'hover-1' };
    const goals: Record<string, string> = { closed: 'open', hover: 'open' };
    const ran: string[] = [];
    const printOf = async (dep: ActionDep) => (dep.kind === 'draw' ? (pictures[dep.state] ?? '') : '');
    const check = (state: string, markup: string) =>
      cachedActionsOf({
        cache,
        key: `${state}:${markup}`,
        printOf,
        run: async (track) => {
          ran.push(state);

          const goal = goals[state] ?? state;

          track({ kind: 'draw', state: goal, opened: null }, pictures[goal] ?? '');

          return { value: `${state} reaches ${pictures[goal]}`, keep: true };
        },
      });
    const checkAll = async () => {
      ran.length = 0;

      for (const state of ['closed', 'hover']) await check(state, pictures[state] ?? '');

      return [...ran];
    };

    return { pictures, goals, checkAll, check };
  };

  it('re-checks exactly the state whose own design changed between two runs', async () => {
    const { pictures, checkAll } = setup();

    expect(await checkAll()).toEqual(['closed', 'hover']);
    expect(await checkAll()).toEqual([]);

    pictures['hover'] = 'hover-2';

    expect(await checkAll()).toEqual(['hover']);
    expect(await checkAll()).toEqual([]);
  });

  it('re-checks exactly the states whose goal picture changed, and returns the new result', async () => {
    const { pictures, goals, checkAll, check } = setup();

    goals['hover'] = 'hover';
    await checkAll();
    pictures['open'] = 'open-2';

    expect(await checkAll()).toEqual(['closed']);
    expect(await check('closed', 'closed-1')).toEqual({ value: 'closed reaches open-2', hit: true });
  });

  it('runs every time without a cache, and keeps nothing a run marks as not to keep', async () => {
    let runs = 0;
    const run = async () => ((runs += 1), { value: runs, keep: false });
    const dir = mkdtempSync(join(tmpdir(), 'action-cache-'));

    dirs.push(dir);

    await cachedActionsOf({ cache: null, key: 'a', printOf: async () => '', run });
    await cachedActionsOf({ cache: null, key: 'a', printOf: async () => '', run });
    await cachedActionsOf({ cache: createActionCache(dir), key: 'a', printOf: async () => '', run });
    await cachedActionsOf({ cache: createActionCache(dir), key: 'a', printOf: async () => '', run });

    expect(runs).toBe(4);
  });

  it('keeps nothing of a run its client aborted, whose lines name closed pages', async () => {
    let runs = 0;
    const run = async () => ((runs += 1), { value: runs, keep: true });
    const dir = mkdtempSync(join(tmpdir(), 'action-cache-'));
    const gone = new AbortController();

    dirs.push(dir);
    gone.abort();

    await withRunSignal(gone.signal, () =>
      cachedActionsOf({ cache: createActionCache(dir), key: 'a', printOf: async () => '', run }),
    );
    await cachedActionsOf({ cache: createActionCache(dir), key: 'a', printOf: async () => '', run });

    expect(runs).toBe(2);
  });
});
