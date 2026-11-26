import { describe, expect, it } from 'vitest';
import { CheckoutFs, checkoutOf } from './checkout';

const fsWith = (tree: Record<string, string | 'dir'>): CheckoutFs => ({
  isDirectory: async (path) => tree[path] === 'dir',
  readText: async (path) => {
    const entry = tree[path];

    return typeof entry === 'string' && entry !== 'dir' ? entry : null;
  },
});

const SDK = {
  '/home/human/dev/sdk/.git': 'dir',
  '/home/human/dev/sdk/.git/HEAD': 'ref: refs/heads/next\n',
} as const;

describe('checkoutOf', () => {
  it('walks up to the checkout the file is in and reads its branch', async () => {
    const checkout = await checkoutOf({
      fs: fsWith({ ...SDK }),
      filePath: '/home/human/dev/sdk/libs/components/src/index.ts',
    });

    expect(checkout).toEqual({ repoPath: '/home/human/dev/sdk', branch: 'next' });
  });

  it('prefers the innermost checkout when one sits inside another', async () => {
    const checkout = await checkoutOf({
      fs: fsWith({
        ...SDK,
        '/home/human/dev/sdk/vendor/inner/.git': 'dir',
        '/home/human/dev/sdk/vendor/inner/.git/HEAD': 'ref: refs/heads/main\n',
      }),
      filePath: '/home/human/dev/sdk/vendor/inner/src/index.ts',
    });

    expect(checkout).toEqual({ repoPath: '/home/human/dev/sdk/vendor/inner', branch: 'main' });
  });

  it('reports the checkout without a branch for a detached head', async () => {
    const checkout = await checkoutOf({
      fs: fsWith({ '/home/human/dev/sdk/.git': 'dir', '/home/human/dev/sdk/.git/HEAD': '9f1c2d3e4f5a\n' }),
      filePath: '/home/human/dev/sdk/src/index.ts',
    });

    expect(checkout).toEqual({ repoPath: '/home/human/dev/sdk', branch: undefined });
  });

  /** A worktree and a submodule both write `.git` as a file, and the directory is still the project. */
  it('reports a worktree as its own checkout', async () => {
    const checkout = await checkoutOf({
      fs: fsWith({ '/home/human/dev/sdk-hotfix/.git': 'gitdir: /home/human/dev/sdk/.git/worktrees/hotfix\n' }),
      filePath: '/home/human/dev/sdk-hotfix/src/index.ts',
    });

    expect(checkout).toEqual({ repoPath: '/home/human/dev/sdk-hotfix' });
  });

  it('finds no checkout for a file outside every one', async () => {
    expect(await checkoutOf({ fs: fsWith({ ...SDK }), filePath: '/home/human/notes/standup.md' })).toBeNull();
  });

  it('stops walking rather than climbing forever', async () => {
    const deep = `/${Array.from({ length: 200 }, (_, index) => `level-${index}`).join('/')}/file.ts`;

    expect(await checkoutOf({ fs: fsWith({}), filePath: deep })).toBeNull();
  });
});
