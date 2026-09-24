import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { ActivityBlock } from '../model/block';
import { CallWindow, callLabel } from '../model/call';
import { CollectedEvent } from '../model/event';
import { WorklogProposal } from '../model/proposal';
import { ClosedTimerRun, timerRunDurationMs } from '../model/timer';
import { TimeWindow } from '../model/time-window';
import { attendedAt, markAttendance } from './attended';
import { AttributeOptions, attribute } from './attribute';
import { CallMatch, dropCallWindows, matchCalls } from './calls';
import { BehindStretch, CutOptions, cutBackground, cutUnwatched, meetLaneRows } from './cut';
import { DescribeOptions } from './describe';
import { DonateOptions, donateBlocks } from './donate';
import { DEFAULT_FILL_OPTIONS, FillOptions, fillGaps } from './fill';
import { MeetingOptions, UnobservedOccurrence, calendarOccurrences, unobservedOccurrences } from './meetings';
import { DEFAULT_MERGE_OPTIONS, MergeOptions, WorkGroup, mergeBlocks } from './merge';
import { mergeRequestActivity } from './merge-request-activity';
import { NoWorkContextOptions, dropNoWorkContext } from './no-work-context';
import { clipBlocks } from './overlap';
import { PrivateTime, privateTime } from './project-link';
import { UnnamedProposal, propose } from './propose';
import {
  BookedRemoteWindow,
  RemoteBooking,
  bookedSpanMs,
  remoteBookingOnGrid,
  unbookedRemoteByRow,
} from './remote-booking';
import { CheckDayOptions, RoundOptions } from './round';
import { TimerMatch, matchTimerRuns, timerProposesRow } from './timers';

export type BuildRowsOptions = {
  config?: GitFlowConfig;
  resolveBase?: AttributeOptions['resolveBase'];
  activity?: AttributeOptions['activity'];
  patterns?: AttributeOptions['patterns'];
  rules?: AttributeOptions['rules'];
  /** The stand-ins the rules point at. Without them a stand-in rule names nothing. */
  standIns?: AttributeOptions['standIns'];
  /** The user's path-to-project links. A private one takes its context out of the day entirely. */
  links?: AttributeOptions['links'];
  /**
   * What the reasoning provider proposed, from a run over this day's own unattributed contexts.
   * Passing none is the deterministic day, and is what the provider's input is read from.
   */
  inferred?: AttributeOptions['inferred'];
  /** What the checkouts sharing a branch slug already book, from a first read of this same day. */
  epics?: AttributeOptions['epics'];
  /** How far a donating repository's time looks for the work it was done for. */
  donate?: Partial<DonateOptions>;
  /** Which projects run behind the day, and the focus that ranks two of them — see `cutBackground`. */
  cut?: CutOptions;
  /** The longest idle gap that joins the work before it. `maxFillGapMs: 0` fills nothing. */
  fill?: Partial<FillOptions>;
  /** How a meeting is named. `config` and `patterns` are taken from the day's own, not repeated here. */
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
  /** The stretches the user worked from another device, from `remoteWorkWindows`. A band in one is attended. */
  remoteWork?: readonly TimeWindow[];
  /** The part of `remoteWork` the day books, from `bookedRemoteWindows`. The rest is drawn and never booked. */
  bookedRemote?: readonly BookedRemoteWindow[];
  /** The most `bookedRemote` may book once it is on the row grid. */
  maxRemoteAttentionMs?: number;
};

export type DayRows = {
  proposals: WorklogProposal[];
  unattributed: WorkGroup[];
  /** The unattributed work as rows, for the day screen to draw and the reviewer to cut and name. */
  unnamed: UnnamedProposal[];
  /**
   * The occurrences the day heard no call over. They are questions the review asks, never rows: an
   * invitation records an intention, and only the microphone records that a meeting happened.
   */
  unobserved: UnobservedOccurrence[];
  /**
   * Every call of the day as a row: the ones a rule counted as work, named from the calendar and
   * carrying the activity seen during them, and the ones a rule excluded, which carry neither.
   */
  calls: CallMatch[];
  /** What the user timed by hand, with how much activity was observed inside each run. */
  timers: TimerMatch[];
  /** Idle time `fillGaps` joined to the work around it, which the day claims with nothing behind it. */
  filledMs: number;
  /**
   * The stretches a foreground band took from a background band, so a lane's hole can be drawn and
   * explained. Not rows: another band already claims the minutes, and no worklog may hold them twice.
   */
  behind: BehindStretch[];
  /** Time in a path the user marked private, for the day to label rather than bill. */
  private: PrivateTime[];
  /** How much of the day that time covers. It is owed to nobody and counts against no target. */
  privateMs: number;
  /**
   * The day's remote stretches on the row grid, and the part of them it books. A row's duration leaves
   * out the rest — see `unbookedRemoteByRow`.
   */
  remote?: RemoteBooking;
};

