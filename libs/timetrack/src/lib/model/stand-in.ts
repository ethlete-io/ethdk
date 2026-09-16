import { ActivityContext } from './block';
import { AttributionRule, NamingAuthor, matchAttributionRule, standInIdOf } from './attribution';

/**
 * Whether the work still waits for an issue. A resolved stand-in is kept rather than deleted: it is
 * what the undo reads, and its day list is the only record of which days a resolve made bookable.
 */
export type StandInState = 'open' | 'resolved';

/**
 * A name the user gave work that Jira does not hold yet.
 *
 * It takes bands the way an issue key does, across days and across checkouts, and it books nothing.
 * A band carries it in `standInId` and never in `issueKey`, so it stays shown, counted as covered and
 * never written. The contexts it covers live on attribution rules that point at the `id` here, which
 * is what makes a resolve one rewrite of those rules rather than a walk over every day. See ADR 0021.
 */
export type StandIn = {
  id: string;
  /** What the user called the work, in their own words. Free text, so it is masked before any send. */
  name: string;
  /**
   * What the ticket will say the work was, drafted from the day's own evidence. Free text, so it is
   * masked before any send.
   *
   * It is a draft and never a decision: the user rewrites it, and the resolve flow files it. A
   * stand-in the user named in one press has none, because one press writes no description.
   */
  description?: string;
  /** The Jira project the issue will be filed in, when a link or the user named one. */
  projectKey?: string;
  state: StandInState;
  /** The issue it resolved to. Absent while it is open. */
  issueKey?: string;
  /**
   * The checkout the app opened it for. Absent on one the user wrote, which stands for work rather
   * than for a path.
   *
   * The rule that names it holds the same path, but a rule is replaced whenever the checkout gets
   * another answer, so the rule cannot be relied on to say which checkout a record came from.
   */
  openedFor?: string;
  /**
   * The branch of `openedFor` the app opened it for. Absent on one the user wrote, and on one the app
   * opened while the grain was the whole checkout.
   *
   * Its absence is what tells the two apart, so a checkout still holding a wide record gets no second
   * placeholder per branch beside it.
   */
  openedForBranch?: string;
  /**
   * The branches its own bands were drawn on, collected as each day is drawn, apart from a base
   * branch. A base branch is integration work rather than one piece of work.
   *
   * A placeholder the app opens now names its own branch, so this repeats that branch and the resolve
   * changes nothing. It is what repairs a record opened while the grain was the whole checkout: an
   * issue is one piece of work, so the resolve cuts the rule back to these branches. Without them a
   * checkout-wide grain survives onto a real key and names every later branch after work it never
   * covered.
   *
   * Collected while the placeholder waits rather than read at the resolve: it is what the rule may
   * still name, and work done after the resolve was never this issue.
   */
  heldOn?: string[];
  /**
   * The rules the resolve rewrote, so the undo can point exactly those back and no rule that named the
   * same issue on its own is dragged along. Written by the resolve and cleared by the undo.
   */
  resolvedRuleIds?: string[];
  /**
   * The local day keys that hold bands of it, oldest first.
   *
   * Stored rather than recomputed: `collected_event` is pruned by retention, and a stand-in open past
   * that window cannot be replayed — which is exactly the one that waited longest.
   */
  days: string[];
  author: NamingAuthor;
  createdAt: Date;
};

