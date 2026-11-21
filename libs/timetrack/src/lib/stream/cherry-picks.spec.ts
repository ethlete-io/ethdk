import { describe, expect, it } from 'vitest';
import { GitCommitEvent } from '../model/event';
import { cherryPickCopies, withoutCherryPicks } from './cherry-picks';

const commit = (options: Omit<Partial<GitCommitEvent>, 'at'> & { sha: string; at: string }): GitCommitEvent => ({
  source: 'git',
  kind: 'git-commit',
  repoPath: '/home/human/dev/ethlete-sdk',
  branch: 'next',
  subject: 'fix(app): Change',
  ...options,
  at: new Date(options.at),
});

const shas = (events: readonly GitCommitEvent[]) => withoutCherryPicks(events).map((event) => event.sha);

describe('withoutCherryPicks', () => {
  it('keeps the earliest of two commits with one patch', () => {
    expect(
      shas([
        commit({ sha: 'b', at: '2026-11-21T01:00:00Z', patchId: 'p', subject: 'fix(app): Reworded' }),
        commit({ sha: 'a', at: '2026-11-21T00:00:00Z', patchId: 'p' }),
      ]),
    ).toEqual(['a']);
  });

  it('keeps two commits with different patches, author times and subjects', () => {
    expect(
      shas([
        commit({ sha: 'a', at: '2026-11-21T00:00:00Z', patchId: 'p' }),
        commit({ sha: 'b', at: '2026-11-21T00:00:01Z', patchId: 'q', subject: 'fix(app): Other' }),
      ]),
    ).toEqual(['a', 'b']);
  });

  it('counts one sha in two checkouts once', () => {
    expect(
      shas([
        commit({ sha: 'a', at: '2026-11-21T00:00:00Z' }),
        commit({ sha: 'a', at: '2026-11-21T00:00:00Z', repoPath: '/home/human/dev/ethlete-sdk-wt1' }),
      ]),
    ).toEqual(['a']);
  });

  it('matches a commit stored without a patch id by its author time and subject', () => {
    expect(
      shas([
        commit({ sha: 'a', at: '2026-11-21T00:00:00Z' }),
        commit({ sha: 'b', at: '2026-11-21T00:00:00Z', patchId: 'p', repoPath: '/home/human/dev/ethlete-sdk-wt1' }),
      ]),
    ).toEqual(['a']);
  });

  it('keeps the copy whose committer time equals its author time, whatever the event order', () => {
    expect(
      shas([
        commit({ sha: 'pick', at: '2026-11-21T00:00:00Z', committedAt: new Date('2026-11-21T03:00:00Z') }),
        commit({ sha: 'orig', at: '2026-11-21T00:00:00Z', committedAt: new Date('2026-11-21T00:00:00Z') }),
      ]),
    ).toEqual(['orig']);
  });

  it('keeps the copy in a repo root over one in a worktree when no committer time is stored', () => {
    const worktree = commit({ sha: 'wt', at: '2026-11-21T00:00:00Z', repoPath: '/home/human/dev/ethlete-sdk-wt1' });
    const main = commit({ sha: 'main', at: '2026-11-21T00:00:00Z' });

    expect(
      withoutCherryPicks([worktree, main], { repoRoots: ['/home/human/dev/ethlete-sdk'] }).map((event) => event.sha),
    ).toEqual(['main']);
  });

  it('keeps a pulled commit, which stands for the pull', () => {
    expect(
      shas([
        commit({ sha: 'a', at: '2026-11-21T00:00:00Z', patchId: 'p' }),
        commit({ sha: 'b', at: '2026-11-21T02:00:00Z', patchId: 'p', authoredAt: new Date('2026-11-21T00:00:00Z') }),
      ]),
    ).toEqual(['a', 'b']);
  });
});

describe('cherryPickCopies', () => {
  it('lists the copies of each commit, the kept one first, and leaves a lone commit out', () => {
    const copies = cherryPickCopies([
      commit({ sha: 'a', at: '2026-11-21T00:00:00Z', repoPath: '/home/human/dev/ethlete-sdk-wt1' }),
      commit({ sha: 'b', at: '2026-11-21T00:00:00Z' }),
      commit({ sha: 'c', at: '2026-11-21T00:05:00Z', subject: 'fix(app): Other' }),
    ]);

    expect(copies.map((group) => group.map((event) => event.sha))).toEqual([['a', 'b']]);
  });
});
