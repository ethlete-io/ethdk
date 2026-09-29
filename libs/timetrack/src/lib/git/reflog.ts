import { GitBranchUpdateEvent, GitCheckoutEvent } from '../model/event';
import { GIT_FIELD_SEPARATOR, GitScanWindow } from './format';
import { branchOrNothing, gitBranchSwitchesIn } from './reflog-switch';

/**
 * Reads branch switches out of `git reflog show` output. This is the reconcile path: the reflog holds
 * the switches that happened while the app was not watching, with their real timestamps.
 *
 * `window` keeps a rescan from re-emitting what the store already has.
 */
export const parseGitReflog = (options: {
  repoPath: string;
  output: string;
  window?: GitScanWindow;
}): GitCheckoutEvent[] =>
  gitBranchSwitchesIn(options.output).flatMap(({ at, to }): GitCheckoutEvent[] => {
    const branch = branchOrNothing(to);

    if (!branch) return [];
    if (options.window && (at < options.window.from || at > options.window.to)) return [];

    return [{ at, source: 'git', kind: 'git-checkout', repoPath: options.repoPath, branch }];
  });

const BRANCH_SELECTOR = /^(.+)@\{(.+)\}$/;

/**
 * Reads the moves of local branches out of `git reflog show --branches` output. The `HEAD` entries
 * are skipped, since `parseGitReflog` reads those, and so is a plain commit, which `parseGitLog`
 * reads with its subject.
 */
export const parseGitBranchReflog = (options: {
  repoPath: string;
  output: string;
  window?: GitScanWindow;
  /** Which checkout holds each branch; a branch missing here stays on `repoPath`. */
  owners?: ReadonlyMap<string, string>;
}): GitBranchUpdateEvent[] =>
  options.output.split('\n').flatMap((line): GitBranchUpdateEvent[] => {
    const [selector, action] = line.split(GIT_FIELD_SEPARATOR);
    const parts = selector ? BRANCH_SELECTOR.exec(selector.trim()) : null;
    const branch = parts?.[1];
    const at = parts?.[2] ? new Date(parts[2]) : undefined;

    if (!branch || branch === 'HEAD' || !at || Number.isNaN(at.getTime()) || action === undefined) return [];
    if (action.startsWith('commit: ')) return [];
    if (options.window && (at < options.window.from || at > options.window.to)) return [];

    const repoPath = options.owners?.get(branch) ?? options.repoPath;

    return [{ at, source: 'git', kind: 'git-branch-update', repoPath, branch, action: action.trim() }];
  });
