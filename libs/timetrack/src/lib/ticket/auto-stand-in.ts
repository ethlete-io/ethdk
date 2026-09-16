import { GitFlowConfig, stripRefPrefix } from '@ethlete/agent-rules/git-flow';
import { WorkGroup } from '../rows/merge';
import { AttributionRule, UnnamedContext } from '../model/attribution';
import { repoRootOf } from '../model/context';
import { TimetrackProjectLink, describeProjectLink, matchProjectLink } from '../model/project-link';
import { StandIn, StandInRefusal, isStandInRefused, openStandIn } from '../model/stand-in';
import { TicketDraft, draftRepoTicket } from './draft';

/**
 * How much unnamed time on one branch is worth a placeholder.
 *
 * A stray five minutes on a branch is noise, and a placeholder for it is a row the user has to
 * answer later for nothing. Fifteen minutes is the smallest stretch this app books at all.
 */
export const DEFAULT_MIN_AUTO_STAND_IN_MS = 15 * 60_000;

/** A stand-in the app opened, with the rule that makes it cover the branch on every later day. */
export type AutoStandIn = {
  standIn: StandIn;
  rule: AttributionRule;
  /** The draft the name and the description came from, so the resolve flow can show what it drew on. */
  draft: TicketDraft;
  observedMs: number;
};

type BranchGroup = { repoPath: string; branch: string; contexts: UnnamedContext[]; observedMs: number };

/**
 * One group per branch of a checkout, which is one piece of work.
 *
 * A checkout with no branch to report is left out. Its work stays unnamed until the user names it:
 * the only placeholder that could be opened for it would cover the whole checkout, which is the grain
 * this exists to stop.
 *
 * `refs/heads/next` and `next` are the same branch, so the key is the stripped name and that is what
 * the rule carries — `matchAttributionRule` strips both sides before it compares them.
 */
const groupByBranch = (contexts: readonly UnnamedContext[]) => {
  const groups = new Map<string, BranchGroup>();

  for (const unnamed of contexts) {
    const repoPath = unnamed.context.repoPath;
    const branch = stripRefPrefix(unnamed.context.branch ?? '');

    if (!repoPath || !branch) continue;

    const key = `${repoPath}@${branch}`;
    const group = groups.get(key) ?? { repoPath, branch, contexts: [], observedMs: 0 };

    group.contexts.push(unnamed);
    group.observedMs += unnamed.observedMs;
    groups.set(key, group);
  }

  return [...groups.values()].sort(
    (left, right) => left.repoPath.localeCompare(right.repoPath) || left.branch.localeCompare(right.branch),
  );
};

/**
 * Whether the path is a checkout of its own, rather than a directory inside one.
 *
 * An agent session reports the directory it was started in, which is often deep inside a checkout, and
 * a project link covers every path under it — so without this a subdirectory qualifies and opens a
 * second placeholder for work the checkout's own placeholder already holds.
 */
const isCheckout = (options: { repoPath: string; roots: readonly string[] }) =>
  repoRootOf({ path: options.repoPath, roots: options.roots }) === options.repoPath;

/**
 * An answer that already stands for the branch, whether or not this day's contexts show it.
 *
 * Any rule counts, not only one pointing at a stand-in. `withAttributionRule` replaces the rule
 * naming the same context, so a placeholder opened here would delete the issue the user named the
 * work with — and the naming offer that would have named it again reads a rule as an answer, so it
 * never comes back either. A checkout-wide rule answers every branch of the checkout.
 */
const alreadyAnswered = (options: { repoPath: string; branch: string; rules: readonly AttributionRule[] }) =>
  options.rules.some(
    (rule) => rule.repoPath === options.repoPath && (!rule.branch || stripRefPrefix(rule.branch) === options.branch),
  );

/**
 * A placeholder already waiting on the branch, read from the records rather than from the rules.
 *
 * The rules alone are not enough. A rule is replaced whenever the work gets another answer, so a pass
 * that ran while none was stored opened a second record and left the first in the waiting list for
 * good.
 *
 * A record opened before the grain was the branch carries no branch of its own and covers the whole
 * checkout, so it blocks every branch of it. Splitting one is the user's to ask for: it holds a name
 * and a day list drawn from work the split cannot divide.
 */
const alreadyWaiting = (options: { repoPath: string; branch: string; standIns: readonly StandIn[] }) =>
  options.standIns.some(
    (standIn) =>
      standIn.state === 'open' &&
      standIn.openedFor === options.repoPath &&
      (!standIn.openedForBranch || standIn.openedForBranch === options.branch),
  );

