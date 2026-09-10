import { SchedulerTimeGridBlock } from '@ethlete/components';
import { ReviewedRow, streamKeyLabel } from '@ethlete/timetrack';
import { TimelineEntry, rowEntryOf } from './row-edit/row-appointment';

/** The lane a row with no checkout and no application behind it falls into. */
export const NO_LANE_KEY = 'lane:none';

const NO_LANE_LABEL = 'No checkout';

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
 */
const packLane = (blocks: readonly SchedulerTimeGridBlock<TimelineEntry>[]): LaneBlock[] => {
  const sorted = [...blocks].sort((a, b) => a.offset - b.offset || a.span - b.span);
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
    const end = block.offset + block.span;

    if (block.offset >= clusterEnd && cluster.length) {
      flush();
      endsPerColumn.length = 0;
    }

    let column = endsPerColumn.findIndex((taken) => taken <= block.offset);

    if (column === -1) column = endsPerColumn.length;

    endsPerColumn[column] = end;
    cluster.push({ block, column });
    clusterEnd = Math.max(clusterEnd, end);
  }

  if (cluster.length) flush();

  return placed;
};

/**
 * The day's blocks as one lane per checkout, in the order the checkouts were first touched. A row
 * nothing could place goes into a last lane of its own rather than into somebody else's.
 *
 * A lane is fixed by the checkout and never by who overlaps whom, so a band's width says which
 * checkout it is and a busy hour narrows nothing.
 */
export const lanesOf = (blocks: readonly SchedulerTimeGridBlock<TimelineEntry>[]): DayLane[] => {
  const byLane = new Map<string, SchedulerTimeGridBlock<TimelineEntry>[]>();

  for (const block of blocks) {
    const key = laneKeyOfBlock(block);

    byLane.set(key, [...(byLane.get(key) ?? []), block]);
  }

  const startOf = (lane: SchedulerTimeGridBlock<TimelineEntry>[]) => Math.min(...lane.map((block) => block.offset));

  return [...byLane]
    .sort(([aKey, a], [bKey, b]) => {
      if (aKey === NO_LANE_KEY) return 1;
      if (bKey === NO_LANE_KEY) return -1;

      return startOf(a) - startOf(b) || aKey.localeCompare(bKey);
    })
    .map(([key, laneBlocks]) => ({
      key,
      label: key === NO_LANE_KEY ? NO_LANE_LABEL : streamKeyLabel(key),
      blocks: packLane(laneBlocks),
    }));
};
