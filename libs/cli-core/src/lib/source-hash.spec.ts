import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cliSourceHash, compareBytes, staleCliBuildMessage, toPosixPath } from './source-hash';

describe('staleCliBuildMessage', () => {
  let root: string;
  let buildDir: string;

  const write = (path: string, content: string) => {
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
  };
  const record = () =>
    write(join(buildDir, 'build-info.json'), JSON.stringify({ sourceHash: cliSourceHash(join(root, 'libs/cli')) }));

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'b267-'));
    buildDir = join(root, 'dist');
    write(join(root, 'libs/cli/src/index.ts'), 'export const a = 1;');
    write(join(root, 'libs/cli/design/part.ts'), 'export const b = 1;');
    record();
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('passes when the sources match the recorded hash', () => {
    expect(staleCliBuildMessage({ root, buildDir })).toBeUndefined();
  });

  it('accepts a copy built from a commit while the sources have uncommitted edits', () => {
    write(join(buildDir, 'pinned-commit'), 'a'.repeat(40));
    write(join(root, 'libs/cli/src/index.ts'), 'export const a = 2;');

    expect(staleCliBuildMessage({ root, buildDir })).toBeUndefined();
  });

  it('refuses after a source edit and names the build command', () => {
    write(join(root, 'libs/cli/src/index.ts'), 'export const a = 2;');

    expect(staleCliBuildMessage({ root, buildDir })).toContain('NX_NO_CLOUD=true npx nx build cli');
  });

  it('refuses after a source edit when run from a subfolder of the checkout', () => {
    write(join(root, 'libs/cli/src/index.ts'), 'export const a = 2;');
    mkdirSync(join(root, 'apps/studio'), { recursive: true });

    expect(staleCliBuildMessage({ root: join(root, 'apps/studio'), buildDir })).toContain(
      'NX_NO_CLOUD=true npx nx build cli',
    );
  });

  it('refuses after an edit in design/', () => {
    write(join(root, 'libs/cli/design/part.ts'), 'export const b = 2;');

    expect(staleCliBuildMessage({ root, buildDir })).toBeDefined();
  });

  it('refuses after an edit in libs/cli/package.json, which the build copies into the dist', () => {
    write(join(root, 'libs/cli/package.json'), '{"version":"1.0.0"}');
    record();
    write(join(root, 'libs/cli/package.json'), '{"version":"2.0.0"}');

    expect(staleCliBuildMessage({ root, buildDir })).toBeDefined();
  });

  it('refuses when the build recorded no hash', () => {
    write(join(buildDir, 'build-info.json'), JSON.stringify({ builtAt: 'x' }));

    expect(staleCliBuildMessage({ root, buildDir })).toBeDefined();
  });

  it('ignores specs, markdown and files outside the source folders', () => {
    write(join(root, 'libs/cli/src/a.spec.ts'), 'x');
    write(join(root, 'libs/cli/src/NOTES.md'), 'x');
    write(join(root, 'libs/cli/project.json'), '{}');

    expect(staleCliBuildMessage({ root, buildDir })).toBeUndefined();
  });

  describe('with a dist symlinked from outside root', () => {
    let other: string;

    beforeEach(() => {
      other = mkdtempSync(join(tmpdir(), 'b270c-'));
      symlinkSync(buildDir, join(other, 'dist'));
    });

    afterEach(() => rmSync(other, { recursive: true, force: true }));

    it('passes when the hash matches', () => {
      write(join(other, 'libs/cli/src/index.ts'), 'export const a = 1;');
      write(join(other, 'libs/cli/design/part.ts'), 'export const b = 1;');

      expect(staleCliBuildMessage({ root: other, buildDir: join(other, 'dist') })).toBeUndefined();
    });

    it('refuses when the hash differs', () => {
      write(join(other, 'libs/cli/src/index.ts'), 'export const a = 99;');

      expect(staleCliBuildMessage({ root: other, buildDir: join(other, 'dist') })).toContain(
        'NX_NO_CLOUD=true npx nx build cli',
      );
    });
  });

  it('does nothing outside the sdk repo', () => {
    rmSync(join(root, 'libs'), { recursive: true });

    expect(staleCliBuildMessage({ root, buildDir })).toBeUndefined();
  });
});

describe('cliSourceHash fixture', () => {
  it('matches the hash the Studio host checks against', () => {
    const fixtures = resolve(__dirname, '../../fixtures/source-hash');

    expect(cliSourceHash(join(fixtures, 'cli'))).toBe(readFileSync(join(fixtures, 'expected-hash.txt'), 'utf8').trim());
  });
});

describe('cliSourceHash portability', () => {
  it('joins relative paths with / whatever the platform separator is', () => {
    expect(toPosixPath('src\\a\\b.ts', '\\')).toBe('src/a/b.ts');
    expect(toPosixPath('src/a/b.ts', '/')).toBe('src/a/b.ts');
  });

  it('orders names by their UTF-8 bytes, not by UTF-16 code units', () => {
    const names = ['\u{1F600}.ts', '\uFF21.ts', '_.ts', 'a.ts', 'B.ts'];

    expect([...names].sort(compareBytes)).toEqual(['B.ts', '_.ts', 'a.ts', '\uFF21.ts', '\u{1F600}.ts']);
    expect([...names].sort()).not.toEqual([...names].sort(compareBytes));
  });

  it('skips symlinks', () => {
    const root = mkdtempSync(join(tmpdir(), 'b918-'));

    try {
      mkdirSync(join(root, 'cli/src'), { recursive: true });
      writeFileSync(join(root, 'cli/src/a.ts'), 'a');
      const before = cliSourceHash(join(root, 'cli'));

      symlinkSync(join(root, 'cli/src/a.ts'), join(root, 'cli/src/link.ts'));
      symlinkSync(join(root, 'cli/src'), join(root, 'cli/src/loop'));

      expect(cliSourceHash(join(root, 'cli'))).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
