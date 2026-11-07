import { mkdtempSync, readdirSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Every temp dir a spec or the code under test creates lands in this one, so afterAll removes them all.
const originalTmpdir = process.env['TMPDIR'];
const specTmpdir = mkdtempSync(join(tmpdir(), 'cli-'));

process.env['TMPDIR'] = specTmpdir;

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
