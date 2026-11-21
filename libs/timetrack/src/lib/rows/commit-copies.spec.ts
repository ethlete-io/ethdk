import { describe, expect, it } from 'vitest';
import { Evidence } from '../model/evidence';
import { CommitCopy, surplusCommitCopies } from './commit-copies';

const commit = (detail: string): Evidence => ({ kind: 'commit', at: new Date('2026-11-21T00:00:00Z'), detail });
const copy = (detail: string, ...laneKeys: string[]): CommitCopy => ({ detail, laneKeys });

describe('surplusCommitCopies', () => {
  it('keeps the first copy a row holds and drops the others', () => {
    const original = commit('aaaaaaa fix(app): Change');
    const pick = commit('bbbbbbb fix(app): Change');

    expect(
      surplusCommitCopies({
        rows: [
          { laneKey: 'repo:/wt', evidence: [original] },
          { laneKey: 'repo:/main', evidence: [pick] },
        ],
        copies: [[copy('aaaaaaa fix(app): Change', 'repo:/wt'), copy('bbbbbbb fix(app): Change', 'repo:/main')]],
      }),
    ).toEqual(new Set([pick]));
  });

  it('keeps a later copy when no row holds the first one', () => {
    const pick = commit('bbbbbbb fix(app): Change');

    expect(
      surplusCommitCopies({
        rows: [{ laneKey: 'repo:/main', evidence: [pick] }],
        copies: [[copy('aaaaaaa fix(app): Change', 'repo:/wt'), copy('bbbbbbb fix(app): Change', 'repo:/main')]],
      }).size,
    ).toBe(0);
  });

  it('tells copies with one sha apart by the lane of the row', () => {
    const inMain = commit('aaaaaaa fix(app): Change');
    const inWorktree = commit('aaaaaaa fix(app): Change');

    expect(
      surplusCommitCopies({
        rows: [
          { laneKey: 'repo:/wt', evidence: [inWorktree] },
          { laneKey: 'repo:/main', evidence: [inMain] },
        ],
        copies: [
          [copy('aaaaaaa fix(app): Change', 'repo:/main', 'repo:/wt'), copy('aaaaaaa fix(app): Change', 'repo:/wt')],
        ],
      }),
    ).toEqual(new Set([inWorktree]));
  });
});
