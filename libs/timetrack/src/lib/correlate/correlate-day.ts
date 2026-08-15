import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { ActivityBlock } from '../model/block';
import { CollectedEvent } from '../model/event';
import { WorklogProposal } from '../model/proposal';
import { ClosedTimerRun, timerRunDurationMs } from '../model/timer';
import { AttributeOptions, attribute } from './attribute';
import { DescribeOptions } from './describe';
import { DonateOptions, donateBlocks } from './donate';
import { MeetingMatch, MeetingOptions, matchMeetings } from './meetings';
import { DEFAULT_MERGE_OPTIONS, MergeOptions, WorkGroup, mergeBlocks } from './merge';
import { clipBlocks } from './overlap';
import { propose } from './propose';
import { CheckDayOptions, DayCheck, RoundOptions, checkDay } from './round';
import { SessionizeOptions, sessionize } from './sessionize';
import { TimerMatch, matchTimerRuns } from './timers';

export type CorrelateDayOptions = {
  config?: GitFlowConfig;
  resolveBase?: AttributeOptions['resolveBase'];
  activity?: AttributeOptions['activity'];
  patterns?: AttributeOptions['patterns'];
  rules?: AttributeOptions['rules'];
  /** How far a donating repository's time looks for the work it was done for. */
  donate?: Partial<DonateOptions>;
  sessionize?: Partial<SessionizeOptions>;
  /** Meeting handling. `config` and `patterns` are taken from the day's own, not repeated here. */
  meetings?: Omit<MeetingOptions, 'config' | 'patterns'>;
  merge?: Partial<MergeOptions>;
  round?: Partial<RoundOptions>;
  describe?: Partial<DescribeOptions>;
  check?: CheckDayOptions;
  /** Runs the user started and stopped by hand. Close an open one first — this takes no clock. */
  timerRuns?: readonly ClosedTimerRun[];
};

export type DayCorrelation = {
  /** The sessionized day, kept for the timeline half of the review UI. Never clipped. */
  blocks: ActivityBlock[];
  proposals: WorklogProposal[];
  unattributed: WorkGroup[];
  /** What the calendar contributed, with how much of each meeting the machine actually saw. */
  meetings: MeetingMatch[];
  /** What the user timed by hand, with how much activity was observed inside each run. */
  timers: TimerMatch[];
  check: DayCheck;
};

/**
 * Runs a window of collected events through the whole deterministic pipeline — sessionize, attribute,
 * merge, round, describe, explain — and returns what a day review needs. Pure: no network, no clock,
 * no filesystem, so the same events always produce the same day.
 *
 * A timer run displaces the reconstruction underneath it. Whatever the collectors saw while it ran
 * describes the work the run already claims, so those blocks are cut out before anything is proposed
 * from them — the alternative is a day that proposes the same hour twice.
 */
export const correlateDay = (options: { events: CollectedEvent[] } & CorrelateDayOptions): DayCorrelation => {
  const blocks = sessionize({ events: options.events, options: options.sessionize });
  const timers = matchTimerRuns({ runs: options.timerRuns ?? [], blocks });
  const reconstructed = clipBlocks({ blocks, windows: timers.map((timer) => timer.run) });
  const attributed = reconstructed.map((block) =>
    attribute({
      block,
      config: options.config,
      resolveBase: options.resolveBase,
      activity: options.activity,
      patterns: options.patterns,
      rules: options.rules,
    }),
  );
  const donated = donateBlocks({ blocks: attributed, rules: options.rules, options: options.donate });
  const meetings = matchMeetings({
    events: options.events,
    blocks,
    meetings: { ...options.meetings, config: options.config, patterns: options.patterns },
  });
  const groups = [
    ...mergeBlocks({ blocks: donated, options: options.merge }),
    ...meetings.map((meeting) => meeting.group),
    ...timers.map((timer) => timer.group),
  ].sort((a, b) => a.from.getTime() - b.from.getTime());
  const { proposals, unattributed } = propose({
    groups,
    config: options.config,
    round: options.round,
    describe: options.describe,
  });

  return {
    blocks,
    proposals,
    unattributed,
    meetings,
    timers,
    check: checkDay({
      proposals,
      unattributed,
      options: {
        maxRowsPerDay: options.merge?.maxRowsPerDay ?? DEFAULT_MERGE_OPTIONS.maxRowsPerDay,
        meetingOverlapMs: meetings.reduce((sum, meeting) => sum + meeting.overlapMs, 0),
        timerUnobservedMs: timers.reduce(
          (sum, timer) => sum + Math.max(0, timerRunDurationMs(timer.run) - timer.observedMs),
          0,
        ),
        ...options.check,
      },
    }),
  };
};
