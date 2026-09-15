import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { WorkGroup } from '../rows/merge';
import { AttributionRule, UnnamedContext } from '../model/attribution';
import { repoRootOf } from '../model/context';
import { TimetrackProjectLink, describeProjectLink, matchProjectLink } from '../model/project-link';
import { StandIn, openStandIn } from '../model/stand-in';
import { TicketDraft, draftRepoTicket } from './draft';

/**
 * How much unnamed time in one checkout is worth a placeholder.
 *
 * A stray five minutes in a checkout is noise, and a placeholder for it is a row the user has to
 * answer later for nothing. Fifteen minutes is the smallest stretch this app books at all.
 */
export const DEFAULT_MIN_AUTO_STAND_IN_MS = 15 * 60_000;

/** A stand-in the app opened, with the rule that makes it cover the checkout on every later day. */
export type AutoStandIn = {
  standIn: StandIn;
  rule: AttributionRule;
  /** The draft the name and the description came from, so the resolve flow can show what it drew on. */
  draft: TicketDraft;
  observedMs: number;
};

type RepoGroup = { repoPath: string; contexts: UnnamedContext[]; observedMs: number };

const groupByRepo = (contexts: readonly UnnamedContext[]) => {
  const groups = new Map<string, RepoGroup>();

  for (const unnamed of contexts) {
    const repoPath = unnamed.context.repoPath;

    if (!repoPath) continue;

    const group = groups.get(repoPath) ?? { repoPath, contexts: [], observedMs: 0 };

    group.contexts.push(unnamed);
    group.observedMs += unnamed.observedMs;
    groups.set(repoPath, group);
  }

  return [...groups.values()].sort((left, right) => left.repoPath.localeCompare(right.repoPath));
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
 * A checkout an answer already stands for, whether or not this day's contexts show it.
 *
 * Any checkout-wide rule counts, not only one pointing at a stand-in. `withAttributionRule` replaces
 * the rule naming the same context, so a placeholder opened here would delete the issue the user named
 * the checkout with — and the naming offer that would have named it again reads a rule as an answer,
 * so it never comes back either.
 */
const alreadyAnswered = (options: { repoPath: string; rules: readonly AttributionRule[] }) =>
  options.rules.some((rule) => rule.repoPath === options.repoPath && !rule.branch);

/**
 * Opens a placeholder for every linked checkout whose work no rule could name, one per checkout.
 *
 * This is the app deciding that work exists, never that it belongs to an issue. A checkout Jira holds
 * no ticket for produces `Not yet named` bands day after day, and a question the user has to go
 * looking for is a question nobody answers — so the placeholder is written, and the user resolves it
 * to a real issue later, which `resolveStandIn` does in one rewrite.
 *
 * The grain is the checkout, so yesterday's and today's bands of the same repository land on the same
 * stand-in and one resolve books both days. That is why the rule carries no branch.
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
  /** The local day key the placeholders open on. */
  day: string;
  now: Date;
  minObservedMs?: number;
}): AutoStandIn[] => {
  const roots = options.repoRoots;

  if (!roots) return [];

  const minObservedMs = options.minObservedMs ?? DEFAULT_MIN_AUTO_STAND_IN_MS;
  const opened: AutoStandIn[] = [];

  for (const group of groupByRepo(options.contexts)) {
    if (group.observedMs < minObservedMs) continue;
    if (!isCheckout({ repoPath: group.repoPath, roots })) continue;
    if (options.offeredCheckouts.includes(group.repoPath)) continue;
    if (alreadyAnswered({ repoPath: group.repoPath, rules: options.rules })) continue;

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
      key: describeProjectLink({ path: group.repoPath }),
    });

    opened.push({
      standIn,
      draft,
      observedMs: group.observedMs,
      rule: {
        id: `repo:${group.repoPath}#${options.now.getTime()}`,
        repoPath: group.repoPath,
        target: { kind: 'stand-in', standInId: standIn.id },
        author: 'app',
        createdAt: options.now,
      },
    });
  }

  return opened;
};
