import { isAfter, isBefore } from 'date-fns';
import { CALENDAR_UNIT_IS_SAME, CalendarPrecision, startOfCalendarUnit } from './calendar-view';

/** How one cell relates to the selection — what the cell directive mirrors as `data-*`. */
export type CalendarSelectionFlags = {
  selected: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
  /** Strictly between a committed range's start and end. */
  inRange: boolean;
  /** Between the pending range start and the hovered/focused cell. */
  inHoverPreview: boolean;
  /** Presentational position inside the committed or previewed range band. */
  band: 'start' | 'middle' | 'end' | null;
};

export type CalendarSelectionState = {
  mode: 'single' | 'range' | 'multiple';
  /** The single value, or `null`. */
  value: Date | null;
  /** Every date picked in `multiple` mode. */
  values: readonly Date[];
  rangeStart: Date | null;
  rangeEnd: Date | null;
  /** Where the pending range currently previews to — the hovered cell, else the roving focus. */
  previewTo: Date;
  /** The unit the grid's cells hold, which is what every comparison here happens at. */
  unit: CalendarPrecision;
};

/**
 * Builds the per-cell selection reader for one grid.
 *
 * Everything it compares happens **at the grid's own unit**, which is what lets one implementation
 * serve all three views: a month cell is the range's start because the range starts somewhere in
 * that month, not because it starts on its 1st. That is also what a month- or year-precision range
 * needs to look right — `07/2025 – 03/2026` bands nine month cells the same way a day range bands
 * days.
 *
 * The band bounds are worked out once for the grid rather than per cell, since they are the same
 * for all of them.
 */
export const createCalendarSelectionReader = (state: CalendarSelectionState) => {
  const isSameUnit = CALENDAR_UNIT_IS_SAME[state.unit];
  const normalize = (date: Date) => startOfCalendarUnit(date, state.unit);
  const isRange = state.mode === 'range';
  const isMultiple = state.mode === 'multiple';
  const start = isRange && state.rangeStart !== null ? normalize(state.rangeStart) : null;
  const end = isRange && state.rangeEnd !== null ? normalize(state.rangeEnd) : null;

  let previewStart: Date | null = null;
  let previewEnd: Date | null = null;

  if (start !== null && end === null) {
    const preview = normalize(state.previewTo);

    previewStart = isBefore(preview, start) ? preview : start;
    previewEnd = isBefore(preview, start) ? start : preview;
  }

  // the visual band spans the committed range, or the pending preview
  let bandStart: Date | null = null;
  let bandEnd: Date | null = null;

  if (start !== null && end !== null && !isSameUnit(start, end)) {
    bandStart = start;
    bandEnd = end;
  } else if (previewStart !== null && previewEnd !== null && !isSameUnit(previewStart, previewEnd)) {
    bandStart = previewStart;
    bandEnd = previewEnd;
  }

  const bandFor = (date: Date): CalendarSelectionFlags['band'] => {
    if (bandStart === null || bandEnd === null) {
      return null;
    }

    if (isSameUnit(date, bandStart)) {
      return 'start';
    }

    if (isSameUnit(date, bandEnd)) {
      return 'end';
    }

    return isAfter(date, bandStart) && isBefore(date, bandEnd) ? 'middle' : null;
  };

  return (date: Date): CalendarSelectionFlags => {
    const rangeStart = start !== null && isSameUnit(date, start);
    const rangeEnd = end !== null && isSameUnit(date, end);
    const value = state.value;

    return {
      selected: isMultiple
        ? state.values.some((picked) => isSameUnit(date, picked))
        : isRange
          ? rangeStart || rangeEnd
          : value !== null && isSameUnit(date, value),
      rangeStart,
      rangeEnd,
      inRange: start !== null && end !== null && isAfter(date, start) && isBefore(date, end),
      inHoverPreview:
        previewStart !== null &&
        previewEnd !== null &&
        !isSameUnit(previewStart, previewEnd) &&
        !isBefore(date, previewStart) &&
        !isAfter(date, previewEnd),
      band: bandFor(date),
    };
  };
};
