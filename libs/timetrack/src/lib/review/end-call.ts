import { CallEvent, CollectedEvent } from '../model/event';
import { CallMatch } from '../rows/calls';
import { CALL_LANE_KEY, storedLaneKey } from '../rows/lane';
import { DEFAULT_ROUND_OPTIONS, RoundOptions } from '../rows/round';
import { setRowRange } from './edits';
import { DayReviewEdits, ReviewedRow } from './model';

const overlaps = (left: { from: Date; to: Date }, right: { from: Date; to: Date }) =>
  left.from.getTime() < right.to.getTime() && right.from.getTime() < left.to.getTime();

/** The start of every call the microphone still holds, keyed by the process holding it. */
const openCallStarts = (events: readonly CollectedEvent[]) => {
  const open = new Map<string, Date>();
  const edges = events
    .filter((event): event is CallEvent => event.source === 'call')
    .sort((left, right) => left.at.getTime() - right.at.getTime());

  for (const edge of edges) {
    if (edge.kind === 'call-end') open.delete(edge.appId);
    else if (!open.has(edge.appId)) open.set(edge.appId, edge.at);
  }

  return open;
};

/**
 * Whether a row in the call lane still grows with a call no `call-end` closed yet, so ending it by
 * hand is an answer the day cannot give itself. A row whose end the reviewer already placed is done.
 */
export const isLiveCallRow = (options: {
  row: ReviewedRow;
  calls: readonly CallMatch[];
  events: readonly CollectedEvent[];
  edits: DayReviewEdits;
}) => {
  const { row } = options;
  const editId = row.recutOf ?? row.id;

  if (storedLaneKey(row.laneKey) !== CALL_LANE_KEY) return false;
  if (options.edits.pinned.some((pin) => pin.id === editId && !pin.tracksTo)) return false;

  const open = openCallStarts(options.events);

  return options.calls.some(({ call }) => {
    const start = open.get(call.appId);

    return (
      !!start && start.getTime() >= call.from.getTime() && start.getTime() < call.to.getTime() && overlaps(call, row)
    );
  });
};

/**
 * Ends a row at `at`, on the nearest increment, the way dragging its end there would: the end stays
 * put however long the call behind it runs, and what the call holds past it comes back as a band of
 * its own with no name. An end at or before the row's start leaves the edits unchanged.
 */
export const endRowAt = (options: {
  edits: DayReviewEdits;
  row: ReviewedRow;
  at: Date;
  round?: Partial<RoundOptions>;
}): DayReviewEdits => {
  const { edits, row } = options;
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.round };
  const to = new Date(Math.round(options.at.getTime() / incrementMs) * incrementMs);

  if (to.getTime() <= row.from.getTime()) return edits;

  // `setRowRange` pins only an end that moved, and a growing row is already drawn to the increment
  // nearest now: resize it from one increment further so the end is pinned where it is.
  const drawn = to.getTime() === row.to.getTime() ? { ...row, to: new Date(to.getTime() + incrementMs) } : row;

  return setRowRange({ edits, row: drawn, from: row.from, to, round: options.round });
};
