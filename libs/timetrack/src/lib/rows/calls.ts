import { ActivityBlock } from '../model/block';
import { CallWindow, callLabel } from '../model/call';
import { CallFeatures, DEFAULT_CALL_AFTER_GAP_MS, callFeaturesOf, matchCallNaming } from '../model/call-naming';
import { CalendarOccurrenceEvent } from '../model/event';
import { Confidence, Evidence } from '../model/evidence';
import { meetingSeriesKey } from '../model/meeting-naming';
import { TimeWindow, subtractWindows } from '../model/time-window';
import { CALL_LANE_KEY, MEETING_LANE_KEY } from './lane';
import {
  CalendarCandidate,
  MeetingOptions,
  NamedIssue,
  PickedCandidate,
  candidatesFor,
  occurrenceIssueKey,
  patternIssueKey,
  pickCandidate,
} from './meetings';
import { WorkGroup } from './merge';
import { clipBlocks, overlapMs } from './overlap';

export type CallMatch = {
  call: CallWindow;
  /**
   * Activity observed while the call ran. It is time the day now proposes twice — once as the call and
   * once as whatever the user was typing during it — so a reviewer has to see it.
   */
  overlapMs: number;
  /** The meeting this call was, when one of the day's occurrences could be picked for it. */
  meeting?: PickedCandidate;
  /**
   * Every occurrence that overlaps the call, whether one was picked or not. It is what the review
   * offers when nothing decided, so the user answers from a list rather than from memory.
   */
  candidates: CalendarCandidate[];
  /** The reviewable row. Carries no `issueKey` when nothing named one, which leaves it unattributed. */
  group: WorkGroup;
  /**
   * What this call is recognised by when no occurrence names it. It is what naming its row writes to
   * the store, so an answer given once reaches the same call next week.
   */
  features: CallFeatures;
};

/**
 * A stretch left of a call after the day's claimed time is cut out that is shorter than this proposes
 * no row. It is the scrap either end of a meeting the microphone opened early and closed late, and a
 * row that would round up to a whole increment is worse than no row.
 */
const MIN_PROPOSED_CALL_MS = 5 * 60_000;

const sharedMs = (left: TimeWindow, right: TimeWindow) =>
  Math.max(0, Math.min(left.to.getTime(), right.to.getTime()) - Math.max(left.from.getTime(), right.from.getTime()));

const pad = (value: number) => String(value).padStart(2, '0');

const timeOfDay = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const callEvidence = (options: { call: CallWindow; window: TimeWindow }): Evidence => ({
  kind: 'call',
  at: options.window.from,
  detail: `call in _${callLabel(options.call)}_ ${timeOfDay(options.window.from)}-${timeOfDay(
    options.window.to,
  )}, which a rule counts as work`,
  summary: callLabel(options.call),
});

/**
 * How sure the row is about which work the call was.
 *
 * The call itself is never in doubt — the microphone opened. What the confidence measures is the
 * naming, so only a meeting the call itself confirmed may reach `certain`. With no meeting behind it a
 * call reaches `likely` at best, and only on the user's own remembered answer: a Tempo pattern names a
 * time of day rather than a call, so it stays `weak` and never syncs unreviewed.
 */
const confidenceOf = (options: { meeting?: PickedCandidate; key?: NamedIssue }): Confidence => {
  if (!options.key) return 'weak';
  if (!options.meeting) return options.key.strength ?? 'weak';

  return options.meeting.match === 'certain' ? 'certain' : 'likely';
};

/**
 * The answer the user already gave for a call like this one — same application, and enough of the
 * weekday, the length and what ran before it. It is what names a call the calendar never held, which
 * has no series to be remembered under. See ADR 0012.
 */
export const rememberedCallIssueKey = (options: {
  features: CallFeatures;
  meetings: MeetingOptions;
}): NamedIssue | undefined => {
  const found = matchCallNaming({ features: options.features, namings: options.meetings.callNamings ?? [] });

  if (!found) return undefined;

  return {
    issueKey: found.naming.issueKey,
    keySource: 'remembered-call',
    strength: found.match,
    evidence: {
      kind: 'call',
      at: found.naming.createdAt,
      detail: `you named _${found.naming.label}_ ${found.naming.issueKey}, and this call is like it`,
      summary: found.naming.label,
    },
  };
};

