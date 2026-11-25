import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const script = fileURLToPath(new URL('./move-into-place.mts', import.meta.url));

const writeTree = (root: string, files: Record<string, string>) => {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
};

const completeCli = {
  'package.json': '{}',
  'src/index.js': 'require("./lib");',
  'src/lib/index.js': 'require("./api");\nrequire("./config");',
  'src/lib/api/index.js': '',
  'src/lib/config.js': '',
};

const buildCli = (staging: string, target: string) =>
  spawnSync(process.execPath, [script, staging, target], { encoding: 'utf8' });

describe('move-into-place.mts', () => {
  it('keeps the CLI complete when two builds move the same compile output', () => {
    const root = mkdtempSync(join(tmpdir(), 'move-into-place-'));
    const staging = join(root, 'tmp/cli-build');
    const target = join(root, 'dist/libs/cli');
    writeTree(staging, completeCli);

    expect(buildCli(staging, target).status).toBe(0);
    const second = buildCli(staging, target);

    expect(second.status).toBe(0);
    expect(readdirSync(join(target, 'src/lib')).sort()).toEqual(['api', 'config.js', 'index.js']);
    expect(readdirSync(join(root, 'tmp'))).toEqual(['cli-build']);
  });

  it('refuses a partial compile output and leaves the built CLI untouched', () => {
    const root = mkdtempSync(join(tmpdir(), 'move-into-place-'));
    const staging = join(root, 'tmp/cli-build');
    const target = join(root, 'dist/libs/cli');
    writeTree(target, completeCli);
    writeTree(
      staging,
      Object.fromEntries(Object.entries(completeCli).filter(([path]) => !path.startsWith('src/lib/api/'))),
    );

    const result = buildCli(staging, target);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('src/lib/index.js requires ./api');
    expect(readdirSync(join(target, 'src/lib')).sort()).toEqual(['api', 'config.js', 'index.js']);
  });
});
