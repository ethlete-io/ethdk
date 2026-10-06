import { inject } from '@angular/core';
import { FieldContext, LogicFn, validate, ValidationError } from '@angular/forms/signals';
import { startOfDay } from 'date-fns';
import { CalendarPrecision, startOfCalendarUnit } from '../../calendar/headless';
import { DATE_FORMAT, DATE_LOCALE, DATE_TIME_FORMAT, injectDateTimeZone, TIME_FORMAT } from './date-time-formats';
import { injectDateTimeLabels } from './date-time-labels';
import { DateRangeValue } from './internals/date-range-picker-input.directive';
import { parseDateValue } from './internals/date-value';
import { displayFormatForPrecision } from './internals/precision-format';
import { formatInZone, isValidTimeZone } from './internals/time-zone';

type DateValue = string | null;

type DateFieldPath = Parameters<typeof validate<DateValue>>[0];

type RangeFieldPath = Parameters<typeof validate<DateRangeValue>>[0];

type Bound<TValue> = Date | null | LogicFn<TValue, Date | null>;

export type RangeOrderOptions = {
  /**
   * date-fns format of the two wire strings - the control's `valueFormat`. Defaults to the token
   * the matching control reads: `DATE_FORMAT`, `DATE_TIME_FORMAT` or `TIME_FORMAT`.
   */
  valueFormat?: string;
  /** Also fail while both ends are equal. @default false */
  strict?: boolean;
  /**
   * The `timeZone` of the date-time control, so an offset-less wire value is read in that zone's
   * wall clock, as the control writes it. Unset, it follows `provideDateTimeZone()`.
   */
  timeZone?: string | null;
  /** Overrides the default "The start must be before the end" message. */
  message?: string;
};

export type TimeRangeOrderOptions = Omit<RangeOrderOptions, 'timeZone'> & {
  /**
   * Accept an end before the start as a range across midnight (`22:00`-`06:00`), the way the time
   * picker draws it. Then only equal ends fail, and only with `strict`.
   * @default false
   */
  allowOvernight?: boolean;
};

export type DateRangeBoundsOptions = {
  /** The earliest date either end may name, or a function returning it. */
  min?: Bound<DateRangeValue>;
  /** The latest date either end may name, or a function returning it. */
  max?: Bound<DateRangeValue>;
  /**
   * date-fns format of the two wire strings. Defaults to `DATE_FORMAT` for the date-only validators
   * and `DATE_TIME_FORMAT` for the date-time ones.
   */
  valueFormat?: string;
  /**
   * The `timeZone` of the date-time control: offset-less wire values are read in that zone's wall
   * clock, and the message names the bound in it. Unset, it follows `provideDateTimeZone()`.
   */
  timeZone?: string | null;
  /** Overrides the default "Choose dates on or after …" / "… on or before …" message. */
  message?: string;
};

export type DateOnlyRangeBoundsOptions = Omit<DateRangeBoundsOptions, 'timeZone'> & {
  /**
   * The unit both ends and the bounds are compared in - the control's `precision`. At `'day'` a
   * `min` of "now" still admits today.
   * @default 'day'
   */
  precision?: CalendarPrecision;
};

export type DateBoundsOptions = Omit<DateRangeBoundsOptions, 'min' | 'max'> & {
  /** The earliest date the value may name, or a function returning it. */
  min?: Bound<DateValue>;
  /** The latest date the value may name, or a function returning it. */
  max?: Bound<DateValue>;
};

export type DateOnlyBoundsOptions = Omit<DateBoundsOptions, 'timeZone'> & {
  /**
   * The unit the value and the bounds are compared in - the control's `precision`. At `'day'` a
   * `min` of "now" still admits today.
   * @default 'day'
   */
  precision?: CalendarPrecision;
};

export type TimeBoundsOptions = {
  /** The earliest time of day the value may name, or a function returning it. Only its time of day is read. */
  min?: Bound<DateValue>;
  /** The latest time of day the value may name, or a function returning it. Only its time of day is read. */
  max?: Bound<DateValue>;
  /** date-fns format of the wire string - the control's `valueFormat`. Defaults to `TIME_FORMAT`. */
  valueFormat?: string;
  /** Overrides the default "Choose a time at or after …" / "… at or before …" message. */
  message?: string;
};

