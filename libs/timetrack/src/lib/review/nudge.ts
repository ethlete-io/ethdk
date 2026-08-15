import { DEFAULT_ROUND_OPTIONS } from '../correlate/round';
import { formatDurationMs } from '../model/duration';
import { SyncedWorklog, syncsInState } from '../model/proposal';
import { contentHashOf } from '../tempo/diff';
import { DayReview } from './model';

/** What a day still owes the person who worked it. */
export type DayNudgeReason =
  /** Rows a sync would write that Tempo does not hold, or does not hold as they now read. */
  | 'unsynced'
  /** Rows nobody has said yes or no to, which a sync leaves alone. */
  | 'undecided'
  /** Observed time no issue claimed, which no sync can ever write. */
  | 'unattributed';

export type DayReviewGap = {
  /** Widest first, so the wording leads with the reason worth acting on. */
  reasons: DayNudgeReason[];
  /** Time in rows a sync would write. */
  unsyncedMs: number;
  undecidedMs: number;
  unattributedMs: number;
};

/**
 * What a day would still change if the reviewer went back to it, read from the local ledger alone.
 *
 * Tempo is never asked. The ledger holds the hash of everything this app wrote, so a row it does not
 * hold, or holds under a different hash, is a row Tempo is behind on — and answering the question
 * locally is what lets the reminder fire on a train, and without a token in it.
 */
export const dayReviewGap = (options: {
  review: DayReview;
  ledger: readonly SyncedWorklog[];
  /** The same attribute values the sync would write, or the hash reads every synced row as changed. */
  attributesByProposalId?: Record<string, Record<string, string | number | boolean>>;
  /** Under this, a gap is not worth a reminder. Defaults to one rounding increment. */
  toleranceMs?: number;
}): DayReviewGap | null => {
  const tolerance = options.toleranceMs ?? DEFAULT_ROUND_OPTIONS.incrementMs;
  const entries = new Map(options.ledger.map((entry) => [entry.proposalId, entry]));
  const reasons: DayNudgeReason[] = [];
  let unsyncedMs = 0;
  let undecidedMs = 0;
  let pendingDelete = false;

  for (const row of options.review.rows) {
    const entry = entries.get(row.id);

    if (row.state === 'suggested') {
      undecidedMs += row.durationMs;
      continue;
    }

    if (row.state === 'rejected') {
      pendingDelete ||= !!entry;
      continue;
    }

    if (!syncsInState(row.state) || row.durationMs <= 0) continue;

    const hash = contentHashOf({ proposal: row, attributes: options.attributesByProposalId?.[row.id] });

    if (!entry || entry.contentHash !== hash) unsyncedMs += row.durationMs;
  }

  const unattributedMs = options.review.check.unattributedMs;

  if (unsyncedMs >= tolerance || pendingDelete) reasons.push('unsynced');
  if (undecidedMs >= tolerance) reasons.push('undecided');
  if (unattributedMs >= tolerance) reasons.push('unattributed');

  return reasons.length > 0 ? { reasons, unsyncedMs, undecidedMs, unattributedMs } : null;
};

/** How long the desktop notification stays quiet after it fired. The banner behind it does not blink. */
export const DEFAULT_NUDGE_REPEAT_MS = 60 * 60_000;

/** How long "later" postpones the whole reminder for. */
export const DEFAULT_NUDGE_SNOOZE_MS = 45 * 60_000;

/** What the store remembers about one day's reminders. */
export type DayNudgeRecord = {
  day: string;
  lastNudgedAt: Date | null;
  /** Set by "later" and by "not today". Until it passes, the day is not reported again. */
  silencedUntil: Date | null;
};

/** The local minute of day an instant falls on, which is the unit the reminder is configured in. */
export const minuteOfDay = (at: Date) => at.getHours() * 60 + at.getMinutes();

/**
 * Whether the day may be reported at this moment. It is only the clock half — what the day still owes
 * is `dayReviewGap`, and both have to say yes.
 */
export const isNudgeDue = (options: {
  now: Date;
  /** The local minute of day the day's review is due. */
  atMinute: number;
  record?: DayNudgeRecord | null;
}) => {
  if (minuteOfDay(options.now) < options.atMinute) return false;

  const silencedUntil = options.record?.silencedUntil;

  return !silencedUntil || options.now >= silencedUntil;
};

/**
 * Whether the desktop notification may be sent again.
 *
 * It is a separate question from `isNudgeDue` because the two surfaces want opposite things: the
 * banner in the window should stay up until the day is finished, and a notification that arrived once
 * an hour ago has already said everything it has to say.
 */
export const hasNudgeRepeatElapsed = (options: { now: Date; record?: DayNudgeRecord | null; repeatMs?: number }) => {
  const lastNudgedAt = options.record?.lastNudgedAt;

  return (
    !lastNudgedAt || options.now.getTime() - lastNudgedAt.getTime() >= (options.repeatMs ?? DEFAULT_NUDGE_REPEAT_MS)
  );
};

export type DayNudge = {
  day: string;
  gap: DayReviewGap;
  title: string;
  body: string;
  /** Whether this one is also worth a desktop notification, or only the banner in the window. */
  notify: boolean;
};

const WORDING: Record<DayNudgeReason, (gap: DayReviewGap) => string> = {
  unsynced: (gap) =>
    gap.unsyncedMs > 0 ? `${formatDurationMs(gap.unsyncedMs)} is not in Tempo yet` : 'a rejected row is still in Tempo',
  undecided: (gap) => `${formatDurationMs(gap.undecidedMs)} is waiting for a yes or a no`,
  unattributed: (gap) => `${formatDurationMs(gap.unattributedMs)} matched no issue`,
};

/**
 * The one reminder a day gets, already worded, or `null` while the day is finished or the moment is
 * wrong. The words are here rather than in the app because the same sentence has to read the same in a
 * desktop notification and in the banner behind it.
 */
export const dayNudge = (options: {
  day: string;
  review: DayReview;
  ledger: readonly SyncedWorklog[];
  now: Date;
  atMinute: number;
  record?: DayNudgeRecord | null;
  repeatMs?: number;
  attributesByProposalId?: Record<string, Record<string, string | number | boolean>>;
  toleranceMs?: number;
}): DayNudge | null => {
  if (!isNudgeDue(options)) return null;

  const gap = dayReviewGap(options);

  if (!gap) return null;

  return {
    day: options.day,
    gap,
    title: gap.reasons[0] === 'unsynced' ? 'Your day is not logged yet' : 'Your day still needs a review',
    body: gap.reasons.map((reason) => WORDING[reason](gap)).join(', '),
    notify: hasNudgeRepeatElapsed(options),
  };
};
