const pad = (value: number) => String(value).padStart(2, '0');

/**
 * The local hour a day starts at. `0` is midnight.
 *
 * A day of work is not a calendar date. Work from 22:00 to 02:00 is one evening, and with a midnight
 * boundary the second half becomes a two-hour day that describes nothing a person did. See ADR 0015.
 *
 * It is a required argument everywhere it matters rather than a defaulted one: two parts of the app
 * disagreeing about which day an hour falls in is worse than the problem the boundary solves, and a
 * default is how one of them ends up never being told.
 */
export type DayBoundary = { startHour: number };

/** The boundary a calendar date is: the one every day-keyed thing used before ADR 0015. */
export const MIDNIGHT: DayBoundary = { startHour: 0 };

const keyOf = (at: Date) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

const partsOf = (day: string) => {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);

  return { year, month: month - 1, date };
};

/**
 * The day an instant belongs to, as `YYYY-MM-DD`. Local rather than UTC because a day of work is a
 * day where the person is, and it is the key their edits are stored under: the same evening must not
 * land in two different days depending on the reader's offset.
 *
 * An instant before the boundary belongs to the day before, so 01:00 on Tuesday is Monday's work.
 */
export const localDayKey = (at: Date, boundary: DayBoundary) => {
  const shifted = new Date(at);

  shifted.setHours(shifted.getHours() - boundary.startHour);

  return keyOf(shifted);
};

/** The half-open local range of a day produced by `localDayKey`, for asking the store what happened. */
export const localDayRange = (day: string, boundary: DayBoundary) => {
  const { year, month, date } = partsOf(day);

  return {
    from: new Date(year, month, date, boundary.startHour),
    to: new Date(year, month, date + 1, boundary.startHour),
  };
};

/**
 * Moves a day key by whole days, over month and year ends and across a daylight-saving change.
 *
 * It needs no boundary: a key is already a day, and stepping from one to the next never asks which
 * day an instant is in. Going back through `localDayKey` would, and would be wrong by a day whenever
 * the boundary is not midnight.
 */
export const shiftDayKey = (day: string, byDays: number) => {
  const { year, month, date } = partsOf(day);
  return keyOf(new Date(year, month, date + byDays));
};

/** The `count` local days ending at `day`, oldest first. */
export const dayKeysThrough = (options: { day: string; count: number }) =>
  Array.from({ length: options.count }, (_, offset) => shiftDayKey(options.day, offset - options.count + 1));

/**
 * The items grouped by the day each one falls in, one array per day key given, in that order.
 *
 * An item outside every day given is dropped, so a caller can hand over a whole range of events and
 * read back exactly the days it asked about.
 */
export const byLocalDay = <T extends { at: Date }>(options: {
  items: readonly T[];
  days: readonly string[];
  boundary: DayBoundary;
}): T[][] => {
  const byKey = new Map(options.days.map((day) => [day, [] as T[]]));

  for (const item of options.items) byKey.get(localDayKey(item.at, options.boundary))?.push(item);

  return options.days.map((day) => byKey.get(day) ?? []);
};
