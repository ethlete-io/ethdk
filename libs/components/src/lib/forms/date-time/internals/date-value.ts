import { tz } from '@date-fns/tz';
import { format as formatDate, isValid, parse } from 'date-fns';
import { Locale } from 'date-fns';
import { formatTokens } from './date-time-format-split';

export type ParseDateValueOptions = {
  /** date-fns format string the value must match. */
  format: string;
  locale?: Locale | null;
  /** The date missing parts are taken from. Defaults to now. */
  referenceDate?: Date;
  /** IANA zone whose wall clock the text is read in, unless the text carries its own offset. */
  timeZone?: string | null;
};

export type FormatDateValueOptions = {
  /** date-fns format string to render the date with. */
  format: string;
  locale?: Locale | null;
};

// date-fns' `y`/`yyyy` parsers take one to four digits as the literal year, so `1.2.26` would read as 0026
const isShortYear = (parsed: Date, { format, locale }: Pick<ParseDateValueOptions, 'format' | 'locale'>) => {
  if (parsed.getFullYear() >= 1000) {
    return false;
  }

  const yearTokens = formatTokens(format, locale ?? null).filter((token) => token[0] === 'y');

  return yearTokens.length > 0 && !yearTokens.includes('yy');
};

/**
 * Strictly parses `value` against a date-fns format string. Returns `null` for
 * empty input, leftover characters, a year of fewer than four digits where the format
 * asks for a full one, or anything date-fns considers invalid.
 */
export const parseDateValue = (value: string, options: ParseDateValueOptions): Date | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const locale = options.locale ?? undefined;
  const timeZone = options.timeZone ?? null;
  const parsed = parse(trimmed, options.format, options.referenceDate ?? new Date(), {
    locale,
    in: timeZone === null ? undefined : tz(timeZone),
  });

  if (!isValid(parsed) || isShortYear(parsed, options)) {
    return null;
  }

  return timeZone === null ? parsed : new Date(parsed.getTime());
};

/** Formats a `Date` with a date-fns format string. Invalid dates yield `null`. */
export const formatDateValue = (date: Date, options: FormatDateValueOptions): string | null => {
  if (!isValid(date)) {
    return null;
  }

  const locale = options.locale;

  return formatDate(date, options.format, locale ? { locale } : undefined);
};
