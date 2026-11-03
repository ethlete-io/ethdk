import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cliSourceHash, staleCliBuildMessage } from './source-hash';

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

  it('refuses after a source edit and names the build command', () => {
    write(join(root, 'libs/cli/src/index.ts'), 'export const a = 2;');

    expect(staleCliBuildMessage({ root, buildDir })).toContain('NX_NO_CLOUD=true npx nx build cli');
  });

  it('refuses after an edit in design/', () => {
    write(join(root, 'libs/cli/design/part.ts'), 'export const b = 2;');

    expect(staleCliBuildMessage({ root, buildDir })).toBeDefined();
  });

  it('refuses when the build recorded no hash', () => {
    write(join(buildDir, 'build-info.json'), JSON.stringify({ builtAt: 'x' }));

    expect(staleCliBuildMessage({ root, buildDir })).toBeDefined();
  });

  it('ignores specs, markdown and files outside the source folders', () => {
    write(join(root, 'libs/cli/src/a.spec.ts'), 'x');
    write(join(root, 'libs/cli/src/NOTES.md'), 'x');
    write(join(root, 'libs/cli/package.json'), '{}');

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
