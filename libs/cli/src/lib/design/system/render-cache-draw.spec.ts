import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUIET_HEADER, SERVED_LINES_HEADER } from '../render';
import { WarmDraw } from '../warm-draw';
import { createDrawCount, drawnMoreThanOnce } from './draw-count.test';
import { renderIssuesOf } from './render-check';

const draws = createDrawCount();
const RENDERED = { path: '/__design/render', body: '{"call":"b","template":"<et-card />"}' };
const WARNING = 'etProvideColor="brand" has no effect because no color themes are registered.';
const printed: string[] = [];

const SHARED = [
  '/src/shared.ts',
  '/tokens.css',
  '/generated/tailwind.css',
  '/frame.js',
  '/sdk/index.css',
  '/sdk/index.js',
];
const SERVED_BY: Record<string, string[]> = {
  a: ['/src/a.ts', '/fonts/a.woff2', ...SHARED],
  b: ['/src/b.ts', ...SHARED],
  c: ['/src/c.ts'],
};
const served = new Map<string, string>();
const states = new Map<string, Record<string, unknown>>();

vi.mock('../code-hash', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../code-hash')>()),
  renderInspectCodeOf: () => 'code',
}));
vi.mock('../thumb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../thumb')>()),
  openFrame: async (page: { goto: (url: string) => Promise<unknown> }, url: string) => page.goto(url),
  awaitSettled: async () => undefined,
}));
vi.mock('../shot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shot')>()),
  partFrameOf: (address: { part: string; state: string }) => ({
    search: new URLSearchParams({ part: address.part, state: address.state }),
    size: null,
  }),
}));
vi.mock('./system-modules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system-modules')>()),
  createSystemModules: () => ({
    drawnOf: () => ({
      presets: {},
      parts: Object.keys(SERVED_BY).map((name) => ({
        file: `/design/${name}.ts`,
        layer: 'components',
        name,
        source: '',
        cssSource: null,
      })),
    }),
    productOf: () => null,
  }),
}));

type Listener = (request: {
  url: () => string;
  headers: () => Record<string, string>;
  method: () => string;
  postData: () => string | null;
}) => void;

const fakeBrowser = (base: string) => ({
  newContext: async () => {
    const listeners: Listener[] = [];
    const request = (url: string, post: string | null = null) => {
      if (post !== null) printed.push(WARNING);

      listeners.forEach((listener) =>
        listener({
          url: () => `${base}${url}`,
          headers: () => ({ accept: '*/*' }),
          method: () => (post === null ? 'GET' : 'POST'),
          postData: () => post,
        }),
      );
    };

    return {
      addInitScript: async () => undefined,
      on: (_event: 'request', listener: Listener) => listeners.push(listener),
      newCDPSession: async () => ({ send: async () => undefined }),
      close: async () => undefined,
      newPage: async () => ({
        on: () => undefined,
        close: async () => undefined,
        emulateMedia: async () => undefined,
        setViewportSize: async () => undefined,
        evaluate: async () => [],
        goto: async (url: string) => {
          const search = new URL(url).searchParams;
          const part = (search.get('part') ?? '').replace('components/', '');

          draws.drawn('design', `${part} ${search.get('state')}`);
          request('/frame.html');
          (SERVED_BY[part] ?? []).forEach((file) => request(file));

          if (part === 'b') request(RENDERED.path, RENDERED.body);
        },
      }),
    };
  },
});

const warmOn = (port: number) =>
  ({
    server: async () => ({
      httpServer: { address: () => ({ address: '::1', family: 'IPv6', port }) },
      ssrLoadModule: async (id: string) => ({ default: { states: states.get(id.split('?')[0] ?? '') ?? {} } }),
    }),
    queue: () => ({
      run: <T>(draw: (browser: unknown) => Promise<T>) => draw(fakeBrowser(`http://localhost:${port}`)),
    }),
  }) as unknown as WarmDraw;

let target = '';

