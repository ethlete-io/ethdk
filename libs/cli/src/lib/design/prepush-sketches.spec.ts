import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyOpenSketches } from './prepush-sketches';

const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'prepush-sketches-'));
  dirs.push(dir);
  return dir;
};
const write = (root: string, file: string, content = '{}') => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
};
const exists = (root: string, file: string) => {
  try {
    return readFileSync(join(root, file), 'utf8');
  } catch {
    return null;
  }
};

afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('copyOpenSketches', () => {
  it('copies the uncommitted open sketches of every product into the clone', () => {
    const from = tempDir();
    const to = tempDir();
    write(from, '.ethlete/design/studio/sketches/components-title-bar/sketch.json', '{"a":1}');
    write(from, '.ethlete/design/studio/sketches/components-title-bar/v1/components/title-bar/title-bar.ts', 'x');
    write(from, '.ethlete/design/sdk/sketches/elements-x/sketch.json');

    copyOpenSketches({ from, to });

    expect(exists(to, '.ethlete/design/studio/sketches/components-title-bar/sketch.json')).toBe('{"a":1}');
    expect(
      exists(to, '.ethlete/design/studio/sketches/components-title-bar/v1/components/title-bar/title-bar.ts'),
    ).toBe('x');
    expect(exists(to, '.ethlete/design/sdk/sketches/elements-x/sketch.json')).toBe('{}');
  });

  it('copies only sketch records, no other uncommitted design file', () => {
    const from = tempDir();
    const to = tempDir();
    write(from, '.ethlete/design/studio/go.json', '{"dirty":true}');
    write(to, '.ethlete/design/studio/go.json', '{"committed":true}');
    write(from, '.ethlete/design/studio/sketches/s/sketch.json');

    copyOpenSketches({ from, to });

    expect(exists(to, '.ethlete/design/studio/go.json')).toBe('{"committed":true}');
  });

  it('drops a committed sketch the working tree no longer has', () => {
    const from = tempDir();
    const to = tempDir();
    write(from, '.ethlete/design/studio/pictures.json');
    write(to, '.ethlete/design/studio/sketches/merged/sketch.json');

    copyOpenSketches({ from, to });

    expect(exists(to, '.ethlete/design/studio/sketches/merged/sketch.json')).toBeNull();
  });

  it('does nothing when the working tree has no design folder', () => {
    const to = tempDir();
    write(to, '.ethlete/design/studio/sketches/s/sketch.json');

    copyOpenSketches({ from: tempDir(), to });

    expect(exists(to, '.ethlete/design/studio/sketches/s/sketch.json')).toBe('{}');
  });
});
