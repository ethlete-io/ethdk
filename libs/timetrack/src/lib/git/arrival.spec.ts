import { describe, expect, it, vi } from 'vitest';
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

  it('parses only the reflog that changed when a later scan with a moved window sees one new move', () => {
    const sha = (index: number) => index.toString(16).padStart(40, 'a');
    const moves = (branch: string, count: number) =>
      Array.from({ length: count }, (_, index) =>
        line(
          `${branch}@{${new Date(Date.UTC(2026, 7, 11, 6, index)).toISOString()}}`,
          'pull: Fast-forward',
          sha(index),
        ),
      );
    const main = moves('next', 200);
    const worktree = moves('fix', 150);
    const later = { from: WINDOW.from, to: new Date('2026-08-11T23:59:59+02:00') };
    const arrived = line('next@{2026-08-11T12:00:00+02:00}', 'pull: Fast-forward', UPSTREAM);
    const split = vi.spyOn(String.prototype, 'split');

    gitArrivalsOf({ outputs: [main.join('\n'), worktree.join('\n')], window: { ...WINDOW } });
    split.mockClear();
    const unchanged = gitArrivalsOf({ outputs: [main.join('\n'), worktree.join('\n')], window: later });
    const unchangedSplits = split.mock.calls.length;

    split.mockClear();
    const next = gitArrivalsOf({ outputs: [[arrived, ...main].join('\n'), worktree.join('\n')], window: later });
    const nextSplits = split.mock.calls.length;

    split.mockRestore();

    expect(unchangedSplits).toBe(0);
    expect(nextSplits).toBe(1 + 201);
    expect(next.arrivals).toHaveLength(unchanged.arrivals.length + 1);
    expect(next.arrivals).toContainEqual({ at: new Date('2026-08-11T12:00:00+02:00'), to: UPSTREAM, from: sha(199) });
  });
});
