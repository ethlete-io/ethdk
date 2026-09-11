import { DEFAULT_ROUND_OPTIONS, RoundOptions } from './round';

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
  Math.max(nearest(row.rawTo, incrementMs), row.from + Math.max(row.durationMs, incrementMs));

/**
 * Puts every row's clock times on an increment boundary: the start goes back to the boundary below
 * it, and the end to the boundary nearest it. A row that ran 09:38 to 10:01 is written 09:30 to
 * 10:00. Recording a start of 09:38:24 claims a precision the evidence behind it does not have, and
 * it is the time a reviewer reads on their own timesheet.
 *
 * The end never lands before `from + durationMs`, so a band is never drawn narrower than the time it
 * books.
 *
 * Widening a row can make it reach into a row it only touched before. Where the snap alone would
 * create such an overlap, the earlier row's end rounds down instead of to the nearest boundary; when
 * its own booked time leaves no room for that, the later row's start moves up to meet it. Rows that
 * already overlapped on the raw clock are left overlapping - a meeting held during coding is a real
 * overlap and this is not the place to resolve it.
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

      if (pulled >= earlier.from + Math.max(earlier.durationMs, incrementMs)) {
        earlier.to = pulled;
        continue;
      }

      row.from = earlier.to;
      row.to = endOf(row, incrementMs);
    }

    done.push(row);
  }

  return options.rows.map((row, index) => {
    const bounds = placed[index];

    if (!bounds) return row;

    return { ...row, from: new Date(bounds.from), to: new Date(bounds.to) };
  });
};
