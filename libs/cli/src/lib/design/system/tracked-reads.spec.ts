import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readsCacheOf } from './tracked-reads';

describe('readsCacheOf', () => {
  it('answers fresh after a file the outer run read after an inner cached run changes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-tracked-reads-'));
    const inner = join(dir, 'inner.txt');
    const outer = join(dir, 'outer.txt');

    writeFileSync(inner, 'a');
    writeFileSync(outer, 'b');

    const innerOf = readsCacheOf({ slotOf: () => 'inner', run: () => readFileSync(inner, 'utf8') });
    const outerOf = readsCacheOf({
      slotOf: () => 'outer',
      run: () => `${innerOf(null)}${readFileSync(outer, 'utf8')}`,
    });

    expect(outerOf(null)).toBe('ab');

    writeFileSync(outer, 'bc');

    expect(outerOf(null)).toBe('abc');

    writeFileSync(inner, 'aa');

    expect(outerOf(null)).toBe('aabc');
  });
});
