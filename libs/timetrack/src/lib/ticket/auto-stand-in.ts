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

type BranchGroup = {
  repoPath: string;
  branch: string;
  workPath?: string;
  contexts: UnnamedContext[];
  observedMs: number;
};

/**
 * One group per piece of work a checkout did: its branch, and the directory its commits worked in
 * where the branch names no piece of work of its own.
 *
 * A checkout with no branch to report is left out. Its work stays unnamed until the user names it:
 * the only placeholder that could be opened for it would cover the whole checkout, which is the grain
 * this exists to stop.
 *
 * `refs/heads/next` and `next` are the same branch, so the key is the stripped name and that is what
 * the rule carries — `matchAttributionRule` strips both sides before it compares them.
 */
const groupByWork = (contexts: readonly UnnamedContext[]) => {
  const groups = new Map<string, BranchGroup>();

  for (const unnamed of contexts) {
    const repoPath = unnamed.context.repoPath;
    const branch = stripRefPrefix(unnamed.context.branch ?? '');
    const workPath = unnamed.context.workPath;

    if (!repoPath || !branch) continue;

    const key = `${repoPath}@${branch}#${workPath ?? ''}`;
    const group = groups.get(key) ?? { repoPath, branch, workPath, contexts: [], observedMs: 0 };

    group.contexts.push(unnamed);
    group.observedMs += unnamed.observedMs;
    groups.set(key, group);
  }

  return [...groups.values()].sort(
    (left, right) =>
      left.repoPath.localeCompare(right.repoPath) ||
      left.branch.localeCompare(right.branch) ||
      (left.workPath ?? '').localeCompare(right.workPath ?? ''),
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
const alreadyAnswered = (options: {
  repoPath: string;
  branch: string;
  workPath?: string;
  rules: readonly AttributionRule[];
}) =>
  options.rules.some(
    (rule) =>
      rule.repoPath === options.repoPath &&
      (!rule.branch || stripRefPrefix(rule.branch) === options.branch) &&
      (!rule.workPath || rule.workPath === options.workPath),
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
const alreadyWaiting = (options: {
  repoPath: string;
  branch: string;
  workPath?: string;
  standIns: readonly StandIn[];
}) =>
  options.standIns.some(
    (standIn) =>
      standIn.state === 'open' &&
      standIn.openedFor === options.repoPath &&
      (!standIn.openedForBranch || standIn.openedForBranch === options.branch) &&
      (!standIn.openedForWorkPath || standIn.openedForWorkPath === options.workPath),
  );

type AutoStandInOptions = {
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
};

/** Why the stand-in pass opened a placeholder for a piece of work, or why it left the work unnamed. */
export type AutoStandInVerdict =
  | 'opens'
  | 'no-repo-roots'
  | 'no-checkout'
  | 'no-branch'
  | 'below-floor'
  | 'base-branch'
  | 'not-a-checkout'
  | 'offered'
  | 'refused'
  | 'waiting'
  | 'answered'
  | 'no-project-link';

/** One piece of work the stand-in pass looked at, and what it decided. */
export type AutoStandInDecision = {
  repoPath?: string;
  branch?: string;
  workPath?: string;
  appId?: string;
  observedMs: number;
  verdict: AutoStandInVerdict;
};

const verdictOf = (
  options: Omit<AutoStandInOptions, 'day' | 'now' | 'unattributed'> & { group: BranchGroup; roots: readonly string[] },
) => {
  const { group, roots } = options;
  const { repoPath, branch, workPath } = group;
  const base = new Set(
    [options.config.baseBranches.development, options.config.baseBranches.production].map(stripRefPrefix),
  );

  if (group.observedMs < (options.minObservedMs ?? DEFAULT_MIN_AUTO_STAND_IN_MS))
    return { verdict: 'below-floor' as const };
  if (base.has(branch) && !workPath) return { verdict: 'base-branch' as const };
  if (!isCheckout({ repoPath, roots })) return { verdict: 'not-a-checkout' as const };
  if (options.offeredCheckouts.includes(repoPath)) return { verdict: 'offered' as const };
  if (isStandInRefused({ repoPath, branch, workPath, refused: options.refused }))
    return { verdict: 'refused' as const };
  if (alreadyWaiting({ repoPath, branch, workPath, standIns: options.standIns }))
    return { verdict: 'waiting' as const };
  if (alreadyAnswered({ repoPath, branch, workPath, rules: options.rules })) return { verdict: 'answered' as const };

  const first = group.contexts[0];
  const link = first && matchProjectLink({ context: first.context, links: options.links });

  return link?.target.kind === 'project'
    ? { verdict: 'opens' as const, projectKey: link.target.projectKey }
    : { verdict: 'no-project-link' as const };
};

/**
 * What the stand-in pass decides for each piece of work a day left unnamed, including the work it never
 * groups: a context on no checkout and a checkout on no branch.
 */
export const autoStandInDecisions = (
  options: Omit<AutoStandInOptions, 'day' | 'now' | 'unattributed'>,
): AutoStandInDecision[] => {
  const ungrouped = new Map<string, AutoStandInDecision>();

  for (const unnamed of options.contexts) {
    const { repoPath, branch, appId } = unnamed.context;

    if (repoPath && stripRefPrefix(branch ?? '')) continue;

    const key = repoPath ? `repo:${repoPath}` : `app:${appId ?? ''}`;
    const held = ungrouped.get(key) ?? {
      ...(repoPath ? { repoPath } : { appId }),
      observedMs: 0,
      verdict: repoPath ? ('no-branch' as const) : ('no-checkout' as const),
    };

    held.observedMs += unnamed.observedMs;
    ungrouped.set(key, held);
  }

  const roots = options.repoRoots;
  const grouped = groupByWork(options.contexts).map((group): AutoStandInDecision => ({
    repoPath: group.repoPath,
    branch: group.branch,
    ...(group.workPath ? { workPath: group.workPath } : {}),
    observedMs: group.observedMs,
    verdict: roots ? verdictOf({ ...options, group, roots }).verdict : 'no-repo-roots',
  }));

  return [...grouped, ...ungrouped.values()];
};

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
 * A base branch gets one only when a directory says which piece of work it was. Work on a base branch
 * is otherwise integration rather than a piece of work, and a placeholder for the branch itself would
 * take every later branch of the checkout with it — which is what `workPath` avoids: the placeholder
 * covers one directory of the base branch and nothing else.
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
export const autoStandIns = (options: AutoStandInOptions): AutoStandIn[] => {
  const roots = options.repoRoots;

  if (!roots) return [];

  const opened: AutoStandIn[] = [];

  for (const group of groupByWork(options.contexts)) {
    const { repoPath, branch, workPath } = group;
    const decided = verdictOf({ ...options, group, roots });

    if (decided.verdict !== 'opens') continue;

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
      projectKey: decided.projectKey,
      author: 'app',
      openedFor: group.repoPath,
      openedForBranch: group.branch,
      openedForWorkPath: workPath,
      key: [describeProjectLink({ path: repoPath }), branch, workPath].filter(Boolean).join('-'),
    });

    opened.push({
      standIn,
      draft,
      observedMs: group.observedMs,
      rule: {
        id: `repo:${repoPath}@${branch}${workPath ? `#${workPath}` : ''}#${options.now.getTime()}`,
        repoPath,
        branch,
        workPath,
        target: { kind: 'stand-in', standInId: standIn.id },
        author: 'app',
        createdAt: options.now,
      },
    });
  }

  return opened;
};
