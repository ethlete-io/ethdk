import { AttributionRule, matchAttributionRule } from '../model/attribution';
import { TimetrackProjectLink, projectKeyFor } from '../model/project-link';
import { HistoricalWorklog, LoggedIssue } from '../model/recurrence';

/**
 * What the user's own Tempo history says a whole checkout's work is for.
 *
 * It is an offer and never a rule: the user made two decisions already — the checkout files into this
 * project, and nearly every hour of the project went to this one issue — and this only reads them back
 * as the answer they add up to. Writing it stays one deliberate click, so nothing here learns without
 * being told. See `AttributionRule`.
 */
export type RepoNamingOffer = {
  /** The checkout the offer names, which is the whole of what the rule it writes covers. */
  repoPath: string;
  /** The checkout's directory name, which is what a card calls it. */
  label: string;
  /** The project the checkout's link names. It is what narrowed the history down to one issue. */
  projectKey: string;
  issueKey: string;
  /** The newest description the history holds for the issue, so a card can say what it is. */
  summary: string;
  /** Distinct days of the span that logged against the issue. */
  days: number;
  loggedMs: number;
  /** How much of the project's logged time went to this one issue, from 0 to 1. */
  share: number;
  /**
   * The standing rules the offer replaces, because they donate this checkout's time to whatever else
   * was open. A branch rule wins over the repository rule the offer writes, so accepting one without
   * taking back the others writes a rule nothing ever reads.
   */
  supersedes: AttributionRule[];
};

/** One checkout a day saw, which is the unit an offer is about. */
export type NamedCheckout = {
  repoPath: string;
  /** Every branch the day saw the checkout on. Each one can carry a rule of its own. */
  branches: readonly string[];
  observedMs: number;
};

export type RepoNamingOptions = {
  /** Distinct days the issue must hold before a habit is a habit rather than one afternoon. */
  minDays: number;
  /** How much of the project's logged time must sit on the one issue, from 0 to 1. */
  minShare: number;
  /** How much the project must hold at all. Without it a single short worklog is a 100% share. */
  minProjectMs: number;
};

export const DEFAULT_REPO_NAMING_OPTIONS: RepoNamingOptions = {
  minDays: 3,
  minShare: 0.6,
  minProjectMs: 4 * 60 * 60_000,
};

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

type Tally = { issueKey: string; loggedMs: number; days: Set<string> };

/**
 * The issue that holds most of one project's logged time, and what the project logged in total.
 *
 * Ranking by time rather than by count is what keeps a project's standing task ahead of the twenty
 * small tickets beside it, each of which was logged more often and for far less.
 */
const dominantIssue = (options: { projectKey: string; worklogs: readonly HistoricalWorklog[] }) => {
  const prefix = `${options.projectKey}-`;
  const tallies = new Map<string, Tally>();
  let projectMs = 0;

  for (const worklog of options.worklogs) {
    if (!worklog.issueKey.startsWith(prefix)) continue;

    const tally = tallies.get(worklog.issueKey) ?? { issueKey: worklog.issueKey, loggedMs: 0, days: new Set<string>() };

    tally.loggedMs += worklog.durationMs;
    tally.days.add(dayKey(worklog.from));
    tallies.set(worklog.issueKey, tally);
    projectMs += worklog.durationMs;
  }

  const top = [...tallies.values()].sort((a, b) => b.loggedMs - a.loggedMs || a.issueKey.localeCompare(b.issueKey))[0];

  return top ? { top, projectMs } : undefined;
};

/**
 * Reads the checkout-wide answer out of decisions the user already made, for the checkouts a day saw.
 *
 * A repository whose branches carry no issue key is asked about again on every branch, and answering
 * per branch is the wrong shape when the whole checkout means one ticket. The project link says which
 * project the checkout files into; the user's own Tempo history says where that project's hours
 * actually went. Where the two agree strongly enough, the answer for the checkout is already on
 * record, and this states it.
 *
 * A checkout any rule already names an issue for produces nothing: it is answered, on that branch or
 * on all of them, and a proposal to overwrite a deliberate answer is not an offer. A checkout whose
 * rules only donate does produce one, and carries the rules it would replace.
 */
export const repoNamingOffers = (options: {
  checkouts: readonly NamedCheckout[];
  links: readonly TimetrackProjectLink[];
  rules: readonly AttributionRule[];
  /** The user's own worklogs over the history span, which is the whole of the evidence. */
  worklogs: readonly HistoricalWorklog[];
  /** The same span's issues, for the line a card shows under the key. */
  loggedIssues?: readonly LoggedIssue[];
  options?: Partial<RepoNamingOptions>;
}): RepoNamingOffer[] => {
  const { minDays, minShare, minProjectMs } = { ...DEFAULT_REPO_NAMING_OPTIONS, ...options.options };
  const summaries = new Map((options.loggedIssues ?? []).map((issue) => [issue.issueKey, issue.summary]));
  const offers: RepoNamingOffer[] = [];

  for (const checkout of options.checkouts) {
    const { repoPath } = checkout;

    if (!repoPath) continue;

    const contexts = checkout.branches.length
      ? checkout.branches.map((branch) => ({ repoPath, branch }))
      : [{ repoPath }];
    const matched = contexts.flatMap((context) => matchAttributionRule({ context, rules: options.rules })?.rule ?? []);

    if (matched.some((rule) => rule.target.kind !== 'donate')) continue;

    const projectKey = projectKeyFor({ context: { repoPath }, links: options.links });

    if (!projectKey) continue;

    const ranked = dominantIssue({ projectKey, worklogs: options.worklogs });

    if (!ranked || ranked.projectMs < minProjectMs) continue;

    const { top, projectMs } = ranked;
    const share = top.loggedMs / projectMs;

    if (top.days.size < minDays || share < minShare) continue;

    offers.push({
      repoPath,
      label: repoPath.split('/').filter(Boolean).pop() ?? repoPath,
      projectKey,
      issueKey: top.issueKey,
      summary: summaries.get(top.issueKey) ?? '',
      days: top.days.size,
      loggedMs: top.loggedMs,
      share,
      supersedes: [...new Map(matched.map((rule) => [rule.id, rule])).values()],
    });
  }

  return offers.sort((a, b) => b.loggedMs - a.loggedMs || a.repoPath.localeCompare(b.repoPath));
};
