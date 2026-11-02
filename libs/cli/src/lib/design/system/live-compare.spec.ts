import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { chromium, type Browser } from 'playwright';
import { answerFileOf, liveShotOf, liveSpecProblemOf, LiveState, mergedStorageOf, substitutedOf } from './live-compare';
import { decodePng } from './part-compare';
import { Partless } from './uncovered-regions';

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
        shell: 'app-shell-page',
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

  it('accepts partless app regions with a reason', () => {
    expect(liveSpecProblemOf({ ...SPEC, partless: [{ selector: 'app-title-bar', reason: 'OS chrome' }] })).toBeNull();
  });

  it.each([
    [{ pages: {} }, 'a live spec must be'],
    [{ ...SPEC, answers: { '/x': 1 } }, 'answers must map'],
    [{ host: 'a', pages: { 'pages/home': {} } }, 'pages/home must have states'],
    [{ host: 'a', pages: { 'pages/home': { states: { edge: {} } } } }, 'must name its design state'],
    [{ host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', pan: { x: 1 } } } } } }, 'pan must be'],
    [{ host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', click: 'x' } } } } }, 'click must be'],
    [{ ...SPEC, frame: 1 }, 'frame must name a PNG'],
    [{ ...SPEC, shell: 1 }, 'shell must be a selector'],
    [{ host: 'a', pages: { 'pages/home': { host: 1, states: {} } } }, 'host must be a selector'],
    [{ host: 'a', pages: { 'pages/home': { answers: { '/x': 1 }, states: {} } } }, 'pages/home: answers must map'],
    [{ host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', invoke: 1 } } } } }, 'invoke must be'],
    [
      { host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', compose: { x: 1 } } } } } },
      'compose must',
    ],
    [
      { host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', occluded: 'yes' } } } } },
      'occluded must be true or false',
    ],
    [{ ...SPEC, partless: [{ selector: 'app-title-bar' }] }, 'partless must be a list'],
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

const PLAIN_PAGE = (erroring: boolean) =>
  `<body style="margin:0"><main style="display:block;width:7px;height:5px;background:#0000ff"></main>${
    erroring
      ? '<script>console.error("ERROR", new Error("ET1234: The control has no accessible name."));console.error("plain error");</script>'
      : ''
  }</body>`;

const WIDE = { width: 40, height: 20 };

const canvasPageOf = (cover: string, world = '') =>
  `<body style="margin:0"><main style="display:block;position:relative;width:40px;height:20px;background:#0000ff">
    <div style="position:absolute;inset:0;overflow:hidden">
      <div style="transform:translate(0px,0px)">
        <img src="http://localhost:1/__design/shot" style="display:block;width:40px;height:20px">${world}
      </div>
    </div>${cover}
  </main></body>`;

const PAGES: Record<string, string> = {
  '/titled': `<body style="margin:0"><main style="display:block;width:7px;height:5px;background:#0000ff"></main><header style="position:fixed;left:0;top:0;width:7px;height:4px;background:#ff0000"></header></body>`,
  '/entering': `<body style="margin:0"><main style="display:block;position:relative;width:7px;height:5px;background:#0000ff">
    <div class="et-overlay-runtime-pane et-animation-enter-active" style="position:absolute;inset:0;background:#ff0000;opacity:0"></div>
  </main><script>setTimeout(() => {
    const pane = document.querySelector('.et-overlay-runtime-pane');
    pane.classList.remove('et-animation-enter-active');
    pane.style.opacity = '1';
  }, 1500)</script></body>`,
  '/occluded': canvasPageOf(
    '<aside class="panel" style="position:absolute;left:0;top:0;width:10px;height:20px;background:#00ff00"></aside>',
  ),
  '/labelled': canvasPageOf(
    '',
    '<span style="position:absolute;left:0;top:0;width:10px;height:20px;background:#00ff00"></span>',
  ),
};

describe('liveShotOf', () => {
  let browser: Browser | undefined;
  let server: Server;
  let url = '';

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
    server = createServer((request, response) => {
      response.setHeader('content-type', 'text/html');
      response.end(PAGES[request.url ?? ''] ?? PLAIN_PAGE(request.url === '/erroring'));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  });

  const shotOf = (
    path: string,
    options: { size?: { width: number; height: number }; state?: LiveState; partless?: Partless[] } = {},
  ) =>
    liveShotOf({
      browser: browser as Browser,
      parts: ['main'],
      url,
      size: options.size ?? { width: 7, height: 5 },
      spec: { host: 'main', pages: {}, partless: options.partless },
      dir: '.',
      page: { path, states: {} },
      state: options.state ?? { design: 'a' },
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

  it('waits for an overlay pane to end its enter animation before the shot', async (context) => {
    if (!browser) return context.skip('no browser');

    const { data } = decodePng(await shotOf('/entering'));

    expect([...data.subarray(0, 3)]).toEqual([255, 0, 0]);
  });

  it('fails a page whose design frame sits under a shell panel', async (context) => {
    if (!browser) return context.skip('no browser');

    await expect(shotOf('/occluded', { size: WIDE })).rejects.toThrow(
      /OCCLUDED: the design frame <img> at 0,0 40x20 sits under <aside class="panel"> \(\d+ of 25 sample points\) on .*\/occluded/,
    );
  });

  it('passes a covered frame in a state that allows it, and a frame under its own canvas labels', async (context) => {
    if (!browser) return context.skip('no browser');

    expect((await shotOf('/occluded', { size: WIDE, state: { design: 'a', occluded: true } })).length).toBeGreaterThan(
      0,
    );
    expect((await shotOf('/labelled', { size: WIDE })).length).toBeGreaterThan(0);
  });

  it('fails a page with a visible region outside every part, unless the spec lists it as partless', async (context) => {
    if (!browser) return context.skip('no browser');

    await expect(shotOf('/titled')).rejects.toThrow(/UNCOVERED: <header> at 0,0 7x4 on .*\/titled - no part covers/);
    expect(
      (await shotOf('/titled', { partless: [{ selector: 'header', reason: 'window chrome' }] })).length,
    ).toBeGreaterThan(0);
  });
}, 30_000);
