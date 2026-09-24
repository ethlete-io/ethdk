import { SchedulerTimeGridBlock } from '@ethlete/components';
import {
  BehindStretch,
  BreakWindow,
  CALL_LANE_KEY,
  ReviewedRow,
  TIMER_LANE_KEY,
  streamKey,
  streamKeyLabel,
  streamKeyRepoPath,
} from '@ethlete/timetrack';
import { TimelineEntry, rowEntryOf } from './row-edit/row-appointment';

/** The lane a row with no checkout and no application behind it falls into. */
export const NO_LANE_KEY = 'lane:none';

/** The lane the day's breaks are drawn in. */
export const BREAK_LANE_KEY = 'lane:break';

const BREAK_LANE_LABEL = 'Break';

/**
 * The lanes that hold no checkout, in the order they are drawn after the checkouts.
 *
 * They trail rather than sort by their first band, because their position is what says they are not
 * one of the day's checkouts.
 */
const TRAILING_LANES = [CALL_LANE_KEY, TIMER_LANE_KEY, NO_LANE_KEY];

const TRAILING_LABELS: Record<string, string> = {
  [CALL_LANE_KEY]: 'Calls & meetings',
  [TIMER_LANE_KEY]: 'Timed by hand',
  [NO_LANE_KEY]: 'No checkout',
};

const rankOf = (key: string) => {
  const at = TRAILING_LANES.indexOf(key);

  return at === -1 ? 0 : at + 1;
};

const labelOf = (key: string) => TRAILING_LABELS[key] ?? streamKeyLabel(key);

const DAY_MS = 24 * 60 * 60_000;

/** One break, placed on the day axis the same way the grid places a block. */
export type BreakBand = {
  window: BreakWindow;
  /** Percent of the day the break starts at. */
  offset: number;
  /** Percent of the day it holds. */
  span: number;
};

/**
 * One stretch a foreground band took, placed on the day axis the same way a break is.
 *
 * It is not packed against the lane's rows. A stretch is measured on the clock while a row is drawn on
 * the increment it snapped to, so the two overlap by the odd minute — and a packed behind band would
 * then halve the width of a real row that only touches it.
 */
export type BehindBand = {
  stretch: BehindStretch;
  offset: number;
  span: number;
};

/** A stretch of a block drawn at one width. `from` and `to` are fractions of the block's own length. */
export type LaneSegment = {
  from: number;
  to: number;
  /** Percent of the lane's own width the stretch starts at. */
  inlineOffset: number;
  /** Percent of the lane's own width the stretch occupies. */
  inlineSize: number;
};

/**
 * A block placed in its lane: the grid's own vertical geometry, with the inline geometry re-read.
 * `inlineOffset` and `inlineSize` bound every segment; `clipPath` cuts the box down to them.
 */
export type LaneBlock = {
  block: SchedulerTimeGridBlock<TimelineEntry>;
  inlineOffset: number;
  inlineSize: number;
  segments: LaneSegment[];
  clipPath: string | null;
};

/** One checkout's column of the day. */
export type DayLane = {
  key: string;
  label: string;
  blocks: LaneBlock[];
  /** The day's breaks. Only the break lane holds any; every other lane holds work. */
  breaks: BreakBand[];
  /** The stretches this checkout lost to another, drawn under its rows to explain the hole they left. */
  behind: BehindBand[];
};

export const laneKeyOfRow = (row: ReviewedRow) => row.laneKey ?? NO_LANE_KEY;

/**
 * The column a row's lane is drawn in: a linked worktree's lane is drawn in its main checkout's, so
 * the two read as one repository. The row keeps its own lane key, which is what its stand-in, its
 * branch and its naming history are kept by.
 */
export const worktreeColumnOf = (worktrees: Readonly<Record<string, string>>) => (laneKey: string) => {
  const main = worktrees[streamKeyRepoPath(laneKey) ?? ''];

  return main ? streamKey({ repoPath: main }) : laneKey;
};

const laneKeyOfBlock = (block: SchedulerTimeGridBlock<TimelineEntry>) => {
  const entry = rowEntryOf(block.node.appointment);

  return entry ? laneKeyOfRow(entry.row) : NO_LANE_KEY;
};

type Timed = { block: SchedulerTimeGridBlock<TimelineEntry>; start: number; end: number; column: number };

/**
 * Packs one lane's blocks into overlap-free columns, the same way a calendar packs a day, and splits
 * the lane only while blocks overlap: a block is full width wherever nothing else in the lane runs.
 *
 * Whether two blocks overlap is read off the clock and never off `offset` and `span`. The end of one
 * row and the start of the next are the same instant, but the two percentages of the day computed
 * for it differ in the last bit often enough that two rows meeting at 16:30 would each be drawn at
 * half the lane's width.
 */
