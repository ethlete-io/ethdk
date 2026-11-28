import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';

const workspace = resolve(__dirname, '../../../../..');

type Server = {
  listen: () => Promise<unknown>;
  close: () => Promise<void>;
  httpServer: { address: () => unknown } | null;
};
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
  const compiled = join(mkdtempSync(join(workspace, 'tmp/render-missing-dist-')), 'cli');
  execFileSync(process.execPath, [join(workspace, 'libs/cli/scripts/compile.mts'), compiled], {
    cwd: workspace,
    stdio: 'pipe',
  });

  const target = mkdtempSync(join(tmpdir(), 'cli-render-missing-dist-'));
  mkdirSync(join(target, '.ethlete/design/calls/app/one'), { recursive: true });
  writeFileSync(join(target, 'package.json'), '{"name":"fixture"}');
  symlinkSync(join(workspace, 'node_modules'), join(target, 'node_modules'));
  writeFileSync(join(target, '.ethlete/design/config.json'), JSON.stringify(config));
  writeFileSync(
    join(target, '.ethlete/design/calls/app/one/call.ts'),
    "import { marker } from '@ethlete/core/marker';\nexport default { eyebrow: marker, headline: '', frameWidth: 1, variants: [] };\n",
  );

  const serve = createRequire(__filename)(join(compiled, 'src/lib/design/serve.js')) as ServeModule;
  const server = await serve.createDesignServer({ target, config, listen: true, listenOn: 0, host: '127.0.0.1' });
  await server.listen();

  const address = server.httpServer?.address();
  const port = address && typeof address === 'object' ? (address as { port: number }).port : 0;

  return {
    base: `http://127.0.0.1:${port}`,
    stop: async () => {
      await server.close();
      rmSync(dirname(compiled), { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    },
  };
};
