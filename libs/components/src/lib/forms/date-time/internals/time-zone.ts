import { TZDate } from '@date-fns/tz';
import { Locale } from 'date-fns';
import { formatDateValue, parseDateValue, FormatDateValueOptions, ParseDateValueOptions } from './date-value';
import { splitDateTimeFormat } from './date-time-format-split';

/** The wall-clock parts of an instant, read in some time zone. */
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

/** The zone the runtime is set to, as an IANA name. */
export const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** `true` when `Intl` accepts `timeZone` as an IANA name. */
export const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });

    return true;
  } catch {
    return false;
  }
};

/**
 * A readable name for an IANA zone: the last segment, underscores turned into spaces.
 * `Asia/Tokyo` gives `Tokyo`, `America/Argentina/Buenos_Aires` gives `Buenos Aires`.
 */
export const timeZoneDisplayName = (timeZone: string) => (timeZone.split('/').pop() ?? timeZone).replace(/_/g, ' ');

/** Reads the wall-clock parts `instant` has in `timeZone`. */
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

/**
 * The instant whose wall clock in `timeZone` is `fields`. A wall clock a daylight-saving jump
 * skipped resolves forward to the first instant that exists, exactly as `TZDate` defines it.
 */
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

/** The wall-clock parts of `date` read in the runtime's own zone - the inverse of {@link zonedProxy}. */
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
 * A plain `Date` whose *runtime-local* wall clock reads as `timeZone`'s does at `instant`, so the
 * calendar and the time picker can keep doing local arithmetic on it.
 *
 * Highlighting only - never derive a committed value from one. The runtime's own daylight-saving
 * jump has no wall clock for one hour a year, and the `Date` constructor moves those parts forward;
 * building a value out of the result would commit an hour nobody picked. Take {@link zonedFields}
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

/** Formats `instant` read in `options.timeZone`. A `null` zone formats it in the runtime's own zone. */
export const formatInZone = (instant: Date, options: ZonedFormatOptions): string | null => {
  const timeZone = options.timeZone;

  if (timeZone === null) {
    return formatDateValue(instant, options);
  }

  // date-fns reads a TZDate through its own getters, so an offset token writes the zone's offset
  // rather than the runtime's - which is what keeps the wire value honest about where it is from.
  return formatDateValue(new TZDate(instant, timeZone) as Date, options);
};

/**
 * Parses `value` and reads the wall clock it names in `options.timeZone`. A `null` zone reads it in
 * the runtime's own zone.
 */
export const parseInZone = (value: string, options: ZonedParseOptions): Date | null => {
  const parsed = parseDateValue(value, options);
  const timeZone = options.timeZone;

  if (parsed === null || timeZone === null) {
    return parsed;
  }

  return instantFromZonedFields(localFields(parsed), timeZone);
};

/** Re-reads `local`'s wall clock in `timeZone`, leaving the parts alone. */
export const reinterpretInZone = (local: Date, timeZone: string | null): Date =>
  timeZone === null ? local : instantFromZonedFields(localFields(local), timeZone);

/**
 * The instant sitting on `day`'s wall-clock day, keeping the time of day `instant` has in
 * `timeZone` - what picking a day in the calendar commits while a value already exists.
 */
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

/**
 * The instant keeping the day `instant` has in `timeZone`, moved to `time`'s wall-clock time of day
 * - what picking a time in the time picker commits while a value already exists.
 */
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
 * field already shows. Naming both readings is the whole point, so a field that agrees with the
 * viewer shows nothing at all.
 *
 * The date is dropped whenever both zones land on the same day - repeating it says nothing, and a
 * date that *is* there therefore means the reader's day genuinely differs, which is the one thing
 * about a foreign zone worth being loud about.
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
