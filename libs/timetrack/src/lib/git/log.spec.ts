import { describe, expect, it } from 'vitest';
import { GIT_FIELD_SEPARATOR } from './format';
import { parseGitLog } from './log';

const REPO = '/home/tom/dev/fut-frontend';
const SHA = 'b39d77c350735b4ec158869ff238ac9e076ae105';

const line = (options: { sha?: string; authored?: string; ref?: string; subject?: string }) =>
  [
    options.sha ?? SHA,
    options.authored ?? '2026-08-11T16:30:29+02:00',
    options.ref ?? 'next',
    options.subject ?? 'feat(platform): Prefer a common name over a last name',
  ].join(GIT_FIELD_SEPARATOR);

const parse = (lines: string[]) => parseGitLog({ repoPath: REPO, output: lines.join('\n') });

describe('parseGitLog', () => {
  it('reads the paths that follow a commit', () => {
    const events = parse([line({}), '', 'src/one.ts', 'src/two.ts']);

    expect(events[0]?.paths).toEqual(['src/one.ts', 'src/two.ts']);
  });

  it('keeps each commit to its own paths', () => {
    const events = parse([
      line({ sha: 'a'.repeat(40), authored: '2026-08-11T15:00:00+02:00' }),
      '',
      'src/one.ts',
      line({ sha: 'b'.repeat(40) }),
      '',
      'src/two.ts',
    ]);

    expect(events.map((event) => event.paths)).toEqual([['src/one.ts'], ['src/two.ts']]);
  });

  it('drops the paths of a commit it refused, rather than lending them to the one before', () => {
    const events = parse([
      line({ sha: 'a'.repeat(40) }),
      '',
      'src/one.ts',
      line({ sha: 'b'.repeat(40), ref: 'refs/remotes/origin/next' }),
      '',
      'src/foreign.ts',
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]?.paths).toEqual(['src/one.ts']);
  });

  it('leaves paths off a commit that changed none', () => {
    expect(parse([line({})])[0]?.paths).toBeUndefined();
  });

  it('reads a commit with its author time, branch and subject', () => {
    const events = parse([line({})]);

    expect(events).toEqual([
      {
        at: new Date('2026-08-11T16:30:29+02:00'),
        source: 'git',
        kind: 'git-commit',
        repoPath: REPO,
        branch: 'next',
        sha: SHA,
        subject: 'feat(platform): Prefer a common name over a last name',
      },
    ]);
  });

  it('keeps a nested branch name whole', () => {
    const ref = 'sub/feat/FIP-2177-user-management/FIP-2178-password-reset';

    const events = parse([line({ ref })]);

    expect(events[0]?.branch).toBe(ref);
  });

  it('reads the same branch whether the ref is spelled short or in full', () => {
    const short = parse([line({ ref: 'next' })]);
    const full = parse([line({ ref: 'refs/heads/next' })]);

    expect(short[0]?.branch).toBe('next');
    expect(full[0]?.branch).toBe('next');
  });

  it('ignores a commit reached through a remote-tracking ref or a tag', () => {
    const events = parse([
      line({ sha: 'aaa1111', ref: 'refs/remotes/origin/changeset-release/next' }),
      line({ sha: 'bbb2222', ref: 'refs/tags/v5.0.0' }),
      line({ sha: 'ccc3333', ref: 'refs/heads/next' }),
    ]);

    expect(events.map((event) => event.sha)).toEqual(['ccc3333']);
  });

  it('reports a commit once when several branches reach it', () => {
    const events = parse([line({ ref: 'next' }), line({ ref: 'main' })]);

    expect(events.map((event) => event.branch)).toEqual(['next']);
  });

  it('keeps a subject that contains the field separator', () => {
    const subject = `fix(query): Handle ${GIT_FIELD_SEPARATOR} in a header`;

    const events = parse([line({ subject })]);

    expect(events[0]?.subject).toBe(subject);
  });

  it('orders commits oldest first', () => {
    const events = parse([
      line({ sha: 'newer', authored: '2026-08-11T16:00:00+02:00' }),
      line({ sha: 'older', authored: '2026-08-11T09:00:00+02:00' }),
    ]);

    expect(events.map((event) => event.sha)).toEqual(['older', 'newer']);
  });

  it('drops a commit authored outside the window, which is what a rebase produces', () => {
    const events = parseGitLog({
      repoPath: REPO,
      output: [
        line({ sha: 'rebased-today', authored: '2026-08-04T11:00:00+02:00' }),
        line({ sha: 'authored-today', authored: '2026-08-11T11:00:00+02:00' }),
      ].join('\n'),
      window: { from: new Date('2026-08-11T00:00:00+02:00'), to: new Date('2026-08-11T23:59:59+02:00') },
    });

    expect(events.map((event) => event.sha)).toEqual(['authored-today']);
  });

  it('skips a malformed line rather than failing the scan', () => {
    const events = parse(['', 'only-a-sha', line({ authored: 'not a date', sha: 'bad' }), line({ sha: 'good' })]);

    expect(events.map((event) => event.sha)).toEqual(['good']);
  });
});
