import { Locale } from 'date-fns';
import { formatDateValue } from '../../../forms/date-time/internals/date-value';

export type TimeFormatSpec = {
  hourCycle: 12 | 24;
  showSeconds: boolean;
};

export type DeriveTimeFormatSpecOptions = {
  /** date-fns format string the picker's columns should match. */
  format: string;
  locale?: Locale | null;
};

// hour 13 renders as "13" only in a 24-hour format, second 57 only when seconds
// are shown; the other parts avoid those digit pairs
const PROBE_DATE = new Date(2000, 0, 1, 13, 35, 57);

/**
 * Derives the column layout (12/24-hour cycle, seconds) from a date-fns time
 * format by rendering a probe date — localized tokens like `p`/`pp` expand
 * per locale, so scanning the format string itself would miss them.
 */
export const deriveTimeFormatSpec = (options: DeriveTimeFormatSpecOptions): TimeFormatSpec => {
  const rendered = formatDateValue(PROBE_DATE, options) ?? '';

  return {
    hourCycle: rendered.includes('13') ? 24 : 12,
    showSeconds: rendered.includes('57'),
  };
};

export type SteppedValuesOptions = {
  /** Exclusive upper bound (`60` for minutes/seconds, `24` for hours). */
  end: number;
  step: number;
  /** An off-step value (the current selection) spliced in at its sorted position. */
  include?: number | null;
};

/** `0, step, 2·step …` below `end`, keeping an off-step selection visible. */
export const generateSteppedValues = (options: SteppedValuesOptions): number[] => {
  const values: number[] = [];

  for (let value = 0; value < options.end; value += options.step) {
    values.push(value);
  }

  const include = options.include ?? null;

  if (include !== null && include >= 0 && include < options.end && !values.includes(include)) {
    values.push(include);
    values.sort((first, second) => first - second);
  }

  return values;
};

export type TimeParts = {
  /** Column-internal hour: `0–23`, or `0–11` in a 12-hour cycle (`0` renders as 12). */
  hour: number;
  minute: number;
  second: number;
  /** `0` = AM, `1` = PM. */
  period: 0 | 1;
};

/** Splits a `Date`'s time of day into the picker's column values. */
export const getTimeParts = (date: Date, hourCycle: 12 | 24): TimeParts => ({
  hour: hourCycle === 12 ? date.getHours() % 12 : date.getHours(),
  minute: date.getMinutes(),
  second: date.getSeconds(),
  period: date.getHours() >= 12 ? 1 : 0,
});
