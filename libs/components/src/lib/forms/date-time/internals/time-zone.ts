import { TZDate } from '@date-fns/tz';
import { Locale } from 'date-fns';
import { formatDateValue, parseDateValue, FormatDateValueOptions, ParseDateValueOptions } from './date-value';
import { splitDateTimeFormat } from './date-time-format-split';

export type ZonedFields = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
};

export type ZonedFormatOptions = FormatDateValueOptions & { timeZone: string | null };
export type ZonedParseOptions = ParseDateValueOptions & { timeZone: string | null };

export const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });

    return true;
  } catch {
    return false;
  }
};

export const timeZoneDisplayName = (timeZone: string) => (timeZone.split('/').pop() ?? timeZone).replace(/_/g, ' ');

export const zonedFields = (instant: Date, timeZone: string): ZonedFields => {
  const zoned = new TZDate(instant, timeZone);

  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth(),
    day: zoned.getDate(),
    hours: zoned.getHours(),
    minutes: zoned.getMinutes(),
    seconds: zoned.getSeconds(),
    milliseconds: zoned.getMilliseconds(),
  };
};

/** A wall clock a daylight-saving jump skipped resolves forward to the first instant that exists. */
export const instantFromZonedFields = (fields: ZonedFields, timeZone: string): Date =>
  new Date(
    new TZDate(
      fields.year,
      fields.month,
      fields.day,
      fields.hours,
      fields.minutes,
      fields.seconds,
      fields.milliseconds,
      timeZone,
    ).getTime(),
  );

export const localFields = (date: Date): ZonedFields => ({
  year: date.getFullYear(),
  month: date.getMonth(),
  day: date.getDate(),
  hours: date.getHours(),
  minutes: date.getMinutes(),
  seconds: date.getSeconds(),
  milliseconds: date.getMilliseconds(),
});

/**
 * Highlighting only - never derive a committed value from one. The runtime's own daylight-saving
 * jump has no wall clock for one hour a year and the `Date` constructor moves those parts forward,
 * so a value built out of the result would commit an hour nobody picked. Take {@link zonedFields}
 * of the instant instead.
 */
export const zonedProxy = (instant: Date, timeZone: string): Date => {
  const fields = zonedFields(instant, timeZone);

  return new Date(
    fields.year,
    fields.month,
    fields.day,
    fields.hours,
    fields.minutes,
    fields.seconds,
    fields.milliseconds,
  );
};

export const formatInZone = (instant: Date, options: ZonedFormatOptions): string | null => {
  const timeZone = options.timeZone;

  if (timeZone === null) {
    return formatDateValue(instant, options);
  }

  return formatDateValue(new TZDate(instant, timeZone) as Date, options);
};

export const parseInZone = (value: string, options: ZonedParseOptions): Date | null => {
  const parsed = parseDateValue(value, options);
  const timeZone = options.timeZone;

  if (parsed === null || timeZone === null) {
    return parsed;
  }

  return instantFromZonedFields(localFields(parsed), timeZone);
};

export const reinterpretInZone = (local: Date, timeZone: string | null): Date =>
  timeZone === null ? local : instantFromZonedFields(localFields(local), timeZone);

export const withZonedDay = (instant: Date, options: { day: Date; timeZone: string }): Date =>
  instantFromZonedFields(
    {
      ...zonedFields(instant, options.timeZone),
      year: options.day.getFullYear(),
      month: options.day.getMonth(),
      day: options.day.getDate(),
    },
    options.timeZone,
  );

export const withZonedTimeOfDay = (instant: Date, options: { time: Date; timeZone: string }): Date =>
  instantFromZonedFields(
    {
      ...zonedFields(instant, options.timeZone),
      hours: options.time.getHours(),
      minutes: options.time.getMinutes(),
      seconds: options.time.getSeconds(),
      milliseconds: 0,
    },
    options.timeZone,
  );

export type LocalReadingOptions = {
  format: string;
  locale?: Locale | null;
  timeZone: string | null;
};

/**
 * How `instant` reads in the runtime's own zone, or `null` when that is the same wall clock the
 * field already shows. The date is dropped whenever both zones land on the same day.
 */
export const localReading = (instant: Date | null, options: LocalReadingOptions): string | null => {
  const timeZone = options.timeZone;

  if (instant === null || timeZone === null) {
    return null;
  }

  const local = formatDateValue(instant, options);

  if (local === null || local === formatInZone(instant, { ...options, timeZone })) {
    return null;
  }

  const fields = zonedFields(instant, timeZone);
  const sameDay =
    fields.year === instant.getFullYear() && fields.month === instant.getMonth() && fields.day === instant.getDate();

  if (!sameDay) {
    return local;
  }

  const split = splitDateTimeFormat(options.format, options.locale ?? null);

  if (split === null || split.time.trim() === '') {
    return local;
  }

  return formatDateValue(instant, { ...options, format: split.time }) ?? local;
};
