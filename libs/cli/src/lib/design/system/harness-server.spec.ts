import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import {
  freePortOf,
  HarnessServer,
  RESERVED_PORTS,
  ServeCommandOf,
  startHarnessServer,
  withHarnessUrl,
} from './harness-server';
import { resolveProduct } from './resolve-product';

const checkout = (project: object = { name: 'app-a', targets: { serve: {} } }) => {
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

const nodeServing =
  (source: string): ServeCommandOf =>
  ({ port }) => ({
    command: process.execPath,
    args: ['-e', source.replace('PORT', String(port))],
  });

const HARNESS_APP = nodeServing(
  "require('http').createServer((q, r) => { r.statusCode = q.url.startsWith('/__design-harness') ? 200 : 404; r.end(String(process.pid)); }).listen(PORT, '127.0.0.1')",
);

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
  it('starts the serve command on a free port, waits for the harness route, and stops the process', async () => {
    const { target, product } = checkout();
    const commandOf = vi.fn(HARNESS_APP);
    const listeners = process.listeners('SIGINT').length;
    const server = await startHarnessServer({ target, product, commandOf });

    if (typeof server === 'string') throw new Error(server);

    const port = Number(new URL(server.url).port);

    expect(commandOf).toHaveBeenCalledWith({ target, project: 'app-a', port });
    expect(RESERVED_PORTS).not.toContain(port);

    const pid = Number(await (await fetch(`${server.url}/__design-harness`)).text());

    expect(alive(pid)).toBe(true);
    expect(process.listeners('SIGINT')).toHaveLength(listeners + 1);
    await server.stop();
    expect(alive(pid)).toBe(false);
    expect(process.listeners('SIGINT')).toHaveLength(listeners);
    await expect(fetch(`${server.url}/__design-harness`)).rejects.toThrow();
  });

  it('reports a serve command that exits before it serves', async () => {
    const { target, product } = checkout();
    const server = await startHarnessServer({
      target,
      product,
      commandOf: nodeServing("console.error('boom PORT'); process.exit(3)"),
    });

    expect(server).toMatch(/^app-a:serve exited on http:\/\/127\.0\.0\.1:\d+:\nboom \d+$/);
  });

  it('refuses a product without a harness or an app without a serve target', async () => {
    const { target } = checkout({ name: 'app-a', targets: {} });
    const harness = { app: 'apps/app-a', map: 'apps/app-a/src/harness/parts.ts' };

    expect(await startHarnessServer({ target, product: resolveProduct({ target, name: 'app-a', config: {} }) })).toBe(
      'product "app-a" has no harness in config.json - pass --url <app dev server url>',
    );
    expect(
      await startHarnessServer({ target, product: resolveProduct({ target, name: 'app-a', config: { harness } }) }),
    ).toBe('apps/app-a/project.json has no serve target');
  });
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
