import { describe, expect, it } from 'vitest';
import { GIT_FIELD_SEPARATOR } from './format';
import { parseGitReflog } from './reflog';

const REPO = '/home/tom/dev/fut-frontend';

const line = (options: { stamp: string; subject: string }) =>
  `HEAD@{${options.stamp}}${GIT_FIELD_SEPARATOR}${options.subject}`;

const checkout = (options: { stamp: string; to: string; from?: string }) =>
  line({ stamp: options.stamp, subject: `checkout: moving from ${options.from ?? 'next'} to ${options.to}` });

const parse = (lines: string[], window?: { from: Date; to: Date }) =>
  parseGitReflog({ repoPath: REPO, output: lines.join('\n'), window });

describe('parseGitReflog', () => {
  it('reads a branch switch with the reflog timestamp', () => {
    const events = parse([checkout({ stamp: '2026-08-11T16:25:56+02:00', to: 'feat/FIP-2177-user-management' })]);

    expect(events).toEqual([
      {
        at: new Date('2026-08-11T16:25:56+02:00'),
        source: 'git',
        kind: 'git-checkout',
        repoPath: REPO,
        branch: 'feat/FIP-2177-user-management',
      },
    ]);
  });

  it('keeps a nested branch name whole', () => {
    const to = 'sub/feat/FIP-2177-user-management/FIP-2178-password-reset';

    const events = parse([checkout({ stamp: '2026-08-11T10:00:00+02:00', to })]);

    expect(events[0]?.branch).toBe(to);
  });

  it('ignores a detached checkout, which records an object name where a branch would be', () => {
    const events = parse([
      checkout({ stamp: '2026-08-10T14:22:02+02:00', to: '8459c8b38' }),
      checkout({ stamp: '2026-08-10T14:23:59+02:00', from: '8459c8b38595133b97e33615ba8fa6f685dddb8a', to: 'next' }),
    ]);

    expect(events.map((event) => event.branch)).toEqual(['next']);
  });

  it('ignores the checkouts a rebase, a pull or a reset performs', () => {
    const events = parse([
      line({ stamp: '2026-08-11T16:25:56+02:00', subject: 'rebase (start): checkout origin/next' }),
      line({ stamp: '2026-08-11T16:25:56+02:00', subject: 'rebase (finish): returning to refs/heads/next' }),
      line({ stamp: '2026-08-11T14:01:53+02:00', subject: 'reset: moving to HEAD' }),
      line({ stamp: '2026-08-11T13:00:00+02:00', subject: 'commit: feat(repo): Add the timetrack store' }),
      line({ stamp: '2026-08-11T12:00:00+02:00', subject: 'pull --tags origin next: Fast-forward' }),
    ]);

    expect(events).toEqual([]);
  });

  it('orders switches oldest first, whatever order the reflog printed them in', () => {
    const events = parse([
      checkout({ stamp: '2026-08-11T16:00:00+02:00', to: 'next' }),
      checkout({ stamp: '2026-08-11T09:00:00+02:00', to: 'feat/FIP-2177-user-management' }),
    ]);

    expect(events.map((event) => event.branch)).toEqual(['feat/FIP-2177-user-management', 'next']);
  });

  it('keeps every switch to the same branch, since each one is a real one', () => {
    const events = parse([
      checkout({ stamp: '2026-08-11T09:00:00+02:00', to: 'next' }),
      checkout({ stamp: '2026-08-11T11:00:00+02:00', to: 'next' }),
    ]);

    expect(events).toHaveLength(2);
  });

  it('drops switches outside the window so a rescan re-emits nothing', () => {
    const events = parse(
      [
        checkout({ stamp: '2026-08-10T09:00:00+02:00', to: 'yesterday' }),
        checkout({ stamp: '2026-08-11T09:00:00+02:00', to: 'today' }),
        checkout({ stamp: '2026-08-12T09:00:00+02:00', to: 'tomorrow' }),
      ],
      { from: new Date('2026-08-11T00:00:00+02:00'), to: new Date('2026-08-11T23:59:59+02:00') },
    );

    expect(events.map((event) => event.branch)).toEqual(['today']);
  });

  it('skips a malformed or unparseable line rather than failing the scan', () => {
    const events = parse([
      '',
      'no separator here',
      `HEAD@{not a date}${GIT_FIELD_SEPARATOR}checkout: moving from next to feat/x`,
      checkout({ stamp: '2026-08-11T09:00:00+02:00', to: 'next' }),
    ]);

    expect(events).toHaveLength(1);
  });
});
