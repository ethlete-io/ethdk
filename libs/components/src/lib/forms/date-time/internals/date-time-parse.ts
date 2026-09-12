import { startOfDay } from 'date-fns';
import { ParseDateValueOptions, parseDateValue } from './date-value';
import { parseTimeText } from './time-parse';

const SEPARATOR_PATTERN = /[,\s]+/g;

/**
 * Only the strict pass honors a custom `displayFormat` - the lenient fallback always uses the
 * locale's short `P`/`p` formats, so with a non-default format it accepts locale-shaped input.
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
  // default), or a bare date leaks the current wall-clock time into the wire value
  const referenceDate = startOfDay(options.referenceDate ?? new Date());

  for (const separator of trimmed.matchAll(SEPARATOR_PATTERN)) {
    const date = parseDateValue(trimmed.slice(0, separator.index), { format: 'P', locale, referenceDate });

    if (date === null) {
      continue;
    }

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
