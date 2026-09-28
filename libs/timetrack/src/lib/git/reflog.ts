import { GitCheckoutEvent } from '../model/event';
import { GitScanWindow } from './format';
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