const standInId = (options: { now: Date; key?: string }) => {
  const key = (options.key ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return key ? `stand-in:${options.now.getTime()}:${key}` : `stand-in:${options.now.getTime()}`;
};

/**
 * Opens a stand-in for work Jira does not hold yet.
 *
 * The id is derived from `now` rather than generated, so the whole act is one pure function the agent
 * endpoint and the card can both call and a spec can read back. `days` starts with the day the user
 * pressed on: a resolve names the days it made bookable from this list, and `collected_event` is
 * pruned long before a slow stand-in is answered.
 */
export const openStandIn = (options: {
  name: string;
  /** The local day key the work was named on. */
  day: string;
  now: Date;
  description?: string;
  projectKey?: string;
  author?: NamingAuthor;
  /** The checkout the app opened it for, when the app is what opened it. */
  openedFor?: string;
  /** The branch of that checkout the app opened it for. */
  openedForBranch?: string;
  /**
   * Tells apart two stand-ins opened in the same millisecond, which is what one pass over a day's
   * checkouts does. Anything but letters and digits is dropped, so an id stays a readable key.
   */
  key?: string;
}): StandIn => ({
  id: standInId(options),
  name: options.name.trim(),
  ...(options.description?.trim() ? { description: options.description.trim() } : {}),
  ...(options.projectKey ? { projectKey: options.projectKey } : {}),
  ...(options.openedFor ? { openedFor: options.openedFor } : {}),
  ...(options.openedForBranch ? { openedForBranch: options.openedForBranch } : {}),
  state: 'open',
  days: [options.day],
  author: options.author ?? 'user',
  createdAt: options.now,
});

/**
 * Work the user refused a placeholder for, by deleting one the app opened.
 *
 * Without `branch` it refuses the whole checkout, which is what an entry written while the grain was
 * the checkout means and what a delete of such a record still writes.
 */
export type StandInRefusal = { repoPath: string; branch?: string };

/**
 * Whether the user refused a placeholder for this branch of this checkout.
 *
 * A refusal of the whole checkout covers every branch of it, so a user who wants no placeholder at
 * all from a repository is not asked to refuse each branch in turn.
 */
export const isStandInRefused = (options: { repoPath: string; branch?: string; refused: readonly StandInRefusal[] }) =>
  options.refused.some(
    (entry) => entry.repoPath === options.repoPath && (!entry.branch || entry.branch === options.branch),
  );

/** The stand-ins still waiting on a ticket, newest first, which is what a picker offers. */
export const openStandIns = (standIns: readonly StandIn[]) =>
  standIns.filter((standIn) => standIn.state === 'open').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

/** The stand-in with this id, or nothing when a rule points at one that was deleted. */
export const findStandIn = (options: { id: string; standIns: readonly StandIn[] }) =>
  options.standIns.find((standIn) => standIn.id === options.id);

/**
 * The stand-in covering a context, read through the narrowest rule that matches it.
 *
 * A rule naming an issue or donating its time wins over a wider stand-in rule exactly as it wins over
 * any other, so this answers nothing where a more specific rule already did.
 */
export const matchStandIn = (options: {
  context: ActivityContext;
  rules: readonly AttributionRule[];
  standIns: readonly StandIn[];
}): StandIn | undefined => {
  const match = matchAttributionRule({ context: options.context, rules: options.rules });
  const id = match && standInIdOf(match.rule);

  return id ? findStandIn({ id, standIns: options.standIns }) : undefined;
};

/** The days the stand-in already covers, with `day` in them. Ordered, so a list reads oldest first. */
export const standInDays = (options: { standIn: Pick<StandIn, 'days'>; day: string }) =>
  [...new Set([...options.standIn.days, options.day])].sort();

/**
 * The branches the stand-in has held, with the ones a day just drew added. First seen first, so the
 * rules a resolve writes read in the order the work happened.
 *
 * A base branch is dropped. Work on one is integration rather than a piece of work, so a rule naming
 * it would hand every later branch of the checkout to whichever issue the placeholder became.
 */
export const standInBranches = (options: {
  standIn: Pick<StandIn, 'heldOn'>;
  branches: readonly string[];
  baseBranches: readonly string[];
}) => {
  const base = new Set(options.baseBranches);

  return [...new Set([...(options.standIn.heldOn ?? []), ...options.branches])].filter(
    (branch) => !!branch && !base.has(branch),
  );
};

/**
 * Whether a resolve may still be undone.
 *
 * Once a day the stand-in held has reached Tempo, the worklog there carries the issue key and nothing
 * in this app can reach it. Putting the rules back would leave the two disagreeing, and the worklog is
 * the one that counts, so a wrong key is a correction from there on rather than an undo.
 */
export const canReopenStandIn = (options: { standIn: StandIn; syncedDays: readonly string[] }) => {
  const synced = new Set(options.syncedDays);

  return options.standIn.state === 'resolved' && !options.standIn.days.some((day) => synced.has(day));
};

const DAY_MS = 86_400_000;

const midnightOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * The workdays from one date to another, counting neither Saturday nor Sunday. The same date answers
 * zero, and a date before `from` answers zero rather than a negative age.
 *
 * `Math.round` rather than a floor: a span crossing a daylight-saving change is an hour short or an
 * hour long, and a floor would lose a whole day to it.
 */
export const workdaysBetween = (options: { from: Date; to: Date }) => {
  const from = midnightOf(options.from);
  const days = Math.round((midnightOf(options.to).getTime() - from.getTime()) / DAY_MS);

  if (days <= 0) return 0;

  const rest = days % 7;
  let extra = 0;

  for (let step = 1; step <= rest; step += 1) {
    const weekday = (from.getDay() + step) % 7;

    if (weekday !== 0 && weekday !== 6) extra += 1;
  }

  return Math.floor(days / 7) * 5 + extra;
};

/** How long a stand-in has waited, and whether that is longer than the user said they would allow. */
export type StandInAge = {
  /** Workdays since it was opened. A weekend does not age a debt nobody was at work to answer. */
  workdays: number;
  /** The time its own bands hold, across every day it covers. */
  heldMs: number;
  isOverdue: boolean;
};

/**
 * Reads the age of a stand-in against the two limits the user set.
 *
 * Either limit alone makes it overdue: work that waited a week and work that piled up four hours in
 * two days are both debts worth naming. A resolved stand-in is never overdue, and a limit of zero or
 * less is the user turning that one test off.
 */
export const standInAge = (options: {
  standIn: Pick<StandIn, 'state' | 'createdAt'>;
  /** From `standInHeldMs`, totalled on demand. Nothing stores a running total — see ADR 0021. */
  heldMs: number;
  now: Date;
  overdueAfterWorkdays: number;
  overdueAfterMs: number;
}): StandInAge => {
  const workdays = workdaysBetween({ from: options.standIn.createdAt, to: options.now });
  const tooOld = options.overdueAfterWorkdays > 0 && workdays >= options.overdueAfterWorkdays;
  const tooLong = options.overdueAfterMs > 0 && options.heldMs >= options.overdueAfterMs;

  return { workdays, heldMs: options.heldMs, isOverdue: options.standIn.state === 'open' && (tooOld || tooLong) };
};

/**
 * The time a stand-in's own bands hold in the rows given.
 *
 * The rows are typed by what this needs rather than as `ReviewedRow`, so the day's review model stays
 * out of the model layer. Pass the rows of every day the stand-in covers to total the whole debt.
 */
export const standInHeldMs = (options: { id: string; rows: readonly { standInId?: string; durationMs: number }[] }) =>
  options.rows.reduce((held, row) => (row.standInId === options.id ? held + row.durationMs : held), 0);
