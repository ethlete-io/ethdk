import { execFileSync, spawn } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { designCommitHunks, withPartHunks } from './commit-hunks';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const repo = (files: Record<string, unknown>) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-commit-hunks-'));

  git(target, 'init', '-q');
  git(target, 'config', 'user.email', 'a@b.c');
  git(target, 'config', 'user.name', 'a');
  git(target, 'config', 'commit.gpgsign', 'false');
  mkdirSync(join(target, 'p'));

  for (const [name, value] of Object.entries(files))
    writeFileSync(join(target, name), `${JSON.stringify(value, null, 2)}\n`);

  git(target, 'add', '.');
  git(target, 'commit', '-qm', 'init');

  return target;
};

const write = (target: string, name: string, value: unknown) =>
  writeFileSync(join(target, name), `${JSON.stringify(value, null, 2)}\n`);

const run = (target: string, ...argv: string[]) => designCommitHunks({ target, argv, invocation: 'et design' });

describe('designCommitHunks', () => {
  afterEach(() => vi.restoreAllMocks());

  it('commits one part, keeps the foreign hunks uncommitted and the working file as it was', () => {
    const target = repo({ 'p/merged.json': { 'components/x': '1', 'components/y': '1' } });
    const edited = { 'components/x': '2', 'components/y': '9', 'components/z': '3' };

    write(target, 'p/merged.json', edited);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(run(target, 'p/merged.json', '--part', 'components/x', '--part', 'components/z')).toBe(0);
    expect(JSON.parse(git(target, 'show', 'HEAD:p/merged.json'))).toEqual({
      'components/x': '2',
      'components/y': '1',
      'components/z': '3',
    });
    expect(JSON.parse(readFileSync(join(target, 'p/merged.json'), 'utf8'))).toEqual(edited);
    expect(git(target, 'diff', '--', 'p/merged.json')).toContain('"components/y": "9"');
    expect(git(target, 'log', '-1', '--format=%s')).toBe(
      'chore(repo): Record components/x, components/z in merged.json',
    );
    expect(git(target, 'show', '--stat', '--format=', 'HEAD')).not.toContain('init');
  });

  it('commits the entries of a part from a list and leaves the entries of another part', () => {
    const target = repo({ 'p/accepted.json': [{ part: 'components/x', n: 1 }] });
    const edited = [
      { part: 'components/x', n: 1 },
      { part: 'components/y', n: 2 },
      { part: 'components/x', n: 3 },
    ];

    write(target, 'p/accepted.json', edited);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(run(target, 'p/accepted.json', '--part', 'components/x', '--message', 'chore(repo): Accept x')).toBe(0);
    expect(JSON.parse(git(target, 'show', 'HEAD:p/accepted.json'))).toEqual([
      { part: 'components/x', n: 1 },
      { part: 'components/x', n: 3 },
    ]);
    expect(JSON.parse(readFileSync(join(target, 'p/accepted.json'), 'utf8'))).toEqual(edited);
    expect(git(target, 'log', '-1', '--format=%s')).toBe('chore(repo): Accept x');
  });

  it('restores the working file and reports when the commit is refused', () => {
    const target = repo({ 'p/merged.json': { 'components/x': '1' } });

    write(target, 'p/merged.json', { 'components/x': '2', 'components/y': '2' });
    writeFileSync(join(target, '.git/hooks/commit-msg'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });

    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(run(target, 'p/merged.json', '--part', 'components/x')).toBe(1);
    expect(error.mock.calls.flat().join('\n')).toContain('p/merged.json was not committed');
    expect(JSON.parse(readFileSync(join(target, 'p/merged.json'), 'utf8'))).toEqual({
      'components/x': '2',
      'components/y': '2',
    });
  });

  it('says so when the part has nothing uncommitted, and refuses a call without a part', () => {
    const target = repo({ 'p/merged.json': { 'components/x': '1' } });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(run(target, 'p/merged.json', '--part', 'components/x')).toBe(0);
    expect(log.mock.calls.flat().join('\n')).toContain('holds no uncommitted entry of components/x');
    expect(run(target, 'p/merged.json')).toBe(1);
    expect(run(target, 'p/merged.json', '--part', 'nope')).toBe(1);
  });
});

describe('designCommitHunks with a locked index', () => {
  afterEach(() => vi.restoreAllMocks());

  it('waits for index.lock to go and then commits', () => {
    const target = repo({ 'p/merged.json': { 'components/x': '1' } });
    const lock = join(target, '.git/index.lock');

    write(target, 'p/merged.json', { 'components/x': '2' });
    writeFileSync(lock, '');
    spawn('sh', ['-c', `sleep 0.5; rm -f '${lock}'`], { detached: true, stdio: 'ignore' }).unref();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(run(target, 'p/merged.json', '--part', 'components/x')).toBe(0);
    expect(JSON.parse(git(target, 'show', 'HEAD:p/merged.json'))).toEqual({ 'components/x': '2' });
  });
});

describe('withPartHunks', () => {
  it('drops the key of a part removed from the working tree and refuses another shape', () => {
    expect(
      withPartHunks({
        head: { 'components/x': '1', 'components/y': '1' },
        work: { 'components/y': '1' },
        parts: ['components/x'],
      }),
    ).toEqual({
      'components/y': '1',
    });
    expect(withPartHunks({ head: 'a', work: 'b', parts: ['components/x'] })).toEqual(
      expect.stringContaining('neither'),
    );
  });
});
