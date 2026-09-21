import { storedLaneKey } from '../rows/lane';
import { DayReviewEdits } from './model';

/** One day's stored edits, as the store hands a range of days back. */
export type StoredDayEdits = {
  /** The local calendar day, as `YYYY-MM-DD`. */
  day: string;
  edits: DayReviewEdits;
};

/** One issue a lane was named with before. */
export type LaneIssueUse = {
  laneKey: string;
  issueKey: string;
  /** How many rows of that lane carried the issue, over the days that were read. */
  count: number;
  /** The last day a row of that lane carried it, as `YYYY-MM-DD`. */
  lastUsedDay: string;
};

type Named = { laneKey?: string; issueKey?: string; state?: string; hidden?: boolean };

/**
 * A row the reviewer threw out or took off the timeline says nothing about which issue the lane
 * belongs to, so neither kind is counted.
 */
const namingIn = (entry: Named) => {
  if (entry.state === 'rejected' || entry.hidden) return undefined;

  const laneKey = storedLaneKey(entry.laneKey);
  const issueKey = entry.issueKey?.trim().toUpperCase();

  return laneKey && issueKey ? { laneKey, issueKey } : undefined;
};

const namingsIn = (edits: DayReviewEdits) =>
  [...Object.values(edits.overrides ?? {}), ...(edits.pinned ?? [])].flatMap((entry) => namingIn(entry) ?? []);

/**
 * Which issues each lane was named with, most recently named first.
 *
 * It reads what the reviewer decided rather than what a rule guessed: only an override or a row built
 * by hand carries a lane, and both of those are the user's own answer. That is also why a naming is
 * worth offering again — the work a checkout or a standing call belongs to barely moves from week to
 * week, while the picker's own list is ordered by whatever the Jira account touched last.
 *
 * Recency decides the order rather than the count, the same way the picker's own list is ordered. The
 * issue a lane was named with yesterday is the one today's row of it usually wants, and a count would
 * hold a ticket that was closed months ago at the top of the list for as long as it is read.
 */
export const laneIssueUses = (days: readonly StoredDayEdits[]): LaneIssueUse[] => {
  const held = new Map<string, LaneIssueUse>();

  for (const { day, edits } of [...days].sort((a, b) => a.day.localeCompare(b.day))) {
    for (const { laneKey, issueKey } of namingsIn(edits)) {
      const at = `${laneKey}\n${issueKey}`;
      const previous = held.get(at);

      held.set(at, { laneKey, issueKey, count: (previous?.count ?? 0) + 1, lastUsedDay: day });
    }
  }

  return [...held.values()].sort(
    (a, b) => b.lastUsedDay.localeCompare(a.lastUsedDay) || b.count - a.count || a.issueKey.localeCompare(b.issueKey),
  );
};

/** The issues one lane was named with, most recently named first, at most `limit` of them. */
export const laneIssueUsesFor = (options: {
  uses: readonly LaneIssueUse[];
  laneKey: string;
  limit?: number;
}): LaneIssueUse[] => {
  if (!options.laneKey) return [];

  const lane = storedLaneKey(options.laneKey);
  const found = options.uses.filter((use) => use.laneKey === lane);

  return options.limit === undefined ? found : found.slice(0, options.limit);
};
