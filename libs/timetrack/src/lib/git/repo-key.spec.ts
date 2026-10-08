import { describe, expect, it } from 'vitest';
import { repoKeyOf } from './repo-key';

describe('repoKeyOf', () => {
  it.each([
    ['git@gitlab.com:Ethlete/sdk.git', 'gitlab.com/ethlete/sdk'],
    ['https://gitlab.com/ethlete/sdk', 'gitlab.com/ethlete/sdk'],
    ['ssh://git@gitlab.com:22/ethlete/sdk.git', 'gitlab.com/ethlete/sdk'],
    ['ssh://git@gitlab.com:2222/ethlete/sdk.git', 'gitlab.com/ethlete/sdk'],
    ['https://user:token@github.com/Ethlete/SDK/', 'github.com/ethlete/sdk'],
    ['http://github.com/Ethlete/SDK.git/', 'github.com/ethlete/sdk'],
    ['git://github.com/ethlete/sdk.git', 'github.com/ethlete/sdk'],
    ['  https://github.com/ethlete/sdk.git  ', 'github.com/ethlete/sdk'],
    ['git@github.com:ethlete/sdk.GIT', 'github.com/ethlete/sdk'],
    ['git@host.example:/srv/repo.git', 'host.example/srv/repo'],
    ['ssh://git@host.example:8080/team/sub/repo.git//', 'host.example/team/sub/repo'],
  ])('normalizes %s to %s', (remoteUrl, expected) => {
    expect(repoKeyOf(remoteUrl, '/home/tom/dev/x')).toBe(expected);
  });

  it('keys two spellings of one repository identically', () => {
    expect(repoKeyOf('git@gitlab.com:Ethlete/sdk.git', '/a')).toBe(repoKeyOf('https://gitlab.com/ethlete/sdk', '/b'));
  });

  it.each([null, '', '   '])('falls back to the directory name without a URL (%j)', (remoteUrl) => {
    expect(repoKeyOf(remoteUrl, '/home/tom/dev/Ethlete-SDK')).toBe('ethlete-sdk');
  });

  it('takes the last segment of a checkout path with a trailing slash', () => {
    expect(repoKeyOf(null, '/Users/tom/dev/x/')).toBe('x');
  });

  it('takes the last segment of a Windows checkout path', () => {
    expect(repoKeyOf(null, 'C:\\dev\\x')).toBe('x');
  });
});
