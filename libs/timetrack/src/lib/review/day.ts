const pad = (value: number) => String(value).padStart(2, '0');

/**
 * The local calendar day an instant falls in, as `YYYY-MM-DD`. Local rather than UTC because a day of
 * work is a day where the person is, and it is the key their edits are stored under: the same evening
 * must not land in two different days depending on the reader's offset.
 */
export const localDayKey = (at: Date) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

/** The half-open local range of a day produced by `localDayKey`, for asking the store what happened. */
export const localDayRange = (day: string) => {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);

  return { from: new Date(year, month - 1, date), to: new Date(year, month - 1, date + 1) };
};

/** Moves a day key by whole days, over month and year ends and across a daylight-saving change. */
export const shiftDayKey = (day: string, byDays: number) => {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);

  return localDayKey(new Date(year, month - 1, date + byDays));
};

/** The `count` local days ending at `day`, oldest first. */
export const dayKeysThrough = (options: { day: string; count: number }) =>
  Array.from({ length: options.count }, (_, offset) => shiftDayKey(options.day, offset - options.count + 1));

/**
 * The items grouped by the local day each one falls in, one array per day key given, in that order.
 *
 * An item outside every day given is dropped, so a caller can hand over a whole range of events and
 * read back exactly the days it asked about.
 */
export const byLocalDay = <T extends { at: Date }>(options: {
  items: readonly T[];
  days: readonly string[];
}): T[][] => {
  const byKey = new Map(options.days.map((day) => [day, [] as T[]]));

  for (const item of options.items) byKey.get(localDayKey(item.at))?.push(item);

  return options.days.map((day) => byKey.get(day) ?? []);
};
