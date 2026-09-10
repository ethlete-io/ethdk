import { ActivityBlock } from '../model/block';
import { CallWindow, callLabel } from '../model/call';
import { Evidence } from '../model/evidence';
import { TimeWindow, subtractWindows } from '../model/time-window';
import { MeetingOptions, standingIssueKey } from './meetings';
import { WorkGroup } from './merge';
import { clipBlocks, overlapMs } from './overlap';

export type CallMatch = {
  call: CallWindow;
  /**
   * Activity observed while the call ran. It is time the day now proposes twice — once as the call and
   * once as whatever the user was typing during it — so a reviewer has to see it.
   */
  overlapMs: number;
  /** The reviewable row. Carries no `issueKey` when nothing named one, which leaves it unattributed. */
  group: WorkGroup;
};

/**
 * A stretch left of a call after the day's claimed time is cut out that is shorter than this proposes
 * no row. It is the scrap either end of a meeting the microphone opened early and closed late, and a
 * row that would round up to a whole increment is worse than no row.
 */
const MIN_PROPOSED_CALL_MS = 5 * 60_000;

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

const matchOne = (options: {
  call: CallWindow;
  window: TimeWindow;
  blocks: readonly ActivityBlock[];
  meetings: MeetingOptions;
}): CallMatch => {
  const { call, window, blocks, meetings } = options;
  const key = standingIssueKey({ at: window.from, meetings });

  return {
    call,
    overlapMs: blocks.reduce((sum, block) => sum + overlapMs({ block, window }), 0),
    group: {
      ...(key ? { issueKey: key.issueKey } : {}),
      from: window.from,
      to: window.to,
      // The microphone's own span, which is time it observed rather than time it reconstructed. A call
      // produces no input at all, so the blocks under it account for almost none of it.
      observedMs: window.to.getTime() - window.from.getTime(),
      // Always weak, however sure the rules are that the call was work: which work it was is a
      // question nothing on this machine can answer, so no call ever syncs unreviewed.
      confidence: 'weak' as const,
      evidence: [callEvidence({ call, window }), ...(key?.evidence ? [key.evidence] : [])],
      blocks: [],
    },
  };
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
 * Turns the calls the rules counted as work into reviewable rows of their own.
 *
 * A call is the one thing the microphone observed directly and the reconstruction cannot see. Sitting
 * in one produces no input, `streamDay` builds no block from a call event on purpose, and without
 * this the day counts the hour as presence and proposes nothing for it.
 *
 * Time the day already claims is cut out of a call first, and each stretch that is left becomes a row.
 * A calendar occurrence over the same minutes names that meeting itself, so proposing the call over it
 * would bill the hour twice — and a microphone held through a meeting is no evidence of which meeting
 * it was, so the call must not raise the calendar row's confidence either.
 *
 * Rows come back in start order, and a call nothing could name an issue for comes back without one,
 * which lands it in the day's unattributed groups rather than on a guessed ticket.
 */
export const matchCalls = (options: {
  calls: readonly CallWindow[];
  blocks: readonly ActivityBlock[];
  /** Time the day already proposes: a meeting, a timer run, a pause. A call proposes no row over it. */
  claimed: readonly TimeWindow[];
  /** How a call is named. The same options a meeting is named from, so both land on the same issue. */
  meetings?: MeetingOptions;
}): CallMatch[] =>
  options.calls
    .filter((call) => call.countsAsWork)
    .flatMap((call) =>
      subtractWindows({ windows: [{ from: call.from, to: call.to }], without: options.claimed })
        .filter((window) => window.to.getTime() - window.from.getTime() >= MIN_PROPOSED_CALL_MS)
        .map((window) => matchOne({ call, window, blocks: options.blocks, meetings: options.meetings ?? {} })),
    )
    .sort((left, right) => left.group.from.getTime() - right.group.from.getTime());
