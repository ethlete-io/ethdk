import { rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { git as gitIn, gitEnv, tempGitRepo } from '../git-test-env.fixtures';
import { catFileBatchOf, catFilesOf, git, gitLater, gitStatusOf, logNamesOf, showFilesOf } from './git-reader';

const repos: string[] = [];

const repo = (files: Record<string, string | Buffer>) => {
  const dir = tempGitRepo('cli-git-reader-');

  repos.push(dir);
  for (const [path, content] of Object.entries(files)) writeFileSync(join(dir, path), content);
  gitIn(dir, 'add', '.');
  gitIn(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base');

  return dir;
};

afterEach(() => repos.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('catFileBatchOf', () => {
  it('splits blobs by their byte size, so a newline or a multi-byte character inside one does not shift the next', () => {
    const first = Buffer.from('ä\nb\n');
    const second = Buffer.from([0, 10, 255, 10]);
    const output = Buffer.concat([
      Buffer.from(`${'a'.repeat(40)} blob ${first.length}\n`),
      first,
      Buffer.from('\n'),
      Buffer.from('HEAD:gone.ts missing\n'),
      Buffer.from(`${'b'.repeat(40)} blob ${second.length}\n`),
      second,
      Buffer.from('\n'),
    ]);

    expect(catFileBatchOf(output)).toEqual([first, null, second]);
  });

  it('answers null for an object that is not a blob and skips its body', () => {
    const output = Buffer.concat([
      Buffer.from(`${'a'.repeat(40)} tree 3\nxyz\n`),
      Buffer.from(`${'b'.repeat(40)} blob 2\nok\n`),
    ]);

    expect(catFileBatchOf(output)).toEqual([null, Buffer.from('ok')]);
  });
});

describe('showFilesOf', () => {
  it('reads every path at a revision in one batch, binary-safe, with a path with spaces and a missing one', () => {
    const binary = Buffer.from([0, 1, 10, 13, 255, 10, 0]);
    const dir = repo({ 'a b.ts': 'with space\n', 'bin.dat': binary, 'c.ts': 'plain' });

    const files = showFilesOf({
      cwd: dir,
      rev: 'HEAD',
      paths: ['a b.ts', 'gone.ts', 'bin.dat', 'c.ts', 'a b.ts'],
      env: gitEnv(),
    });

    expect([...files.keys()]).toEqual(['a b.ts', 'gone.ts', 'bin.dat', 'c.ts']);
    expect(files.get('a b.ts')?.toString()).toBe('with space\n');
    expect(files.get('gone.ts')).toBeNull();
    expect(files.get('bin.dat')).toEqual(binary);
    expect(files.get('c.ts')?.toString()).toBe('plain');
  });

  it('answers null for every path at a revision that does not exist', () => {
    const dir = repo({ 'a.ts': 'a' });

    expect([...showFilesOf({ cwd: dir, rev: 'nope', paths: ['a.ts'], env: gitEnv() }).values()]).toEqual([null]);
  });
});

describe('catFilesOf', () => {
  it('answers null for a name with a line break and keeps the order of the others', () => {
    const dir = repo({ 'a.ts': 'a', 'b.ts': 'b' });

    expect(catFilesOf(['HEAD:a.ts', 'HEAD:x\ny', 'HEAD:b.ts'], { cwd: dir, env: gitEnv() })).toEqual([
      Buffer.from('a'),
      null,
      Buffer.from('b'),
    ]);
  });
});

describe('logNamesOf', () => {
  it('lists each commit with the paths it touched, a path with spaces unquoted', () => {
    const dir = repo({ 'a b.ts': 'one' });

    writeFileSync(join(dir, 'a b.ts'), 'two');
    writeFileSync(join(dir, 'ü.ts'), 'two');
    gitIn(dir, 'add', '.');
    gitIn(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'second');

    const log = logNamesOf([], { cwd: dir, env: gitEnv() });

    expect(log.map(({ paths }) => paths)).toEqual([['a b.ts', 'ü.ts'], ['a b.ts']]);
    expect(log[0]?.commit).toBe(gitIn(dir, 'rev-parse', 'HEAD'));
  });
});

describe('single calls', () => {
  it('throws on a failing command, while gitStatusOf and gitLater answer it', async () => {
    const dir = repo({ 'a.ts': 'a' });
    const env = gitEnv();

    expect(git(['rev-parse', 'HEAD'], { cwd: dir, env }).trim()).toBe(gitIn(dir, 'rev-parse', 'HEAD'));
    expect(() => git(['rev-parse', 'nope'], { cwd: dir, env, stdio: 'pipe' })).toThrow();
    expect(gitStatusOf(['rev-parse', 'nope'], { cwd: dir, env }).status).not.toBe(0);
    expect(await gitLater(['-C', dir, 'rev-parse', 'nope'])).toBeNull();
  });
});
