import { execFileSync } from 'child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const cliRoot = resolve(__dirname, '../../..');
const workspace = resolve(cliRoot, '../..');

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

const config = { render: { packages: { '@ethlete/*': 'dist/libs/*' } } };

export const startMissingDistServer = async () => {
  mkdirSync(join(workspace, 'tmp'), { recursive: true });
  const compiled = mkdtempSync(join(workspace, 'tmp/render-missing-dist-'));
  execFileSync('npx', ['tsc', '-p', join(cliRoot, 'tsconfig.lib.json'), '--outDir', compiled], {
    cwd: workspace,
    stdio: 'pipe',
  });
  cpSync(join(cliRoot, 'design'), join(compiled, 'libs/cli/design'), { recursive: true });
  cpSync(join(cliRoot, 'package.json'), join(compiled, 'libs/cli/package.json'));

  const target = mkdtempSync(join(tmpdir(), 'cli-render-missing-dist-'));
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

  const server = await serve.createDesignServer({ target, config, listen: true, listenOn: port, host: '127.0.0.1' });
  await server.listen();

  return {
    base: `http://127.0.0.1:${port}`,
    stop: async () => {
      await server.close();
      rmSync(compiled, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    },
  };
};
