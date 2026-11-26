import { afterAll, expect } from 'vitest';
import { leakMessageOf, openSpecTmp } from '../scripts/spec-tmp.mjs';

const previous = process.env['TMPDIR'];
const tmp = openSpecTmp();

process.env['TMPDIR'] = tmp.dir;

afterAll(() => {
  if (previous === undefined) delete process.env['TMPDIR'];
  else process.env['TMPDIR'] = previous;

  const left = tmp.close();

  if (left.length > 0) throw new Error(leakMessageOf(expect.getState().testPath ?? 'this spec file', left));
});
