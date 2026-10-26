import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serveDesign } from './serve';

type ServerOptions = {
  server: { port: number; strictPort: boolean };
  resolve: { alias: { find: RegExp; replacement: string }[] };
  plugins: {
    load: (id: string) => string | null;
    resolveId: (id: string, importer?: string) => string | null;
    transformIndexHtml: { handler: (html: string, ctx: { path: string; originalUrl?: string }) => string };
    configureServer: (vite: unknown) => void;
  }[];
};

const created: ServerOptions[] = [];

vi.mock('vite', () => ({
  createServer: async (options: ServerOptions) => {
    created.push(options);

    return { listen: async () => undefined, printUrls: () => undefined };
  },
}));

vi.mock('@tailwindcss/postcss', () => ({ default: () => ({}) }));

const cwd = process.cwd();

afterEach(() => {
  process.chdir(cwd);
  created.length = 0;
  vi.restoreAllMocks();
});

const makeTarget = (config?: unknown) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-serve-'));

  if (config) {
    mkdirSync(join(target, '.ethlete/design/calls/app/one'), { recursive: true });
    writeFileSync(join(target, '.ethlete/design/config.json'), JSON.stringify(config), 'utf8');
    writeFileSync(join(target, '.ethlete/design/calls/app/one/call.ts'), '', 'utf8');
    writeFileSync(
      join(target, 'tsconfig.base.json'),
      JSON.stringify({ compilerOptions: { paths: { '@lib/*': ['libs/x/*'], '@one': ['libs/one.ts'] } } }),
      'utf8',
    );
  }

  return target;
};

describe('serveDesign', () => {
  it('exits 1 without a config', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await serveDesign({ target: makeTarget() })).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('no config'));
    expect(created).toHaveLength(0);
  });

  it('serves the call registry and workspace aliases on the configured port', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubEnv('DE_PORT', '');

    const target = makeTarget({ port: 4999, defaultCall: 'app/one' });

    expect(await serveDesign({ target })).toBe(0);

    const [options] = created;
    const plugin = options?.plugins[0];
    const registry = plugin?.load(plugin.resolveId('virtual:design-explore') ?? '');

    expect(options?.server).toMatchObject({ port: 4999, strictPort: true });
    expect(registry).toContain('"app/one": () => import("/@fs/');
    expect(registry).not.toContain('defaultCall');
    expect(options?.resolve.alias.map((alias) => alias.replacement)).toEqual(
      expect.arrayContaining([`${join(target, 'libs/x')}/`, join(target, 'libs/one.ts')]),
    );
  });

  it('hands each project its theme names, and none to a project without them', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = makeTarget({ projects: { app: { themes: { surface: ['light', 'dark'] } }, bare: {} } });

    expect(await serveDesign({ target })).toBe(0);

    const plugin = created[created.length - 1]?.plugins[0];
    const env = plugin?.load(plugin.resolveId('virtual:design-explore/env') ?? '') ?? '';
    const themesOf = new Function(`${env.replace(/export const/g, 'const')}; return themesOf;`)() as (
      project: string,
    ) => unknown;

    expect(themesOf('app')).toEqual({ surface: ['light', 'dark'], color: [] });
    expect(themesOf('bare')).toEqual({ surface: [], color: [] });
    expect(themesOf('other')).toEqual({ surface: [], color: [] });
  });

  it('serves variant thumbnails and closes their browser with the server', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = makeTarget({ port: 4999 });

    expect(await serveDesign({ target })).toBe(0);

    const mounted: string[] = [];
    const closing: (() => void)[] = [];
    const vite = {
      moduleGraph: { getModuleById: () => null, invalidateModule: () => undefined },
      ws: { send: () => undefined },
      middlewares: { use: (path: string) => mounted.push(path) },
      httpServer: { on: (event: string, listener: () => void) => event === 'close' && closing.push(listener) },
      watcher: { add: () => undefined, on: () => undefined },
    };

    created[created.length - 1]?.plugins[0]?.configureServer(vite);

    expect(mounted).toContain('/__design/thumb');
    expect(closing).toHaveLength(1);
  });
});

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-serve-system-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
  mkdirSync(join(target, '.ethlete/design/calls/acme/hero'), { recursive: true });
  writeFileSync(
    join(target, '.ethlete/design/calls/acme/hero/call.ts'),
    "export default defineCall({\n  legacy: true,\n  eyebrow: '',\n});\n",
  );

  return target;
};