export type TimeRangeBoundsOptions = Omit<TimeBoundsOptions, 'min' | 'max'> & {
  /** The earliest time of day either end may name, or a function returning it. Only its time of day is read. */
  min?: Bound<DateRangeValue>;
  /** The latest time of day either end may name, or a function returning it. Only its time of day is read. */
  max?: Bound<DateRangeValue>;
};

export type RangeOrderError = ValidationError & { kind: 'rangeOrder' };

export type RangeMinError = ValidationError & { kind: 'rangeMin'; min: Date };

export type RangeMaxError = ValidationError & { kind: 'rangeMax'; max: Date };

const knownTimeZone = (timeZone: string | null | undefined) =>
  timeZone && isValidTimeZone(timeZone) ? timeZone : null;

const withControlTimeZone = <TOptions extends { timeZone?: string | null }>(options: TOptions): TOptions => ({
  ...options,
  timeZone: options.timeZone === undefined ? injectDateTimeZone() : options.timeZone,
});

type SideReading = { valueFormat: string; timeZone: string | null };

const parseSide = (value: string | null, { valueFormat, timeZone }: SideReading) =>
  value === null
    ? null
    : parseDateValue(value, { format: valueFormat, referenceDate: startOfDay(new Date()), timeZone });

type RangeOrderConfig = {
  path: RangeFieldPath;
  valueFormat: string;
  options: RangeOrderOptions & TimeRangeOrderOptions;
};

const rangeOrder = ({
  path,
  valueFormat,
  options: { strict, message, timeZone, allowOvernight },
}: RangeOrderConfig) => {
  const labels = injectDateTimeLabels();
  const reading = { valueFormat, timeZone: knownTimeZone(timeZone) };

  validate(path, ({ value }): RangeOrderError | undefined => {
    const start = parseSide(value().start, reading);
    const end = parseSide(value().end, reading);

    if (start === null || end === null) return undefined;

    const outOfOrder = allowOvernight
      ? strict && start.getTime() === end.getTime()
      : strict
        ? start.getTime() >= end.getTime()
        : start.getTime() > end.getTime();

    return outOfOrder ? { kind: 'rangeOrder', message: message ?? labels().rangeOrder } : undefined;
  });
};

/**
 * Signal-forms validator for `et-date-range-input`: fails the range while its start lies after its
 * end. The control does not reorder the two ends itself.
 *
 * Passes while either end is empty or unparseable; pair it with `required()` on the child paths.
 *
 * ```ts
 * form(model, (s) => {
 *   dateRangeOrder(s.stay);
 * });
 * ```
 */
export const dateRangeOrder = (path: RangeFieldPath, options: Omit<RangeOrderOptions, 'timeZone'> = {}) =>
  rangeOrder({ path, valueFormat: options.valueFormat ?? inject(DATE_FORMAT), options });

/**
 * Signal-forms validator for `et-date-time-range-input`: fails the range while its start lies after
 * its end. Same contract as {@link dateRangeOrder}, read against the `DATE_TIME_FORMAT` token.
 *
 * ```ts
 * form(model, (s) => {
 *   dateTimeRangeOrder(s.slot, { strict: true });
 * });
 * ```
 */
export const dateTimeRangeOrder = (path: RangeFieldPath, options: RangeOrderOptions = {}) =>
  rangeOrder({
    path,
    valueFormat: options.valueFormat ?? inject(DATE_TIME_FORMAT),
    options: withControlTimeZone(options),
  });

/**
 * Signal-forms validator for `et-time-range-input`: fails the range while its start time lies after
 * its end time. Same contract as {@link dateRangeOrder}, read against the `TIME_FORMAT` token. Pass
 * `allowOvernight` to accept a range across midnight.
 *
 * ```ts
 * form(model, (s) => {
 *   timeRangeOrder(s.openingHours, { strict: true });
 * });
 * ```
 */
export const timeRangeOrder = (path: RangeFieldPath, options: TimeRangeOrderOptions = {}) =>
  rangeOrder({ path, valueFormat: options.valueFormat ?? inject(TIME_FORMAT), options });

type BoundsConfig<TValue> = {
  path: Parameters<typeof validate<TValue>>[0];
  sidesOf: (value: TValue) => (string | null)[];
  valueFormat: string;
  options: { min?: Bound<TValue>; max?: Bound<TValue>; message?: string; timeZone?: string | null };
  unit: (date: Date) => Date;
  label: string;
};

