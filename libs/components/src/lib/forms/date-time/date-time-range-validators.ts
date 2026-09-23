import { inject } from '@angular/core';
import { FieldContext, LogicFn, validate, ValidationError } from '@angular/forms/signals';
import { format, startOfDay } from 'date-fns';
import { CalendarPrecision, startOfCalendarUnit } from '../../calendar/headless';
import { DATE_FORMAT, TIME_FORMAT } from './date-time-formats';
import { DateRangeValue } from './internals/date-range-picker-input.directive';
import { parseDateValue } from './internals/date-value';
import { displayFormatForPrecision } from './internals/precision-format';

type RangeFieldPath = Parameters<typeof validate<DateRangeValue>>[0];

type RangeBound = Date | null | LogicFn<DateRangeValue, Date | null>;

export type RangeOrderOptions = {
  /**
   * date-fns format of the two wire strings - the control's `valueFormat`. Defaults to the
   * `DATE_FORMAT` token (`TIME_FORMAT` for {@link timeRangeOrder}), the same default the control uses.
   */
  valueFormat?: string;
  /** Also fail while both ends are equal. @default false */
  strict?: boolean;
  /** Overrides the default "The start must be before the end" message. */
  message?: string;
};

export type DateRangeBoundsOptions = {
  /** The earliest date either end may name, or a function returning it. */
  min?: RangeBound;
  /** The latest date either end may name, or a function returning it. */
  max?: RangeBound;
  /** date-fns format of the two wire strings. Defaults to the `DATE_FORMAT` token. */
  valueFormat?: string;
  /** Overrides the default "Choose dates on or after …" / "… on or before …" message. */
  message?: string;
};

export type DateOnlyRangeBoundsOptions = DateRangeBoundsOptions & {
  /**
   * The unit both ends and the bounds are compared in - the control's `precision`. At `'day'` a
   * `min` of "now" still admits today.
   * @default 'day'
   */
  precision?: CalendarPrecision;
};

export type RangeOrderError = ValidationError & { kind: 'rangeOrder' };

export type RangeMinError = ValidationError & { kind: 'rangeMin'; min: Date };

export type RangeMaxError = ValidationError & { kind: 'rangeMax'; max: Date };

const parseSide = (value: string | null, valueFormat: string) =>
  value === null ? null : parseDateValue(value, { format: valueFormat, referenceDate: startOfDay(new Date()) });

type RangeOrderConfig = { path: RangeFieldPath; valueFormat: string; options: RangeOrderOptions };

const rangeOrder = ({ path, valueFormat, options: { strict, message } }: RangeOrderConfig) =>
  validate(path, ({ value }): RangeOrderError | undefined => {
    const start = parseSide(value().start, valueFormat);
    const end = parseSide(value().end, valueFormat);

    if (start === null || end === null) return undefined;

    const outOfOrder = strict ? start.getTime() >= end.getTime() : start.getTime() > end.getTime();

    return outOfOrder ? { kind: 'rangeOrder', message: message ?? 'The start must be before the end' } : undefined;
  });

/**
 * Signal-forms validator for `et-date-range-input` and `et-date-time-range-input`: fails the range
 * while its start lies after its end. Neither control reorders the two ends itself.
 *
 * Passes while either end is empty or unparseable; pair it with `required()` on the child paths.
 *
 * ```ts
 * form(model, (s) => {
 *   dateRangeOrder(s.stay, { valueFormat: 'yyyy-MM-dd' });
 * });
 * ```
 */
export const dateRangeOrder = (path: RangeFieldPath, options: RangeOrderOptions = {}) =>
  rangeOrder({ path, valueFormat: options.valueFormat ?? inject(DATE_FORMAT), options });

/**
 * Signal-forms validator for `et-time-range-input`: fails the range while its start time lies after
 * its end time. Same contract as {@link dateRangeOrder}, read against the `TIME_FORMAT` token.
 *
 * ```ts
 * form(model, (s) => {
 *   timeRangeOrder(s.openingHours, { strict: true });
 * });
 * ```
 */
export const timeRangeOrder = (path: RangeFieldPath, options: RangeOrderOptions = {}) =>
  rangeOrder({ path, valueFormat: options.valueFormat ?? inject(TIME_FORMAT), options });

type RangeBoundsConfig = {
  path: RangeFieldPath;
  valueFormat: string;
  options: DateRangeBoundsOptions;
  unit: (date: Date) => Date;
  label: string;
};

const resolveBound = (bound: RangeBound | undefined, ctx: FieldContext<DateRangeValue>) =>
  typeof bound === 'function' ? bound(ctx) : (bound ?? null);

const rangeBounds = ({ path, valueFormat, options, unit, label }: RangeBoundsConfig) =>
  validate(path, (ctx): RangeMinError | RangeMaxError | undefined => {
    const sides = [ctx.value().start, ctx.value().end]
      .map((side) => parseSide(side, valueFormat))
      .filter((side) => side !== null)
      .map((side) => unit(side).getTime());

    const min = resolveBound(options.min, ctx);
    const max = resolveBound(options.max, ctx);

    if (min !== null && sides.some((side) => side < unit(min).getTime())) {
      return { kind: 'rangeMin', min, message: options.message ?? `Choose dates on or after ${format(min, label)}` };
    }

    if (max !== null && sides.some((side) => side > unit(max).getTime())) {
      return { kind: 'rangeMax', max, message: options.message ?? `Choose dates on or before ${format(max, label)}` };
    }

    return undefined;
  });

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
 *   dateRangeBounds(s.stay, { min: new Date(), valueFormat: 'yyyy-MM-dd' });
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
    label: displayFormatForPrecision(precision, null),
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
    valueFormat: options.valueFormat ?? inject(DATE_FORMAT),
    options,
    unit: (date) => date,
    label: 'Pp',
  });
