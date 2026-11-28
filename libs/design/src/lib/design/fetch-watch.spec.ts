import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModuleFetcher, watchModuleFetches } from './fetch-watch';

const dirs: string[] = [];

afterEach(() => {
  vi.useRealTimers();
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

const never = () => new Promise<never>(() => undefined);

const fetcherOf = (fetch: (id: string) => Promise<unknown>) =>
  ({ fetchModule: (id: string) => fetch(id) }) as unknown as ModuleFetcher;

describe('watchModuleFetches', () => {
  it('fails a fetch that never settles with the pending module ids and their wait', async () => {
    vi.useFakeTimers();

    const lines: string[] = [];
    const environment = fetcherOf((id) => (id === '/hang.ts' ? never() : Promise.resolve({ code: id })));

    watchModuleFetches(environment, { stallMs: 1000, report: (line) => lines.push(line) });

    const hanging = environment.fetchModule('/hang.ts').catch((error: Error) => error.message);

    await expect(environment.fetchModule('/fine.ts')).resolves.toEqual({ code: '/fine.ts' });
    await vi.advanceTimersByTimeAsync(1000);

    expect(await hanging).toBe(
      'design-explore: no vite module fetch settled for 1.0 s; failing /hang.ts, pending: /hang.ts (1.0 s)',
    );
    expect(lines).toEqual([await hanging]);
    await expect(environment.fetchModule('/hang.ts')).rejects.toThrow(
      'design-explore: the vite module fetch of /hang.ts still hangs after 1.0 s',
    );
  });

  it('keeps a slow fetch while other fetches still settle', async () => {
    vi.useFakeTimers();

    let finish: (value: unknown) => void = () => undefined;
    const environment = fetcherOf((id) =>
      id === '/slow.ts' ? new Promise((settle) => (finish = settle)) : Promise.resolve(id),
    );

    watchModuleFetches(environment, { stallMs: 1000, report: () => undefined });

    const slow = environment.fetchModule('/slow.ts');

    await vi.advanceTimersByTimeAsync(800);
    await environment.fetchModule('/other.ts');
    await vi.advanceTimersByTimeAsync(800);
    finish('done');

    await expect(slow).resolves.toBe('done');
  });

  it('reports a blocked event loop instead of failing the fetch that waited through it', async () => {
    vi.useFakeTimers();

    let clock = 0;
    let finish: (value: unknown) => void = () => undefined;
    const lines: string[] = [];
    const environment = fetcherOf(() => new Promise((settle) => (finish = settle)));

    let cpu = 0;

    watchModuleFetches(environment, {
      stallMs: 1000,
      now: () => clock,
      cpuMs: () => cpu,
      report: (line) => lines.push(line),
    });

    const blocked = environment.fetchModule('/blocked.ts');

    clock += 30_000;
    cpu += 30_000;
    await vi.advanceTimersByTimeAsync(1000);
    finish('done');

    await expect(blocked).resolves.toBe('done');
    expect(lines).toEqual([
      "design-explore: the design server's event loop was blocked for 30.0 s; pending vite module fetches: /blocked.ts (30.0 s)",
    ]);
  });

  it('reports a suspended process, not a blocked loop, when the late timer used almost no CPU', async () => {
    vi.useFakeTimers();

    let clock = 0;
    let finish: (value: unknown) => void = () => undefined;
    const lines: string[] = [];
    const environment = fetcherOf(() => new Promise((settle) => (finish = settle)));

    watchModuleFetches(environment, {
      stallMs: 1000,
      now: () => clock,
      cpuMs: () => 0,
      report: (line) => lines.push(line),
    });

    const slept = environment.fetchModule('/slept.ts');

    clock += 195_000;
    await vi.advanceTimersByTimeAsync(1000);
    finish('done');

    await expect(slept).resolves.toBe('done');
    expect(lines).toEqual([
      'design-explore: the design server was suspended for 195.0 s (it used 0.0 s of CPU: the machine slept or the process was stopped); pending vite module fetches: /slept.ts (195.0 s)',
    ]);
  });

  it('fails an ssrLoadModule whose import hangs in a plugin fast, naming the module', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fetch-watch-'));

    dirs.push(root);
    writeFileSync(join(root, 'entry.ts'), "export { value } from './hang';\n");
    writeFileSync(join(root, 'hang.ts'), 'export const value = 1;\n');

    let release: (code: string) => void = () => undefined;
    const hang = new Promise<string>((settle) => (release = settle));
    const { createServer } = await import('vite');
    const server = await createServer({
      configFile: false,
      root,
      logLevel: 'silent',
      appType: 'custom',
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      plugins: [{ name: 'hang', load: (id) => (id.endsWith('hang.ts') ? hang : undefined) }],
    });
    const lines: string[] = [];

    watchModuleFetches(server.environments['ssr'] as ModuleFetcher, {
      stallMs: 500,
      report: (line) => lines.push(line),
    });

    const began = Date.now();

    try {
      await expect(server.ssrLoadModule('/entry.ts')).rejects.toThrow(/pending: \/hang\.ts \(\d+\.\d s\)/);
      expect(Date.now() - began).toBeLessThan(10_000);
      expect(lines.join('\n')).toContain('/hang.ts');
    } finally {
      release('export const value = 1;');
      await server.close();
    }
  }, 20_000);
});
