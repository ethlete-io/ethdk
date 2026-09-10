import { describe, expect, it } from 'vitest';
import { contextKey, streamKey, streamKeyRepoPath } from './block';

describe('streamKey', () => {
  it('gives one checkout one key, whatever branch is checked out', () => {
    expect(streamKey({ repoPath: '/home/tom/dev/a', branch: 'main' })).toBe(
      streamKey({ repoPath: '/home/tom/dev/a', branch: 'next' }),
    );
  });

  it('keeps two checkouts apart', () => {
    expect(streamKey({ repoPath: '/home/tom/dev/a' })).not.toBe(streamKey({ repoPath: '/home/tom/dev/b' }));
  });

  it('names the application when there is no checkout', () => {
    expect(streamKey({ appId: 'slack' })).not.toBe(streamKey({ appId: 'firefox' }));
    expect(streamKey({})).toBe(streamKey({ appId: '' }));
  });

  it('is not the block-continuation identity, which the branch does split', () => {
    expect(contextKey({ repoPath: '/home/tom/dev/a', branch: 'main' })).not.toBe(
      contextKey({ repoPath: '/home/tom/dev/a', branch: 'next' }),
    );
  });
});

describe('streamKeyRepoPath', () => {
  it('reads the checkout back out of the key `streamKey` wrote', () => {
    expect(streamKeyRepoPath(streamKey({ repoPath: '/home/tom/dev/a', branch: 'next' }))).toBe('/home/tom/dev/a');
  });

  it('names nothing for a key that names an application', () => {
    expect(streamKeyRepoPath(streamKey({ appId: 'discord' }))).toBeUndefined();
    expect(streamKeyRepoPath(streamKey({}))).toBeUndefined();
  });
});
