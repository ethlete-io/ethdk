import { formatDurationMs } from '../model/duration';
import { CollectedEvent } from '../model/event';
import { AttributedBlock } from './attribute';
import { TimeWindow } from './overlap';

export type FillOptions = {
  /**
   * The longest idle gap that joins the work before it. Kept at `maxMergeGapMs` on purpose: the gap
   * that merges two rows is the gap that gets filled, which is one rule to hold rather than two.
   */
  maxFillGapMs: number;
};

export const DEFAULT_FILL_OPTIONS: FillOptions = {
  maxFillGapMs: 15 * 60_000,
};

export type FillResult = {
  blocks: AttributedBlock[];
  /** Time the day now claims with nothing observed behind it, for the `filled-time` warning. */
  filledMs: number;
};

const within = (options: { at: Date; from: number; to: number }) =>
  options.at.getTime() >= options.from && options.at.getTime() <= options.to;

/**
 * The gap between two blocks, or nothing when the day already accounts for it.
 *
 * An `idle-start` has to sit inside it: without one nothing observed anybody at the machine, and a day
 * the window collector never watched is all holes. A `lock` disqualifies it however short it is —
 * locking the screen is a person saying they are leaving, while going idle is the machine guessing
 * they might be.
 */
const fillableGap = (options: {
  earlier: AttributedBlock;
  later: AttributedBlock;
  events: readonly CollectedEvent[];
  claimed: readonly TimeWindow[];
  maxFillGapMs: number;
}) => {
  const { earlier, later, events, claimed, maxFillGapMs } = options;
  const from = earlier.block.to.getTime();
  const to = later.block.from.getTime();

  if (to - from <= 0 || to - from > maxFillGapMs) return undefined;
  if (!earlier.issueKey || !later.issueKey) return undefined;

  const presence = events.filter((event) => event.source === 'idle' && within({ at: event.at, from, to }));

  if (!presence.some((event) => event.kind === 'idle-start')) return undefined;
  if (presence.some((event) => event.kind === 'lock')) return undefined;
  if (claimed.some((window) => window.from.getTime() < to && window.to.getTime() > from)) return undefined;

  return { from: earlier.block.to, to: later.block.from, durationMs: to - from };
};

const fillBlock = (options: { earlier: AttributedBlock; gap: { from: Date; to: Date; durationMs: number } }) => {
  const { earlier, gap } = options;
  const evidence = {
    kind: 'gap-fill' as const,
    at: gap.from,
    detail: `${formatDurationMs(gap.durationMs)} idle at the machine, joined to the ${earlier.issueKey} work before it`,
  };

  return {
    block: { from: gap.from, to: gap.to, context: earlier.block.context, evidence: [evidence] },
    issueKey: earlier.issueKey,
    storyKey: earlier.storyKey,
    taskKey: earlier.taskKey,
    confidence: 'weak' as const,
    evidence: [evidence],
  };
};

/**
 * Gives a short idle gap to the work it interrupted.
 *
 * A gap between two blocks is a gap the idle notifier dated, and its threshold is five minutes — so a
 * short one is reading a diff or thinking, not a break, and the day is short by the sum of them. The
 * result is always `weak`: nothing observed the time, and a row that is mostly filled must not sync
 * until somebody has looked at it.
 *
 * Long gaps, locked screens and time a timer run or a meeting already claims are all left alone, and a
 * gap with no `idle-start` in it is left alone too — a day nothing watched must fill nothing rather
 * than fill everything.
 */
export const fillGaps = (options: {
  blocks: AttributedBlock[];
  /** The day's own events, read only for its presence transitions. */
  events?: readonly CollectedEvent[];
  /** Windows another row already claims: the day's timer runs and its matched meetings. */
  claimed?: readonly TimeWindow[];
  options?: Partial<FillOptions>;
}): FillResult => {
  const { maxFillGapMs } = { ...DEFAULT_FILL_OPTIONS, ...options.options };
  const events = options.events ?? [];

  if (maxFillGapMs <= 0 || events.length === 0) return { blocks: options.blocks, filledMs: 0 };

  const ordered = options.blocks.slice().sort((a, b) => a.block.from.getTime() - b.block.from.getTime());
  const claimed = options.claimed ?? [];
  const blocks: AttributedBlock[] = [];
  let filledMs = 0;

  ordered.forEach((earlier, index) => {
    blocks.push(earlier);

    const later = ordered[index + 1];
    const gap = later ? fillableGap({ earlier, later, events, claimed, maxFillGapMs }) : undefined;

    if (!gap) return;

    blocks.push(fillBlock({ earlier, gap }));
    filledMs += gap.durationMs;
  });

  return { blocks, filledMs };
};
