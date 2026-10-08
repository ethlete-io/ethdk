import { describe, expect, it } from 'vitest';
import { translatePeerPath } from './peer-path';

const SDK = 'gitlab.com/ethlete/sdk';
const localKeys = { '/home/tom/dev/ethlete-sdk': SDK, '/home/tom/dev/fut': 'gitlab.com/ethlete/fut' };

describe('translatePeerPath', () => {
  it('maps a peer checkout onto the local checkout with the same key', () => {
    expect(
      translatePeerPath({ path: '/Users/tom/code/sdk', peerKeys: { '/Users/tom/code/sdk': SDK }, localKeys }),
    ).toBe('/home/tom/dev/ethlete-sdk');
  });

  it('keeps what lies below the peer checkout', () => {
    expect(
      translatePeerPath({
        path: '/Users/tom/code/sdk/libs/timetrack/src',
        peerKeys: { '/Users/tom/code/sdk/': SDK },
        localKeys,
      }),
    ).toBe('/home/tom/dev/ethlete-sdk/libs/timetrack/src');
  });

  it('does not take a sibling that only shares a name prefix as under the checkout', () => {
    expect(
      translatePeerPath({ path: '/Users/tom/code/sdk-old/src', peerKeys: { '/Users/tom/code/sdk': SDK }, localKeys }),
    ).toBe('/Users/tom/code/sdk-old/src');
  });

  it('picks the deepest peer checkout a path lies under', () => {
    expect(
      translatePeerPath({
        path: '/Users/tom/code/fut/vendor/sdk/x',
        peerKeys: { '/Users/tom/code/fut': 'gitlab.com/ethlete/fut', '/Users/tom/code/fut/vendor/sdk': SDK },
        localKeys,
      }),
    ).toBe('/home/tom/dev/ethlete-sdk/x');
  });

  it('keeps the peer path when no local checkout has its key', () => {
    expect(
      translatePeerPath({
        path: '/Users/tom/code/other/src',
        peerKeys: { '/Users/tom/code/other': 'github.com/someone/other' },
        localKeys,
      }),
    ).toBe('/Users/tom/code/other/src');
  });

  it('keeps a path under no peer checkout', () => {
    expect(translatePeerPath({ path: '/Users/tom/notes', peerKeys: { '/Users/tom/code/sdk': SDK }, localKeys })).toBe(
      '/Users/tom/notes',
    );
  });

  it('maps a Windows peer path onto a POSIX checkout', () => {
    expect(
      translatePeerPath({
        path: 'C:\\Users\\tom\\dev\\sdk\\libs\\core',
        peerKeys: { 'C:\\Users\\tom\\dev\\sdk': SDK },
        localKeys,
      }),
    ).toBe('/home/tom/dev/ethlete-sdk/libs/core');
  });

  it('maps a POSIX peer path onto a Windows checkout', () => {
    expect(
      translatePeerPath({
        path: '/Users/tom/code/sdk/libs/core',
        peerKeys: { '/Users/tom/code/sdk': SDK },
        localKeys: { 'D:\\work\\sdk\\': SDK },
      }),
    ).toBe('D:\\work\\sdk\\libs\\core');
  });

  it('takes the shortest local checkout when several share the key', () => {
    expect(
      translatePeerPath({
        path: '/Users/tom/code/sdk',
        peerKeys: { '/Users/tom/code/sdk': SDK },
        localKeys: { '/home/tom/dev/ethlete-sdk-2': SDK, '/home/tom/dev/sdk': SDK },
      }),
    ).toBe('/home/tom/dev/sdk');
  });
});
