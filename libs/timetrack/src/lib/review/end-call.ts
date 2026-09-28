import { CallEvent, CollectedEvent } from '../model/event';
import { CallMatch, meetingBehindRow } from '../rows/calls';
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

const holdsOpenCall = (options: {
  row: ReviewedRow;
  calls: readonly CallMatch[];
  events: readonly CollectedEvent[];
}) => {
  if (storedLaneKey(options.row.laneKey) !== CALL_LANE_KEY) return false;

  const open = openCallStarts(options.events);

  return options.calls.some(({ call }) => {
    const start = open.get(call.appId);

    return (
      !!start &&
      start.getTime() >= call.from.getTime() &&
      start.getTime() < call.to.getTime() &&
      overlaps(call, options.row)
    );
  });
};

type EndedRow = { id: string; from: Date; issueKey?: string; recutOf?: string };

const endPinOf = (edits: DayReviewEdits, row: EndedRow) => {
  const editId = row.recutOf ?? row.id;

  return edits.pinned.find((pin) => pin.id === editId);
};

const cutFrom = (edits: DayReviewEdits, row: EndedRow) => {
  const sources = endPinOf(edits, row)?.replaces ?? [row.recutOf ?? row.id];

  return (id: string) =>
    sources.includes(id) ||
    (id.includes('#') &&
      (sources.some((source) => id.startsWith(`${source}#`)) || (!!row.issueKey && id.startsWith(`${row.issueKey}@`))));
};

/**
 * The pins an earlier end of this row left on the rest of its call: bands with no name after the row,
 * each cut out of the row's own call row, which the reviewer ended or dragged in turn.
 */
const restPinsOf = (edits: DayReviewEdits, row: EndedRow) => {
  const cutFromRow = cutFrom(edits, row);
  const unnamed = edits.pinned
    .filter((pin) => !pin.issueKey && !pin.standInId && !pin.excluded && storedLaneKey(pin.laneKey) === CALL_LANE_KEY)
    .sort((left, right) => left.from.getTime() - right.from.getTime());
  const rest = new Set(
    unnamed.filter(
      (pin) => pin.from.getTime() >= row.from.getTime() && pin.replaces.length > 0 && pin.replaces.every(cutFromRow),
    ),
  );
  let reached = endPinOf(edits, row)?.to.getTime();

  for (const pin of unnamed) {
    if (reached === undefined || pin.from.getTime() !== reached) continue;

    rest.add(pin);
    reached = pin.to.getTime();
  }

  return [...rest];
};

const withoutRestPins = (edits: DayReviewEdits, row: EndedRow): DayReviewEdits => {
  const rest = restPinsOf(edits, row);

  return rest.length ? { ...edits, pinned: edits.pinned.filter((pin) => !rest.includes(pin)) } : edits;
};

const endedCallPins = (edits: DayReviewEdits) =>
  edits.pinned.filter((pin) => !!pin.issueKey && storedLaneKey(pin.laneKey) === CALL_LANE_KEY && !pin.tracksTo);

/**
 * Drops the ends a reviewer gave the rest of a call a named row was ended off, so that rest is one
 * band that grows with the call. Edits written before the rest had no end of its own still hold such
 * pins, each drawn as a second band with no name.
 */
export const withoutEndedRestPins = (edits: DayReviewEdits): DayReviewEdits => {
  const stale = new Set(
    endedCallPins(edits).flatMap((pin) => restPinsOf(edits, pin).filter((rest) => rest.tracksTo === false)),
  );

  return stale.size ? { ...edits, pinned: edits.pinned.filter((pin) => !stale.has(pin)) } : edits;
};

const isRestOfEndedCall = (edits: DayReviewEdits, row: ReviewedRow) =>
  !row.issueKey &&
  storedLaneKey(row.laneKey) === CALL_LANE_KEY &&
  endedCallPins(edits).some(
    (pin) => row.from.getTime() >= pin.to.getTime() && cutFrom(edits, pin)(row.recutOf ?? row.id),
  );

/**
 * Where the calls behind a row end, on the nearest increment. A call the same process picked up again
 * within one increment of the last one's end is the same call.
 */
const callEndOf = (options: { row: ReviewedRow; calls: readonly CallMatch[]; round?: Partial<RoundOptions> }) => {
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.round };
  const windows = options.calls
    .map(({ call }) => call)
    .sort((left, right) => left.from.getTime() - right.from.getTime());
  let end: number | null = null;

  for (const call of windows) {
    const joins = end === null ? overlaps(call, options.row) : call.from.getTime() <= end + incrementMs;

    if (joins) end = Math.max(end ?? 0, call.to.getTime());
  }

  return end === null ? null : Math.round(end / incrementMs) * incrementMs;
};

