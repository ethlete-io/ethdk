import { ActivityContext } from './block';
import { FieldSource, storedSourceOf } from './field-source';
import { AttributionRule, NamingAuthor, matchAttributionRule, standInIdOf } from './attribution';
import { HistoricalWorklog } from './recurrence';

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
   * The directory of `openedForBranch` the app opened it for, where the branch names no piece of work
   * of its own. Absent on every record opened while the grain was the branch or the whole checkout.
   */
  openedForWorkPath?: string;
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
   * Who last resolved or reopened it. A resolved one without it was resolved by the user, an open one
   * without it was never touched. See `FieldSource`.
   */
  resolutionSource?: FieldSource;
  /** The issue the ticket for it is filed under, once auto mode or the user picked one. */
  parentKey?: string;
  /** Who picked `parentKey`. A parent stored without it was picked by the user. */
  parentSource?: FieldSource;
  /**
   * The local day keys that hold bands of it, oldest first.
   *
   * Stored rather than recomputed: `collected_event` is pruned by retention, and a stand-in open past
   * that window cannot be replayed — which is exactly the one that waited longest.
   */
  days: string[];
  /**
   * The days of `days` Tempo already held when it was resolved. The resolve made them no more bookable
   * than they were: on them it still reads as open, so time the user booked by hand is not booked again.
   * Written by the resolve and cleared by the undo.
   */
  bookedDays?: string[];
  /**
   * The local day key the user hid it on. It stays hidden until it holds a band on a later day.
   * Only the pickers and the list read it: a hidden stand-in still names its bands.
   */
  hiddenOn?: string;
  /**
   * The ids of the stand-ins merged into this one. A day review stores the id a row was named with, and
   * a merge does not rewrite past days, so a lookup of a merged id must still reach this record.
   */
  mergedIds?: string[];
  author: NamingAuthor;
  createdAt: Date;
};

/** Who decided whether the stand-in is resolved. See {@link StandIn.resolutionSource}. */
export const standInResolutionSourceOf = (standIn: Pick<StandIn, 'state' | 'resolutionSource'>): FieldSource =>
  storedSourceOf({ set: standIn.state === 'resolved', source: standIn.resolutionSource });

/** Who picked the stand-in's parent. See {@link StandIn.parentSource}. */
export const standInParentSourceOf = (standIn: Pick<StandIn, 'parentKey' | 'parentSource'>): FieldSource =>
  storedSourceOf({ set: !!standIn.parentKey, source: standIn.parentSource });

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
  /** The directory of that branch the app opened it for, where the branch names no piece of work. */
  openedForWorkPath?: string;
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
  ...(options.openedForWorkPath ? { openedForWorkPath: options.openedForWorkPath } : {}),
  state: 'open',
  days: [options.day],
  author: options.author ?? 'user',
  createdAt: options.now,
});

/**
 * Work the user refused a placeholder for, by deleting one the app opened.
 *
 * Without `branch` it refuses the whole checkout, which is what an entry written while the grain was
 * the checkout means and what a delete of such a record still writes. Without `workPath` it refuses
 * every directory of the branch.
 */
export type StandInRefusal = { repoPath: string; branch?: string; workPath?: string };

/**
 * Whether the user refused a placeholder for this branch of this checkout.
 *
 * A refusal of the whole checkout covers every branch of it, so a user who wants no placeholder at
 * all from a repository is not asked to refuse each branch in turn.
 */
export const isStandInRefused = (options: {
  repoPath: string;
  branch?: string;
  workPath?: string;
  refused: readonly StandInRefusal[];
}) =>
  options.refused.some(
    (entry) =>
      entry.repoPath === options.repoPath &&
      (!entry.branch || entry.branch === options.branch) &&
      (!entry.workPath || entry.workPath === options.workPath),
  );

/** The stand-ins still waiting on a ticket, newest first, which is what a picker offers. */
export const openStandIns = (standIns: readonly StandIn[]) =>
  standIns.filter((standIn) => standIn.state === 'open').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** The oldest other open stand-in with the same name, which a merge folds this one into. */
export const standInDuplicateOf = (options: { standIn: StandIn; standIns: readonly StandIn[] }) =>
  options.standIn.state === 'open'
    ? openStandIns(options.standIns)
        .filter((other) => other.id !== options.standIn.id && nameKey(other.name) === nameKey(options.standIn.name))
        .at(-1)
    : undefined;

/**
 * The issues Tempo holds a worklog for whose text is an open stand-in's name, newest first, keyed by
 * stand-in id. Each one is an offer to resolve that stand-in to the issue, never a resolution.
 */
export const standInWorklogOffers = (options: {
  standIns: readonly StandIn[];
  worklogs: readonly Pick<HistoricalWorklog, 'issueKey' | 'from' | 'description'>[];
}) => {
  const newestFirst = [...options.worklogs].sort((a, b) => b.from.getTime() - a.from.getTime());
  const offers = new Map<string, string[]>();

  for (const standIn of openStandIns(options.standIns)) {
    const name = nameKey(standIn.name);
    const keys = newestFirst
      .filter((worklog) => !!name && nameKey(worklog.description ?? '') === name)
      .map((worklog) => worklog.issueKey);

    if (keys.length) offers.set(standIn.id, [...new Set(keys)]);
  }

  return offers;
};

