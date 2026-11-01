import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { chromium, type Browser } from 'playwright';
import { answerFileOf, liveShotOf, liveSpecProblemOf, mergedStorageOf, substitutedOf } from './live-compare';

const SPEC = {
  host: 'app-shell',
  pages: {
    'pages/home': {
      states: {
        edge: { design: 'part', pan: { selector: '.canvas > div', x: -200, y: 0 }, click: ['Hide panel'] },
      },
    },
  },
};

describe('liveSpecProblemOf', () => {
  it('accepts a spec with pages, states, pans and clicks', () => {
    expect(liveSpecProblemOf(SPEC)).toBeNull();
  });

  it('accepts frame content, page hosts, sample overrides and composed parts', () => {
    expect(
      liveSpecProblemOf({
        host: 'app-shell',
        frame: 'live/frame.png',
        pages: {
          'pages/start': {
            host: 'app-start',
            answers: { '/x': 'live/x.json' },
            states: {
              hidden: {
                design: 'part',
                invoke: { roots: [] },
                compose: { 'elements/shell': { panel: 'hidden' } },
              },
            },
          },
        },
      }),
    ).toBeNull();
  });

  it('accepts a fixed ISO time and rejects one that does not parse', () => {
    expect(liveSpecProblemOf({ ...SPEC, now: '2026-11-04T12:00:00Z' })).toBeNull();
    expect(liveSpecProblemOf({ ...SPEC, now: 'Mittwoch' })).toBe('now must be an ISO time');
  });

  it.each([
    [{ pages: {} }, 'a live spec must be'],
    [{ ...SPEC, answers: { '/x': 1 } }, 'answers must map'],
    [{ host: 'a', pages: { 'pages/home': {} } }, 'pages/home must have states'],
    [{ host: 'a', pages: { 'pages/home': { states: { edge: {} } } } }, 'must name its design state'],
    [{ host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', pan: { x: 1 } } } } } }, 'pan must be'],
    [{ host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', click: 'x' } } } } }, 'click must be'],
    [{ ...SPEC, frame: 1 }, 'frame must name a PNG'],
    [{ host: 'a', pages: { 'pages/home': { host: 1, states: {} } } }, 'host must be a selector'],
    [{ host: 'a', pages: { 'pages/home': { answers: { '/x': 1 }, states: {} } } }, 'pages/home: answers must map'],
    [{ host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', invoke: 1 } } } } }, 'invoke must be'],
    [
      { host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', compose: { x: 1 } } } } } },
      'compose must',
    ],
  ])('refuses %j', (spec, message) => {
    expect(liveSpecProblemOf(spec)).toContain(message);
  });
});

describe('mergedStorageOf', () => {
  it('merges object values per key and lets a later layer replace any other value', () => {
    expect(
      mergedStorageOf({ view: { checkout: '/a', cameras: { one: { x: 1 } } }, flag: 'old' }, undefined, {
        view: { cameras: { two: { x: 2 } } },
        flag: 'new',
      }),
    ).toEqual({ view: { checkout: '/a', cameras: { one: { x: 1 }, two: { x: 2 } } }, flag: 'new' });
  });
});

describe('substitutedOf', () => {
  it('replaces $port and $checkout anywhere in the value', () => {
    expect(substitutedOf({ a: '$port', b: ['$checkout', 'x'] }, { port: 4000, checkout: '/repo' })).toEqual({
      a: 4000,
      b: ['/repo', 'x'],
    });
  });
});

describe('answerFileOf', () => {
  it('prefers the answer of the path with its query over the path alone', () => {
    const answers = { '/__design/system': 'system.json', '/__design/flows?product=a': 'flows-a.json' };

    expect(answerFileOf(answers, new URL('http://localhost/__design/system?x=1'))).toBe('system.json');
    expect(answerFileOf(answers, new URL('http://localhost/__design/flows?product=a'))).toBe('flows-a.json');
    expect(answerFileOf(answers, new URL('http://localhost/__design/flows?product=b'))).toBeNull();
  });
});

describe('liveShotOf', () => {
  let browser: Browser | undefined;
  let server: Server;
  let url = '';

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
    server = createServer((request, response) => {
      response.setHeader('content-type', 'text/html');
      response.end(
        `<body style="margin:0"><main style="display:block;width:7px;height:5px;background:#0000ff"></main>${
          request.url === '/erroring'
            ? '<script>console.error("ERROR", new Error("ET1234: The control has no accessible name."));console.error("plain error");</script>'
            : ''
        }</body>`,
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  });

  const shotOf = (path: string) =>
    liveShotOf({
      browser: browser as Browser,
      url,
      size: { width: 7, height: 5 },
      spec: { host: 'main', pages: {} },
      dir: '.',
      page: { path, states: {} },
      state: { design: 'a' },
      server: 'http://localhost:1',
      checkout: '.',
      timeout: 5000,
    });

  it('shoots a page that logs no SDK error', async (context) => {
    if (!browser) return context.skip('no browser');

    expect((await shotOf('/fine')).length).toBeGreaterThan(0);
  });

  it('fails with the code and message of each SDK error the page logs', async (context) => {
    if (!browser) return context.skip('no browser');

    await expect(shotOf('/erroring')).rejects.toThrow(
      `the app page ${url}/erroring logged SDK errors:\n  ET1234: The control has no accessible name.`,
    );
  });
}, 30_000);