const resolveBound = <TValue>(bound: Bound<TValue> | undefined, ctx: FieldContext<TValue>) =>
  typeof bound === 'function' ? bound(ctx) : (bound ?? null);

const bounds = <TValue>({ path, sidesOf, valueFormat, options, unit, label }: BoundsConfig<TValue>) => {
  const labels = injectDateTimeLabels();
  const locale = inject(DATE_LOCALE);
  const timeZone = knownTimeZone(options.timeZone);
  const formatBound = (bound: Date) => formatInZone(bound, { format: label, locale, timeZone }) ?? '';

  validate(path, (ctx): RangeMinError | RangeMaxError | undefined => {
    const sides = sidesOf(ctx.value())
      .map((side) => parseSide(side, { valueFormat, timeZone }))
      .filter((side) => side !== null)
      .map((side) => unit(side).getTime());

    const min = resolveBound(options.min, ctx);
    const max = resolveBound(options.max, ctx);

    if (min !== null && sides.some((side) => side < unit(min).getTime())) {
      return { kind: 'rangeMin', min, message: options.message ?? labels().rangeMin(formatBound(min)) };
    }

    if (max !== null && sides.some((side) => side > unit(max).getTime())) {
      return { kind: 'rangeMax', max, message: options.message ?? labels().rangeMax(formatBound(max)) };
    }

    return undefined;
  });
};

const rangeBounds = (config: Omit<BoundsConfig<DateRangeValue>, 'sidesOf'>) =>
  bounds({ ...config, sidesOf: (value) => [value.start, value.end] });

/**
 * Signal-forms validator for `et-date-range-input`: fails the range while either end lies before
 * `min` or after `max`, compared in whole `precision` units. The control's `minDate`/`maxDate` only
 * shape the picker, so a typed or patched value needs this to be rejected.
 *
 * Reports `kind: 'rangeMin'` (with `min`) or `kind: 'rangeMax'` (with `max`), so a
 * custom error resolver can format the bound itself. An empty end is skipped.
 *
 * ```ts
 * form(model, (s) => {
 *   dateRangeBounds(s.stay, { min: new Date() });
 * });
 * ```
 */
export const dateRangeBounds = (path: RangeFieldPath, options: DateOnlyRangeBoundsOptions) => {
  const precision = options.precision ?? 'day';

  rangeBounds({
    path,
    valueFormat: options.valueFormat ?? inject(DATE_FORMAT),
    options,
    unit: (date) => startOfCalendarUnit(date, precision),
    label: displayFormatForPrecision(precision, inject(DATE_LOCALE)),
  });
};

/**
 * Signal-forms validator for `et-date-time-range-input`: fails the range while either end lies
 * before `min` or after `max`, compared to the millisecond. Same contract as {@link dateRangeBounds}.
 *
 * ```ts
 * form(model, (s) => {
 *   dateTimeRangeBounds(s.slot, { min: () => new Date() });
 * });
 * ```
 */
export const dateTimeRangeBounds = (path: RangeFieldPath, options: DateRangeBoundsOptions) =>
  rangeBounds({
    path,
    valueFormat: options.valueFormat ?? inject(DATE_TIME_FORMAT),
    options: withControlTimeZone(options),
    unit: (date) => date,
    label: 'Pp',
  });

/**
 * Signal-forms validator for `et-date-input`: fails the value while it lies before `min` or after
 * `max`, compared in whole `precision` units. The control's `minDate`/`maxDate` only shape the
 * picker, so a typed or patched value needs this to be rejected.
 *
 * Reports `kind: 'rangeMin'` (with `min`) or `kind: 'rangeMax'` (with `max`), like
 * {@link dateRangeBounds}. An empty or unparseable value passes; pair it with `required()`.
 *
 * ```ts
 * form(model, (s) => {
 *   dateBounds(s.birthday, { max: new Date() });
 * });
 * ```
 */
export const dateBounds = (path: DateFieldPath, options: DateOnlyBoundsOptions = {}) => {
  const precision = options.precision ?? 'day';

  bounds<DateValue>({
    path,
    sidesOf: (value) => [value],
    valueFormat: options.valueFormat ?? inject(DATE_FORMAT),
    options,
    unit: (date) => startOfCalendarUnit(date, precision),
    label: displayFormatForPrecision(precision, inject(DATE_LOCALE)),
  });
};

