import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cliSourceHash } from '../source-hash';
import { builtCliChangedWarning, cliBuildLineOf } from './stale-cli-dist';

describe('builtCliChangedWarning', () => {
  let root: string;
  let sha: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const source = (name = 'index.ts') => join(root, 'libs/cli/src', name);
  const copyDir = () => join(root, 'tmp/studio-cli', sha);
  const distDir = () => join(root, 'dist/libs/cli');

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'f904-'));
    mkdirSync(join(root, 'libs/cli/src'), { recursive: true });
    writeFileSync(source(), 'export const a = 1;\n');
    writeFileSync(join(root, '.gitignore'), 'tmp\ndist\n');
    git('init', '-q');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'one');
    sha = git('rev-parse', 'HEAD');
    mkdirSync(copyDir(), { recursive: true });
    writeFileSync(join(copyDir(), 'pinned-commit'), `${sha}\n`);
    mkdirSync(distDir(), { recursive: true });
    writeFileSync(join(distDir(), 'build-info.json'), JSON.stringify({ commit: sha }));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('names the build it runs and its build commit', () => {
    expect(cliBuildLineOf({ distDir: copyDir() })).toBe(
      `cli: runs the build at ${copyDir()} (built from ${sha.slice(0, 9)})`,
    );
    expect(cliBuildLineOf({ distDir: join(root, 'none') })).toBe(
      `cli: runs the build at ${join(root, 'none')} (no build commit)`,
    );
  });

  it('stays silent while libs/cli matches the build commit', () => {
    expect(builtCliChangedWarning({ distDir: copyDir() })).toBeNull();
    expect(builtCliChangedWarning({ distDir: distDir() })).toBeNull();
  });

  it('names the build commit of an et:design copy when libs/cli has uncommitted changes', () => {
    writeFileSync(source(), 'export const a = 2;\n');

    expect(builtCliChangedWarning({ distDir: copyDir() })).toContain(`built from ${sha.slice(0, 9)}`);
  });

  it('warns for a dist build when libs/cli has commits since its build commit', () => {
    writeFileSync(source('later.ts'), 'export const b = 1;\n');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'two');

    expect(builtCliChangedWarning({ distDir: distDir() })).toContain(`built from ${sha.slice(0, 9)}`);
  });

  it('stays silent for a dist built from the uncommitted sources it still matches', () => {
    writeFileSync(source(), 'export const a = 2;\n');
    const sourceHash = cliSourceHash(join(root, 'libs/cli'));
    mkdirSync(join(distDir(), 'src'), { recursive: true });
    writeFileSync(join(distDir(), 'build-info.json'), JSON.stringify({ commit: sha, sourceHash }));

    expect(builtCliChangedWarning({ distDir: distDir() })).toBeNull();

    writeFileSync(source(), 'export const a = 3;\n');

    expect(builtCliChangedWarning({ distDir: distDir() })).toContain(`built from ${sha.slice(0, 9)}`);
  });

  it('ignores spec and markdown changes, which a build does not contain', () => {
    writeFileSync(source('index.spec.ts'), 'it();\n');
    writeFileSync(join(root, 'libs/cli/README.md'), '# cli\n');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'docs');

    expect(builtCliChangedWarning({ distDir: distDir() })).toBeNull();
  });

  it('stays silent for an installed package, an unknown commit, or no git checkout', () => {
    writeFileSync(source(), 'export const a = 2;\n');
    const installed = join(root, 'node_modules/@ethlete/cli');
    mkdirSync(installed, { recursive: true });
    writeFileSync(join(installed, 'build-info.json'), JSON.stringify({ commit: sha }));

    expect(builtCliChangedWarning({ distDir: installed })).toBeNull();

    writeFileSync(join(distDir(), 'build-info.json'), JSON.stringify({ commit: 'f'.repeat(40) }));

    expect(builtCliChangedWarning({ distDir: distDir() })).toBeNull();

    rmSync(join(root, '.git'), { recursive: true, force: true });

    expect(builtCliChangedWarning({ distDir: copyDir() })).toBeNull();
  });
});
