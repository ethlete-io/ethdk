import { execFileSync } from 'child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const cliRoot = resolve(__dirname, '../../..');
const workspace = resolve(cliRoot, '../..');
const BUDGET_MS = 5000;

type Server = { listen: () => Promise<unknown>; close: () => Promise<void>; resolvedUrls: { local: string[] } | null };
type ServeModule = {
  createDesignServer: (options: {
    target: string;
    config: Record<string, unknown>;
    listen: boolean;
    listenOn: number;
    host: string;
  }) => Promise<Server>;
};

let compiled = '';
let target = '';
let server: Server | null = null;
let base = '';

const config = { render: { packages: { '@ethlete/*': 'dist/libs/*' } } };

beforeAll(async () => {
  compiled = mkdtempSync(join(workspace, 'tmp/render-missing-dist-'));
  execFileSync('npx', ['tsc', '-p', join(cliRoot, 'tsconfig.lib.json'), '--outDir', compiled], {
    cwd: workspace,
    stdio: 'pipe',
  });
  cpSync(join(cliRoot, 'design'), join(compiled, 'libs/cli/design'), { recursive: true });
  cpSync(join(cliRoot, 'package.json'), join(compiled, 'libs/cli/package.json'));

  target = mkdtempSync(join(tmpdir(), 'cli-render-missing-dist-'));
  mkdirSync(join(target, '.ethlete/design/calls/app/one'), { recursive: true });
  writeFileSync(join(target, 'package.json'), '{"name":"fixture"}');
  symlinkSync(join(workspace, 'node_modules'), join(target, 'node_modules'));
  writeFileSync(join(target, '.ethlete/design/config.json'), JSON.stringify(config));
  writeFileSync(
    join(target, '.ethlete/design/calls/app/one/call.ts'),
    "import { marker } from '@ethlete/core/marker';\nexport default { eyebrow: marker, headline: '', frameWidth: 1, variants: [] };\n",
  );

  const serve = createRequire(__filename)(join(compiled, 'libs/cli/src/lib/design/serve.js')) as ServeModule;
  const port = 20000 + Math.floor(Math.random() * 30000);

  server = await serve.createDesignServer({ target, config, listen: true, listenOn: port, host: '127.0.0.1' });
  await server.listen();
  base = `http://127.0.0.1:${port}`;
}, 120_000);

afterAll(async () => {
  await server?.close();
  rmSync(compiled, { recursive: true, force: true });
  rmSync(target, { recursive: true, force: true });
});

describe('a render.packages fixture on a missing dist, through the real render path', () => {
  it('answers the first call listing within the budget', async () => {
    const started = Date.now();
    const response = await fetch(`${base}/__design/calls`);
    const listed = (await response.json()) as { slug: string; error?: string }[];

    expect(Date.now() - started).toBeLessThan(BUDGET_MS);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.error).toBeTruthy();
  });

  it('answers a render in the worker with the build command within the budget', async () => {
    const started = Date.now();
    const response = await fetch(`${base}/__design/render`, {
      method: 'POST',
      body: JSON.stringify({ call: 'app/one', template: '<p></p>', imports: [], fields: null }),
    });
    const body = await response.text();

    expect(Date.now() - started).toBeLessThan(BUDGET_MS);
    expect(response.status).toBe(500);
    expect(body).toContain('missing, run `nx build components`');
  });
});