const run = async (port = 1) => {
  printed.length = 0;

  const result = await renderIssuesOf({
    target,
    config: {} as never,
    jobs: [{ product: 'studio', sketch: null, parts: null }],
    chromiumOf: async () => ({ chromium: {} as never, from: '/playwright' }),
    warm: warmOn(port),
    cached: true,
  });

  expect('unavailable' in result).toBe(false);

  const counts = draws.take();

  expect(drawnMoreThanOnce(counts)).toEqual([]);

  return {
    redrawn: [...new Set([...counts.keys()].map((key) => key.split(' ')[1]))].sort(),
    output: JSON.stringify({ printed, result }),
  };
};

const check = async (port = 1) => (await run(port)).redrawn;

describe('render inspect cache', () => {
  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), 'render-cache-'));
    served.clear();

    for (const url of ['/frame.html', ...Object.values(SERVED_BY).flat()]) served.set(url, `v1 ${url}`);
    for (const name of Object.keys(SERVED_BY)) states.set(`/design/${name}.ts`, { default: {}, open: {} });

    served.set(RENDERED.path, '<et-card />');

    vi.stubGlobal('fetch', async (url: URL, init?: { headers?: Record<string, string>; body?: string }) => {
      const body = served.get(url.pathname);
      const posted = init?.body !== undefined;

      if (body === undefined) return new Response('missing', { status: 404 });
      if (posted && init?.headers?.[QUIET_HEADER] !== '1') printed.push(WARNING);

      return new Response(`${body} served by http://${url.host}`, {
        headers: posted ? { [SERVED_LINES_HEADER]: encodeURIComponent(JSON.stringify([WARNING])) } : {},
      });
    });
    vi.spyOn(console, 'warn').mockImplementation((line: string) => printed.push(line));
    draws.take();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('prints the same output warm as cold, the lines the server logged while drawing included', async () => {
    const cold = await run();
    const warm = await run();

    expect(warm.redrawn).toEqual([]);
    expect(cold.output).toContain('has no effect');
    expect(warm.output).toEqual(cold.output);
  });

  it('hits after a resident restart on another port, whose host is in urls and bodies', async () => {
    await check(1);

    expect(await check(2)).toEqual([]);
  });

  it('draws each frame once cold, nothing warm, and only the edited part after a part edit', async () => {
    expect(await check()).toEqual(['a', 'b', 'c']);
    expect(await check()).toEqual([]);

    served.set('/src/a.ts', 'v2');

    expect(await check()).toEqual(['a']);
    expect(draws.take().size).toBe(0);
  });

  it.each([
    ['a part file', '/src/a.ts', ['a']],
    ['a shared import of two parts', '/src/shared.ts', ['a', 'b']],
    ['a css token', '/tokens.css', ['a', 'b']],
    ['the generated tailwind output', '/generated/tailwind.css', ['a', 'b']],
    ['a font file', '/fonts/a.woff2', ['a']],
    ['a frame asset', '/frame.html', ['a', 'b', 'c']],
    ['the sdk dist css', '/sdk/index.css', ['a', 'b']],
    ['the sdk dist js', '/sdk/index.js', ['a', 'b']],
    ['the sdk markup the render worker answers', RENDERED.path, ['b']],
  ])('an edit of %s redraws exactly the parts that loaded it', async (_what, url, redrawn) => {
    await check();

    served.set(url, 'edited');

    expect(await check()).toEqual(redrawn);
    expect(await check()).toEqual([]);
  });

  it('redraws a part whose states change, and nothing else', async () => {
    await check();

    states.set('/design/b.ts', { default: {}, open: {}, closed: {} });

    expect(await check()).toEqual(['b']);
  });

  it.each(['design.config.json', 'capabilities.json', 'merged.json', 'pictures.json'])(
    'an edit of %s, which render inspect neither serves nor reads, redraws nothing',
    async (name) => {
      writeFileSync(join(target, name), '{}');
      await check();

      writeFileSync(join(target, name), '{"edited":true}');

      expect(await check()).toEqual([]);
    },
  );

  it('draws again when a served file can no longer be fetched', async () => {
    await check();

    served.delete('/src/c.ts');

    expect(await check()).toEqual(['c']);
  });
});
