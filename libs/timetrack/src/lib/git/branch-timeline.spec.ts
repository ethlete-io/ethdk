import { describe, expect, it } from 'vitest';
import { branchAtIn, branchWindowsIn, encodeBranchTimelines, parseBranchTimelines } from './branch-timeline';
import { GIT_FIELD_SEPARATOR } from './format';
import { parseHeadBranchAt } from './head';

const checkout = (options: { stamp: string; from: string; to: string }) =>
  `HEAD@{${options.stamp}}${GIT_FIELD_SEPARATOR}checkout: moving from ${options.from} to ${options.to}`;

const OUTPUT = [
  checkout({ stamp: '2026-11-18T14:00:00+01:00', from: 'next', to: 'feature/report' }),
  checkout({ stamp: '2026-11-10T09:00:00+01:00', from: 'main', to: 'next' }),
  checkout({ stamp: '2026-09-01T09:00:00+02:00', from: 'release', to: 'main' }),
].join('\n');

describe('branchWindowsIn', () => {
  const windows = branchWindowsIn({ output: OUTPUT, since: new Date('2026-10-20T00:00:00Z') });

  it('keeps the window holding at the cutoff and every later one', () => {
    expect(windows.map((window) => window.branch)).toEqual(['main', 'next', 'feature/report']);
  });

  it('answers what the reflog answers for every instant after the cutoff', () => {
    for (const at of ['2026-10-21T12:00:00Z', '2026-11-18T10:00:00Z', '2026-11-18T23:00:00Z']) {
      expect(branchAtIn({ windows, at: new Date(at) })).toBe(parseHeadBranchAt({ output: OUTPUT, at: new Date(at) }));
    }
  });

  it('starts at the branch HEAD came from when the reflog holds no older switch', () => {
    const all = branchWindowsIn({ output: OUTPUT, since: new Date('2020-01-01T00:00:00Z') });

    expect(branchAtIn({ windows: all, at: new Date('2026-01-01T00:00:00Z') })).toBe('release');
  });
});

describe('parseBranchTimelines', () => {
  it('reads back what was encoded', () => {
    const checkouts = [{ key: 'gitlab.com/client/shop', windows: [{ fromMs: 0, branch: 'main' }, { fromMs: 5 }] }];

    expect(parseBranchTimelines(encodeBranchTimelines(checkouts))).toEqual(checkouts);
  });

  it('drops what no version wrote', () => {
    expect(
      parseBranchTimelines('{"checkouts":[{"key":"","windows":[]},{"key":"a","windows":[{"fromMs":"x"}]}]}'),
    ).toEqual([]);
    expect(parseBranchTimelines('not json')).toEqual([]);
  });
});