const packLane = (blocks: readonly SchedulerTimeGridBlock<TimelineEntry>[]): LaneBlock[] => {
  const timed = blocks
    .map((block) => ({
      block,
      start: block.node.appointment.start.getTime(),
      end: block.node.appointment.end.getTime(),
      column: 0,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const endsPerColumn: number[] = [];

  for (const entry of timed) {
    const free = endsPerColumn.findIndex((taken) => taken <= entry.start);

    entry.column = free === -1 ? endsPerColumn.length : free;
    endsPerColumn[entry.column] = entry.end;
  }

  return timed.map((entry) => placeOf(entry, timed));
};

const placeOf = (entry: Timed, lane: readonly Timed[]): LaneBlock => {
  const others = lane.filter((other) => other !== entry && other.start < entry.end && other.end > entry.start);
  const cuts = [...new Set([entry.start, entry.end, ...others.flatMap((other) => [other.start, other.end])])]
    .filter((at) => at >= entry.start && at <= entry.end)
    .sort((a, b) => a - b);
  const length = entry.end - entry.start || 1;
  const segments: LaneSegment[] = [];

  for (let at = 0; at < cuts.length - 1; at++) {
    const from = cuts[at] ?? 0;
    const to = cuts[at + 1] ?? 0;
    const beside = others.filter((other) => other.start < to && other.end > from);
    const columns = Math.max(entry.column, ...beside.map((other) => other.column)) + 1;
    const inlineOffset = beside.length ? (entry.column / columns) * 100 : 0;
    const inlineSize = beside.length ? 100 / columns : 100;
    const last = segments.at(-1);

    if (last && last.inlineOffset === inlineOffset && last.inlineSize === inlineSize) {
      last.to = (to - entry.start) / length;
    } else {
      segments.push({ from: (from - entry.start) / length, to: (to - entry.start) / length, inlineOffset, inlineSize });
    }
  }

  if (!segments.length) segments.push({ from: 0, to: 1, inlineOffset: 0, inlineSize: 100 });

  const inlineOffset = Math.min(...segments.map((segment) => segment.inlineOffset));
  const inlineSize = Math.max(...segments.map((segment) => segment.inlineOffset + segment.inlineSize)) - inlineOffset;

  return {
    block: entry.block,
    inlineOffset,
    inlineSize,
    segments,
    clipPath: clipPathOf({ segments, inlineOffset, inlineSize }),
  };
};

const clipPathOf = (options: { segments: readonly LaneSegment[]; inlineOffset: number; inlineSize: number }) => {
  if (options.segments.length < 2) return null;

  const x = (lanePercent: number) => ((lanePercent - options.inlineOffset) / options.inlineSize) * 100;
  const left = options.segments.flatMap((segment) => [
    [x(segment.inlineOffset), segment.from * 100],
    [x(segment.inlineOffset), segment.to * 100],
  ]);
  const right = options.segments.flatMap((segment) => [
    [x(segment.inlineOffset + segment.inlineSize), segment.from * 100],
    [x(segment.inlineOffset + segment.inlineSize), segment.to * 100],
  ]);
  const points = [...left, ...right.reverse()].map(([px, py]) => `${px}% ${py}%`);

  return `polygon(${points.join(', ')})`;
};

const offsetOf = (options: { at: Date; dayStart: Date }) =>
  ((options.at.getTime() - options.dayStart.getTime()) / DAY_MS) * 100;

const spanOf = (window: { from: Date; to: Date }) => ((window.to.getTime() - window.from.getTime()) / DAY_MS) * 100;

const breakBandsOf = (options: { breaks: readonly BreakWindow[]; dayStart: Date }): BreakBand[] =>
  options.breaks.map((window) => ({
    window,
    offset: offsetOf({ at: window.from, dayStart: options.dayStart }),
    span: spanOf(window),
  }));

/**
 * The day's blocks as one lane per checkout, in the order the checkouts were first touched, with the
 * day's breaks in a leading lane of their own. A row nothing could place goes into a last lane rather
 * than into somebody else's.
 *
 * A day whose breaks are all gone keeps the lane, empty: it is where a break is drawn, so a day that
 * dropped the last one would otherwise offer no way to state a new one. A day with no work at all has
 * no grid to draw on and gets no lane.
 *
 * A lane is fixed by the checkout and never by who overlaps whom, so a band's width says which
 * checkout it is and a busy hour narrows nothing.
 */
export const lanesOf = (options: {
  blocks: readonly SchedulerTimeGridBlock<TimelineEntry>[];
  breaks: readonly BreakWindow[];
  behind?: readonly BehindStretch[];
  /** Midnight of the day on screen, which the break and behind geometry is measured from. */
  dayStart: Date;
  columnOf?: (laneKey: string) => string;
}): DayLane[] => {
  const columnOf = options.columnOf ?? ((laneKey: string) => laneKey);
  const byLane = new Map<string, SchedulerTimeGridBlock<TimelineEntry>[]>();

  for (const block of options.blocks) {
    const key = columnOf(laneKeyOfBlock(block));

    byLane.set(key, [...(byLane.get(key) ?? []), block]);
  }

  const behindByLane = new Map<string, BehindBand[]>();

  for (const stretch of options.behind ?? []) {
    const key = columnOf(stretch.laneKey);
    const band = {
      stretch,
      offset: offsetOf({ at: stretch.from, dayStart: options.dayStart }),
      span: spanOf(stretch),
    };

    behindByLane.set(key, [...(behindByLane.get(key) ?? []), band]);
    // A checkout every one of whose minutes went elsewhere has no block left to open a lane with, and
    // that is the hole this band exists to explain.
    if (!byLane.has(key)) byLane.set(key, []);
  }

  const startOf = (key: string, lane: SchedulerTimeGridBlock<TimelineEntry>[]) =>
    Math.min(...lane.map((block) => block.offset), ...(behindByLane.get(key) ?? []).map((band) => band.offset));

  const work = [...byLane]
    .sort(
      ([aKey, a], [bKey, b]) =>
        rankOf(aKey) - rankOf(bKey) || startOf(aKey, a) - startOf(bKey, b) || aKey.localeCompare(bKey),
    )
    .map(([key, laneBlocks]) => ({
      key,
      label: labelOf(key),
      blocks: packLane(laneBlocks),
      breaks: [],
      behind: behindByLane.get(key) ?? [],
    }));

  if (!work.length) return work;

  return [
    { key: BREAK_LANE_KEY, label: BREAK_LANE_LABEL, blocks: [], breaks: breakBandsOf(options), behind: [] },
    ...work,
  ];
};
