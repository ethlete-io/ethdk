import { DEFAULT_ROUND_OPTIONS, RoundOptions, roundDurationUp } from './round';

/** A row's raw bounds and the whole increments it books, from `roundDurationUp`. */
export type SnapInput = {
  from: Date;
  to: Date;
  durationMs: number;
};

const floorTo = (ms: number, incrementMs: number) => Math.floor(ms / incrementMs) * incrementMs;
const nearest = (ms: number, incrementMs: number) => Math.round(ms / incrementMs) * incrementMs;

type Placed = {
  index: number;
  rawFrom: number;
  rawTo: number;
  durationMs: number;
  from: number;
  to: number;
};

const endOf = (row: Placed, incrementMs: number) =>
  Math.max(
    nearest(row.rawTo, incrementMs),
    row.from + Math.max(roundDurationUp(row.durationMs, { incrementMs }), incrementMs),
  );

/**
 * Puts every row's clock times on an increment boundary: the start goes back to the boundary below
 * it, and the end to the boundary nearest it. A row that ran 09:38 to 10:01 is written 09:30 to
 * 10:00. Recording a start of 09:38:24 claims a precision the evidence behind it does not have, and
 * it is the time a reviewer reads on their own timesheet.
 *
 * The end never lands before `from + durationMs`, so a band is never drawn narrower than the time it
 * books, and a duration that is not a whole increment reaches the boundary above it — both ends of a
 * band are on the grid.
 *
 * Widening a row can make it reach into a row it only touched before. Where the snap alone would
 * create such an overlap, the earlier row's end rounds down instead of to the nearest boundary; when
 * its own booked time leaves no room for that, the later row's start moves up to meet it. Rows that
 * already overlapped on the raw clock are left overlapping - a meeting held during coding is a real
 * overlap and this is not the place to resolve it.
 *
 * The earlier row gives up booked time rather than strand the later one past its own last evidence.
 * A day still running widens its last row into an increment the clock has not reached, and a row
 * pushed beyond that is drawn entirely in the future.
 */
export const snapRowBounds = <T extends SnapInput>(options: {
  rows: readonly T[];
  options?: Partial<RoundOptions>;
}): T[] => {
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.options };
  const placed: Placed[] = options.rows.map((row, index) => {
    const from = floorTo(row.from.getTime(), incrementMs);
    const seed: Placed = {
      index,
      rawFrom: row.from.getTime(),
      rawTo: row.to.getTime(),
      durationMs: row.durationMs,
      from,
      to: from,
    };

    return { ...seed, to: endOf(seed, incrementMs) };
  });
  const order = [...placed].sort((a, b) => a.rawFrom - b.rawFrom || a.rawTo - b.rawTo || a.index - b.index);
  const done: Placed[] = [];

  for (const row of order) {
    for (const earlier of done) {
      if (earlier.rawTo > row.rawFrom || earlier.to <= row.from) continue;

      const pulled = floorTo(earlier.rawTo, incrementMs);
      // A push would put this row's start at or after its own last evidence, so it would be drawn over
      // minutes nothing happened in — on a running day, minutes that have not happened at all.
      const strands = earlier.to >= row.rawTo;
      const room = earlier.from + (strands ? incrementMs : Math.max(earlier.durationMs, incrementMs));

      if (pulled >= room) {
        earlier.to = pulled;
        continue;
      }

      row.from = earlier.to;
      // Not `endOf`: the minutes this row gave up went to the row before it, and pushing its end out
      // to keep its old length would book them a second time.
      row.to = Math.max(nearest(row.rawTo, incrementMs), row.from + incrementMs);
    }

    done.push(row);
  }

  return options.rows.map((row, index) => {
    const bounds = placed[index];

    if (!bounds) return row;

    return { ...row, from: new Date(bounds.from), to: new Date(bounds.to) };
  });
};
