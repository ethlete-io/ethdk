import { ActivityBlock, formatDurationMs } from '@ethlete/timetrack';

export const formatClockTime = (at: Date) => at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatDayLabel = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

/** What a block was in, for the timeline: its branch, else its checkout, else the app it was seen in. */
export const formatBlockLabel = (block: ActivityBlock) =>
  block.context.branch ?? block.context.repoPath?.split('/').pop() ?? block.context.appId ?? 'unknown';

/** A delta against a target, where the sign is the point — `+45m` over, `−1h 15m` short. */
export const formatSignedDurationMs = (ms: number) => `${ms >= 0 ? '+' : '−'}${formatDurationMs(Math.abs(ms))}`;
