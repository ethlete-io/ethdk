import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUIET_HEADER, SERVED_LINES_HEADER } from '../render';
import { withRunSignal } from '../run-abort';
import { WarmDraw } from '../warm-draw';
import { partsCompletenessOf } from './complete';
import { createDrawCount, drawnMoreThanOnce } from './draw-count.test';
import { ResolvedProduct } from './resolve-product';

const draws = createDrawCount();

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
  host: ['/src/host.ts', '/src/a.ts', ...SHARED],
};
const EMBEDS: Record<string, string> = { host: 'components/a' };
const RENDERED = {
  body: '{"call":"host","template":"<et-card etProvideColor=\\"brand\\" />"}',
  path: '/__design/render',
};
const WARNING = 'etProvideColor="brand" has no effect because no color themes are registered.';

const served = new Map<string, string>();
const states = new Map<string, Record<string, unknown>>();
const printed: string[] = [];

vi.mock('../code-hash', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../code-hash')>()),
  completenessCodeOf: () => 'code',
}));
vi.mock('../thumb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../thumb')>()),
  openFrame: async (page: { goto: (url: string) => Promise<unknown> }, url: string) => page.goto(url),
  awaitSettled: async () => undefined,
}));
vi.mock('../shot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shot')>()),
  viewportOf: () => ({ width: 100, height: 100 }),
  partFrameOf: (address: { part: string; state: string; interaction: string | null }) => ({
    search: new URLSearchParams({ part: address.part, state: address.state }),
    size: null,
  }),
}));
vi.mock('../contact-sheet', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../contact-sheet')>()),
  changedSharesOf: async (options: { others: Buffer[] }) => options.others.map(() => 0),
}));
vi.mock('./sketch/baseline', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./sketch/baseline')>()),
  partHashOf: () => 'hash',
}));

let target = '';
let product: ResolvedProduct;

vi.mock('./system-modules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system-modules')>()),
  createSystemModules: () => ({ drawnOf: () => ({ presets: {}, parts: product.parts }), productOf: () => product }),
}));

type Request = {
  url: () => string;
  headers: () => Record<string, string>;
  method: () => string;
  postData: () => string | null;
};

const fakeBrowser = (base: string) => ({
  newContext: async () => {
    const listeners: ((request: Request) => void)[] = [];
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
    let part = '';

    return {
      on: (_event: 'request', listener: (request: Request) => void) => listeners.push(listener),
      newCDPSession: async () => ({ send: async () => undefined }),
      close: async () => undefined,
      newPage: async () => ({
        setViewportSize: async () => undefined,
        addStyleTag: async () => undefined,
        locator: () => ({ boundingBox: async () => null }),
        screenshot: async () => Buffer.from('png'),
        evaluate: async () => ({
          controls: [],
          surfaces: [],
          found: EMBEDS[part] ? [{ kind: 'control', what: 'button', path: 'button', owner: EMBEDS[part] }] : [],
          overrides: [],
          backdrop: null,
        }),
        goto: async (url: string) => {
          const search = new URL(url).searchParams;

          part = (search.get('part') ?? '').replace('components/', '');
          draws.drawn('design', `${part} ${search.get('state')}`);
          request('/frame.html');
          (SERVED_BY[part] ?? []).forEach((file) => request(file));

          if (part === 'host') request(RENDERED.path, RENDERED.body);
        },
      }),
    };
  },
});

const warmOn = (port: number) =>
  ({
    server: async () => ({
      httpServer: { address: () => ({ address: '::1', family: 'IPv6', port }) },
      ssrLoadModule: async (id: string) => ({
        default: { states: states.get(id.split('?')[0] ?? '') ?? {} },
      }),
    }),
    queue: () => ({
      run: <T>(draw: (browser: unknown) => Promise<T>) => draw(fakeBrowser(`http://localhost:${port}`)),
    }),
  }) as unknown as WarmDraw;

const run = async (port = 1) => {
  printed.length = 0;

  const result = await partsCompletenessOf({
    target,
    config: {} as never,
    product,
    parts: Object.keys(SERVED_BY).map((name) => `components/${name}`),
    chromiumOf: async () => ({ chromium: {} as never, from: '/playwright' }),
    warm: warmOn(port),
    cached: true,
  });

  if ('unavailable' in result) throw new Error(result.unavailable);

  const counts = draws.take();

  expect(drawnMoreThanOnce(counts)).toEqual([]);

  return {
    redrawn: [...new Set([...counts.keys()].map((key) => key.split(' ')[1]))].sort(),
    output: JSON.stringify({
      printed,
      gaps: [...result.gaps],
      hints: [...result.hints],
      exceptions: result.exceptions,
    }),
  };
};

