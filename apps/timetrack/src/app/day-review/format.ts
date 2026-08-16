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

/** What a block was in, for the timeline: its branch, else its checkout, else the app it was seen in. */
export const formatBlockLabel = (block: ActivityBlock) =>
  block.context.branch ?? block.context.repoPath?.split('/').pop() ?? block.context.appId ?? 'unknown';

/** A delta against a target, where the sign is the point — `+45m` over, `−1h 15m` short. */
export const formatSignedDurationMs = (ms: number) => `${ms >= 0 ? '+' : '−'}${formatDurationMs(Math.abs(ms))}`;
