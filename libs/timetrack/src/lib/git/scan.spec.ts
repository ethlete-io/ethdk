import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { GIT_FIELD_SEPARATOR } from './format';
import { GitRepoScan, GitScanResult, collectGitEvents$ } from './scan';

const REPO = '/home/tom/dev/fut-frontend';
const WINDOW = { from: new Date('2026-08-11T00:00:00+02:00'), to: new Date('2026-08-11T23:59:59+02:00') };

const REFLOG = [
  `HEAD@{2026-08-11T09:00:00+02:00}${GIT_FIELD_SEPARATOR}checkout: moving from next to feat/FIP-2177-user-management`,
].join('\n');

const LOG = [
  ['sha1', '2026-08-11T10:00:00+02:00', 'feat/FIP-2177-user-management', 'feat(user): Add the form'].join(
    GIT_FIELD_SEPARATOR,
  ),
].join('\n');

const WORKTREES = (worktree: string) =>
  [
    `worktree ${REPO}`,
    'HEAD 1111111111111111111111111111111111111111',
    'branch refs/heads/next',
    '',
    `worktree ${worktree}`,
    'HEAD 2222222222222222222222222222222222222222',
    'branch refs/heads/wt/components-e2e',
  ].join('\n');

const SHARED_LOG = [
  ['sha1', '2026-08-11T10:00:00+02:00', 'next', 'feat(repo): Land the thing'].join(GIT_FIELD_SEPARATOR),
  ['sha2', '2026-08-11T11:00:00+02:00', 'wt/components-e2e', 'test(repo): Add the suite'].join(GIT_FIELD_SEPARATOR),
].join('\n');

const runner = (outputs: (spec: ProcessSpec) => Partial<{ code: number; stdout: string; stderr: string }>) => {
  const specs: ProcessSpec[] = [];
  const processes: TimetrackProcessRunner = {
    run$: vi.fn((spec: ProcessSpec) => {
      specs.push(spec);

      return of({ code: 0, stdout: '', stderr: '', ...outputs(spec) });
    }),
  };

  return { processes, specs };
};

const byCommand = (spec: ProcessSpec) =>
  spec.args[0] === 'reflog' ? { stdout: REFLOG } : { stdout: spec.args[0] === 'log' ? LOG : '' };

const scan = (options: { repos: GitRepoScan[]; outputs?: (spec: ProcessSpec) => Partial<GitProcessOutput> }) => {
  const { processes, specs } = runner(options.outputs ?? byCommand);
  let result: GitScanResult | undefined;

  collectGitEvents$({ processes, repos: options.repos }).subscribe((value) => (result = value));

  return { result, specs };
};

type GitProcessOutput = { code: number; stdout: string; stderr: string };

const REPOS: GitRepoScan[] = [{ path: REPO, window: WINDOW }];