/**
 * What ran immediately before a call: the calendar series of the call before it, or that call's
 * application when the calendar named none.
 *
 * A gap past {@link DEFAULT_CALL_AFTER_GAP_MS} makes the earlier call no longer the thing that ran
 * before this one, so a morning meeting cannot key an evening call that merely follows it in the day.
 */
const afterOf = (options: {
  call: CallWindow;
  previous: CallWindow | undefined;
  occurrences: readonly CalendarOccurrenceEvent[];
  titled: readonly ActivityBlock[];
}) => {
  const { call, previous } = options;

  if (!previous) return undefined;

  const gap = call.from.getTime() - previous.to.getTime();

  if (gap < 0 || gap > DEFAULT_CALL_AFTER_GAP_MS) return undefined;

  const window = { from: previous.from, to: previous.to };
  const picked = pickCandidate({
    call: previous,
    window,
    candidates: candidatesFor({ occurrences: options.occurrences, window }),
    blocks: options.titled,
  });

  return picked ? `series:${meetingSeriesKey(picked.event)}` : `app:${previous.appId.trim().toLowerCase()}`;
};

const matchOne = (options: {
  call: CallWindow;
  window: TimeWindow;
  after?: string;
  blocks: readonly ActivityBlock[];
  titled: readonly ActivityBlock[];
  occurrences: readonly CalendarOccurrenceEvent[];
  meetings: MeetingOptions;
}): CallMatch => {
  const { call, window, blocks, meetings } = options;
  const candidates = candidatesFor({ occurrences: options.occurrences, window });
  const meeting = pickCandidate({ call, window, candidates, blocks: options.titled });
  const features = callFeaturesOf({ appId: call.appId, from: window.from, to: window.to, after: options.after });
  /**
   * The user's own answer is read before the history: a remembered naming is a statement about this
   * call, and a pattern is a statement about this time of day. See ADR 0012.
   */
  const key = meeting
    ? occurrenceIssueKey({ event: meeting.event, meetings })
    : (rememberedCallIssueKey({ features, meetings }) ?? patternIssueKey({ at: window.from, meetings }));

  return {
    call,
    overlapMs: blocks.reduce((sum, block) => sum + overlapMs({ block, window }), 0),
    ...(meeting ? { meeting } : {}),
    candidates,
    features,
    group: {
      ...(key ? { issueKey: key.issueKey } : {}),
      from: window.from,
      to: window.to,
      // The microphone's own span, which is time it observed rather than time it reconstructed. A call
      // produces no input at all, so the blocks under it account for almost none of it.
      observedMs: window.to.getTime() - window.from.getTime(),
      confidence: confidenceOf({ meeting, key }),
      evidence: [
        callEvidence({ call, window }),
        ...(meeting?.evidence ?? []),
        ...(key?.evidence ? [key.evidence] : []),
      ],
      blocks: [],
      laneKey: meeting ? MEETING_LANE_KEY : CALL_LANE_KEY,
    },
  };
};

/**
 * The calendar occurrence a row was named from, or nothing.
 *
 * A naming is remembered against a calendar series, so naming a row only teaches the day something
 * when the row can be traced back to an occurrence. The lane and the clock are that link: a meeting
 * row keeps the meeting lane, and an edit moves its ends without making it a different meeting. The
 * call sharing the most time with the row wins, so two meetings in one hour still name one each.
 */
export const meetingBehindRow = (options: {
  row: { from: Date; to: Date; laneKey?: string };
  calls: readonly CallMatch[];
}): CalendarOccurrenceEvent | undefined => {
  if (options.row.laneKey !== MEETING_LANE_KEY) return undefined;

  return options.calls
    .flatMap((match) =>
      match.meeting ? [{ event: match.meeting.event, sharedMs: sharedMs(options.row, match.group) }] : [],
    )
    .filter((entry) => entry.sharedMs > 0)
    .sort((a, b) => b.sharedMs - a.sharedMs)[0]?.event;
};

/**
 * The call a row was named from when no calendar occurrence named it, or nothing.
 *
 * It is the counterpart of {@link meetingBehindRow} for the call lane: a call the calendar never held
 * has no series to be remembered under, so its answer is remembered against the call's own features
 * instead. A row in the meeting lane is left to `meetingBehindRow`, and a call an occurrence named is
 * skipped here, so one answer never writes into both stores.
 */
