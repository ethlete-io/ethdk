import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDeployedBuildFingerprint$, readBuildFingerprint } from './build-fingerprint';

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

describe('fetchDeployedBuildFingerprint$', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the fingerprint out of the served document', async () => {
    respondWith('<html><head><script src="/main-BBB.js" type="module"></script></head></html>');

    await expect(firstValueFrom(fetchDeployedBuildFingerprint$('/'))).resolves.toBe('/main-BBB.js');
  });

  it('does not fetch until subscribed', async () => {
    respondWith('<script src="/main-BBB.js"></script>');

    const fingerprint$ = fetchDeployedBuildFingerprint$('/');

    expect(fetch).not.toHaveBeenCalled();

    await firstValueFrom(fingerprint$);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['double-quoted', '<script type="module" src="/main-AAA.js"></script>'],
    ['single-quoted', "<script src='/main-AAA.js'></script>"],
    ['unquoted', '<script defer src=/main-AAA.js></script>'],
    ['character references', '<script src="/main.js?v=1&amp;h=&#65;&#x42;"></script>'],
    ['upper-case tags', '<SCRIPT SRC="/main-AAA.js"></SCRIPT>'],
    ['a commented-out script', '<!-- <script src="/old-ZZZ.js"></script> --><script src="/main-AAA.js"></script>'],
    ['a data-src attribute', '<script data-src="/lazy-ZZZ.js"></script><script src="/main-AAA.js"></script>'],
    [
      'a nonced style and inline script',
      '<style nonce="a">p{}</style><script nonce="a">1</script><script src="/a.js">',
    ],
  ])('matches the running document for %s', async (_case, html) => {
    respondWith(html);

    await expect(firstValueFrom(fetchDeployedBuildFingerprint$('/'))).resolves.toBe(readBuildFingerprint(parse(html)));
  });

  it('does not parse the served document into a DOM', async () => {
    const parseFromString = vi.spyOn(DOMParser.prototype, 'parseFromString');
    respondWith('<style>p{}</style><script src="/main-BBB.js"></script>');

    await firstValueFrom(fetchDeployedBuildFingerprint$('/'));

    expect(parseFromString).not.toHaveBeenCalled();
    parseFromString.mockRestore();
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

    await expect(firstValueFrom(fetchDeployedBuildFingerprint$('/'))).resolves.toBeNull();
  });
});
