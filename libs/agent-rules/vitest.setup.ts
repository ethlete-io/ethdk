import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Every temp dir a spec or the code under test creates lands in this one, so afterAll removes them all.
const originalTmpdir = process.env['TMPDIR'];
const specTmpdir = mkdtempSync(join(tmpdir(), 'agent-rules-'));

process.env['TMPDIR'] = specTmpdir;

afterAll(() => {
  if (originalTmpdir === undefined) delete process.env['TMPDIR'];
  else process.env['TMPDIR'] = originalTmpdir;

  rmSync(specTmpdir, { recursive: true, force: true });
});
