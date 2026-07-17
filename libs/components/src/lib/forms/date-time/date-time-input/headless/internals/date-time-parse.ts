import { ParseDateValueOptions, parseDateValue } from '../../../internals/date-value';
import { parseTimeText } from '../../../time-input/headless/internals/time-parse';

// every run of whitespace and/or commas is a candidate date|time boundary
const SEPARATOR_PATTERN = /[,\s]+/g;

/**
 * Parses typed date-time text: strictly against the combined display format
 * first, then leniently — the text split into a date and a time at any
 * separator boundary (the date parsed against the locale's short `P` format,
 * the time via the time input's lenient `parseTimeText`, so `7/16/2026 930pm`
 * commits), or a bare date committing at midnight. Returns `null` when nothing
 * parses.
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

  for (const separator of trimmed.matchAll(SEPARATOR_PATTERN)) {
    const date = parseDateValue(trimmed.slice(0, separator.index), { format: 'P', locale });

    if (date === null) {
      continue;
    }

    // `date` parsed from a date-only format is midnight — as the reference date
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

  return parseDateValue(trimmed, { format: 'P', locale });
};
