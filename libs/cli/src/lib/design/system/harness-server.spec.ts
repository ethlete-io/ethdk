import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import {
  BuildCommandOf,
  freePortOf,
  HarnessServer,
  RESERVED_PORTS,
  startHarnessServer,
  withHarnessUrl,
} from './harness-server';
import { resolveProduct } from './resolve-product';

const checkout = (project: object = { name: 'app-a', targets: { build: {} } }) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-harness-server-'));
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(target, path)), { recursive: true });
    writeFileSync(join(target, path), source);
  };
  const harness = { app: 'apps/app-a', map: 'apps/app-a/src/harness/parts.ts' };

  write('apps/app-a/project.json', JSON.stringify(project));
  write(join(DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': { harness } } }));
  mkdirSync(join(target, DESIGN_DIR, 'app-a'), { recursive: true });

  return { target, product: resolveProduct({ target, name: 'app-a', config: { harness } }) };
};

const nodeBuilding =
  (source: string): BuildCommandOf =>
  ({ outputPath }) => ({
    command: process.execPath,
    args: ['-e', source, outputPath],
  });

const HARNESS_BUILD = nodeBuilding(
  "const fs = require('fs'); const out = process.argv[1] + '/browser'; fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(out + '/index.html', '<script src=\"main.js\"></script>'); fs.writeFileSync(out + '/main.js', 'boot()');",
);

const outputOf = (commandOf: { mock: { calls: Parameters<BuildCommandOf>[] } }) =>
  commandOf.mock.calls[0]?.[0].outputPath ?? '';

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

afterEach(() => vi.restoreAllMocks());

describe('freePortOf', () => {
  it('never hands out a reserved port', async () => {
    const probe = vi.fn<() => Promise<number>>();

    RESERVED_PORTS.forEach((port) => probe.mockResolvedValueOnce(port));
    probe.mockResolvedValueOnce(51234);

    expect(await freePortOf(probe)).toBe(51234);
    expect(RESERVED_PORTS).toEqual(expect.arrayContaining([4221, 4400, 4402, 4403, 4492]));
    await expect(freePortOf(async () => 4403)).rejects.toThrow('no free port');
  });

  it('asks the OS for a port by default', async () => {
    const port = await freePortOf();

    expect(port).toBeGreaterThan(0);
    expect(RESERVED_PORTS).not.toContain(port);
  });
});

describe('startHarnessServer', () => {
  it('builds the app into a temp folder, serves it with a fallback to index.html, and removes the folder on stop', async () => {
    const { target, product } = checkout();
    const commandOf = vi.fn(HARNESS_BUILD);
    const listeners = process.listeners('SIGINT').length;
    const server = await startHarnessServer({ target, product, commandOf });

    if (typeof server === 'string') throw new Error(server);

    const outputPath = outputOf(commandOf);

    expect(commandOf).toHaveBeenCalledWith({ target, project: 'app-a', outputPath: expect.any(String) });
    expect(outputPath.startsWith(tmpdir())).toBe(true);
    expect(RESERVED_PORTS).not.toContain(Number(new URL(server.url).port));

    const page = await fetch(`${server.url}/__design-harness`);

    expect(page.headers.get('content-type')).toMatch(/^text\/html/);
    expect(await page.text()).toBe('<script src="main.js"></script>');
    expect(await (await fetch(`${server.url}/main.js`)).text()).toBe('boot()');
    expect(await (await fetch(`${server.url}/..%2F..%2Fetc%2Fpasswd`)).text()).toBe('<script src="main.js"></script>');
    expect(process.listeners('SIGINT')).toHaveLength(listeners + 1);

    await server.stop();

    expect(existsSync(dirname(outputPath))).toBe(false);
    expect(process.listeners('SIGINT')).toHaveLength(listeners);
    await expect(fetch(`${server.url}/__design-harness`)).rejects.toThrow();
  });

  it('fails at once when Nx waits for the same task in another process, and stops it', async () => {
    const { target, product } = checkout();
    const commandOf = vi.fn(
      nodeBuilding(
        "console.log('pid ' + process.pid); console.log('Waiting for app-a:build:development in another nx process'); setInterval(() => undefined, 1000)",
      ),
    );
    const started = Date.now();
    const server = await startHarnessServer({ target, product, commandOf, timeout: 60_000 });

    expect(Date.now() - started).toBeLessThan(10_000);
    expect(server).toMatch(/^app-a:build:development waits for another nx process running the same task/);

    const pid = Number(/pid (\d+)/.exec(String(server))?.[1]);

    expect(alive(pid)).toBe(false);
    expect(existsSync(dirname(outputOf(commandOf)))).toBe(false);
  });

  it('reports a build that fails and removes its temp folder', async () => {
    const { target, product } = checkout();
    const commandOf = vi.fn(nodeBuilding("console.error('boom'); process.exit(3)"));
    const server = await startHarnessServer({ target, product, commandOf });

    expect(server).toBe('app-a:build:development failed:\nboom');
    expect(existsSync(dirname(outputOf(commandOf)))).toBe(false);
  });

  it('refuses a product without a harness or an app without a build target', async () => {
    const { target } = checkout({ name: 'app-a', targets: { serve: {} } });
    const harness = { app: 'apps/app-a', map: 'apps/app-a/src/harness/parts.ts' };

    expect(await startHarnessServer({ target, product: resolveProduct({ target, name: 'app-a', config: {} }) })).toBe(
      'product "app-a" has no harness in config.json - pass --url <app dev server url>',
    );
    expect(
      await startHarnessServer({ target, product: resolveProduct({ target, name: 'app-a', config: { harness } }) }),
    ).toBe('apps/app-a/project.json has no build target');
  });

  it.runIf(process.env['ET_DESIGN_REAL_HARNESS'])(
    'builds and serves the real docs-examples harness next to a running dev server',
    { timeout: 600_000 },
    async () => {
      const target = resolve(__dirname, '../../../../../..');
      const config = JSON.parse(readFileSync(join(target, DESIGN_DIR, 'config.json'), 'utf8'));
      const product = resolveProduct({ target, name: 'sdk', config: config.products.sdk });
      const server = await startHarnessServer({ target, product });

      if (typeof server === 'string') throw new Error(server);

      try {
        expect(await (await fetch(`${server.url}/__design-harness`)).text()).toContain('src="main.js"');
        expect((await fetch(`${server.url}/main.js`)).headers.get('content-type')).toMatch(/^text\/javascript/);
      } finally {
        await server.stop();
      }
    },
  );
});

describe('withHarnessUrl', () => {
  const started = () => {
    const stop = vi.fn(async () => undefined);
    const start = vi.fn(async (): Promise<HarnessServer> => ({ url: 'http://127.0.0.1:50001', stop }));

    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    return { start, stop };
  };

  it('uses --url as given and starts nothing', async () => {
    const { target, product } = checkout();
    const { start } = started();
    const run = vi.fn(async (url: string) => url);

    expect(await withHarnessUrl({ target, product, url: 'http://localhost:9', start, run })).toBe('http://localhost:9');
    expect(start).not.toHaveBeenCalled();
  });

  it('without --url passes the started url on and stops the server after a result, a refusal or a throw', async () => {
    const { target, product } = checkout();
    const { start, stop } = started();

    expect(await withHarnessUrl({ target, product, url: undefined, start, run: async (url) => url })).toBe(
      'http://127.0.0.1:50001',
    );
    expect(start).toHaveBeenCalledWith({ target, product });
    expect(stop).toHaveBeenCalledTimes(1);

    expect(await withHarnessUrl({ target, product, url: undefined, start, run: async () => 'compare failed' })).toBe(
      'compare failed',
    );
    expect(stop).toHaveBeenCalledTimes(2);

    await expect(
      withHarnessUrl({
        target,
        product,
        url: undefined,
        start,
        run: async () => {
          throw new Error('shot crashed');
        },
      }),
    ).rejects.toThrow('shot crashed');
    expect(stop).toHaveBeenCalledTimes(3);
  });

  it('returns the start refusal without running', async () => {
    const { target, product } = checkout();
    const run = vi.fn(async () => 'ran');

    expect(await withHarnessUrl({ target, product, url: undefined, start: async () => 'no harness', run })).toBe(
      'no harness',
    );
    expect(run).not.toHaveBeenCalled();
  });
});
