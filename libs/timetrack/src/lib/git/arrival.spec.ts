import { describe, expect, it } from 'vitest';
import { gitArrivalsOf, gitArrivedAt } from './arrival';
import { GIT_FIELD_SEPARATOR } from './format';

const WINDOW = { from: new Date('2026-08-11T00:00:00+02:00'), to: new Date('2026-08-11T23:59:59+02:00') };
const OLD = '1'.repeat(40);
const UPSTREAM = '2'.repeat(40);
const REPLAYED = '3'.repeat(40);
const REWRITTEN = '4'.repeat(40);

const line = (selector: string, action: string, sha: string) => [selector, action, sha].join(GIT_FIELD_SEPARATOR);

describe('gitArrivalsOf', () => {
  it('keeps a commit a rebase replayed here out of what a pull brought in', () => {
    const output = [
      line('HEAD@{2026-08-11T10:00:02+02:00}', 'pull --rebase (pick): feat(repo): Mine', REPLAYED),
      line('HEAD@{2026-08-11T10:00:01+02:00}', 'pull --rebase (start): checkout ' + UPSTREAM, UPSTREAM),
      line('next@{2026-08-11T10:00:03+02:00}', 'pull --rebase (finish): refs/heads/next onto ' + UPSTREAM, REPLAYED),
      line('next@{2026-08-10T09:00:00+02:00}', 'commit: feat(repo): Mine', OLD),
    ].join('\n');
    const arrivals = gitArrivalsOf({ outputs: [output], window: WINDOW });

    expect(arrivals.arrivals).toEqual([{ at: new Date('2026-08-11T10:00:03+02:00'), to: REPLAYED, from: OLD }]);
    expect(
      gitArrivedAt({
        arrivals,
        listed: arrivals.arrivals.map((arrival) => ({ arrival, output: `${REPLAYED}\n${UPSTREAM}\n` })),
      }),
    ).toEqual(new Map([[UPSTREAM, new Date('2026-08-11T10:00:03+02:00')]]));
  });

  it('reads a commit another checkout wrote as written here', () => {
    const main = line('next@{2026-08-11T12:00:00+02:00}', 'merge wt/fix: Fast-forward', REWRITTEN);
    const worktree = line('HEAD@{2026-08-11T11:00:00+02:00}', 'commit: fix(repo): In the worktree', REWRITTEN);
    const arrivals = gitArrivalsOf({ outputs: [main, worktree], window: WINDOW });

    expect(
      gitArrivedAt({ arrivals, listed: arrivals.arrivals.map((arrival) => ({ arrival, output: REWRITTEN })) }),
    ).toEqual(new Map());
  });
});
