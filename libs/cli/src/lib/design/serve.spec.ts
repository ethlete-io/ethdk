import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serveDesign } from './serve';

type ServerOptions = {
  server: { port: number; strictPort: boolean };
  resolve: { alias: { find: RegExp; replacement: string }[] };
  plugins: { load: (id: string) => string | null; resolveId: (id: string) => string | null }[];
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
    expect(registry).toContain('defaultCall = "app/one"');
    expect(options?.resolve.alias.map((alias) => alias.replacement)).toEqual(
      expect.arrayContaining([`${join(target, 'libs/x')}/`, join(target, 'libs/one.ts')]),
    );
  });
});
