import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readsCacheOf, trackedRun } from './tracked-reads';

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

describe('trackedRun', () => {
  it('adds the reads of a nested run to the run around it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-tracked-reads-nest-'));
    const inner = join(dir, 'inner.txt');

    writeFileSync(inner, 'i');

    const outer = trackedRun(() => trackedRun(() => readFileSync(inner, 'utf8')).value);

    expect(outer.inputs.map(({ input }) => input.path)).toEqual([inner]);
  });
});