export const callBehindRow = (options: {
  row: { from: Date; to: Date; laneKey?: string };
  calls: readonly CallMatch[];
}): CallMatch | undefined => {
  if (options.row.laneKey !== CALL_LANE_KEY) return undefined;

  return options.calls
    .filter((match) => !match.meeting)
    .map((match) => ({ match, sharedMs: sharedMs(options.row, match.group) }))
    .filter((entry) => entry.sharedMs > 0)
    .sort((a, b) => b.sharedMs - a.sharedMs)[0]?.match;
};

/**
 * Cuts the application a call is held in out of the blocks, for as long as the call runs.
 *
 * A browser window focused while a Meet runs in it is the call, and a chat window focused during a
 * call in the same client is that call too. Left in, each becomes a band beside the call row claiming
 * the same minutes, which is the only reason those applications ever took a lane.
 *
 * Only that one application, and only a block that names no checkout: an editor open during a call is
 * work done while listening, and a day that ran work and a call at once says so on purpose.
 */
export const dropCallWindows = (options: {
  blocks: readonly ActivityBlock[];
  calls: readonly CallWindow[];
}): ActivityBlock[] => {
  const held = options.calls.filter((call) => call.countsAsWork);

  if (!held.length) return [...options.blocks];

  return options.blocks.flatMap((block) => {
    if (block.context.repoPath || !block.context.appId) return [block];

    const appId = block.context.appId.toLowerCase();
    const windows = held.filter((call) => call.appId.toLowerCase() === appId);

    return windows.length ? clipBlocks({ blocks: [block], windows }) : [block];
  });
};

/**
 * Turns the calls the rules counted as work into reviewable rows of their own, and names each from the
 * day's calendar.
 *
 * A call is the one thing the microphone observed directly and the reconstruction cannot see. Sitting
 * in one produces no input, `streamDay` builds no block from a call event on purpose, and without
 * this the day counts the hour as presence and proposes nothing for it.
 *
 * The calendar contributes no row of its own. It is a candidate list: every occurrence that overlaps
 * the call is offered, one is picked from the call's own evidence, and the meeting's name and issue
 * come from the picked one. So the real start is the microphone's, and a meeting nobody attended is
 * never billed.
 *
 * Time the day already claims — a timer run, a pause — is cut out of a call first, and each stretch
 * that is left becomes a row. Rows come back in start order, and a call nothing could name an issue
 * for comes back without one, which lands it in the day's unattributed groups rather than on a
 * guessed ticket.
 */
export const matchCalls = (options: {
  calls: readonly CallWindow[];
  blocks: readonly ActivityBlock[];
  /**
   * The blocks the meeting is named out of: the same day before the call's own windows were cut and
   * before an application no rule counts as work was dropped. The title of the browser tab holding a
   * Meet is the one string that says *which* meeting the call was, and both of those cuts remove it.
   * Defaults to `blocks`.
   */
  titled?: readonly ActivityBlock[];
  /** Time the day already proposes: a timer run, a pause. A call proposes no row over it. */
  claimed: readonly TimeWindow[];
  /** The day's calendar occurrences, from `calendarOccurrences`. Each call is named out of these. */
  occurrences?: readonly CalendarOccurrenceEvent[];
  /** How a call is named: the user's remembered answers, Tempo history and the branch grammar. */
  meetings?: MeetingOptions;
}): CallMatch[] => {
  const titled = options.titled ?? options.blocks;
  const occurrences = options.occurrences ?? [];
  /**
   * Every call of the day in start order, not only the ones a rule counted as work. A voice room the
   * attendance gate dropped still ran before the call that follows it, and `after` asks what ran
   * before rather than what books.
   */
  const inOrder = [...options.calls].sort((left, right) => left.from.getTime() - right.from.getTime());
  const after = new Map<CallWindow, string | undefined>(
    inOrder.map((call, index) => [call, afterOf({ call, previous: inOrder[index - 1], occurrences, titled })]),
  );

  return inOrder
    .filter((call) => call.countsAsWork)
    .flatMap((call) =>
      subtractWindows({ windows: [{ from: call.from, to: call.to }], without: options.claimed })
        .filter((window) => window.to.getTime() - window.from.getTime() >= MIN_PROPOSED_CALL_MS)
        .map((window) =>
          matchOne({
            call,
            window,
            after: after.get(call),
            blocks: options.blocks,
            titled,
            occurrences,
            meetings: options.meetings ?? {},
          }),
        ),
    )
    .sort((left, right) => left.group.from.getTime() - right.group.from.getTime());
};
