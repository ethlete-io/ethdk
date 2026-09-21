import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { commitPathsOnDays } from './git';

const MINE = 'me@example.com';
const THEIRS = 'them@example.com';

let root = '';

const run = (args: string[], env: Record<string, string> = {}) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });

const commit = (options: { day: string; email: string; path: string; subject: string }) => {
  const file = join(root, options.path);

  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, `${options.subject}\n`);
  run(['add', '-A']);
  run(['commit', '-m', options.subject], {
    GIT_AUTHOR_NAME: 'A',
    GIT_AUTHOR_EMAIL: options.email,
    GIT_COMMITTER_NAME: 'A',
    GIT_COMMITTER_EMAIL: options.email,
    GIT_AUTHOR_DATE: `${options.day}T12:00:00`,
    GIT_COMMITTER_DATE: `${options.day}T12:00:00`,
  });
};

const pathsOf = (result: ReturnType<typeof commitPathsOnDays>) => result.flatMap((entry) => entry.paths).sort();

describe('commitPathsOnDays', () => {
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'ethlete-git-spec-'));
    run(['init', '-q', '-b', 'main']);
    commit({ day: '2026-09-08', email: MINE, path: 'on-main/a.ts', subject: 'on main' });
    commit({ day: '2026-09-08', email: THEIRS, path: 'theirs/b.ts', subject: 'not mine' });
    run(['checkout', '-q', '-b', 'side']);
    commit({ day: '2026-09-09', email: MINE, path: 'on-side/c.ts', subject: 'on a side branch' });
    run(['checkout', '-q', 'main']);
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('reads a commit on a branch HEAD does not reach', () => {
    const days = ['2026-09-08', '2026-09-09'];

    expect(pathsOf(commitPathsOnDays({ root, days }))).toContain('on-side/c.ts');
  });

  it('leaves out another author when one is named', () => {
    const days = ['2026-09-08', '2026-09-09'];
    const paths = pathsOf(commitPathsOnDays({ root, days, author: MINE }));

    expect(paths).toEqual(['on-main/a.ts', 'on-side/c.ts']);
  });

  it('keeps every author when none is named', () => {
    const days = ['2026-09-08'];

    expect(pathsOf(commitPathsOnDays({ root, days }))).toEqual(['on-main/a.ts', 'theirs/b.ts']);
  });

  it('drops a commit on a day outside the list', () => {
    const days = ['2026-09-08'];

    expect(pathsOf(commitPathsOnDays({ root, days, author: MINE }))).toEqual(['on-main/a.ts']);
  });
});
