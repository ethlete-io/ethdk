import { execFileSync } from 'child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { commitStep, dirtySnapshot, parsePorcelain, startCommits } from './commits';

const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

const write = (root: string, path: string, content: string) => {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), content, 'utf8');
};

const makeGitRepo = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-update-commits-'));

  git(root, 'init', '--quiet');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'commit.gpgsign', 'false');
  git(root, 'config', 'core.hooksPath', mkdtempSync(join(tmpdir(), 'cli-update-hooks-')));
  write(root, 'package.json', '{}\n');
  write(root, 'src/mine.ts', 'mine\n');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '-m', 'initial');

  return root;
};

const filesOf = (root: string, ref: string) =>
  git(root, 'show', '--name-only', '--format=', ref).trim().split('\n').filter(Boolean);

describe('parsePorcelain', () => {
  it('reads both sides of a rename', () => {
    expect(parsePorcelain(' M a.ts\0R  new.ts\0old.ts\0?? b.ts\0')).toEqual(['a.ts', 'new.ts', 'old.ts', 'b.ts']);
  });
});

describe('dirtySnapshot', () => {
  it('is undefined outside a git checkout', () => {
    expect(dirtySnapshot(mkdtempSync(join(tmpdir(), 'cli-update-no-git-')))).toBeUndefined();
  });

  it('leaves the update directory out', () => {
    const root = makeGitRepo();

    write(root, '.ethlete/update/pending.json', '{}');
    write(root, 'new.ts', 'new');

    expect(Object.keys(dirtySnapshot(root) ?? {})).toEqual(['new.ts']);
  });
});

describe('commitStep', () => {
  it('commits only what the step changed, new files included', () => {
    const root = makeGitRepo();

    write(root, 'src/mine.ts', 'my own work\n');

    const state = startCommits(root);

    if (!state) throw new Error('not a checkout');

    write(root, 'package.json', '{ "version": "2" }\n');
    write(root, 'src/new.ts', 'new\n');

    const result = commitStep({ root, state, message: 'chore(deps): Step', body: 'a → b' });

    expect(result.commit).toMatchObject({ state: 'committed', paths: ['package.json', 'src/new.ts'] });
    expect(filesOf(root, 'HEAD')).toEqual(['package.json', 'src/new.ts']);
    expect(git(root, 'log', '-1', '--format=%B').trim()).toBe('chore(deps): Step\n\na → b');
    expect(git(root, 'status', '--porcelain')).toBe(' M src/mine.ts\n');
    expect(result.state.snapshot).toEqual(state.baseline);
  });

  it('does not commit a step that touched a path the user had changed before the run', () => {
    const root = makeGitRepo();

    write(root, 'src/mine.ts', 'my own work\n');

    const state = startCommits(root);

    if (!state) throw new Error('not a checkout');

    write(root, 'src/mine.ts', 'my own work, rewritten by a codemod\n');
    write(root, 'package.json', '{ "version": "2" }\n');

    const result = commitStep({ root, state, message: 'chore(deps): Step' });

    expect(result.commit).toEqual({ state: 'blocked', paths: ['src/mine.ts'] });
    expect(git(root, 'log', '--format=%s').trim()).toBe('initial');

    write(root, 'src/other.ts', 'other\n');

    expect(commitStep({ root, state: result.state, message: 'chore(deps): Next' }).commit).toMatchObject({
      state: 'committed',
      paths: ['src/other.ts'],
    });
  });

  it('leaves the changes unstaged in the tree when the commit fails', () => {
    const root = makeGitRepo();
    const hook = join(git(root, 'config', 'core.hooksPath').trim(), 'pre-commit');
    const state = startCommits(root);

    if (!state) throw new Error('not a checkout');

    writeFileSync(hook, '#!/bin/sh\necho "lint failed" >&2\nexit 1\n', 'utf8');
    chmodSync(hook, 0o755);
    write(root, 'src/new.ts', 'new\n');

    const result = commitStep({ root, state, message: 'chore(deps): Step' });

    expect(result.commit).toEqual({ state: 'failed', reason: 'lint failed', paths: ['src/new.ts'] });
    expect(git(root, 'status', '--porcelain')).toBe('?? src/new.ts\n');
  });
});
