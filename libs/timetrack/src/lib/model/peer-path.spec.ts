import { describe, expect, it } from 'vitest';
import { translatePeerPath, withRepoAliases } from './peer-path';

const SDK = 'gitlab.com/ethlete/sdk';
const localKeys = { '/home/human/dev/ethlete-sdk': SDK, '/home/human/dev/fut': 'gitlab.com/ethlete/fut' };

describe('translatePeerPath', () => {
  it('maps a peer checkout onto the local checkout with the same key', () => {
    expect(
      translatePeerPath({ path: '/Users/human/code/sdk', peerKeys: { '/Users/human/code/sdk': SDK }, localKeys }),
    ).toBe('/home/human/dev/ethlete-sdk');
  });

  it('keeps what lies below the peer checkout', () => {
    expect(
      translatePeerPath({
        path: '/Users/human/code/sdk/libs/timetrack/src',
        peerKeys: { '/Users/human/code/sdk/': SDK },
        localKeys,
      }),
    ).toBe('/home/human/dev/ethlete-sdk/libs/timetrack/src');
  });

  it('keeps the trailing separator of a directory path', () => {
    expect(
      translatePeerPath({ path: '/Users/human/code/sdk/libs/', peerKeys: { '/Users/human/code/sdk': SDK }, localKeys }),
    ).toBe('/home/human/dev/ethlete-sdk/libs/');
  });

  it('does not take a sibling that only shares a name prefix as under the checkout', () => {
    expect(
      translatePeerPath({
        path: '/Users/human/code/sdk-old/src',
        peerKeys: { '/Users/human/code/sdk': SDK },
        localKeys,
      }),
    ).toBe('/Users/human/code/sdk-old/src');
  });

  it('picks the deepest peer checkout a path lies under', () => {
    expect(
      translatePeerPath({
        path: '/Users/human/code/fut/vendor/sdk/x',
        peerKeys: { '/Users/human/code/fut': 'gitlab.com/ethlete/fut', '/Users/human/code/fut/vendor/sdk': SDK },
        localKeys,
      }),
    ).toBe('/home/human/dev/ethlete-sdk/x');
  });

  it('keeps the peer path when no local checkout has its key', () => {
    expect(
      translatePeerPath({
        path: '/Users/human/code/other/src',
        peerKeys: { '/Users/human/code/other': 'github.com/someone/other' },
        localKeys,
      }),
    ).toBe('/Users/human/code/other/src');
  });

  it('keeps a path under no peer checkout', () => {
    expect(
      translatePeerPath({ path: '/Users/human/notes', peerKeys: { '/Users/human/code/sdk': SDK }, localKeys }),
    ).toBe('/Users/human/notes');
  });

  it('maps a Windows peer path onto a POSIX checkout', () => {
    expect(
      translatePeerPath({
        path: 'C:\\Users\\human\\dev\\sdk\\libs\\core',
        peerKeys: { 'C:\\Users\\human\\dev\\sdk': SDK },
        localKeys,
      }),
    ).toBe('/home/human/dev/ethlete-sdk/libs/core');
  });

  it('maps a POSIX peer path onto a Windows checkout', () => {
    expect(
      translatePeerPath({
        path: '/Users/human/code/sdk/libs/core',
        peerKeys: { '/Users/human/code/sdk': SDK },
        localKeys: { 'D:\\work\\sdk\\': SDK },
      }),
    ).toBe('D:\\work\\sdk\\libs\\core');
  });

  it('takes the shortest local checkout when several share the key', () => {
    expect(
      translatePeerPath({
        path: '/Users/human/code/sdk',
        peerKeys: { '/Users/human/code/sdk': SDK },
        localKeys: { '/home/human/dev/ethlete-sdk-2': SDK, '/home/human/dev/sdk': SDK },
      }),
    ).toBe('/home/human/dev/sdk');
  });
});

describe('withRepoAliases', () => {
  it('keys an aliased checkout by its alias, and leaves the others and an undiscovered path alone', () => {
    expect(
      withRepoAliases({
        keys: localKeys,
        aliases: { '/home/human/dev/fut': 'fut-alias', '/home/human/dev/gone': 'gone' },
      }),
    ).toEqual({ '/home/human/dev/ethlete-sdk': SDK, '/home/human/dev/fut': 'fut-alias' });
  });

  it('maps a peer checkout with another origin onto the local checkout both machines aliased alike', () => {
    expect(
      translatePeerPath({
        path: '/Users/human/code/fork/src/main.ts',
        peerKeys: withRepoAliases({
          keys: { '/Users/human/code/fork': 'github.com/human/fork' },
          aliases: { '/Users/human/code/fork': 'fut-alias' },
        }),
        localKeys: withRepoAliases({ keys: localKeys, aliases: { '/home/human/dev/fut': 'fut-alias' } }),
      }),
    ).toBe('/home/human/dev/fut/src/main.ts');
  });
});
