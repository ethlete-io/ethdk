import { startOfDay } from 'date-fns';
import { ParseDateValueOptions, parseDateValue } from './date-value';
import { parseTimeText } from './time-parse';

// every run of whitespace and/or commas is a candidate date|time boundary
const SEPARATOR_PATTERN = /[,\s]+/g;

/**
 * Parses typed date-time text: strictly against the combined display format
 * first, then leniently - the text split into a date and a time at any
 * separator boundary (the date parsed against the locale's short `P` format,
 * the time via the time input's lenient `parseTimeText`, so `7/16/2026 930pm`
 * commits), or a bare date committing at midnight. Returns `null` when nothing
 * parses.
 *
 * Deliberate limitation: only the strict pass honors a custom `displayFormat`.
 * The lenient fallback always uses the locale's short `P`/`p` formats, because a
 * combined `displayFormat` can't be split into date and time halves generically
 * (its token layout is arbitrary). With a non-default `displayFormat`, lenient
 * recovery therefore accepts locale-shaped input rather than display-shaped input.
 */
export const parseDateTimeText = (value: string, options: ParseDateValueOptions): Date | null => {
  const strict = parseDateValue(value, options);

  if (strict !== null) {
    return strict;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const locale = options.locale;
  // date-only parses must fill their missing time from midnight, not `new Date()` (parseDateValue's
  // default) - otherwise a bare date leaks the current wall-clock time into the wire value, and the
  // day-portion reference below would hand a non-midnight time to `parseTimeText`.
  const referenceDate = startOfDay(options.referenceDate ?? new Date());

  for (const separator of trimmed.matchAll(SEPARATOR_PATTERN)) {
    const date = parseDateValue(trimmed.slice(0, separator.index), { format: 'P', locale, referenceDate });

    if (date === null) {
      continue;
    }

    // `date` parsed from a date-only format is midnight - as the reference date
    // it contributes the day, the parsed time contributes the time of day
    const merged = parseTimeText(trimmed.slice(separator.index + separator[0].length), {
      format: 'p',
      locale,
      referenceDate: date,
    });

    if (merged !== null) {
      return merged;
    }
  }

  return parseDateValue(trimmed, { format: 'P', locale, referenceDate });
};