/**
 * The other open stand-ins of the same checkout that `standIn` can be joined into by hand, oldest
 * first. The one `standInDuplicateOf` names is left out, because the list already offers it.
 */
export const standInJoinTargets = (options: { standIn: StandIn; standIns: readonly StandIn[] }) => {
  const { standIn } = options;

  if (standIn.state !== 'open' || !standIn.openedFor) return [];

  const duplicate = standInDuplicateOf(options);

  return openStandIns(options.standIns)
    .filter((other) => other.id !== standIn.id && other.id !== duplicate?.id && other.openedFor === standIn.openedFor)
    .reverse();
};

/** Whether the user hid it and it took no band on a later day since. */
export const isStandInHidden = (standIn: Pick<StandIn, 'state' | 'days' | 'hiddenOn'>) => {
  const hiddenOn = standIn.hiddenOn;

  return standIn.state === 'open' && !!hiddenOn && !standIn.days.some((day) => day > hiddenOn);
};

/** The open stand-ins the user did not hide, newest first. */
export const offeredStandIns = (standIns: readonly StandIn[]) =>
  openStandIns(standIns).filter((standIn) => !isStandInHidden(standIn));

/**
 * Whether an open stand-in took no band for `afterWorkdays` workdays. One with no day yet counts from
 * when it was created.
 */
export const isStandInStale = (options: {
  standIn: Pick<StandIn, 'state' | 'days' | 'createdAt'>;
  now: Date;
  afterWorkdays: number;
}) => {
  const { standIn } = options;
  const lastDay = standIn.days[standIn.days.length - 1];
  const from = lastDay ? new Date(`${lastDay}T12:00:00`) : standIn.createdAt;

  return standIn.state === 'open' && workdaysBetween({ from, to: options.now }) >= options.afterWorkdays;
};

/** The days a stand-in holds bands on that Tempo does not hold yet, which are the only ones still waiting. */
export const standInWaitingDays = (options: { standIn: Pick<StandIn, 'days'>; bookedDays: ReadonlySet<string> }) =>
  options.standIn.days.filter((day) => !options.bookedDays.has(day));

/**
 * Whether every day an open stand-in holds bands on is already booked in Tempo, so nothing waits on
 * its ticket. One with no day yet is never booked, and a band on a later, unbooked day brings it back.
 */
export const isStandInBooked = (options: {
  standIn: Pick<StandIn, 'state' | 'days'>;
  bookedDays: ReadonlySet<string>;
}) => options.standIn.state === 'open' && options.standIn.days.length > 0 && !standInWaitingDays(options).length;

/**
 * Where a placeholder the app opened stands for its work: the checkout, then the narrowest thing the
 * record was cut to.
 *
 * Two placeholders may carry one name and mean two pieces of work — a spec track and the branch that
 * implements it are both called after the feature — so a list that shows the name alone cannot be
 * acted on. A record the user wrote by hand names no checkout, and this answers nothing for it.
 */
export const standInWhere = (standIn: Pick<StandIn, 'openedFor' | 'openedForBranch' | 'openedForWorkPath'>) => {
  if (!standIn.openedFor) return '';

  const checkout = standIn.openedFor.split('/').filter(Boolean).pop() ?? standIn.openedFor;

  if (standIn.openedForWorkPath) return `${checkout}, ${standIn.openedForWorkPath}`;

  return standIn.openedForBranch ? `${checkout}, on ${standIn.openedForBranch}` : checkout;
};

/**
 * The stand-in with this id, or the one it was merged into. Nothing when a rule points at one that was
 * deleted.
 */
export const findStandIn = (options: { id: string; standIns: readonly StandIn[] }) =>
  options.standIns.find((standIn) => standIn.id === options.id) ??
  options.standIns.find((standIn) => standIn.mergedIds?.includes(options.id));

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
  const resolvedDays = standInWaitingDays({
    standIn: options.standIn,
    bookedDays: new Set(options.standIn.bookedDays ?? []),
  });

  return options.standIn.state === 'resolved' && !resolvedDays.some((day) => synced.has(day));
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
  standIn: Pick<StandIn, 'state' | 'createdAt' | 'days'>;
  /** From `standInHeldMs`, totalled on demand. Nothing stores a running total — see ADR 0021. */
  heldMs: number;
  now: Date;
  overdueAfterWorkdays: number;
  overdueAfterMs: number;
  /** The days Tempo already holds. A stand-in waits from its first day Tempo does not hold. */
  bookedDays?: ReadonlySet<string>;
}): StandInAge => {
  const { standIn } = options;
  const bookedDays = options.bookedDays ?? new Set<string>();
  const firstWaiting = standIn.days.some((day) => bookedDays.has(day))
    ? standInWaitingDays({ standIn, bookedDays })[0]
    : undefined;
  const from = firstWaiting ? new Date(`${firstWaiting}T12:00:00`) : standIn.createdAt;
  const workdays = workdaysBetween({ from, to: options.now });
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
