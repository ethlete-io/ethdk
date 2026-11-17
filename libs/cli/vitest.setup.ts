import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { RENDER_WORKER_ENV } from './vitest.global-setup';

// A worker thread cannot load the TypeScript source of the render worker; the global setup bundles it once per run.
vi.mock('./src/lib/design/package-root', async (importOriginal) => {
  const original = await importOriginal<typeof import('./src/lib/design/package-root')>();
  const worker = process.env[RENDER_WORKER_ENV];

  if (!worker)
    throw new Error(
      `${RENDER_WORKER_ENV} is not set: run the cli specs through a config with ./vitest.global-setup.ts`,
    );

  return {
    ...original,
    packageFileOf: (file: string) => (file.endsWith('render-worker.js') ? worker : original.packageFileOf(file)),
  };
});

// Every temp dir a spec or the code under test creates lands in this one, so afterAll removes them all.
const originalTmpdir = process.env['TMPDIR'];
const specTmpdir = mkdtempSync(join(tmpdir(), 'cli-'));

process.env['TMPDIR'] = specTmpdir;

// jiti caches the transpiled source of the workers specs start in `<tmpdir>/jiti`. A cache per spec file transpiles
// the whole worker graph in every file, past the test timeout on a busy CI runner.
const jitiCache = resolve(__dirname, 'node_modules/.cache/jiti-specs');

mkdirSync(jitiCache, { recursive: true });
symlinkSync(jitiCache, join(specTmpdir, 'jiti'), 'dir');

const originalStateHome = process.env['XDG_STATE_HOME'];

process.env['XDG_STATE_HOME'] = join(specTmpdir, 'state');

const TEMP_WARN_BYTES = 50 * 1024 * 1024;

const sizeOf = (dir: string): number =>
  readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const path = join(dir, entry.name);

    return sum + (entry.isDirectory() ? sizeOf(path) : entry.isFile() ? statSync(path).size : 0);
  }, 0);

afterAll(() => {
  const size = sizeOf(specTmpdir);

  if (size > TEMP_WARN_BYTES)
    console.warn(
      `${expect.getState().testPath ?? 'This spec file'} left ${Math.round(size / 1024 / 1024)} MB in its temp folder; remove each target after its test.`,
    );

  if (originalTmpdir === undefined) delete process.env['TMPDIR'];
  else process.env['TMPDIR'] = originalTmpdir;

  if (originalStateHome === undefined) delete process.env['XDG_STATE_HOME'];
  else process.env['XDG_STATE_HOME'] = originalStateHome;

  rmSync(specTmpdir, { recursive: true, force: true });
});
