import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDeployedBuildFingerprint, readBuildFingerprint } from './build-fingerprint';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

const respondWith = (body: string, init?: ResponseInit) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(body, init))),
  );

describe('readBuildFingerprint', () => {
  it('changes when a hashed entry script changes', () => {
    const before = readBuildFingerprint(parse('<script src="/main-AAA.js" type="module"></script>'));
    const after = readBuildFingerprint(parse('<script src="/main-BBB.js" type="module"></script>'));

    expect(before).not.toBe(after);
  });

  it('ignores the order the scripts appear in', () => {
    const one = parse('<script src="/main-AAA.js"></script><script src="/polyfills-BBB.js"></script>');
    const other = parse('<script src="/polyfills-BBB.js"></script><script src="/main-AAA.js"></script>');

    expect(readBuildFingerprint(one)).toBe(readBuildFingerprint(other));
  });

  it('ignores cross-origin scripts, whose URLs churn on their own', () => {
    const withoutTag = parse('<script src="/main-AAA.js"></script>');
    const withTag = parse('<script src="/main-AAA.js"></script><script src="https://cdn.test/a.js?v=2"></script>');

    expect(readBuildFingerprint(withTag)).toBe(readBuildFingerprint(withoutTag));
  });

  it('is empty for a document with no entry scripts', () => {
    expect(readBuildFingerprint(parse('<p>Gone fishing</p>'))).toBe('');
  });
});

describe('fetchDeployedBuildFingerprint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the fingerprint out of the served document', async () => {
    respondWith('<html><head><script src="/main-BBB.js" type="module"></script></head></html>');

    await expect(fetchDeployedBuildFingerprint('/')).resolves.toBe('/main-BBB.js');
  });

  it.each([
    ['a non-2xx response', () => respondWith('Not found', { status: 404 })],
    ['a body with no scripts in it', () => respondWith('<html><body>502 Bad Gateway</body></html>')],
    [
      'a network failure',
      () =>
        vi.stubGlobal(
          'fetch',
          vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
        ),
    ],
  ])('answers null rather than a fingerprint for %s', async (_case, arrange) => {
    arrange();

    await expect(fetchDeployedBuildFingerprint('/')).resolves.toBeNull();
  });
});