/**
 * Signal-forms validator for `et-date-time-input`: fails the value while it lies before `min` or
 * after `max`, compared to the millisecond. Same contract as {@link dateBounds}.
 *
 * ```ts
 * form(model, (s) => {
 *   dateTimeBounds(s.appointment, { min: () => new Date() });
 * });
 * ```
 */
export const dateTimeBounds = (path: DateFieldPath, options: DateBoundsOptions = {}) =>
  bounds<DateValue>({
    path,
    sidesOf: (value) => [value],
    valueFormat: options.valueFormat ?? inject(DATE_TIME_FORMAT),
    options: withControlTimeZone(options),
    unit: (date) => date,
    label: 'Pp',
  });

type TimeOfDayBoundsConfig<TValue> = {
  path: Parameters<typeof validate<TValue>>[0];
  sidesOf: (value: TValue) => (string | null)[];
  options: { min?: Bound<TValue>; max?: Bound<TValue>; message?: string; valueFormat?: string };
};

const secondsOfDay = (date: Date) => date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();

const timeOfDayBounds = <TValue>({ path, sidesOf, options }: TimeOfDayBoundsConfig<TValue>) => {
  const labels = injectDateTimeLabels();
  const locale = inject(DATE_LOCALE);
  const valueFormat = options.valueFormat ?? inject(TIME_FORMAT);
  const formatBound = (bound: Date) => formatInZone(bound, { format: 'p', locale, timeZone: null }) ?? '';
  const minError = (min: Date): RangeMinError => ({
    kind: 'rangeMin',
    min,
    message: options.message ?? labels().timeMin(formatBound(min)),
  });
  const maxError = (max: Date): RangeMaxError => ({
    kind: 'rangeMax',
    max,
    message: options.message ?? labels().timeMax(formatBound(max)),
  });

  const outsideWindow = (seconds: number, { min, max }: { min: Date; max: Date }) => {
    const minSeconds = secondsOfDay(min);
    const maxSeconds = secondsOfDay(max);

    if (minSeconds <= maxSeconds) {
      if (seconds < minSeconds) return minError(min);

      return seconds > maxSeconds ? maxError(max) : undefined;
    }

    if (seconds >= minSeconds || seconds <= maxSeconds) return undefined;

    return seconds - maxSeconds <= minSeconds - seconds ? maxError(max) : minError(min);
  };

  validate(path, (ctx): RangeMinError | RangeMaxError | undefined => {
    const min = resolveBound(options.min, ctx);
    const max = resolveBound(options.max, ctx);

    for (const side of sidesOf(ctx.value())) {
      const parsed = parseSide(side, { valueFormat, timeZone: null });

      if (parsed === null) continue;

      const seconds = secondsOfDay(parsed);
      const error =
        min !== null && max !== null
          ? outsideWindow(seconds, { min, max })
          : min !== null && seconds < secondsOfDay(min)
            ? minError(min)
            : max !== null && seconds > secondsOfDay(max)
              ? maxError(max)
              : undefined;

      if (error) return error;
    }

    return undefined;
  });
};

/**
 * Signal-forms validator for `et-time-input`: fails the value while its time of day lies before
 * `min` or after `max`. The control's `minTime`/`maxTime` only shape the picker, so a typed or
 * patched value needs this to be rejected.
 *
 * Like the picker, a `min` later than `max` is a window across midnight (`22:00`-`06:00`). Reports
 * `kind: 'rangeMin'` (with `min`) or `kind: 'rangeMax'` (with `max`); outside a window across
 * midnight, the nearer bound wins. An empty or unparseable value passes; pair it with `required()`.
 *
 * ```ts
 * form(model, (s) => {
 *   timeBounds(s.start, { min: openingTime, max: closingTime });
 * });
 * ```
 */
export const timeBounds = (path: DateFieldPath, options: TimeBoundsOptions = {}) =>
  timeOfDayBounds<DateValue>({ path, sidesOf: (value) => [value], options });

/**
 * Signal-forms validator for `et-time-range-input`: fails the range while the time of day of either
 * end lies before `min` or after `max`. Same contract as {@link timeBounds}; an empty end is skipped.
 *
 * ```ts
 * form(model, (s) => {
 *   timeRangeBounds(s.openingHours, { min: openingTime, max: closingTime });
 * });
 * ```
 */
export const timeRangeBounds = (path: RangeFieldPath, options: TimeRangeBoundsOptions = {}) =>
  timeOfDayBounds<DateRangeValue>({ path, sidesOf: (value) => [value.start, value.end], options });
