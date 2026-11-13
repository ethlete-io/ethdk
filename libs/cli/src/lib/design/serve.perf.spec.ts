import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';
import { EventEmitter } from 'events';
import { IncomingMessage, ServerResponse } from 'http';
import { tmpdir } from 'os';
import { setTimeout as delay } from 'timers/promises';
import { join } from 'path';
import { Readable } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calibrationMs, recordPerf, watchLongestBlock } from '../perf.fixtures';
import { readConfig } from './design-config';
import { serveDesign } from './serve';
import { resolveProduct } from './system/resolve-product';
import { createSketch, parseTarget } from './system/sketch/sketch';
import { CheckSketches } from './system/sketch/sketch-checker';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;
type ServerOptions = { plugins: { configureServer: (vite: unknown) => void }[] };

const created: ServerOptions[] = [];
const targets: string[] = [];

vi.mock('vite', () => ({
  createLogger: () => ({
    info: () => undefined,
    warn: () => undefined,
    warnOnce: () => undefined,
    error: () => undefined,
    clearScreen: () => undefined,
    hasErrorLogged: () => false,
    hasWarned: false,
  }),
  createServer: async (options: ServerOptions) => {
    created.push(options);

    return { listen: async () => undefined, printUrls: () => undefined, close: async () => undefined };
  },
}));

vi.mock('@tailwindcss/postcss', () => ({ default: () => ({}) }));

beforeEach(() => vi.stubEnv('ETHLETE_DESIGN_SLOW_CHECKS', 'off'));

afterEach(async () => {
  created.length = 0;
  vi.restoreAllMocks();
  await Promise.all(targets.splice(0).map((target) => rm(target, { recursive: true, force: true })));
});

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-serve-perf-'));

  targets.push(target);
  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
  mkdirSync(join(target, '.ethlete/design/calls/acme/hero'), { recursive: true });
  writeFileSync(
    join(target, '.ethlete/design/calls/acme/hero/call.ts'),
    "export default defineCall({\n  legacy: true,\n  eyebrow: '',\n});\n",
  );

  return target;
};

const serveAcme = async (target: string, moduleOf: (id: string) => unknown, checkSketches: CheckSketches) => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);

  expect(await serveDesign({ target, checkSketches })).toBe(0);

  const handlers = new Map<string, Handler>();
  const hot = { send: () => undefined };

  created[created.length - 1]?.plugins[0]?.configureServer({
    moduleGraph: {
      getModuleById: (id: string) => ({ id }),
      idToModuleMap: new Map(),
      invalidateModule: () => undefined,
      getModulesByFile: () => undefined,
    },
    ws: hot,
    environments: { client: { hot } },
    middlewares: { use: (path: string, handler: Handler) => handlers.set(path, handler) },
    httpServer: { on: () => undefined },
    watcher: { add: () => undefined, on: () => undefined },
    ssrLoadModule: async (id: string) => moduleOf(id),
  });

  return (path: string, query = '') =>
    new Promise<{ status: number; body: unknown }>((done) => {
      const response = Object.assign(new EventEmitter(), {
        statusCode: 200,
        writableFinished: false,
        setHeader: () => undefined,
        end: (body: string) => {
          response.writableFinished = true;
          done({ status: response.statusCode, body: JSON.parse(body) as unknown });
        },
      });
      const request = Object.assign(Readable.from([]), { url: query, method: 'GET' });

      handlers.get(path)?.(request as unknown as IncomingMessage, response as unknown as ServerResponse);
    });
};

describe('the design server perf', () => {
  it('keeps answering other requests while it checks two hundred sketches, without a block over 8 calibration units', async () => {
    const target = acme();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const names = Array.from({ length: 200 }, (_, index) => `components/card@s${String(index).padStart(3, '0')}`);
    const problem = { rule: 'SKETCH', file: join(target, 'card.ts'), message: 'checked off the event loop' };

    for (const name of names) {
      const parsed = parseTarget(name);
      const sketch = typeof parsed === 'string' ? parsed : createSketch({ product, sketch: parsed, variants: ['a'] });

      if (typeof sketch === 'string') throw new Error(sketch);
    }

    const checked = {
      unreadable: [],
      variants: names.map((name) => ({ target: name, variant: 'a', problems: [problem] })),
    };
    const ask = await serveAcme(
      target,
      (id) =>
        id.includes('/calls/')
          ? undefined
          : { default: { note: 'n', states: { one: {} }, render: () => ({ body: '<p></p>', styles: '' }) } },
      async () => {
        await delay(100);

        return checked;
      },
    );
    const unitBefore = calibrationMs();
    const stop = watchLongestBlock();
    const answers = await Promise.all([
      ask('/__design/sketches', '?product=acme'),
      ask('/__design/sketches', '?product=acme'),
      delay(10).then(() => ask('/__design/calls')),
    ]);
    const { longestMs, gc } = stop();
    const unitMs = Math.max(unitBefore, calibrationMs());
    const boundMs = unitMs * 8;

    recordPerf('serve-sketch-listing-block', { longestMs, boundMs, unitMs, gc });

    expect(answers.map(({ status }) => status)).toEqual([200, 200, 200]);
    expect(longestMs).toBeLessThan(boundMs);
  }, 60_000);
});