/**
 * Turns a day's blocks into the rows a review books from — attribute, donate, cut, merge, round,
 * describe — and adds the rows nothing observed as blocks at all: the meetings, the calls and the
 * runs the user timed. Pure: no network, no clock, no filesystem.
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
 * attributed, so a media player proposes no time and gets no lane. Which meeting a call was is read
 * off the unfiltered blocks, so a call held in one of those applications is still named by its own
 * window title.
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
  // Before anything else is cut: a call's own window is the call, and a band of it beside the call row
  // would claim the same minutes twice.
  const heard = dropCallWindows({ blocks, calls: options.calls ?? [] });
  const unwatched = [...timers.map((timer) => timer.run), ...pauses];
  const reconstructed = clipBlocks({ blocks: heard, windows: unwatched });
  // The same day with the call's own windows still in it. Their titles are what say which meeting the
  // call was, and `heard` has just cut every one of them out.
  const titled = clipBlocks({ blocks, windows: unwatched });
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
      standIns: options.standIns,
      links: options.links,
      inferred: options.inferred,
      epics: options.epics,
    }),
  );
  // Private blocks leave before donation rather than after proposal: a repository the user took out
  // of their working day must not lend its time to the work beside it either.
  const secluded = attributed.flatMap((entry) =>
    entry.privateLink ? [{ block: entry.block, link: entry.privateLink }] : [],
  );
  const working = attributed.filter((entry) => !entry.privateLink);
  // Before donation rather than after: a minute another session of the same checkout already books
  // must not lend its time to the work beside it either.
  const watched = cutUnwatched({ blocks: working, events: options.events });
  const donated = donateBlocks({ blocks: watched, rules: options.rules, options: options.donate });
  // Before the gaps are filled rather than after: a filled minute is idle time joined to the work
  // around it, and cutting one away afterwards would leave `filledMs` claiming time no row holds.
  // The calls are handed in raw rather than as the rows `matchCalls` builds later: a call is the
  // foreground of the minutes it runs in, and the cut has to happen before a gap is filled.
  const cut = cutBackground({
    blocks: donated,
    claimed: (options.calls ?? []).filter((call) => call.countsAsWork),
    round: options.round,
    ...options.cut,
  });
  const naming = { ...options.meetings, config: options.config, patterns: options.patterns };
  const occurrences = calendarOccurrences(options.events);
  // `nameable` rather than `blocks`: `overlapMs` is the time the day proposes twice, and a block no
  // row is built from proposes nothing. A call held in one of those applications would otherwise warn
  // that the reviewer has to look at an hour nothing else claims.
  const calls = matchCalls({
    calls: options.calls ?? [],
    blocks: nameable,
    titled,
    claimed: unwatched,
    occurrences,
    meetings: naming,
  });
  const unobserved = unobservedOccurrences({ occurrences, calls: options.calls ?? [], meetings: naming });
  // A call a rule excluded claims nothing: it books no time, and a voice room left open is the one
  // thing that must never stand in for a person being at the machine.
  const booked = calls.filter((match) => match.call.countsAsWork);
  const filled = fillGaps({
    blocks: cut.blocks,
    events: options.events,
    claimed: [...unwatched, ...booked.map((call) => call.group)],
    options: options.fill,
  });
  // Attendance is marked after the merge and before the proposal: a band is the unit the user books,
  // so it is the unit the question "was anybody here" has to be answered for. A call and a timed run
  // are the user's own acts, so they answer it themselves.
  const groups = markAttendance({
    groups: [
      ...mergeBlocks({ blocks: filled.blocks, barriers: options.breaks, options: options.merge }),
      ...calls.map((call) => call.group),
      ...timers.filter((timer) => timerProposesRow(timer.run)).map((timer) => timer.group),
    ],
    at: [
      ...attendedAt({
        events: options.events,
        graceMs: options.fill?.maxFillGapMs ?? DEFAULT_FILL_OPTIONS.maxFillGapMs,
      }),
      ...(options.remoteWork ?? []),
    ],
    claimed: [...unwatched, ...booked.map((call) => ({ from: call.group.from, to: call.group.to }))],
  }).sort((a, b) => a.from.getTime() - b.from.getTime());
  const { proposals, unattributed, unnamed } = propose({
    groups,
    config: options.config,
    round: options.round,
    describe: options.describe,
  });
  const secludedTime = privateTime({ blocks: secluded });
  const remote = remoteBookingOnGrid({
    drawn: options.remoteWork ?? [],
    booked: options.bookedRemote ?? [],
    maxBookedMs: options.maxRemoteAttentionMs,
    round: options.round,
  });
  const unbooked = unbookedRemoteByRow({ rows: [...proposals, ...unnamed], remote });
  const withoutUnbooked = <T extends WorklogProposal | UnnamedProposal>(row: T, index: number): T => {
    const durationMs = Math.min(row.durationMs, bookedSpanMs(row, unbooked[index]));

    return durationMs === row.durationMs ? row : { ...row, durationMs };
  };

  return {
    proposals: proposals.map(withoutUnbooked),
    unattributed,
    unnamed: unnamed.map((row, index) => withoutUnbooked(row, proposals.length + index)),
    unobserved,
    calls,
    timers,
    filledMs: filled.filledMs,
    behind: meetLaneRows({
      behind: cut.behind,
      rows: [...proposals, ...unnamed],
      round: options.round,
    }),
    private: secludedTime,
    privateMs: secludedTime.reduce((sum, entry) => sum + entry.observedMs, 0),
    remote,
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
  meetingOverlaps: rows.calls.map((call) => ({
    label: call.group.issueKey ?? callLabel(call.call),
    from: call.group.from,
    overlapMs: call.overlapMs,
  })),
  timerUnobservedMs: rows.timers.reduce(
    (sum, timer) => sum + Math.max(0, timerRunDurationMs(timer.run) - timer.observedMs),
    0,
  ),
  filledMs: rows.filledMs,
});