const serveAcme = async (target: string) => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);

  expect(await serveDesign({ target })).toBe(0);

  const plugin = created[created.length - 1]?.plugins[0];
  const handlers = new Map<string, Handler>();
  const watchers = new Map<string, (file: string) => void>();
  const sent: unknown[] = [];
  const invalidated: string[] = [];
  const loaded: string[] = [];
  const vite = {
    moduleGraph: {
      getModuleById: (id: string) => ({ id }),
      invalidateModule: (module: { id: string }) => invalidated.push(module.id),
      getModulesByFile: () => undefined,
    },
    ws: { send: (message: unknown) => sent.push(message) },
    middlewares: { use: (path: string, handler: Handler) => handlers.set(path, handler) },
    httpServer: { on: () => undefined },
    watcher: {
      add: () => undefined,
      on: (event: string, listener: (file: string) => void) => watchers.set(event, listener),
    },
    ssrLoadModule: async (id: string) => {
      loaded.push(id);

      return id.includes('/calls/')
        ? { default: { eyebrow: '', headline: 'Hero', legacy: true, frameWidth: 640, variants: [] } }
        : { default: { note: 'n', states: { one: {} } } };
    },
  };

  plugin?.configureServer(vite);

  const ask = (path: string, query = '', method = 'GET') =>
    new Promise<{ status: number; body: unknown }>((done) => {
      const response = {
        statusCode: 200,
        setHeader: () => undefined,
        end: (body: string) => done({ status: response.statusCode, body: JSON.parse(body) as unknown }),
      };

      handlers.get(path)?.({ url: query, method } as IncomingMessage, response as unknown as ServerResponse);
    });

  return { plugin, ask, watchers, sent, invalidated, loaded };
};

describe('the design server for a design system', () => {
  it('answers the parts list of every product, or of one, and 404 for an unknown one', async () => {
    const { ask, loaded } = await serveAcme(acme());
    const all = await ask('/__design/system');
    const one = (await ask('/__design/system', '?product=acme')).body as { name: string; parts: unknown[] }[];

    expect(all.status).toBe(200);
    expect((all.body as { name: string }[]).map((product) => product.name)).toEqual(['acme-base', 'acme']);
    expect(one.map((product) => product.name)).toEqual(['acme']);
    expect(one[0]?.parts[0]).toEqual({
      layer: 'foundations',
      name: 'palette',
      origin: 'product',
      note: 'n',
      states: ['one'],
      problems: [],
    });
    expect(loaded).toContainEqual(expect.stringMatching(/acme-base\/components\/card\/card\.ts\?design-product=acme$/));
    expect((await ask('/__design/system', '?product=nope')).status).toBe(404);
  });

  it('lists the calls and marks one transferred on POST only', async () => {
    const target = acme();
    const { ask } = await serveAcme(target);
    const callFile = join(target, '.ethlete/design/calls/acme/hero/call.ts');

    expect((await ask('/__design/calls')).body).toEqual([expect.objectContaining({ slug: 'acme/hero', legacy: true })]);
    expect((await ask('/__design/transfer', '?call=acme/hero')).status).toBe(405);
    expect(await ask('/__design/transfer', '?call=acme/hero', 'POST')).toEqual({
      status: 200,
      body: { result: 'marked' },
    });
    expect(readFileSync(callFile, 'utf8')).toContain('  legacy: true,\n  transferred: true,\n');
    expect((await ask('/__design/transfer', '?call=acme/none', 'POST')).status).toBe(404);
  });

  it("serves each product's parts as that product resolves them, and its stylesheet and head", async () => {
    const target = acme();
    const config = JSON.parse(readFileSync(join(target, '.ethlete/design/config.json'), 'utf8')) as {
      products: Record<string, Record<string, unknown>>;
    };

    config.products['acme'] = { ...config.products['acme'], styles: ['acme.css'], head: 'head.html' };
    writeFileSync(join(target, '.ethlete/design/config.json'), JSON.stringify(config));
    writeFileSync(join(target, 'head.html'), '<link rel="icon" href="acme.svg">');

    const { plugin } = await serveAcme(target);
    const system = plugin?.load(plugin.resolveId('virtual:design-explore/system') ?? '') ?? '';
    const env = plugin?.load(plugin.resolveId('virtual:design-explore/env') ?? '') ?? '';
    const html = (url: string) =>
      plugin?.transformIndexHtml.handler('<!--head-->', { path: '/frame.html', originalUrl: url });

    expect(system).toMatch(
      /"acme": \{[^}]*"components\/card": \(\) => import\("\/@fs\/[^"]*acme-base\/components\/card\/card\.ts\?design-product=acme"\)/,
    );
    expect(env).toMatch(
      /productEnvs = \{\n {2}"acme-base": \(\) => Promise.all\(\[\]\),\n {2}"acme": \(\) => Promise.all\(\[import\("[^"]*acme\.css"\)\]\)/,
    );
    expect(html('/frame.html?product=acme&part=components/card&state=default')).toBe(
      '<link rel="icon" href="acme.svg">',
    );
    expect(html('/frame.html?product=acme-base&part=components/card&state=default')).toBe('<!--head-->');
    expect(plugin?.resolveId('@system/components/button', `${join(target, 'x.ts')}?design-product=acme`)).toMatch(
      /acme\/components\/button\/button\.ts\?design-product=acme$/,
    );
  });

  it('rebuilds the parts registry and reloads the frames when a part file comes or goes', async () => {
    const target = acme();
    const { watchers, sent, invalidated } = await serveAcme(target);

    watchers.get('add')?.(join(target, '.ethlete/design/acme/components/badge/badge.ts'));

    expect(invalidated).toEqual(['\0virtual:design-explore/system']);
    expect(sent).toEqual([{ type: 'full-reload' }]);

    watchers.get('add')?.(join(target, 'elsewhere.ts'));

    expect(sent).toHaveLength(1);
  });
});
