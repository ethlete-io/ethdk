/**
 * A duration the way a timesheet reads it — `1h 45m`, `45m`. Rounded to the nearest minute, so
 * anything under half a minute reads as `0m` rather than as a suspiciously precise nothing.
 */
export const formatDurationMs = (ms: number) => {
  const minutes = Math.round(ms / 60_000);
  const hours = Math.floor(minutes / 60);

  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

/** Under this `formatDurationMs` reads `0m`, so a line carrying only this much carries no number. */
export const READABLE_MS = 30_000;

/** A clock time the way a day reads it — `09:55`. Local, because a day is read where the person is. */
export const formatTimeOfDay = (at: Date) =>
  `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
