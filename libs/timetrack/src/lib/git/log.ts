import { GitCommitEvent } from '../model/event';
import { GIT_FIELD_SEPARATOR, GitScanWindow, isGitLogHeader } from './format';

const FOREIGN_REF = /^refs\/(remotes|tags)\//;

/**
 * `%S` prints the ref the way the command line spelled it, so `--branches` yields a bare `next` while
 * `--all` would yield `refs/heads/next`. Both have to read as the same branch.
 */
const branchOf = (ref: string) => {
  const trimmed = ref.trim();

  return FOREIGN_REF.test(trimmed) ? undefined : trimmed.replace(/^refs\/heads\//, '') || undefined;
};

/**
 * Reads commits out of `git log` output formatted with `GIT_LOG_FORMAT`. A commit reachable from
 * several branches is reported once, under the first ref that reached it.
 *
 * Only local branches are kept: a remote-tracking ref is somebody else's push, and it carries the same
 * commits as the local branch anyway.
 *
 * `window` is what decides which commits belong to the day, and it is not the same filter `--since`
 * applies: that reads the commit date, while a commit is timed by its author date here. Rebasing
 * last week's work today gives it a commit date of today, and without this it would be logged today.
 *
 * `owners` names the checkout that holds each branch. Every worktree of a repository shares
 * `refs/heads/`, so one log covers all of them and the ref a commit was reached from is what says which
 * checkout it belongs to. A branch no checkout holds falls back to `repoPath`.
 *
 * `worktrees` names the checkout that holds a branch none of `owners` holds, which the commit carries
 * as its `worktree`.
 *
 * `arrived` names the commits this machine received rather than wrote, with when each arrived (see
 * `gitArrivedAt`). Such a commit is dated by its arrival, which is the only moment this machine took
 * part in it, and keeps its author date as `authoredAt`.
 *
 * The paths `--name-only` prints follow their own commit's header, so a commit this drops has to stay
 * the current one until the next header arrives. Otherwise its files join the commit before it.
 */
export const parseGitLog = (options: {
  repoPath: string;
  output: string;
  window?: GitScanWindow;
  owners?: ReadonlyMap<string, string>;
  worktrees?: ReadonlyMap<string, string>;
  arrived?: ReadonlyMap<string, Date>;
}): GitCommitEvent[] => {
  const events: GitCommitEvent[] = [];
  const seen = new Set<string>();
  let current: GitCommitEvent | null = null;

  for (const line of options.output.split('\n')) {
    if (!isGitLogHeader(line)) {
      const path = line.trim();

      if (current && path) current.paths = [...(current.paths ?? []), path];

      continue;
    }

    current = null;

    const [sha, authored, ref, ...rest] = line.split(GIT_FIELD_SEPARATOR);
    const branch = ref ? branchOf(ref) : undefined;
    const subject = rest.join(GIT_FIELD_SEPARATOR).trim();

    if (!sha || !authored || !branch || !subject || seen.has(sha)) continue;

    const authoredAt = new Date(authored);

    if (Number.isNaN(authoredAt.getTime())) continue;

    const arrivedAt = options.arrived?.get(sha);
    const at = arrivedAt ?? authoredAt;

    if (options.window && (at < options.window.from || at > options.window.to)) continue;

    seen.add(sha);

    const owner = options.owners?.get(branch);
    const worktree = owner ? undefined : options.worktrees?.get(branch);

    current = {
      at,
      source: 'git',
      kind: 'git-commit',
      repoPath: owner ?? options.repoPath,
      branch,
      sha,
      subject,
      ...(worktree ? { worktree } : {}),
      ...(arrivedAt ? { authoredAt } : {}),
    };
    events.push(current);
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
};
