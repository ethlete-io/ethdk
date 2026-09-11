import { SchedulerTimeGridBlock } from '@ethlete/components';
import { BreakWindow, CALL_LANE_KEY, MEETING_LANE_KEY, ReviewedRow, streamKeyLabel } from '@ethlete/timetrack';
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
const TRAILING_LANES = [CALL_LANE_KEY, MEETING_LANE_KEY, NO_LANE_KEY];

const TRAILING_LABELS: Record<string, string> = {
  [CALL_LANE_KEY]: 'Calls',
  [MEETING_LANE_KEY]: 'Meetings',
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

/** A block placed in its lane: the grid's own vertical geometry, with the inline geometry re-read. */
export type LaneBlock = {
  block: SchedulerTimeGridBlock<TimelineEntry>;
  /** Percent of the lane's own width the block starts at. */
  inlineOffset: number;
  /** Percent of the lane's own width the block occupies. */
  inlineSize: number;
};

/** One checkout's column of the day. */
export type DayLane = {
  key: string;
  label: string;
  blocks: LaneBlock[];
  /** The day's breaks. Only the break lane holds any; every other lane holds work. */
  breaks: BreakBand[];
};

export const laneKeyOfRow = (row: ReviewedRow) => row.laneKey ?? NO_LANE_KEY;

const laneKeyOfBlock = (block: SchedulerTimeGridBlock<TimelineEntry>) => {
  const entry = rowEntryOf(block.node.appointment);

  return entry ? laneKeyOfRow(entry.row) : NO_LANE_KEY;
};

/**
 * Packs one lane's blocks into the fewest overlap-free columns, the same way a calendar packs a day.
 * One checkout rarely holds two rows at once, so an equal split of the lane is enough — a block never
 * widens into a free column beside it.
 *
 * Whether two blocks overlap is read off the clock and never off `offset` and `span`. The end of one
 * row and the start of the next are the same instant, but the two percentages of the day computed
 * for it differ in the last bit often enough that two rows meeting at 16:30 would each be drawn at
 * half the lane's width.
 */
const packLane = (blocks: readonly SchedulerTimeGridBlock<TimelineEntry>[]): LaneBlock[] => {
  const startOfBlock = (block: SchedulerTimeGridBlock<TimelineEntry>) => block.node.appointment.start.getTime();
  const endOfBlock = (block: SchedulerTimeGridBlock<TimelineEntry>) => block.node.appointment.end.getTime();
  const sorted = [...blocks].sort((a, b) => startOfBlock(a) - startOfBlock(b) || endOfBlock(a) - endOfBlock(b));
  const placed: LaneBlock[] = [];

  let cluster: { block: SchedulerTimeGridBlock<TimelineEntry>; column: number }[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const columns = Math.max(1, ...cluster.map((entry) => entry.column + 1));

    for (const entry of cluster) {
      placed.push({ block: entry.block, inlineOffset: (entry.column / columns) * 100, inlineSize: 100 / columns });
    }

    cluster = [];
    clusterEnd = -Infinity;
  };

  const endsPerColumn: number[] = [];

  for (const block of sorted) {
    const start = startOfBlock(block);
    const end = endOfBlock(block);

    if (start >= clusterEnd && cluster.length) {
      flush();
      endsPerColumn.length = 0;
    }

    let column = endsPerColumn.findIndex((taken) => taken <= start);

    if (column === -1) column = endsPerColumn.length;

    endsPerColumn[column] = end;
    cluster.push({ block, column });
    clusterEnd = Math.max(clusterEnd, end);
  }

  if (cluster.length) flush();

  return placed;
};

const breakBandsOf = (options: { breaks: readonly BreakWindow[]; dayStart: Date }): BreakBand[] =>
  options.breaks.map((window) => ({
    window,
    offset: ((window.from.getTime() - options.dayStart.getTime()) / DAY_MS) * 100,
    span: ((window.to.getTime() - window.from.getTime()) / DAY_MS) * 100,
  }));

/**
 * The day's blocks as one lane per checkout, in the order the checkouts were first touched, with the
 * day's breaks in a leading lane of their own. A row nothing could place goes into a last lane rather
 * than into somebody else's.
 *
 * A lane is fixed by the checkout and never by who overlaps whom, so a band's width says which
 * checkout it is and a busy hour narrows nothing.
 */
export const lanesOf = (options: {
  blocks: readonly SchedulerTimeGridBlock<TimelineEntry>[];
  breaks: readonly BreakWindow[];
  /** Midnight of the day on screen, which the break geometry is measured from. */
  dayStart: Date;
}): DayLane[] => {
  const byLane = new Map<string, SchedulerTimeGridBlock<TimelineEntry>[]>();

  for (const block of options.blocks) {
    const key = laneKeyOfBlock(block);

    byLane.set(key, [...(byLane.get(key) ?? []), block]);
  }

  const startOf = (lane: SchedulerTimeGridBlock<TimelineEntry>[]) => Math.min(...lane.map((block) => block.offset));

  const work = [...byLane]
    .sort(([aKey, a], [bKey, b]) => rankOf(aKey) - rankOf(bKey) || startOf(a) - startOf(b) || aKey.localeCompare(bKey))
    .map(([key, laneBlocks]) => ({
      key,
      label: labelOf(key),
      blocks: packLane(laneBlocks),
      breaks: [],
    }));

  if (!options.breaks.length) return work;

  return [{ key: BREAK_LANE_KEY, label: BREAK_LANE_LABEL, blocks: [], breaks: breakBandsOf(options) }, ...work];
};
