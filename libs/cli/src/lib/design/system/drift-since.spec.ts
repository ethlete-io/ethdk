import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { gitSpawn } from '../../git-test-env.fixtures';
import { driftLinesOf, driftSinceOf } from './drift-since';

const run = (cwd: string, args: string[], date?: string) => {
  const result = gitSpawn(args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date },
  });

  if (result.status !== 0) throw new Error(String(result.stderr));

  return String(result.stdout).trim();
};

const commit = (cwd: string, file: string, text: string, message: string, date: string) => {
  mkdirSync(join(cwd, 'src'), { recursive: true });
  writeFileSync(join(cwd, file), text);
  run(cwd, ['add', file]);
  run(cwd, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', message], date);
};

describe('driftLinesOf', () => {
  it('lists the commits', () => {
    expect(driftLinesOf({ sha: 'abc1234', at: 'T', log: 'def5678 fix hero\n9999999 tweak\n' })).toEqual([
      'drift since abc1234 (T): 2 commit(s) touched the app files',
      '  def5678 fix hero',
      '  9999999 tweak',
    ]);
  });

  it('shows the ten newest commits and counts the older ones', () => {
    const log = Array.from({ length: 12 }, (_, index) => `c${index} commit ${index}`).join('\n');
    const lines = driftLinesOf({ sha: 'abc1234', at: 'T', log });

    expect(lines).toHaveLength(12);
    expect(lines[10]).toBe('  c9 commit 9');
    expect(lines[11]).toBe('  and 2 older');
  });

  it('hints at a design-side change when no commit touched the files', () => {
    expect(driftLinesOf({ sha: 'abc1234', at: 'T', log: '' })).toEqual([
      'drift since abc1234 (T): no commit touched the app files (a design-side change?)',
    ]);
  });
});

describe('driftSinceOf', () => {
  const repo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-drift-since-'));

    run(dir, ['init', '-q']);
    commit(dir, 'src/hero.ts', 'a', 'add hero', '2026-01-01T00:00:00Z');
    commit(dir, 'src/other.ts', 'a', 'add other', '2026-01-02T00:00:00Z');
    commit(dir, 'src/hero.ts', 'b', 'change hero', '2026-01-03T00:00:00Z');
    commit(dir, 'src/other.ts', 'b', 'change other', '2026-01-04T00:00:00Z');

    return dir;
  };
  const record = (app?: Record<string, string>) => ({ hash: 'h', at: '2026-01-02T12:00:00Z', states: {}, app });

  it('names the commits since the record that touched its app files', () => {
    const lines = driftSinceOf({ root: repo(), record: record({ 'src/hero.ts': 'x' }), files: [] });

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^drift since [0-9a-f]+ \(2026-01-02T12:00:00Z\): 1 commit\(s\) touched the app files$/u);
    expect(lines[1]).toMatch(/^ {2}[0-9a-f]+ change hero$/u);
  });

  it('falls back to the component files when the record has none', () => {
    const lines = driftSinceOf({ root: repo(), record: record(), files: ['src/other.ts'] });

    expect(lines[1]).toMatch(/change other$/u);
  });

  it('reports no commit when only other files changed', () => {
    const [line] = driftSinceOf({ root: repo(), record: record({ 'src/none.ts': 'x' }), files: [] });

    expect(line).toMatch(/: no commit touched the app files/u);
  });

  it('prints nothing without a record', () => {
    expect(driftSinceOf({ root: repo(), record: undefined, files: [] })).toEqual([]);
  });
});
