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
  state: 'open',
  days: [options.day],
  author: options.author ?? 'user',
  createdAt: options.now,
});

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
