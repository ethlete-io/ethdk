import { describe, expect, it } from 'vitest';
import { parseGitWorktrees } from './worktree';

const OUTPUT = [
  'worktree /home/tom/dev/sdk',
  'HEAD 1111111111111111111111111111111111111111',
  'branch refs/heads/next',
  '',
  'worktree /home/tom/dev/sdk-e2e',
  'HEAD 2222222222222222222222222222222222222222',
  'branch refs/heads/wt/components-e2e',
  '',
].join('\n');

describe('parseGitWorktrees', () => {
  it('reads every checkout and the branch it holds, main worktree first', () => {
    expect(parseGitWorktrees(OUTPUT)).toEqual([
      { path: '/home/tom/dev/sdk', branch: 'next' },
      { path: '/home/tom/dev/sdk-e2e', branch: 'wt/components-e2e' },
    ]);
  });

  it('leaves a detached checkout without a branch', () => {
    const output = ['worktree /home/tom/dev/sdk', 'HEAD 1111111111111111111111111111111111111111', 'detached'].join(
      '\n',
    );

    expect(parseGitWorktrees(output)).toEqual([{ path: '/home/tom/dev/sdk' }]);
  });

  it('keeps a branch name that contains a slash whole', () => {
    const output = ['worktree /home/tom/dev/sdk', 'branch refs/heads/feat/FIP-2177-user-management'].join('\n');

    expect(parseGitWorktrees(output)[0]?.branch).toBe('feat/FIP-2177-user-management');
  });

  it('reads nothing out of empty output', () => {
    expect(parseGitWorktrees('')).toEqual([]);
  });
});
