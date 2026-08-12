/**
 * A duration the way a timesheet reads it — `1h 45m`, `45m`. Rounded to the nearest minute, so
 * anything under half a minute reads as `0m` rather than as a suspiciously precise nothing.
 */
export const formatDurationMs = (ms: number) => {
  const minutes = Math.round(ms / 60_000);
  const hours = Math.floor(minutes / 60);

  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};