describe('collectGitEvents$', () => {
  it('reads switches and commits from one repository', () => {
    const { result } = scan({ repos: REPOS });

    expect(result?.events.map((event) => event.kind)).toEqual(['git-checkout', 'git-commit']);
    expect(result?.failures).toEqual([]);
  });

  it('runs git in the repository, never with a path argument', () => {
    const { specs } = scan({ repos: REPOS });

    expect(specs.every((spec) => spec.command === 'git' && spec.cwd === REPO)).toBe(true);
    expect(specs.some((spec) => spec.args.includes('-C'))).toBe(false);
  });

  it('bounds the commit query to the window and to local branches', () => {
    const { specs } = scan({ repos: REPOS });
    const log = specs.find((spec) => spec.args[0] === 'log');

    expect(log?.args).toContain('--branches');
    expect(log?.args).toContain('--no-merges');
    expect(log?.args).toContain(`--since=${WINDOW.from.toISOString()}`);
    expect(log?.args).toContain(`--until=${WINDOW.to.toISOString()}`);
    expect(log?.args.some((arg) => arg.startsWith('--author='))).toBe(false);
  });

  it('restricts commits to the configured author', () => {
    const { specs } = scan({ repos: [{ path: REPO, window: WINDOW, author: 'trb@braune-digital.com' }] });
    const log = specs.find((spec) => spec.args[0] === 'log');

    expect(log?.args).toContain('--author=trb@braune-digital.com');
  });

  it('merges several repositories into one timeline, oldest first', () => {
    const other = '/home/tom/dev/ethlete-sdk';
    const { result } = scan({
      repos: [
        { path: REPO, window: WINDOW },
        { path: other, window: WINDOW },
      ],
      outputs: (spec) =>
        spec.cwd === other
          ? {
              stdout:
                spec.args[0] === 'reflog'
                  ? `HEAD@{2026-08-11T08:00:00+02:00}${GIT_FIELD_SEPARATOR}checkout: moving from main to next`
                  : '',
            }
          : byCommand(spec),
    });

    expect(result?.events.map((event) => event.at.toISOString())).toEqual([
      new Date('2026-08-11T08:00:00+02:00').toISOString(),
      new Date('2026-08-11T09:00:00+02:00').toISOString(),
      new Date('2026-08-11T10:00:00+02:00').toISOString(),
    ]);
  });

  it('reports a repository that is gone instead of failing the scan', () => {
    const { result } = scan({
      repos: [
        { path: '/home/tom/dev/moved-away', window: WINDOW },
        { path: REPO, window: WINDOW },
      ],
      outputs: (spec) =>
        spec.cwd === REPO ? byCommand(spec) : { code: 128, stderr: 'fatal: cannot change to /home/tom/dev/moved-away' },
    });

    expect(result?.failures).toHaveLength(3);
    expect(result?.failures[0]?.stderr).toContain('cannot change to');
    expect(result?.events.map((event) => event.kind)).toEqual(['git-checkout', 'git-commit']);
  });

  it('keeps what the other command returned when one of the two fails', () => {
    const { result } = scan({
      repos: REPOS,
      outputs: (spec) => (spec.args[0] === 'reflog' ? { code: 1, stderr: 'no reflog' } : byCommand(spec)),
    });

    expect(result?.events.map((event) => event.kind)).toEqual(['git-commit']);
    expect(result?.failures.map((failure) => failure.args[0])).toEqual(['reflog']);
  });

  it('runs nothing when no repository is configured', () => {
    const { result, specs } = scan({ repos: [] });

    expect(result).toEqual({ events: [], failures: [] });
    expect(specs).toEqual([]);
  });
  it('reads the commits of a repository and its worktree once, in the checkout that holds each branch', () => {
    const worktree = `${REPO}-e2e`;
    const { result, specs } = scan({
      repos: [
        { path: REPO, window: WINDOW },
        { path: worktree, window: WINDOW },
      ],
      outputs: (spec) =>
        spec.args[0] === 'worktree'
          ? { stdout: WORKTREES(worktree) }
          : spec.args[0] === 'log'
            ? { stdout: SHARED_LOG }
            : { stdout: '' },
    });

    expect(specs.filter((spec) => spec.args[0] === 'log')).toHaveLength(1);
    expect(result?.events.map((event) => (event.kind === 'git-commit' ? event.repoPath : null))).toEqual([
      REPO,
      worktree,
    ]);
  });

  it('reads the shared log in the main checkout, whichever order the roots are configured in', () => {
    const worktree = `${REPO}-e2e`;
    const { specs } = scan({
      repos: [
        { path: worktree, window: WINDOW },
        { path: REPO, window: WINDOW },
      ],
      outputs: (spec) => (spec.args[0] === 'worktree' ? { stdout: WORKTREES(worktree) } : { stdout: '' }),
    });

    expect(specs.find((spec) => spec.args[0] === 'log')?.cwd).toBe(REPO);
  });

  it('reads the reflog of every checkout, because a worktree switches its own head', () => {
    const worktree = `${REPO}-e2e`;
    const { specs } = scan({
      repos: [
        { path: REPO, window: WINDOW },
        { path: worktree, window: WINDOW },
      ],
      outputs: (spec) => (spec.args[0] === 'worktree' ? { stdout: WORKTREES(worktree) } : { stdout: '' }),
    });

    expect(specs.filter((spec) => spec.args[0] === 'reflog').map((spec) => spec.cwd)).toEqual([REPO, worktree]);
  });

  it('keeps a branch no configured checkout holds on the repository the log was read in', () => {
    const worktree = `${REPO}-e2e`;
    const { result } = scan({
      repos: [{ path: REPO, window: WINDOW }],
      outputs: (spec) =>
        spec.args[0] === 'worktree'
          ? { stdout: WORKTREES(worktree) }
          : spec.args[0] === 'log'
            ? { stdout: SHARED_LOG }
            : { stdout: '' },
    });

    expect(result?.events.map((event) => (event.kind === 'git-commit' ? event.repoPath : null))).toEqual([REPO, REPO]);
  });

  it('scans a checkout on its own when the worktree list fails', () => {
    const { result, specs } = scan({
      repos: REPOS,
      outputs: (spec) => (spec.args[0] === 'worktree' ? { code: 1, stderr: 'unknown subcommand' } : byCommand(spec)),
    });

    expect(specs.filter((spec) => spec.args[0] === 'log')).toHaveLength(1);
    expect(result?.events.map((event) => event.kind)).toEqual(['git-checkout', 'git-commit']);
    expect(result?.failures.map((failure) => failure.args[0])).toEqual(['worktree']);
  });
});
