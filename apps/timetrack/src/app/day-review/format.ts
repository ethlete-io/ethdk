import { ActivityBlock, formatDurationMs } from '@ethlete/timetrack';

export { formatClockTime, formatDayLabel, formatDayRangeLabel, formatWeekdayLabel } from '../display';

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
