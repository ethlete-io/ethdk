import { addDays } from 'date-fns';
import { resolveCalendarKeyboardDate } from '../../../calendar/headless/internals/calendar-keyboard';
import { SchedulerWeekStartsOn } from '../scheduler.directive';

/** The all-day strip's row in the time grid's keyboard model; hour `h` is row `h + 1`. */
export const SCHEDULER_TIME_GRID_ALL_DAY_ROW = 0;

export const SCHEDULER_TIME_GRID_LAST_ROW = 24;

export type SchedulerTimeGridKeyboardCell = {
  day: Date;
  row: number;
};

export type ResolveSchedulerTimeGridKeyboardCellOptions = {
  focused: SchedulerTimeGridKeyboardCell;
  weekStartsOn: SchedulerWeekStartsOn;
  view: 'week' | 'day';
  hasAllDayRow: boolean;
};

export const resolveSchedulerMonthKeyboardDate = (
  key: string,
  options: { focusedDate: Date; weekStartsOn: SchedulerWeekStartsOn },
): Date | null => resolveCalendarKeyboardDate(key, { ...options, shiftKey: false });

export const resolveSchedulerTimeGridKeyboardCell = (
  key: string,
  options: ResolveSchedulerTimeGridKeyboardCellOptions,
): SchedulerTimeGridKeyboardCell | null => {
  const { focused, weekStartsOn, view, hasAllDayRow } = options;
  const firstRow = hasAllDayRow ? SCHEDULER_TIME_GRID_ALL_DAY_ROW : SCHEDULER_TIME_GRID_ALL_DAY_ROW + 1;
  const period = view === 'day' ? 1 : 7;

  switch (key) {
    case 'ArrowUp':
      return { day: focused.day, row: Math.max(focused.row - 1, firstRow) };
    case 'ArrowDown':
      return { day: focused.day, row: Math.min(focused.row + 1, SCHEDULER_TIME_GRID_LAST_ROW) };
    case 'PageUp':
      return { day: addDays(focused.day, -period), row: focused.row };
    case 'PageDown':
      return { day: addDays(focused.day, period), row: focused.row };
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'Home':
    case 'End': {
      const day = resolveCalendarKeyboardDate(key, { shiftKey: false, focusedDate: focused.day, weekStartsOn });

      return day === null ? null : { day, row: focused.row };
    }
    default:
      return null;
  }
};

const resolveSchedulerCellItemIndex = (
  key: string,
  { index, count }: { index: number; count: number },
): number | null => {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowLeft':
      return Math.max(index - 1, 0);
    case 'ArrowDown':
    case 'ArrowRight':
      return Math.min(index + 1, count - 1);
    default:
      return null;
  }
};

export const schedulerCellItemOffset = (itemCounts: readonly number[], cell: number) =>
  itemCounts.slice(0, cell).reduce((sum, count) => sum + count, 0);

export type SchedulerCellItemFocusTarget = { kind: 'cell' | 'item'; index: number };

/** `flatIndex` counts items across every cell in render order; `itemCounts` must follow that same order. */
export const resolveSchedulerCellItemFocus = (
  key: string,
  { itemCounts, flatIndex }: { itemCounts: readonly number[]; flatIndex: number },
): SchedulerCellItemFocusTarget | null => {
  let offset = 0;

  for (const [cell, count] of itemCounts.entries()) {
    if (flatIndex < offset + count) {
      if (key === 'Escape') return { kind: 'cell', index: cell };

      const next = resolveSchedulerCellItemIndex(key, { index: flatIndex - offset, count });

      return next === null ? null : { kind: 'item', index: offset + next };
    }

    offset += count;
  }

  return null;
};
