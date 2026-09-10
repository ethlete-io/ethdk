import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { ActivityBlock } from '../model/block';
import { CallWindow } from '../model/call';
import { CollectedEvent } from '../model/event';
import { WorklogProposal } from '../model/proposal';
import { ClosedTimerRun, timerRunDurationMs } from '../model/timer';
import { TimeWindow } from '../model/time-window';
import { AttributeOptions, attribute } from '../rows/attribute';
import { CallMatch, matchCalls } from '../rows/calls';
import { DescribeOptions } from '../rows/describe';
import { DonateOptions, donateBlocks } from '../rows/donate';
import { FillOptions, fillGaps } from '../rows/fill';
import { MeetingMatch, MeetingOptions, matchMeetings } from '../rows/meetings';
import { mergeRequestActivity } from '../rows/merge-request-activity';
import { DEFAULT_MERGE_OPTIONS, MergeOptions, WorkGroup, mergeBlocks } from '../rows/merge';
import { clipBlocks } from '../rows/overlap';
import { pausedMs } from '../stream/pauses';
import { PrivateTime, privateTime } from '../rows/project-link';
import { propose } from '../rows/propose';
import { CheckDayOptions, DayCheck, RoundOptions, checkDay } from '../rows/round';
import { SessionizeOptions, sessionize } from './sessionize';
import { TimerMatch, matchTimerRuns } from '../rows/timers';

export type CorrelateDayOptions = {
  config?: GitFlowConfig;
  resolveBase?: AttributeOptions['resolveBase'];
  activity?: AttributeOptions['activity'];
  patterns?: AttributeOptions['patterns'];
  rules?: AttributeOptions['rules'];
  /** The user's path-to-project links. A private one takes its context out of the day entirely. */
  links?: AttributeOptions['links'];
  /**
   * What the reasoning provider proposed, from a run over this day's own unattributed contexts.
   * Passing none is the deterministic day, and is what the provider's input is read from.
   */
  inferred?: AttributeOptions['inferred'];
  /** How far a donating repository's time looks for the work it was done for. */
  donate?: Partial<DonateOptions>;
  /** The longest idle gap that joins the work before it. `maxFillGapMs: 0` fills nothing. */
  fill?: Partial<FillOptions>;
  sessionize?: Partial<SessionizeOptions>;
  /** Meeting handling. `config` and `patterns` are taken from the day's own, not repeated here. */
  meetings?: Omit<MeetingOptions, 'config' | 'patterns'>;
  merge?: Partial<MergeOptions>;
  round?: Partial<RoundOptions>;
  describe?: Partial<DescribeOptions>;
  check?: CheckDayOptions;
  /** Runs the user started and stopped by hand. Close an open one first — this takes no clock. */
  timerRuns?: readonly ClosedTimerRun[];
  /**
   * The day's calls, from `classifyCalls`. Classify them first — the rules live in the settings and a
   * call still open has to be cut off against a clock this does not take.
   */
  calls?: readonly CallWindow[];
  /**
   * The stretches the user had stopped collection for, from `pauseWindows`. Close an open one first —
   * this takes no clock either.
   */
  pauses?: readonly TimeWindow[];
};

