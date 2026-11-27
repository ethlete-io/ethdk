import { describe, expect, it } from 'vitest';
import { mainOfDeletedCheckout, parseGitWorktrees } from './worktree';

const OUTPUT = [
  'worktree /home/human/dev/sdk',
  'HEAD 1111111111111111111111111111111111111111',
  'branch refs/heads/next',
  '',
  'worktree /home/human/dev/sdk-e2e',
  'HEAD 2222222222222222222222222222222222222222',
  'branch refs/heads/wt/components-e2e',
  '',
].join('\n');

describe('parseGitWorktrees', () => {
  it('reads every checkout and the branch it holds, main worktree first', () => {
    expect(parseGitWorktrees(OUTPUT)).toEqual([
      { path: '/home/human/dev/sdk', branch: 'next' },
      { path: '/home/human/dev/sdk-e2e', branch: 'wt/components-e2e' },
    ]);
  });

  it('leaves a detached checkout without a branch', () => {
    const output = ['worktree /home/human/dev/sdk', 'HEAD 1111111111111111111111111111111111111111', 'detached'].join(
      '\n',
    );

    expect(parseGitWorktrees(output)).toEqual([{ path: '/home/human/dev/sdk' }]);
  });

  it('keeps a branch name that contains a slash whole', () => {
    const output = ['worktree /home/human/dev/sdk', 'branch refs/heads/feat/FIP-2177-user-management'].join('\n');

    expect(parseGitWorktrees(output)[0]?.branch).toBe('feat/FIP-2177-user-management');
  });

  it('reads nothing out of empty output', () => {
    expect(parseGitWorktrees('')).toEqual([]);
  });
});

describe('mainOfDeletedCheckout', () => {
  const main = '/home/human/dev/client/app-frontend';
  const holders = [main, '/home/human/dev/.scratch/app-visual', '/home/human/dev/scratch/app-vb-rack'];

  it('files a deleted worktree under the one repository holding its commit', () => {
    expect(mainOfDeletedCheckout({ checkout: '/home/human/dev/client/app-frontend-fab', holders: [main] })).toBe(main);
  });

  it('files a deleted sibling worktree under the main its folder name extends when scratch clones hold the commit too', () => {
    expect(mainOfDeletedCheckout({ checkout: '/home/human/dev/client/app-frontend-fab', holders })).toBe(main);
    expect(mainOfDeletedCheckout({ checkout: '/home/human/dev/client/app-frontend-ssr-globals-2a/', holders })).toBe(
      holders[0],
    );
  });

  it('prefers the longest main name a sibling worktree extends', () => {
    const mains = ['/home/human/dev/app', '/home/human/dev/app-altcha'];

    expect(mainOfDeletedCheckout({ checkout: '/home/human/dev/app-altcha-login', holders: mains })).toBe(mains[1]);
  });

  it('files a deleted worktree under the only holder in its parent folder when its name extends none', () => {
    expect(mainOfDeletedCheckout({ checkout: '/home/human/dev/client/wt-sa-next', holders })).toBe(main);
  });

  it('leaves a checkout unfiled when no holder matches its folder', () => {
    expect(mainOfDeletedCheckout({ checkout: '/home/human/dev/other/tool', holders })).toBeUndefined();
    expect(
      mainOfDeletedCheckout({
        checkout: '/home/human/dev/wt-x',
        holders: ['/home/human/dev/app', '/home/human/dev/api'],
      }),
    ).toBeUndefined();
    expect(mainOfDeletedCheckout({ checkout: '/home/human/dev/client/app-frontend-fab', holders: [] })).toBeUndefined();
  });
});
