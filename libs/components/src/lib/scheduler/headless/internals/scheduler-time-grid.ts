import { endOfDay, isSameDay, startOfDay } from 'date-fns';
import { Appointment, AppointmentId } from '../../scheduler.types';
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

/** One day column of a time grid: its positioned timed blocks. All-day appointments live in {@link SchedulerTimeGrid.allDay} instead, spanning the days they cover. */
export type SchedulerTimeGridDay<TExtra = unknown> = {
  date: Date;
  today: boolean;
  blocks: SchedulerTimeGridBlock<TExtra>[];
};

/** One all-day appointment positioned across the time grid's day columns. */
export type SchedulerTimeGridAllDayEntry<TExtra = unknown> = {
  node: AppointmentTreeNode<TExtra>;
  /** Percent (0-100) of the visible range's width the entry starts at - `inset-inline-start`. */
  inlineOffset: number;
  /** Percent (0-100] of the visible range's width the entry spans - `inline-size`. */
  inlineSize: number;
  /** 0-based stacking row among all-day entries whose day spans overlap. */
  row: number;
};

/** The full time grid: one column per visible day, plus the all-day entries spanning across them. */
export type SchedulerTimeGrid<TExtra = unknown> = {
  days: SchedulerTimeGridDay<TExtra>[];
  allDay: SchedulerTimeGridAllDayEntry<TExtra>[];
  /** How many stacking rows the all-day lane needs - callers size its reserved space from this. */
  allDayRowCount: number;
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

type DaySpan<TExtra> = { node: AppointmentTreeNode<TExtra>; startIndex: number; endIndex: number };

/**
 * Assigns each all-day entry the first stacking row whose last occupant ends before it starts -
 * the day-axis equivalent of {@link packColumns}'s column assignment, so entries whose day ranges
 * overlap stack into separate rows instead of drawing on top of each other.
 */
const packAllDayRows = <TExtra>(
  spans: readonly DaySpan<TExtra>[],
): { rowByAppointmentId: Map<AppointmentId, number>; rowCount: number } => {
  const sorted = [...spans].sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex);
  const rowEnds: number[] = [];
  const rowByAppointmentId = new Map<AppointmentId, number>();

  for (const span of sorted) {
    const existingRow = rowEnds.findIndex((end) => end < span.startIndex);
    const row = existingRow === -1 ? rowEnds.length : existingRow;

    rowEnds[row] = span.endIndex;
    rowByAppointmentId.set(span.node.appointment.id, row);
  }

  return { rowByAppointmentId, rowCount: rowEnds.length };
};

/**
 * Lays out a time grid: timed appointments packed into overlap-free columns per day
 * ({@link packColumns}) with `offset`/`span` as percentages of the day, and all-day appointments
 * as entries spanning the visible days they cover, stacked into rows ({@link packAllDayRows}).
 * Every percentage is exposed as a unitless CSS custom property and resolved with
 * `calc(var(...) * 1%)` against a CSS-controlled size - no pixel math here, same as the slider's
 * thumb-position percent. A timed appointment spanning midnight is clipped to each day it
 * touches; an all-day appointment outside the visible range is clipped to its first/last visible
 * day, same as the month grid's "every day it spans" rule.
 */
export const buildSchedulerTimeGrid = <TExtra>(
  options: SchedulerTimeGridOptions<TExtra>,
): SchedulerTimeGrid<TExtra> => {
  const { days, tree, today } = options;
  const flattened = flattenAppointmentTree(tree);

  const allDaySpans: DaySpan<TExtra>[] = [];

  const dayColumns = days.map((date, index) => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const dayStartMs = dayStart.getTime();
    const dayMs = dayEnd.getTime() - dayStartMs;

    const timed: ClippedEntry<TExtra>[] = [];

    for (const node of flattened) {
      const { appointment } = node;

      if (!coversDay(appointment, { start: dayStart, end: dayEnd })) {
        continue;
      }

      if (appointment.allDay) {
        const span = allDaySpans.find((entry) => entry.node.appointment.id === appointment.id);

        if (span) {
          span.endIndex = index;
        } else {
          allDaySpans.push({ node, startIndex: index, endIndex: index });
        }

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
      blocks: packColumns(timed, { startMs: dayStartMs, ms: dayMs }),
    };
  });

  const { rowByAppointmentId, rowCount } = packAllDayRows(allDaySpans);
  const inlineSize = days.length === 0 ? 0 : 100 / days.length;

  const allDay = allDaySpans.map((span) => ({
    node: span.node,
    inlineOffset: span.startIndex * inlineSize,
    inlineSize: (span.endIndex - span.startIndex + 1) * inlineSize,
    row: rowByAppointmentId.get(span.node.appointment.id) ?? 0,
  }));

  return { days: dayColumns, allDay, allDayRowCount: rowCount };
};

/**
 * Which hour the time grid's scrollable body should open scrolled to, so day/week view never
 * starts on an empty screen scrolled to midnight: the current hour (with an hour of lead-in) when
 * today is one of the visible days, else the earliest timed appointment's hour (same lead-in),
 * else a business-hours default.
 */
export const computeInitialScrollHour = <TExtra>(grid: SchedulerTimeGrid<TExtra>, now: Date) => {
  if (grid.days.some((day) => day.today)) {
    return Math.max(0, now.getHours() - 1);
  }

  const offsets = grid.days.flatMap((day) => day.blocks.map((block) => block.offset));

  if (offsets.length === 0) {
    return 8;
  }

  return Math.max(0, Math.floor((Math.min(...offsets) / 100) * 24) - 1);
};
