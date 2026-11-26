/** 8rem per hour, the day timeline's own scale. */
export const HOUR_REM = 8;

/** The lane opens at 13:45 and closes at 15:30. */
export const WINDOW_FROM_MIN = 13 * 60 + 45;
export const WINDOW_MINUTES = 105;

export const ROW = {
  ticket: 'FIP-3095',
  detail: 'Meeting #1 | Braune Digital - Discord',
  fromMin: 14 * 60,
  /** Where the calendar meeting ended: everything after it is the call running on as small talk. */
  meetingEndMin: 14 * 60 + 45,
};

/** Now. The Discord call is still open, so the row still grows to here. */
export const NOW_MIN = 15 * 60;

export const remAt = (minute: number) => ((minute - WINDOW_FROM_MIN) / 60) * HOUR_REM;
export const remFor = (minutes: number) => (minutes / 60) * HOUR_REM;

export const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

export const duration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return hours ? `${hours}h ${rest}m` : `${rest}m`;
};
