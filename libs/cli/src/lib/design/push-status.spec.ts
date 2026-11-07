import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushGateReceiptPath, pushStatusLines, pushStatusOf } from './push-status';
import { designStatus } from './status';

const git = (cwd: string, args: string[], date?: string) =>
  spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...(date ? { GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date } : {}) },
  });

const commit = (cwd: string, date: string) =>
  git(cwd, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '--no-verify', '-m', 'x'], date);

const repo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-push-status-'));

  git(dir, ['init', '-q', '-b', 'next']);
  commit(dir, '2026-01-01T00:00:00Z');
  git(dir, ['update-ref', 'refs/remotes/origin/next', 'HEAD']);
  commit(dir, '2026-01-01T10:00:00Z');
  commit(dir, '2026-01-01T12:00:00Z');

  return dir;
};

const dirs: string[] = [];

const freshRepo = () => {
  const dir = repo();

  dirs.push(dir);

  return dir;
};

const headOf = (dir: string) => git(dir, ['rev-parse', 'HEAD']).stdout.trim();

describe('pushStatusOf', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    dirs.splice(0).forEach((dir) => {
      rmSync(dir, { recursive: true, force: true });
      rmSync(pushGateReceiptPath(dir), { force: true });
    });
  });

  it('counts the unpushed commits and ages the oldest one', () => {
    const dir = freshRepo();
    const status = pushStatusOf(dir, Date.parse('2026-01-01T15:00:00Z'));

    expect(status).toMatchObject({ base: 'origin/next', unpushed: 2, oldestAgeHours: 5, gate: 'unknown' });
    expect(pushStatusLines(status!)[0]).toBe('2 unpushed commit(s) on origin/next, oldest 5 h old');
  });

  it('counts against origin/<branch> and warns when the upstream has another name', () => {
    const dir = freshRepo();

    git(dir, ['update-ref', 'refs/remotes/origin/studio-mac-move', `${headOf(dir)}~2`]);
    git(dir, ['config', 'remote.origin.url', dir]);
    git(dir, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*']);
    git(dir, ['config', 'branch.next.remote', 'origin']);
    git(dir, ['config', 'branch.next.merge', 'refs/heads/studio-mac-move']);
    git(dir, ['update-ref', 'refs/remotes/origin/next', headOf(dir)]);

    const status = pushStatusOf(dir);

    expect(status).toMatchObject({ base: 'origin/next', unpushed: 0, strayUpstream: 'origin/studio-mac-move' });
    expect(pushStatusLines(status!)[2]).toBe(
      'warning: the upstream is origin/studio-mac-move, not origin/next; run git branch --set-upstream-to=origin/next',
    );
  });

  it('reads the gate result only for the head it was run on', () => {
    const dir = freshRepo();

    mkdirSync(join(pushGateReceiptPath(dir), '..'), { recursive: true });
    writeFileSync(
      pushGateReceiptPath(dir),
      JSON.stringify({ head: headOf(dir), ok: false, at: '2026-01-01T13:00:00Z' }),
    );

    expect(pushStatusOf(dir)?.gate).toBe('red');
    expect(pushStatusLines(pushStatusOf(dir)!)[1]).toContain('before any feature slice');

    commit(dir, '2026-01-01T14:00:00Z');

    expect(pushStatusOf(dir)?.gate).toBe('unknown');
  });

  it('prints the push status as JSON for a bare status call', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const dir = freshRepo();

    expect(designStatus({ target: dir, argv: ['--json'], invocation: 'et design' })).toBe(0);

    const printed = JSON.parse(String(log.mock.calls[0]?.[0])) as { push: { unpushed: number } };
    expect(printed.push.unpushed).toBe(2);
  });
});
