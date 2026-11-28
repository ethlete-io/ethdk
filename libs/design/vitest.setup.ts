import { RENDER_WORKER_ENV } from './vitest.global-setup';

// A worker thread cannot load the TypeScript source of the render worker; the global setup bundles it once per run.
vi.mock('./src/lib/design/package-root', async (importOriginal) => {
  const original = await importOriginal<typeof import('./src/lib/design/package-root')>();
  const worker = process.env[RENDER_WORKER_ENV];

  if (!worker)
    throw new Error(
      `${RENDER_WORKER_ENV} is not set: run the design specs through a config with ./vitest.global-setup.ts`,
    );

  return {
    ...original,
    packageFileOf: (file: string) => (file.endsWith('render-worker.js') ? worker : original.packageFileOf(file)),
  };
});