/**
 * Whether a row in the call lane still grows with a call no `call-end` closed yet, so ending it by
 * hand is an answer the day cannot give itself. A row whose end the reviewer already placed is done,
 * and so is the rest of a call a named row was ended off: it grows with the call as one band.
 */
export const isLiveCallRow = (options: {
  row: ReviewedRow;
  calls: readonly CallMatch[];
  events: readonly CollectedEvent[];
  edits: DayReviewEdits;
}) => {
  const pin = endPinOf(options.edits, options.row);

  if (pin && !pin.tracksTo) return false;
  if (isRestOfEndedCall(options.edits, options.row)) return false;

  return holdsOpenCall(options);
};

/**
 * Whether a named call row was cut off its call by {@link endRowAt} and the call ran on past the cut,
 * so {@link followCallAgain} has minutes to hand back. A row the reviewer resized by hand, and a row a
 * calendar meeting names, never is.
 *
 * An end cut before `snippedFromMs` existed is told by the end an earlier version left on the rest of
 * its call.
 */
export const isEndedCallRow = (options: {
  row: ReviewedRow;
  calls: readonly CallMatch[];
  edits: DayReviewEdits;
  round?: Partial<RoundOptions>;
}) => {
  const { row, edits } = options;
  const pin = endPinOf(edits, row);

  if (!row.issueKey || storedLaneKey(row.laneKey) !== CALL_LANE_KEY || !pin || pin.tracksTo) return false;
  if (meetingBehindRow(options)) return false;

  const snipped = pin.snippedFromMs !== undefined || restPinsOf(edits, row).some((rest) => rest.tracksTo === false);
  const callEnd = callEndOf(options);

  return snipped && callEnd !== null && callEnd > row.to.getTime();
};

/**
 * Where a growing call row offers to end: on the increment nearest the end of the calendar meeting the
 * call was, when that meeting ended inside the row. The call itself is evidence up to now, so a row no
 * meeting ended inside offers one increment before its end, and a row one increment long offers its
 * end.
 */
export const callRowSnipAt = (options: {
  row: ReviewedRow;
  calls: readonly CallMatch[];
  round?: Partial<RoundOptions>;
}): Date => {
  const { row } = options;
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.round };
  const until = meetingBehindRow(options)?.until;
  const inside = (ms: number) => ms > row.from.getTime() && ms < row.to.getTime();
  const meetingEnd = until && Math.round(until.getTime() / incrementMs) * incrementMs;

  if (meetingEnd && inside(meetingEnd)) return new Date(meetingEnd);

  const quarterBefore = row.to.getTime() - incrementMs;

  return inside(quarterBefore) ? new Date(quarterBefore) : row.to;
};

/**
 * Hands a row's end back to the call behind it, undoing {@link endRowAt}: the row grows with the call
 * again, and the band with no name past it is gone along with any end the reviewer gave that band. A
 * call that ended before the row's end before the cut puts the end back there instead, so a row is
 * never shorter for it. A row {@link isEndedCallRow} does not hold for is left alone.
 */
export const followCallAgain = (options: {
  edits: DayReviewEdits;
  row: ReviewedRow;
  calls: readonly CallMatch[];
  round?: Partial<RoundOptions>;
}): DayReviewEdits => {
  const { row } = options;
  const pin = endPinOf(options.edits, row);

  if (!pin || !isEndedCallRow(options)) return options.edits;

  const edits = withoutRestPins(options.edits, row);
  const before = Math.max(pin.snippedFromMs ?? 0, row.to.getTime());
  const callEnd = callEndOf(options) ?? row.to.getTime();

  if (callEnd < before) {
    return setRowRange({ edits, row, from: row.from, to: new Date(before), round: options.round });
  }

  return {
    ...edits,
    pinned: edits.pinned.map((entry) => {
      if (entry !== pin) return entry;

      const { snippedFromMs: _snippedFromMs, ...kept } = entry;

      return { ...kept, tracksTo: true };
    }),
  };
};

/**
 * Ends a row at `at`, on the nearest increment, the way dragging its end there would: the end stays
 * put however long the call behind it runs, and what the call holds past it comes back as a band of
 * its own with no name, one band however often the row was ended before. An end at or before the
 * row's start leaves the edits unchanged.
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

  const cleared = withoutRestPins(edits, row);
  const ended = setRowRange({ edits: cleared, row: drawn, from: row.from, to, round: options.round });
  const snippedFromMs = endPinOf(edits, row)?.snippedFromMs ?? row.to.getTime();

  if (ended === cleared) return ended;

  return {
    ...ended,
    pinned: ended.pinned.map((pin) => (cleared.pinned.includes(pin) ? pin : { ...pin, snippedFromMs })),
  };
};