export type DayCorrelation = {
  /** The sessionized day, kept for the timeline half of the review UI. Never clipped. */
  blocks: ActivityBlock[];
  proposals: WorklogProposal[];
  unattributed: WorkGroup[];
  /** What the calendar contributed, with how much of each meeting the machine actually saw. */
  meetings: MeetingMatch[];
  /** The calls a rule counted as work, with how much activity was observed during each. */
  calls: CallMatch[];
  /** What the user timed by hand, with how much activity was observed inside each run. */
  timers: TimerMatch[];
  /** Idle time `fillGaps` joined to the work around it, which the day claims with nothing behind it. */
  filledMs: number;
  /** The stretches collection was stopped for, for the timeline to draw as the holes they are. */
  pauses: readonly TimeWindow[];
  /** How much of the day those stretches cover. */
  pausedMs: number;
  /** Time in a path the user marked private, for the day to label rather than bill. */
  private: PrivateTime[];
  /** How much of the day that time covers. It is owed to nobody and counts against no target. */
  privateMs: number;
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
 *
 * A pause is cut out for the opposite reason: nothing watched it, and the samples on either side are
 * close enough together that the sessionizer would otherwise bridge the hole and bill it.
 */
export const correlateDay = (options: { events: CollectedEvent[] } & CorrelateDayOptions): DayCorrelation => {
  const blocks = sessionize({ events: options.events, options: options.sessionize });
  const timers = matchTimerRuns({ runs: options.timerRuns ?? [], blocks });
  const pauses = options.pauses ?? [];
  const reconstructed = clipBlocks({ blocks, windows: [...timers.map((timer) => timer.run), ...pauses] });
  // The GitLab rung is derived here rather than passed in: the day's events already hold it, and a
  // caller that had to remember to fetch it would be a caller that forgets on one of the four screens.
  const activity = [
    ...(options.activity ?? []),
    ...mergeRequestActivity({ events: options.events, config: options.config }),
  ];
  const attributed = reconstructed.map((block) =>
    attribute({
      block,
      config: options.config,
      resolveBase: options.resolveBase,
      activity,
      patterns: options.patterns,
      rules: options.rules,
      links: options.links,
      inferred: options.inferred,
    }),
  );
  // Private blocks leave before donation rather than after proposal: a repository the user took out
  // of their working day must not lend its time to the work beside it either.
  const secluded = attributed.flatMap((entry) =>
    entry.privateLink ? [{ block: entry.block, link: entry.privateLink }] : [],
  );
  const working = attributed.filter((entry) => !entry.privateLink);
  const donated = donateBlocks({ blocks: working, rules: options.rules, options: options.donate });
  const naming = { ...options.meetings, config: options.config, patterns: options.patterns };
  const meetings = matchMeetings({ events: options.events, blocks, meetings: naming });
  const claimed = [...timers.map((timer) => timer.run), ...meetings.map((meeting) => meeting.group), ...pauses];
  const calls = matchCalls({ calls: options.calls ?? [], blocks, claimed, meetings: naming });
  const filled = fillGaps({
    blocks: donated,
    events: options.events,
    claimed: [...claimed, ...calls.map((call) => call.group)],
    options: options.fill,
  });
  const groups = [
    ...mergeBlocks({ blocks: filled.blocks, options: options.merge }),
    ...meetings.map((meeting) => meeting.group),
    ...calls.map((call) => call.group),
    ...timers.map((timer) => timer.group),
  ].sort((a, b) => a.from.getTime() - b.from.getTime());
  const { proposals, unattributed } = propose({
    groups,
    config: options.config,
    round: options.round,
    describe: options.describe,
  });
  const secludedTime = privateTime({ blocks: secluded });

  return {
    blocks,
    proposals,
    unattributed,
    meetings,
    calls,
    timers,
    filledMs: filled.filledMs,
    pauses,
    pausedMs: pausedMs(pauses),
    private: secludedTime,
    privateMs: secludedTime.reduce((sum, entry) => sum + entry.observedMs, 0),
    check: checkDay({
      proposals,
      unattributed,
      options: {
        maxRowsPerDay: options.merge?.maxRowsPerDay ?? DEFAULT_MERGE_OPTIONS.maxRowsPerDay,
        meetingOverlapMs:
          meetings.reduce((sum, meeting) => sum + meeting.overlapMs, 0) +
          calls.reduce((sum, call) => sum + call.overlapMs, 0),
        timerUnobservedMs: timers.reduce(
          (sum, timer) => sum + Math.max(0, timerRunDurationMs(timer.run) - timer.observedMs),
          0,
        ),
        filledMs: filled.filledMs,
        pausedMs: pausedMs(pauses),
        ...options.check,
      },
    }),
  };
};
