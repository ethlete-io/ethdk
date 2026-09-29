import { describe, expect, it } from 'vitest';
import { pathsChangedBetween, releaseFlags } from './release';

describe('releaseFlags', () => {
  it('reads each flag and its alias', () => {
    expect(releaseFlags(['--force', '-sp'])).toEqual({ shouldForce: true, skipPush: true });
    expect(releaseFlags(['-f', '--skip-push'])).toEqual({ shouldForce: true, skipPush: true });
  });

  it('does not read a flag out of a longer argument', () => {
    expect(releaseFlags(['--no-fail-fast', '--spec'])).toEqual({ shouldForce: false, skipPush: false });
  });
});

describe('pathsChangedBetween', () => {
  it('returns only paths that the version step added, changed or removed', () => {
    const before = new Map([
      ['unrelated.ts', 'a'],
      ['package.json', 'p1'],
    ]);
    const after = new Map([
      ['unrelated.ts', 'a'],
      ['package.json', 'p2'],
      ['CHANGELOG.md', 'c'],
      ['.changeset/x.md', 'deleted'],
    ]);
    const beforeWithChangeset = new Map([...before, ['.changeset/x.md', 'x']]);

    expect(pathsChangedBetween(beforeWithChangeset, after).sort()).toEqual([
      '.changeset/x.md',
      'CHANGELOG.md',
      'package.json',
    ]);
  });

  it('returns nothing when the tree did not change', () => {
    const snapshot = new Map([['a.ts', '1']]);

    expect(pathsChangedBetween(snapshot, new Map(snapshot))).toEqual([]);
  });
});
