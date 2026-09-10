import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { ActivityBlock } from '../model/block';
import { CallWindow } from '../model/call';
import { CollectedEvent } from '../model/event';
import { WorklogProposal } from '../model/proposal';
import { ClosedTimerRun, timerRunDurationMs } from '../model/timer';
import { TimeWindow } from '../model/time-window';
import { AttributeOptions, attribute } from './attribute';
import { CallMatch, matchCalls } from './calls';
import { DescribeOptions } from './describe';
import { DonateOptions, donateBlocks } from './donate';
import { FillOptions, fillGaps } from './fill';
import { MeetingMatch, MeetingOptions, matchMeetings } from './meetings';
import { DEFAULT_MERGE_OPTIONS, MergeOptions, WorkGroup, mergeBlocks } from './merge';
import { mergeRequestActivity } from './merge-request-activity';
import { NoWorkContextOptions, dropNoWorkContext } from './no-work-context';
import { clipBlocks } from './overlap';
import { PrivateTime, privateTime } from './project-link';
import { UnnamedProposal, propose } from './propose';
import { CheckDayOptions, RoundOptions } from './round';
import { TimerMatch, matchTimerRuns } from './timers';

export type BuildRowsOptions = {
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
  /** Meeting handling. `config` and `patterns` are taken from the day's own, not repeated here. */
  meetings?: Omit<MeetingOptions, 'config' | 'patterns'>;
  /**
   * The applications that can name no work, from `effectiveNoWorkContextApps` and
   * `effectiveTransientApps`. Their blocks propose no time and get no lane.
   */
  noWorkContext?: NoWorkContextOptions;
  merge?: Partial<MergeOptions>;
  round?: Partial<RoundOptions>;
  describe?: Partial<DescribeOptions>;
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
  /**
   * The breaks the day held, from `breakWindows`. No band is drawn across one: the user left the desk,
   * so the work before it and the work after it are two stretches.
   */
  breaks?: readonly TimeWindow[];
};

export type DayRows = {
  proposals: WorklogProposal[];
  unattributed: WorkGroup[];
  /** The unattributed work as rows, for the day screen to draw and the reviewer to cut and name. */
  unnamed: UnnamedProposal[];
  /** What the calendar contributed, with how much of each meeting the machine actually saw. */
  meetings: MeetingMatch[];
  /** The calls a rule counted as work, with how much activity was observed during each. */
  calls: CallMatch[];
  /** What the user timed by hand, with how much activity was observed inside each run. */
  timers: TimerMatch[];
  /** Idle time `fillGaps` joined to the work around it, which the day claims with nothing behind it. */
  filledMs: number;
  /** Time in a path the user marked private, for the day to label rather than bill. */
  private: PrivateTime[];
  /** How much of the day that time covers. It is owed to nobody and counts against no target. */
  privateMs: number;
};

/**
 * Turns a day's blocks into the rows a review books from — attribute, donate, merge, round, describe
 * — and adds the rows nothing observed as blocks at all: the meetings, the calls a rule counted and
 * the runs the user timed. Pure: no network, no clock, no filesystem.
 *
 * A timer run displaces the reconstruction underneath it. Whatever the collectors saw while it ran
 * describes the work the run already claims, so those blocks are cut out before anything is proposed
 * from them — the alternative is a day that proposes the same hour twice.
 *
 * A pause is cut out for the opposite reason: nothing watched it, and the samples on either side are
 * close enough together that the block builder would otherwise bridge the hole and bill it.
 *
 * A break ends a band rather than being cut out of one. The blocks on either side are real work and
 * keep their time; what a break denies is one band drawn across it.
 *
 * A block that names nothing but an application on `noWorkContext` is dropped before it is
 * attributed, so a media player proposes no time and gets no lane. Meetings, calls and timer runs are
 * matched against the unfiltered blocks, so a call held in one of those applications keeps the
 * activity observed during it.
 *
 * Which builder produced the blocks is not its business, which is what lets the two day pipelines
 * share one ladder, one merge and one rounding rather than drifting apart on all three.
 */
export const buildRows = (
  options: { blocks: readonly ActivityBlock[]; events: readonly CollectedEvent[] } & BuildRowsOptions,
): DayRows => {
  const { blocks } = options;
  const timers = matchTimerRuns({ runs: options.timerRuns ?? [], blocks });
  const pauses = options.pauses ?? [];
  const reconstructed = clipBlocks({ blocks, windows: [...timers.map((timer) => timer.run), ...pauses] });
  // The GitLab rung is derived here rather than passed in: the day's events already hold it, and a
  // caller that had to remember to fetch it would be a caller that forgets on one of the four screens.
  const activity = [
    ...(options.activity ?? []),
    ...mergeRequestActivity({ events: options.events, config: options.config }),
  ];
  const nameable = dropNoWorkContext({ blocks: reconstructed, ...options.noWorkContext });
  const attributed = nameable.map((block) =>
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
  // `nameable` rather than `blocks`: `overlapMs` is the time the day proposes twice, and a block no
  // row is built from proposes nothing. A call held in one of those applications would otherwise warn
  // that the reviewer has to look at an hour nothing else claims.
  const calls = matchCalls({ calls: options.calls ?? [], blocks: nameable, claimed, meetings: naming });
  const filled = fillGaps({
    blocks: donated,
    events: options.events,
    claimed: [...claimed, ...calls.map((call) => call.group)],
    options: options.fill,
  });
  const groups = [
    ...mergeBlocks({ blocks: filled.blocks, barriers: options.breaks, options: options.merge }),
    ...meetings.map((meeting) => meeting.group),
    ...calls.map((call) => call.group),
    ...timers.map((timer) => timer.group),
  ].sort((a, b) => a.from.getTime() - b.from.getTime());
  const { proposals, unattributed, unnamed } = propose({
    groups,
    config: options.config,
    round: options.round,
    describe: options.describe,
  });
  const secludedTime = privateTime({ blocks: secluded });

  return {
    proposals,
    unattributed,
    unnamed,
    meetings,
    calls,
    timers,
    filledMs: filled.filledMs,
    private: secludedTime,
    privateMs: secludedTime.reduce((sum, entry) => sum + entry.observedMs, 0),
  };
};

/**
 * What a day's own rows say about the checks a reviewer should see, for `checkDay` to warn on.
 *
 * Derived here rather than passed in, so a screen cannot forget one: `pausedMs` is the only input a
 * caller still owns, because a pause is a window of the day rather than a row of it.
 */
export const dayCheckOptions = (rows: DayRows): CheckDayOptions => ({
  maxRowsPerDay: DEFAULT_MERGE_OPTIONS.maxRowsPerDay,
  meetingOverlapMs:
    rows.meetings.reduce((sum, meeting) => sum + meeting.overlapMs, 0) +
    rows.calls.reduce((sum, call) => sum + call.overlapMs, 0),
  timerUnobservedMs: rows.timers.reduce(
    (sum, timer) => sum + Math.max(0, timerRunDurationMs(timer.run) - timer.observedMs),
    0,
  ),
  filledMs: rows.filledMs,
});
