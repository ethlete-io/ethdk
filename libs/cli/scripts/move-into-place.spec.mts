import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { moveIntoPlace } from './move-into-place.mjs';

const setup = () => {
  const root = mkdtempSync(join(tmpdir(), 'move-into-place-'));
  const staging = join(root, 'tmp/cli-build');
  const target = join(root, 'dist/libs/cli');
  mkdirSync(staging, { recursive: true });
  writeFileSync(join(staging, 'index.js'), 'new');
  mkdirSync(join(staging, 'src/lib'), { recursive: true });
  writeFileSync(join(staging, 'src/lib/run.js'), 'new');
  return { root, staging, target };
};

describe('moveIntoPlace', () => {
  it('replaces an existing build with the staged one and leaves nothing behind', () => {
    const { root, staging, target } = setup();
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'index.js'), 'old');
    writeFileSync(join(target, 'gone.js'), 'old');
    mkdirSync(join(target, 'src/lib'), { recursive: true });
    writeFileSync(join(target, 'src/lib/run.js'), 'old');
    writeFileSync(join(target, 'src/lib/gone.js'), 'old');

    moveIntoPlace(staging, target);

    expect(readdirSync(target).sort()).toEqual(['index.js', 'src']);
    expect(readdirSync(join(target, 'src/lib'))).toEqual(['run.js']);
    expect(readFileSync(join(target, 'src/lib/run.js'), 'utf8')).toBe('new');
    expect(readFileSync(join(target, 'index.js'), 'utf8')).toBe('new');
    expect(readdirSync(join(root, 'tmp'))).toEqual([]);
  });

  it('keeps the built folders in place instead of swapping them out', () => {
    const { staging, target } = setup();
    mkdirSync(join(target, 'src/lib'), { recursive: true });
    const before = [target, join(target, 'src'), join(target, 'src/lib')].map((dir) => statSync(dir).ino);

    moveIntoPlace(staging, target);

    expect([target, join(target, 'src'), join(target, 'src/lib')].map((dir) => statSync(dir).ino)).toEqual(before);
  });

  it('creates the target when no build exists yet', () => {
    const { staging, target } = setup();

    moveIntoPlace(staging, target);

    expect(readFileSync(join(target, 'index.js'), 'utf8')).toBe('new');
  });
});
