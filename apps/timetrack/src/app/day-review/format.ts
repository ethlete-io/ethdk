import { ActivityBlock, formatDurationMs } from '@ethlete/timetrack';

export const formatClockTime = (at: Date) => at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatDayLabel = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

/** A weekday and its date, for a list of days — `Mon 10 Aug`. */
export const formatWeekdayLabel = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

/** The span a week covers, as one label — `10 Aug – 16 Aug 2026`. */
export const formatDayRangeLabel = (from: string, to: string) =>
  `${new Date(`${from}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${new Date(
    `${to}T00:00:00`,
  ).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`;

/**
 * What a block was in, for the timeline: its checkout and branch, else whichever of the two it has,
 * else the app it was seen in.
 *
 * The checkout leads because a branch name alone does not identify work — `next` is a branch in most
 * repositories here, and a day that shows it three times says nothing about which project each was.
 */
export const formatBlockLabel = (block: ActivityBlock) => {
  const repo = block.context.repoPath?.split('/').filter(Boolean).pop();
  const branch = block.context.branch;

  if (repo && branch) return `${repo} · ${branch}`;

  return branch ?? repo ?? block.context.appId ?? 'unknown';
};

/** A delta against a target, where the sign is the point — `+45m` over, `−1h 15m` short. */
export const formatSignedDurationMs = (ms: number) => `${ms >= 0 ? '+' : '−'}${formatDurationMs(Math.abs(ms))}`;
