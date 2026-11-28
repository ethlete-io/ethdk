import { tmpdir } from 'os';
import { join } from 'path';

export const RENDER_WORKER_ENV = 'ETHLETE_SPEC_RENDER_WORKER';

const buildRenderWorker = async (root: string) => {
  const { buildSync } = await import('esbuild');
  const outfile = join(root, 'render-worker', 'render-worker.js');

  buildSync({
    entryPoints: [join(__dirname, 'src/lib/design/render-worker.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['@angular/*'],
    outfile,
    logLevel: 'error',
  });

  return outfile;
};

// Must run after ../cli/vitest.global-setup.ts, which points TMPDIR at the run's own folder and removes it at teardown.
export default async function setup() {
  process.env[RENDER_WORKER_ENV] = await buildRenderWorker(tmpdir());

  return () => {
    delete process.env[RENDER_WORKER_ENV];
  };
}