/**
 * Opens a placeholder for every branch of a linked checkout whose work no rule could name.
 *
 * This is the app deciding that work exists, never that it belongs to an issue. A checkout Jira holds
 * no ticket for produces `Not yet named` bands day after day, and a question the user has to go
 * looking for is a question nobody answers — so the placeholder is written, and the user resolves it
 * to a real issue later, which `resolveStandIn` does in one rewrite.
 *
 * The grain is the branch, because an issue is one piece of work and a checkout does several
 * unrelated pieces in one day. A checkout-wide placeholder drew itself over all of them and one
 * resolve named all of them after one ticket, with a name drafted from whichever piece came last.
 * Yesterday's and today's bands of the same branch still land on the same placeholder, so one resolve
 * books both days.
 *
 * A base branch gets none. Work on one is integration rather than a piece of work, so a placeholder
 * there would take every later branch of the checkout with it.
 *
 * Only a checkout with a `project` link qualifies. The link is what says the path is work at all and
 * which Jira project a ticket is filed in, so a placeholder opened without one has nowhere to go.
 *
 * Nothing opens until the host has answered which repositories exist. The day is cut before that
 * answer arrives, and a day cut without it gives every subdirectory an agent ran in its own stream —
 * so a pass that ran then would write permanent rules for paths that are not checkouts.
 *
 * A checkout the app can still offer a real issue for is left alone. The offer is read out of the
 * user's own Tempo history, it arrives later than the day does, and a placeholder written first both
 * replaces the rule it would have become and stops the offer ever being made again.
 */
export const autoStandIns = (options: {
  contexts: readonly UnnamedContext[];
  unattributed: readonly WorkGroup[];
  links: readonly TimetrackProjectLink[];
  rules: readonly AttributionRule[];
  config: GitFlowConfig;
  /**
   * The checkouts the host discovered, or nothing while the discovery has not answered yet. Nothing
   * opens until it has.
   */
  repoRoots: readonly string[] | null | undefined;
  /**
   * The checkouts the app can still offer a real issue for. A placeholder is the answer for work no
   * issue covers, so one that does is not work for a placeholder.
   */
  offeredCheckouts: readonly string[];
  /** Every placeholder the settings hold, so work already waiting on one gets no second. */
  standIns: readonly StandIn[];
  /** The work the user refused a placeholder for. It stays unnamed until they name it. */
  refused: readonly StandInRefusal[];
  /** The local day key the placeholders open on. */
  day: string;
  now: Date;
  minObservedMs?: number;
}): AutoStandIn[] => {
  const roots = options.repoRoots;

  if (!roots) return [];

  const minObservedMs = options.minObservedMs ?? DEFAULT_MIN_AUTO_STAND_IN_MS;
  const base = new Set(
    [options.config.baseBranches.development, options.config.baseBranches.production].map(stripRefPrefix),
  );
  const opened: AutoStandIn[] = [];

  for (const group of groupByBranch(options.contexts)) {
    if (group.observedMs < minObservedMs) continue;
    if (base.has(group.branch)) continue;
    if (!isCheckout({ repoPath: group.repoPath, roots })) continue;
    if (options.offeredCheckouts.includes(group.repoPath)) continue;
    if (isStandInRefused({ repoPath: group.repoPath, branch: group.branch, refused: options.refused })) continue;
    if (alreadyWaiting({ repoPath: group.repoPath, branch: group.branch, standIns: options.standIns })) continue;
    if (alreadyAnswered({ repoPath: group.repoPath, branch: group.branch, rules: options.rules })) continue;

    const first = group.contexts[0];
    const link = first && matchProjectLink({ context: first.context, links: options.links });

    if (link?.target.kind !== 'project') continue;

    const draft = draftRepoTicket({
      repoPath: group.repoPath,
      contexts: group.contexts,
      unattributed: options.unattributed,
      config: options.config,
    });
    const standIn = openStandIn({
      name: draft.summary,
      description: draft.description,
      day: options.day,
      now: options.now,
      projectKey: link.target.projectKey,
      author: 'app',
      openedFor: group.repoPath,
      openedForBranch: group.branch,
      key: `${describeProjectLink({ path: group.repoPath })}-${group.branch}`,
    });

    opened.push({
      standIn,
      draft,
      observedMs: group.observedMs,
      rule: {
        id: `repo:${group.repoPath}@${group.branch}#${options.now.getTime()}`,
        repoPath: group.repoPath,
        branch: group.branch,
        target: { kind: 'stand-in', standInId: standIn.id },
        author: 'app',
        createdAt: options.now,
      },
    });
  }

  return opened;
};
