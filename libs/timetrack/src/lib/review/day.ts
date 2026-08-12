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
