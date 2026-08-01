import { isAfter, isBefore } from 'date-fns';
import { CALENDAR_UNIT_IS_SAME, CalendarPrecision, startOfCalendarUnit } from './calendar-view';

/** How one cell relates to the selection - what the cell directive mirrors as `data-*`. */
export type CalendarSelectionFlags = {
  selected: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
  /** Strictly between a committed range's start and end. */
  inRange: boolean;
  /** Between the pending range start and the hovered/focused cell. */
  inHoverPreview: boolean;
  /** Presentational position inside the committed or previewed range band. */
  band: CalendarBandPosition;
  /** The same, for the comparison range - the period the selection is being measured against. */
  comparisonBand: CalendarBandPosition;
};

/**
 * Where a cell sits in a band. `'single'` is a band one cell wide - both its ends at once, which a
 * one-day comparison period is. The selection band never reports it: a range whose ends are the same
 * cell is drawn as a plain selected cell instead.
 */
export type CalendarBandPosition = 'start' | 'middle' | 'end' | 'single' | null;

export type CalendarSelectionState = {
  mode: 'single' | 'range' | 'multiple';
  /** The single value, or `null`. */
  value: Date | null;
  /** Every date picked in `multiple` mode. */
  values: readonly Date[];
  rangeStart: Date | null;
  rangeEnd: Date | null;
  /**
   * The range to band while nothing is committed yet - already resolved by whichever selection
   * strategy is in play, since what a hover should promise is that strategy's business.
   */
  previewStart: Date | null;
  previewEnd: Date | null;
  /** A second range to band behind the selection, for "against the previous period" comparisons. */
  comparisonStart: Date | null;
  comparisonEnd: Date | null;
  /** The unit the grid's cells hold, which is what every comparison here happens at. */
  unit: CalendarPrecision;
};

/**
 * Builds the per-cell selection reader for one grid.
 *
 * Everything it compares happens **at the grid's own unit**, which is what lets one implementation
 * serve all three views: a month cell is the range's start because the range starts somewhere in
 * that month, not because it starts on its 1st. That is also what a month- or year-precision range
 * needs to look right - `07/2025 – 03/2026` bands nine month cells the same way a day range bands
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

  const previewStart = isRange && state.previewStart !== null ? normalize(state.previewStart) : null;
  const previewEnd = isRange && state.previewEnd !== null ? normalize(state.previewEnd) : null;

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

  /** One band's reader: which end of it a cell is, or whether it is somewhere in the middle. */
  const bandReader = (from: Date | null, to: Date | null) => {
    if (from === null || to === null) {
      return () => null;
    }

    const isOneCell = isSameUnit(from, to);

    return (date: Date): CalendarBandPosition => {
      if (isSameUnit(date, from)) {
        return isOneCell ? 'single' : 'start';
      }

      if (isSameUnit(date, to)) {
        return 'end';
      }

      return isAfter(date, from) && isBefore(date, to) ? 'middle' : null;
    };
  };

  const bandFor = bandReader(bandStart, bandEnd);

  // The comparison range is not a selection: it bands whatever it covers, one cell or many, since a
  // single-day comparison period still has to show. Read as an interval either way round, because
  // nothing about it is being built up by a reader who could get the order wrong on purpose.
  let comparisonFrom = state.comparisonStart === null ? null : normalize(state.comparisonStart);
  let comparisonTo = state.comparisonEnd === null ? null : normalize(state.comparisonEnd);

  if (comparisonFrom !== null && comparisonTo !== null && isBefore(comparisonTo, comparisonFrom)) {
    [comparisonFrom, comparisonTo] = [comparisonTo, comparisonFrom];
  }

  const comparisonFor = bandReader(comparisonFrom, comparisonTo);

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
      comparisonBand: comparisonFor(date),
    };
  };
};
