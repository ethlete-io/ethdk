import { ActivityBlock } from '../model/block';
import { CollectedEvent } from '../model/event';
import { timerRunDurationMs } from '../model/timer';
import { TimeWindow } from '../model/time-window';
import { BuildRowsOptions, DayRows, buildRows } from '../rows/build-rows';
import { DEFAULT_MERGE_OPTIONS } from '../rows/merge';
import { CheckDayOptions, DayCheck, checkDay } from '../rows/round';
import { pausedMs } from '../stream/pauses';
import { SessionizeOptions, sessionize } from './sessionize';

export type CorrelateDayOptions = BuildRowsOptions & {
  sessionize?: Partial<SessionizeOptions>;
  check?: CheckDayOptions;
};

export type DayCorrelation = DayRows & {
  /** The sessionized day, kept for the timeline half of the review UI. Never clipped. */
  blocks: ActivityBlock[];
  /** The stretches collection was stopped for, for the timeline to draw as the holes they are. */
  pauses: readonly TimeWindow[];
  /** How much of the day those stretches cover. */
  pausedMs: number;
  check: DayCheck;
};

/**
 * Runs a window of collected events through the v1 pipeline and returns what a day review needs.
 * Pure: no network, no clock, no filesystem, so the same events always produce the same day.
 *
 * `sessionize` is the half of it that ADR 0007 replaces. Everything after the blocks is `buildRows`,
 * which the stream pipeline reads the same way.
 */
export const correlateDay = (options: { events: CollectedEvent[] } & CorrelateDayOptions): DayCorrelation => {
  const blocks = sessionize({ events: options.events, options: options.sessionize });
  const pauses = options.pauses ?? [];
  const rows = buildRows({ ...options, blocks });

  return {
    ...rows,
    blocks,
    pauses,
    pausedMs: pausedMs(pauses),
    check: checkDay({
      proposals: rows.proposals,
      unattributed: rows.unattributed,
      options: {
        maxRowsPerDay: options.merge?.maxRowsPerDay ?? DEFAULT_MERGE_OPTIONS.maxRowsPerDay,
        meetingOverlapMs:
          rows.meetings.reduce((sum, meeting) => sum + meeting.overlapMs, 0) +
          rows.calls.reduce((sum, call) => sum + call.overlapMs, 0),
        timerUnobservedMs: rows.timers.reduce(
          (sum, timer) => sum + Math.max(0, timerRunDurationMs(timer.run) - timer.observedMs),
          0,
        ),
        filledMs: rows.filledMs,
        pausedMs: pausedMs(pauses),
        ...options.check,
      },
    }),
  };
};