const check = async (port = 1) => (await run(port)).redrawn;

describe('completeness cache', () => {
  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), 'completeness-cache-'));
    product = {
      name: 'studio',
      dir: target,
      base: null,
      parts: Object.keys(SERVED_BY).map((name) => {
        const dir = join(target, 'components', name);

        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${name}.css`), `.${name} {}`);

        return {
          file: join(dir, `${name}.ts`),
          layer: 'components',
          name,
          origin: 'product',
          source: '',
          cssSource: null,
        };
      }),
    } as unknown as ResolvedProduct;
    served.clear();

    for (const url of ['/frame.html', ...Object.values(SERVED_BY).flat()]) served.set(url, `v1 ${url}`);
    for (const { file } of product.parts) states.set(file, { default: {}, open: {} });

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

  it('draws each part once cold, nothing warm, and prints the same output both times', async () => {
    const cold = await run();
    const warm = await run();

    expect(cold.redrawn).toEqual(['a', 'b', 'c', 'host']);
    expect(warm.redrawn).toEqual([]);
    expect(cold.output).toContain('has no effect');
    expect(warm.output).toEqual(cold.output);
  });

  it('hits after a resident restart on another port, whose host is in urls and bodies', async () => {
    await check(1);

    expect(await check(2)).toEqual([]);
  });

  it('redraws a part and every part that embeds it after an edit of the embedded part', async () => {
    await check();

    served.set('/src/a.ts', 'v2');

    expect(await check()).toEqual(['a', 'host']);
    expect(await check()).toEqual([]);
  });

  it.each([
    ['a part file', '/src/b.ts', ['b']],
    ['a shared import', '/src/shared.ts', ['a', 'b', 'host']],
    ['a css token', '/tokens.css', ['a', 'b', 'host']],
    ['the generated tailwind output', '/generated/tailwind.css', ['a', 'b', 'host']],
    ['a font file', '/fonts/a.woff2', ['a']],
    ['a frame asset', '/frame.html', ['a', 'b', 'c', 'host']],
    ['the sdk dist css', '/sdk/index.css', ['a', 'b', 'host']],
    ['the sdk dist js', '/sdk/index.js', ['a', 'b', 'host']],
    ['the sdk markup the render worker answers', RENDERED.path, ['host']],
  ])('an edit of %s redraws exactly the parts that loaded it', async (_what, url, redrawn) => {
    await check();

    served.set(url, 'edited');

    expect(await check()).toEqual(redrawn);
    expect(await check()).toEqual([]);
  });

  it('redraws a part whose own stylesheet changes, read in Node, and nothing else', async () => {
    await check();

    writeFileSync(join(target, 'components', 'c', 'c.css'), '.c { color: red }');

    expect(await check()).toEqual(['c']);
  });

  it('redraws a part whose states change, and nothing else', async () => {
    await check();

    states.set(product.parts[1]?.file ?? '', { default: {}, open: {}, closed: {} });

    expect(await check()).toEqual(['b']);
  });

  it.each([
    ['design.config.json', '{}', '{"edited":true}'],
    ['capabilities.json', '{}', '{"edited":true}'],
    ['merged.json', '{}', '{"components/a":{"hash":"other"}}'],
    ['pictures.json', '{}', '{"edited":true}'],
    ['sketches/components-a.sketch.ts', 'export {}', 'export const edited = true;'],
  ])('an edit of %s, which the drawing neither serves nor reads, redraws nothing', async (name, before, after) => {
    mkdirSync(join(target, 'sketches'), { recursive: true });
    writeFileSync(join(target, name), before);
    await check();

    writeFileSync(join(target, name), after);

    expect(await check()).toEqual([]);
  });

  it('draws again when a served file can no longer be fetched', async () => {
    await check();

    served.delete('/src/c.ts');

    expect(await check()).toEqual(['c']);
  });

  it('never hits while Node cannot reach the server it drew from', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:1');
    });

    await check();

    expect(await check()).toEqual(['a', 'b', 'c', 'host']);
  });

  it('fetches from the address the server listens on, not localhost', async () => {
    const fetched: string[] = [];
    const fetchServed = globalThis.fetch;

    vi.stubGlobal('fetch', async (url: URL, init?: RequestInit) => {
      fetched.push(url.host);

      return fetchServed(url, init);
    });

    await check();

    expect([...new Set(fetched)]).toEqual(['[::1]:1']);
  });

  it('keeps nothing of a run aborted while drawing', async () => {
    const gone = new AbortController();

    gone.abort();
    await withRunSignal(gone.signal, () => check());

    expect(await check()).toEqual(['a', 'b', 'c', 'host']);
  });
});
