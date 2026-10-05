import { TimeWindow, clipWindows, mergeWindows, subtractWindows, windowsMs } from '../model/time-window';
import { DEFAULT_ROUND_OPTIONS, RoundOptions, ticketOf } from './round';
import { nearestOnGrid } from './grid';

/** A part of a remote stretch the day books, with the lane of the prompt that bought it. */
export type BookedRemoteWindow = TimeWindow & { laneKey?: string };

/** A day's remote stretches on the row grid: all of `drawn` is drawn as work, and only `booked` books. */
export type RemoteBooking = { drawn: TimeWindow[]; booked: BookedRemoteWindow[] };

type BookingRow = TimeWindow & { id: string; laneKey?: string; issueKey?: string; standInId?: string };

/** What a row spanning `from` to `to` books: its span, less the unbooked remote time inside it. */
export const bookedSpanMs = (row: TimeWindow, unbooked: readonly TimeWindow[] = []) =>
  Math.max(0, row.to.getTime() - row.from.getTime() - windowsMs(clipWindows({ windows: unbooked, within: [row] })));

/** Puts a day's remote stretches on the row grid, each end to the nearest boundary as a drawn break is. */
export const remoteBookingOnGrid = (options: {
  drawn: readonly TimeWindow[];
  booked: readonly BookedRemoteWindow[];
  round?: Partial<RoundOptions>;
}): RemoteBooking => {
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.round };
  const nearest = (at: Date) => new Date(nearestOnGrid(at.getTime(), incrementMs));
  const booked = options.booked
    .map((part) => ({ ...part, from: nearest(part.from), to: nearest(part.to) }))
    .filter((part) => part.to.getTime() > part.from.getTime());

  return {
    drawn: mergeWindows(options.drawn.map((window) => ({ from: nearest(window.from), to: nearest(window.to) }))),
    booked,
  };
};

const ownerOrder = (a: BookingRow, b: BookingRow) =>
  Number(!a.issueKey) - Number(!b.issueKey) ||
  (a.laneKey ?? '￿').localeCompare(b.laneKey ?? '￿') ||
  a.from.getTime() - b.from.getTime() ||
  a.id.localeCompare(b.id);

/**
 * The remote time each of `rows` draws and does not book, in their order. See ADR 0033.
 *
 * A booked part counts only on the rows in the lane of the prompt that bought it. When none of `rows`
 * is in that lane, it counts on the one row over it that names an issue before one that does not, then
 * has the lowest lane key, then starts first. Every other row over it treats it as unbooked, so the day
 * books each part at most once. The session rows of one ticket in the lane all count it, because
 * `siblingBookingsOf` shares their minutes out and books the clock they cover once.
 */
export const unbookedRemoteByRow = (options: {
  rows: readonly BookingRow[];
  remote?: RemoteBooking;
}): TimeWindow[][] => {
  const owned = options.rows.map((): TimeWindow[] => []);
  const indexed = options.rows.map((row, index) => ({ row, index }));

  for (const part of options.remote?.booked ?? []) {
    const lane = indexed.filter(({ row }) => part.laneKey !== undefined && row.laneKey === part.laneKey);
    const over = (lane.length ? lane : indexed).filter(
      ({ row }) => row.from.getTime() < part.to.getTime() && row.to.getTime() > part.from.getTime(),
    );
    const owners = lane.length ? over : over.sort((a, b) => ownerOrder(a.row, b.row)).slice(0, 1);
    const byTicket = new Map<string, TimeWindow[]>();
    let left: TimeWindow[] = [part];

    for (const { row, index } of owners) {
      const ticket = lane.length ? ticketOf(row) : undefined;
      const sibling = (ticket && byTicket.get(ticket)) || [];
      const taken = clipWindows({ windows: left, within: [row] });

      owned[index]?.push(...clipWindows({ windows: mergeWindows([...sibling, ...taken]), within: [row] }));
      if (ticket) byTicket.set(ticket, mergeWindows([...sibling, ...taken]));
      left = subtractWindows({ windows: left, without: [row] });
    }
  }

  return options.rows.map((row, index) =>
    subtractWindows({
      windows: clipWindows({ windows: options.remote?.drawn ?? [], within: [row] }),
      without: owned[index] ?? [],
    }),
  );
};
