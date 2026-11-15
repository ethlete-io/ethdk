import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { setTimeout as wait } from 'timers/promises';
import { describe, expect, it } from 'vitest';
import { asyncReadsCacheOf, readsCacheOf, trackedRunAsync } from './tracked-reads';

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

const filesIn = (names: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-tracked-reads-async-'));

  for (const [name, text] of Object.entries(names)) writeFileSync(join(dir, name), text);

  return (name: string) => join(dir, name);
};

const pathsOf = (inputs: { input: { path: string } }[]) => inputs.map(({ input }) => input.path).sort();

describe('trackedRunAsync', () => {
  it('keeps the reads of two runs at the same time apart', async () => {
    const file = filesIn({ 'a.txt': 'a', 'b.txt': 'b' });
    const readAfter = async (name: string, ms: number) => {
      await wait(ms);
      await readFile(file(name), 'utf8');
      await wait(ms);
      await stat(file(name));
    };

    const [first, second] = await Promise.all([
      trackedRunAsync(() => readAfter('a.txt', 5)),
      trackedRunAsync(() => readAfter('b.txt', 2)),
    ]);

    expect(pathsOf(first.inputs)).toEqual([file('a.txt')]);
    expect(pathsOf(second.inputs)).toEqual([file('b.txt')]);
  });

  it('adds the reads of a nested run to the run around it', async () => {
    const file = filesIn({ 'inner.txt': 'i', 'outer.txt': 'o' });

    const outer = await trackedRunAsync(async () => {
      const inner = await trackedRunAsync(async () => {
        await wait(1);

        return readFile(file('inner.txt'), 'utf8');
      });

      expect(pathsOf(inner.inputs)).toEqual([file('inner.txt')]);

      return `${inner.value}${await readFile(file('outer.txt'), 'utf8')}`;
    });

    expect(outer.value).toBe('io');
    expect(pathsOf(outer.inputs)).toEqual([file('inner.txt'), file('outer.txt')]);
  });
});

describe('asyncReadsCacheOf', () => {
  it('answers fresh once a file an async run read changes, and from the entry while none did', async () => {
    const file = filesIn({ 'a.txt': 'a', 'b.txt': 'b' });
    let runs = 0;
    const textOf = asyncReadsCacheOf({
      slotOf: (name: string) => name,
      run: async (name: string) => {
        runs += 1;
        await wait(1);

        return readFile(file(name), 'utf8');
      },
    });

    await Promise.all([textOf('a.txt'), textOf('b.txt')]);

    expect(await textOf('a.txt')).toBe('a');
    expect(runs).toBe(2);

    writeFileSync(file('b.txt'), 'bb');

    expect(await textOf('a.txt')).toBe('a');
    expect(await textOf('b.txt')).toBe('bb');
    expect(runs).toBe(3);
  });
});
