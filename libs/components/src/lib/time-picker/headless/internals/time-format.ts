import { Locale } from 'date-fns';
import { formatDateValue } from '../../../forms/date-time/internals/date-value';

export type TimeFormatSpec = {
  hourCycle: 12 | 24;
  showSeconds: boolean;
};

export type DeriveTimeFormatSpecOptions = {
  format: string;
  locale?: Locale | null;
};

// hour 13 renders as "13" only in a 24-hour format, second 57 only when seconds
// are shown; the other parts avoid those digit pairs
const PROBE_DATE = /* @__PURE__ */ new Date(2000, 0, 1, 13, 35, 57);

export const deriveTimeFormatSpec = (options: DeriveTimeFormatSpecOptions): TimeFormatSpec => {
  const rendered = formatDateValue(PROBE_DATE, options) ?? '';

  return {
    hourCycle: rendered.includes('13') ? 24 : 12,
    showSeconds: rendered.includes('57'),
  };
};

export type SteppedValuesOptions = {
  end: number;
  step: number;
  include?: number | null;
};

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
  period: 0 | 1;
};

export const getTimeParts = (date: Date, hourCycle: 12 | 24): TimeParts => ({
  hour: hourCycle === 12 ? date.getHours() % 12 : date.getHours(),
  minute: date.getMinutes(),
  second: date.getSeconds(),
  period: date.getHours() >= 12 ? 1 : 0,
});
