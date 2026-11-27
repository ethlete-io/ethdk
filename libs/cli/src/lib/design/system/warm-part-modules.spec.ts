import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { productModuleIdOf } from './system-modules';
import { warmPartModules } from './warm-part-modules';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const partFilesOf = () => {
  const dir = mkdtempSync(join(tmpdir(), 'warm-part-modules-'));

  dirs.push(dir);

  const fileOf = (name: string) => {
    const file = join(dir, `${name}.ts`);

    writeFileSync(
      file,
      `const counts = ((globalThis as any).__warmCounts ??= {});\ncounts[${JSON.stringify(name)}] = (counts[${JSON.stringify(name)}] ?? 0) + 1;\nexport default { states: {} };\n`,
    );

    return file;
  };

  return { dir, base: fileOf('base'), variant: fileOf('variant'), other: fileOf('other') };
};

const systemOf = (files: ReturnType<typeof partFilesOf>) => ({
  products: () => ['app'],
  productOf: () => ({ parts: [{ file: files.base }, { file: files.other }] }) as never,
  sketchesOf: () => [{ target: 'pages/home@edit', targets: ['pages/home'], variants: ['a'] }] as never,
  partOf: ({ sketch }: { sketch?: unknown }) => ({ file: sketch ? files.variant : files.base }) as never,
});

describe('warmPartModules', () => {
  it('loads the sketch targets first, then every product part, each id once', async () => {
    const files = partFilesOf();
    const loaded: string[] = [];

    const count = await warmPartModules({
      system: systemOf(files),
      load: async (id) => void loaded.push(id),
    });

    expect(count).toBe(3);
    expect(loaded).toEqual([
      productModuleIdOf({ file: files.base, product: 'app' }),
      productModuleIdOf({ file: files.variant, product: 'app', sketch: { target: 'pages/home@edit', variant: 'a' } }),
      productModuleIdOf({ file: files.other, product: 'app' }),
    ]);
  });

  it('shares Vite module loads with a request that arrives mid-warm', async () => {
    const files = partFilesOf();
    const { createServer } = await import('vite');
    const server = await createServer({
      configFile: false,
      logLevel: 'silent',
      root: files.dir,
      appType: 'custom',
      server: { middlewareMode: true, ws: false },
      optimizeDeps: { noDiscovery: true, entries: [] },
    });
    const counts = ((globalThis as { __warmCounts?: Record<string, number> }).__warmCounts = {});

    try {
      const started: string[] = [];
      const warming = warmPartModules({
        system: systemOf(files),
        load: (id) => (started.push(id), server.ssrLoadModule(id)),
      });

      await new Promise((resolve) => setImmediate(resolve));
      expect(started).toEqual([productModuleIdOf({ file: files.base, product: 'app' })]);

      const asked = await server.ssrLoadModule(productModuleIdOf({ file: files.base, product: 'app' }));

      await warming;

      expect(asked['default']).toEqual({ states: {} });
      expect(counts).toEqual({ base: 1, variant: 1, other: 1 });
    } finally {
      await server.close();
    }
  }, 60_000);

  it('stops once the signal aborts', async () => {
    const files = partFilesOf();
    const stop = new AbortController();
    const loaded: string[] = [];

    const count = await warmPartModules({
      system: systemOf(files),
      load: async (id) => {
        loaded.push(id);
        stop.abort();
      },
      signal: stop.signal,
    });

    expect(loaded).toHaveLength(1);
    expect(count).toBe(1);
  });
});
