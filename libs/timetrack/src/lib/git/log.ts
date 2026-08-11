import { GitCommitEvent } from '../model/event';
import { GIT_FIELD_SEPARATOR, GitScanWindow } from './format';

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
 * `window` is what decides which commits belong to the day, and it is not the same filter `--since` and
 * `--until` apply: those read the commit date, while a commit is timed by its author date here. Rebasing
 * last week's work today gives it a commit date of today, and without this it would be logged today.
 */
export const parseGitLog = (options: {
  repoPath: string;
  output: string;
  window?: GitScanWindow;
}): GitCommitEvent[] => {
  const events: GitCommitEvent[] = [];
  const seen = new Set<string>();

  for (const line of options.output.split('\n')) {
    const [sha, authored, ref, ...rest] = line.split(GIT_FIELD_SEPARATOR);
    const branch = ref ? branchOf(ref) : undefined;
    const subject = rest.join(GIT_FIELD_SEPARATOR).trim();

    if (!sha || !authored || !branch || !subject || seen.has(sha)) continue;

    const at = new Date(authored);

    if (Number.isNaN(at.getTime())) continue;
    if (options.window && (at < options.window.from || at > options.window.to)) continue;

    seen.add(sha);
    events.push({ at, source: 'git', kind: 'git-commit', repoPath: options.repoPath, branch, sha, subject });
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
};
