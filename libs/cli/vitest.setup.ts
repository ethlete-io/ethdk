import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Every temp dir a spec or the code under test creates lands in this one, so afterAll removes them all.
const originalTmpdir = process.env['TMPDIR'];
const specTmpdir = mkdtempSync(join(tmpdir(), 'cli-'));

process.env['TMPDIR'] = specTmpdir;

const originalStateHome = process.env['XDG_STATE_HOME'];

process.env['XDG_STATE_HOME'] = join(specTmpdir, 'state');

afterAll(() => {
  if (originalTmpdir === undefined) delete process.env['TMPDIR'];
  else process.env['TMPDIR'] = originalTmpdir;

  if (originalStateHome === undefined) delete process.env['XDG_STATE_HOME'];
  else process.env['XDG_STATE_HOME'] = originalStateHome;

  rmSync(specTmpdir, { recursive: true, force: true });
});
