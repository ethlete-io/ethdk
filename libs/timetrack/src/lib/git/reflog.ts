import { GitCheckoutEvent } from '../model/event';
import { GIT_FIELD_SEPARATOR, GitScanWindow } from './format';

const SELECTOR = /^HEAD@\{(.+)\}$/;
const CHECKOUT = /^checkout: moving from .+ to (.+)$/;

/**
 * A detached checkout records the object name where a branch would be. Nothing resolves refs here, so a
 * bare hex name is read as a commit rather than a branch — the cost is a branch someone named in hex.
 */
const OBJECT_NAME = /^[0-9a-f]{7,40}$/;

/**
 * Reads branch switches out of `git reflog show` output. This is the reconcile path: the reflog holds
 * the switches that happened while the app was not watching, with their real timestamps.
 *
 * Only `checkout: moving from … to …` counts. A rebase's or a pull's internal checkouts are tooling
 * moving HEAD around, not the user changing what they work on.
 *
 * `window` keeps a rescan from re-emitting what the store already has.
 */
export const parseGitReflog = (options: {
  repoPath: string;
  output: string;
  window?: GitScanWindow;
}): GitCheckoutEvent[] => {
  const events: GitCheckoutEvent[] = [];

  for (const line of options.output.split('\n')) {
    const [selector, subject] = line.split(GIT_FIELD_SEPARATOR);
    const stamp = selector ? SELECTOR.exec(selector.trim())?.[1] : undefined;
    const branch = subject ? CHECKOUT.exec(subject.trim())?.[1] : undefined;

    if (!stamp || !branch || OBJECT_NAME.test(branch)) continue;

    const at = new Date(stamp);

    if (Number.isNaN(at.getTime())) continue;
    if (options.window && (at < options.window.from || at > options.window.to)) continue;

    events.push({ at, source: 'git', kind: 'git-checkout', repoPath: options.repoPath, branch });
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
};
