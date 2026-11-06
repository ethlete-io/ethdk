import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WarmDraw } from '../warm-draw';
import { createDrawCount, drawnMoreThanOnce } from './draw-count.test';
import { renderIssuesOf } from './render-check';

const draws = createDrawCount();
const BASE = 'http://localhost:1';

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

type Listener = (request: { url: () => string; headers: () => Record<string, string> }) => void;

const fakeBrowser = () => ({
  newContext: async () => {
    const listeners: Listener[] = [];
    const request = (url: string) =>
      listeners.forEach((listener) => listener({ url: () => `${BASE}${url}`, headers: () => ({ accept: '*/*' }) }));

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
          (SERVED_BY[part] ?? []).forEach(request);
        },
      }),
    };
  },
});

const warm = {
  server: async () => ({
    httpServer: { address: () => ({ port: 1 }) },
    ssrLoadModule: async (id: string) => ({ default: { states: states.get(id.split('?')[0] ?? '') ?? {} } }),
  }),
  queue: () => ({ run: <T>(draw: (browser: unknown) => Promise<T>) => draw(fakeBrowser()) }),
} as unknown as WarmDraw;

let target = '';

const check = async () => {
  const result = await renderIssuesOf({
    target,
    config: {} as never,
    jobs: [{ product: 'studio', sketch: null, parts: null }],
    chromiumOf: async () => ({ chromium: {} as never, from: '/playwright' }),
    warm,
    cached: true,
  });

  expect('unavailable' in result).toBe(false);

  const counts = draws.take();

  expect(drawnMoreThanOnce(counts)).toEqual([]);

  return [...new Set([...counts.keys()].map((key) => key.split(' ')[1]))].sort();
};

describe('render inspect cache', () => {
  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), 'render-cache-'));
    served.clear();

    for (const url of ['/frame.html', ...Object.values(SERVED_BY).flat()]) served.set(url, `v1 ${url}`);
    for (const name of Object.keys(SERVED_BY)) states.set(`/design/${name}.ts`, { default: {}, open: {} });

    vi.stubGlobal('fetch', async (url: URL) => {
      const body = served.get(url.pathname);

      return body === undefined ? new Response('missing', { status: 404 }) : new Response(body);
    });
    draws.take();
  });

  afterEach(() => vi.unstubAllGlobals());

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
