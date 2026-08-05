import { endOfDay, isSameDay, startOfDay } from 'date-fns';
import { Appointment } from '../../scheduler.types';
import { AppointmentTreeNode, flattenAppointmentTree } from './scheduler-tree';

/** One timed appointment positioned on a time-grid day column. */
export type SchedulerTimeGridBlock<TExtra = unknown> = {
  node: AppointmentTreeNode<TExtra>;
  /** Percent (0-100) of the day the block starts at - its `inset-block-start` within the day column. */
  offset: number;
  /** Percent (0-100] of the day the block spans - its `block-size` within the day column. */
  span: number;
  /** 0-based column index within this block's overlap group. */
  column: number;
  /** How many columns wide this block's overlap group is - every block in the group shares this width. */
  columnCount: number;
  /** Percent (0-100) of the day column's inline size the block starts at - `inset-inline-start`. */
  inlineOffset: number;
  /** Percent (0-100] of the day column's inline size the block occupies - `inline-size`. */
  inlineSize: number;
};

/** One day column of a time grid: its all-day strip entries and its positioned timed blocks. */
export type SchedulerTimeGridDay<TExtra = unknown> = {
  date: Date;
  today: boolean;
  allDay: AppointmentTreeNode<TExtra>[];
  blocks: SchedulerTimeGridBlock<TExtra>[];
};

export type SchedulerTimeGridOptions<TExtra> = {
  days: readonly Date[];
  tree: readonly AppointmentTreeNode<TExtra>[];
  today: Date;
};

const coversDay = (appointment: Appointment, day: { start: Date; end: Date }) =>
  appointment.start <= day.end && appointment.end >= day.start;

type ClippedEntry<TExtra> = { node: AppointmentTreeNode<TExtra>; start: number; end: number };

/**
 * Packs one day's timed appointments into the fewest overlap-free columns: appointments are
 * grouped into clusters transitively connected by overlap, then within each cluster assigned the
 * first column whose previous occupant already ended. `inlineOffset`/`inlineSize` are then derived
 * from `column`/`columnCount` as percentages of the day column's width, so every block in a
 * cluster renders evenly wide regardless of which column it landed in.
 */
const packColumns = <TExtra>(
  entries: readonly ClippedEntry<TExtra>[],
  day: { startMs: number; ms: number },
): SchedulerTimeGridBlock<TExtra>[] => {
  const sorted = [...entries].sort((a, b) => a.start - b.start || a.end - b.end);
  const blocks: SchedulerTimeGridBlock<TExtra>[] = [];

  let cluster: ClippedEntry<TExtra>[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;

    const columnEnds: number[] = [];
    const columnsByEntry = cluster.map((entry) => {
      const existingColumn = columnEnds.findIndex((end) => end <= entry.start);
      const column = existingColumn === -1 ? columnEnds.length : existingColumn;

      columnEnds[column] = entry.end;

      return column;
    });

    const columnCount = columnEnds.length;
    const inlineSize = 100 / columnCount;

    cluster.forEach((entry, index) => {
      const column = columnsByEntry[index] ?? 0;

      blocks.push({
        node: entry.node,
        offset: ((entry.start - day.startMs) / day.ms) * 100,
        span: ((entry.end - entry.start) / day.ms) * 100,
        column,
        columnCount,
        inlineOffset: column * inlineSize,
        inlineSize,
      });
    });

    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const entry of sorted) {
    if (cluster.length > 0 && entry.start >= clusterEnd) {
      flush();
    }

    cluster.push(entry);
    clusterEnd = Math.max(clusterEnd, entry.end);
  }

  flush();

  return blocks;
};

/**
 * Lays out a time grid's day columns: all-day appointments in chain order for the strip, and
 * timed appointments packed into overlap-free columns ({@link packColumns}) with `offset`/`span`
 * as percentages of the day, so the component exposes them as unitless CSS custom properties and
 * resolves them with `calc(var(...) * 1%)` against a CSS-controlled hour height - no pixel math
 * here, same as the slider's thumb-position percent. An appointment spanning midnight is clipped
 * to each day it touches, same as the month grid's "every day it spans" rule.
 */
export const buildSchedulerTimeGrid = <TExtra>(
  options: SchedulerTimeGridOptions<TExtra>,
): SchedulerTimeGridDay<TExtra>[] => {
  const { days, tree, today } = options;
  const flattened = flattenAppointmentTree(tree);

  return days.map((date) => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const dayStartMs = dayStart.getTime();
    const dayMs = dayEnd.getTime() - dayStartMs;

    const allDay: AppointmentTreeNode<TExtra>[] = [];
    const timed: ClippedEntry<TExtra>[] = [];

    for (const node of flattened) {
      const { appointment } = node;

      if (!coversDay(appointment, { start: dayStart, end: dayEnd })) {
        continue;
      }

      if (appointment.allDay) {
        allDay.push(node);
        continue;
      }

      timed.push({
        node,
        start: Math.max(appointment.start.getTime(), dayStartMs),
        end: Math.min(appointment.end.getTime(), dayEnd.getTime()),
      });
    }

    return {
      date,
      today: isSameDay(date, today),
      allDay,
      blocks: packColumns(timed, { startMs: dayStartMs, ms: dayMs }),
    };
  });
};
