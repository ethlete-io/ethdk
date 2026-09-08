import { describe, expect, it } from 'vitest';
import { contextKey, streamKey } from './block';

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
