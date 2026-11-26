const DATE_PART = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PART = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

const pad = (value: number) => String(value).padStart(2, '0');

/** The `startDate` a worklog carries: a calendar day in the user's own time zone, never UTC. */
export const tempoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The `startTime` a worklog carries, in the same local wall clock as {@link tempoDay}. */
export const tempoTimeOfDay = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

/**
 * Rebuilds an instant from the date and the time of day Tempo sends separately. Both are the user's
 * local wall clock, so parsing either as UTC silently shifts a worklog into the neighbouring day.
 * Returns `undefined` for anything that is not the shape Tempo documents.
 */
export const parseTempoWallClock = (day: string | undefined, timeOfDay: string | undefined) => {
  const date = DATE_PART.exec(day ?? '');

  if (!date) return undefined;

  const time = TIME_PART.exec(timeOfDay ?? '00:00:00');

  if (!time) return undefined;

  return new Date(
    Number(date[1]),
    Number(date[2]) - 1,
    Number(date[3]),
    Number(time[1]),
    Number(time[2]),
    Number(time[3] ?? '0'),
  );
};
