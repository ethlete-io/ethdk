import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, viteCacheOf } from './paths';
import { serveDesign } from './serve';
import { createShotStore } from './shot-store';
import { productModuleIdOf } from './system/system-modules';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

type Plugin = { configureServer: (vite: unknown) => void };

type FakeModule = { id: string; file: string; importers: Set<FakeModule>; importedModules: Set<FakeModule> };

const created: { plugins: Plugin[] }[] = [];

vi.mock('vite', () => ({
  createServer: async (options: { plugins: Plugin[] }) => {
    created.push(options);

    return { listen: async () => undefined, printUrls: () => undefined, close: async () => undefined };
  },
}));

vi.mock('@tailwindcss/postcss', () => ({ default: () => ({}) }));

const screenshot = vi.fn<(options: unknown) => Promise<Buffer>>(async () => Buffer.from('drawn png'));

vi.mock('./browser', async (original) => ({
  ...(await original<typeof import('./browser')>()),
  chromiumOf: async () => ({
    from: 'playwright',
    chromium: {
      launch: async () => ({
        close: async () => undefined,
        newContext: async () => ({
          clearCookies: async () => undefined,
          close: async () => undefined,
          newPage: async () => ({
            goto: async () => undefined,
            mouse: { move: async () => undefined },
            screenshot,
            evaluate: async (script: string) =>
              script.includes('data-et-part')
                ? [{ parts: ['components/card'], x: 0, y: 0, width: 200, height: 80 }]
                : script.includes('data-et-')
                  ? null
                  : script.includes('innerHTML')
                    ? '<p>card</p>'
                    : true,
            locator: () => ({
              count: async () => 0,
              first: () => ({ waitFor: async () => undefined }),
              boundingBox: async () => ({ x: 0, y: 0, width: 200, height: 80 }),
            }),
          }),
        }),
      }),
    },
  }),
}));

const cwd = process.cwd();

afterEach(() => {
  process.chdir(cwd);
  created.length = 0;
  vi.restoreAllMocks();
  screenshot.mockClear();
});

const SHOT = 'product=acme&part=components/card&state=long&preset=phone';

const acme = () => {
  const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-shot-store-')));
  const configPath = join(target, DESIGN_DIR, 'config.json');

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const config = JSON.parse(readFileSync(configPath, 'utf8')) as { products: Record<string, object> };

  config.products['acme'] = { ...config.products['acme'], styles: ['styles/acme.css'] };
  writeFileSync(configPath, JSON.stringify(config));

  const files = {
    part: join(target, DESIGN_DIR, 'acme-base/components/card/card.ts'),
    kit: join(target, 'dist/libs/kit/index.mjs'),
    stylesheet: join(target, 'styles/acme.css'),
  };

  for (const file of [files.kit, files.stylesheet]) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, '/* one */\n');
  }

  return { target, files };
};

const graphOf = (files: ReturnType<typeof acme>['files']) => {
  const moduleOf = (id: string, imported: FakeModule[] = []): FakeModule => ({
    id,
    file: id.split('?')[0] ?? id,
    importers: new Set(),
    importedModules: new Set(imported),
  });
  const kit = moduleOf(files.kit);
  const part = moduleOf(productModuleIdOf({ file: files.part, product: 'acme' }), [kit]);
  const stylesheet = moduleOf(productModuleIdOf({ file: files.stylesheet, product: 'acme' }));

  return new Map([part, stylesheet, kit].map((module) => [module.id, module]));
};

const start = async (target: string, graph = new Map<string, FakeModule>()) => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);

  expect(await serveDesign({ target })).toBe(0);

  const handlers = new Map<string, Handler>();

  created[created.length - 1]?.plugins[0]?.configureServer({
    moduleGraph: {
      getModuleById: (id: string) => graph.get(id),
      idToModuleMap: graph,
      invalidateModule: () => undefined,
      getModulesByFile: () => undefined,
    },
    environments: { client: { hot: { send: () => undefined } } },
    middlewares: { use: (path: string, handler: Handler) => handlers.set(path, handler) },
    httpServer: { on: () => undefined, address: () => ({ port: 1 }) },
    watcher: { add: () => undefined, on: () => undefined },
    ssrLoadModule: async () => ({ default: { states: { long: {} } } }),
  });

  const shot = () =>
    new Promise<{ status: number; body: unknown }>((done) => {
      const response = {
        statusCode: 200,
        setHeader: () => undefined,
        end: (body: unknown) => done({ status: response.statusCode, body }),
      };

      handlers.get('/__design/shot')?.({ url: `/?${SHOT}` } as IncomingMessage, response as unknown as ServerResponse);
    });

  return { shot };
};

const storedIn = (target: string) => {
  const dir = viteCacheOf(target, 'shots');

  return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')) : [];
};

describe('the shots a design server keeps on disk', () => {
  it('serves a shot a former server drew without drawing it again', async () => {
    const { target, files } = acme();
    const before = await start(target, graphOf(files));

    expect(await before.shot()).toEqual({ status: 200, body: Buffer.from('drawn png') });
    await vi.waitFor(() => expect(storedIn(target)).toHaveLength(1));

    const after = await start(target);

    expect(await after.shot()).toEqual({ status: 200, body: Buffer.from('drawn png') });
    expect(screenshot).toHaveBeenCalledTimes(1);
  });

  it.each(['part', 'kit', 'stylesheet'] as const)(
    'draws a shot again once its %s file changed while no server ran',
    async (changed) => {
      const { target, files } = acme();
      const before = await start(target, graphOf(files));

      await before.shot();
      await vi.waitFor(() => expect(storedIn(target)).toHaveLength(1));

      writeFileSync(files[changed], `${readFileSync(files[changed], 'utf8')}\n/* two */\n`);

      const after = await start(target);

      expect(await after.shot()).toMatchObject({ status: 200 });
      expect(screenshot).toHaveBeenCalledTimes(2);
    },
  );

  it('draws a shot again once a shared file appears that its imports may now resolve to', async () => {
    const { target, files } = acme();
    const before = await start(target, graphOf(files));

    await before.shot();
    await vi.waitFor(() => expect(storedIn(target)).toHaveLength(1));

    mkdirSync(join(target, DESIGN_DIR, 'acme/shared'), { recursive: true });
    writeFileSync(join(target, DESIGN_DIR, 'acme/shared/format.ts'), 'export const format = 1;\n');

    await (await start(target)).shot();

    expect(screenshot).toHaveBeenCalledTimes(2);
  });
});

describe('createShotStore', () => {
  const picture = { png: Buffer.from('png'), marks: [] };
  const address = { product: 'acme', part: 'components/card', sketch: null, props: null };

  it('treats a corrupt entry as a miss', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-shot-store-'));
    const input = join(dir, 'input.ts');
    const store = () => createShotStore({ dir, salt: 's', inputsOf: () => [input], scopeOf: () => '' });

    writeFileSync(input, 'one');
    store().write('key', { address, picture });

    const [entry = ''] = readdirSync(dir);

    expect(store().read('key', address)).toEqual(picture);

    writeFileSync(join(dir, entry), '{"key":');

    expect(store().read('key', address)).toBeNull();
  });

  it('drops the oldest entries past its limit', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-shot-store-'));
    const store = createShotStore({ dir, salt: 's', inputsOf: () => [], scopeOf: () => '', limit: 120 });

    for (const key of ['one', 'two', 'three']) store.write(key, { address, picture });

    expect(store.read('one', address)).toBeNull();
    expect(store.read('three', address)).toEqual(picture);
  });
});
