import { Locale } from 'date-fns';
import { CalendarPrecision } from '../../../calendar/headless';

/**
 * The `displayFormat` a precision implies, when the consumer has not named one.
 *
 * Day precision keeps `'P'` - the locale's own short date. The coarser two are derived from that
 * same pattern rather than hardcoded, so a month field reads `07.2026` where the date field reads
 * `30.07.2026` and `07/2026` where it reads `07/30/2026`: the day token comes out along with the
 * separator that joined it, and the year run is widened to `yyyy` (date-fns' short patterns use
 * `y`, which is not fixed-width and would refuse a typing mask).
 *
 * Without a locale - date-fns falls back to en-US internally, whose short date is `MM/dd/yyyy` -
 * that is the pattern to strip, so the result matches what the day field would show.
 */
export const displayFormatForPrecision = (precision: CalendarPrecision, locale: Locale | null) => {
  if (precision === 'day') {
    return 'P';
  }

  if (precision === 'year') {
    return 'yyyy';
  }

  return monthYearFormat(locale?.formatLong?.date({ width: 'short' }) ?? 'MM/dd/yyyy');
};

/** The short date pattern with its day token (and the separator holding it in place) removed. */
const monthYearFormat = (shortDatePattern: string) => {
  // the day token with whatever non-token characters sit between it and its neighbour - a leading
  // separator when the day is not first (`dd.MM.y` → `.MM.y` keeps `MM.y`), a trailing one when it is
  const stripped = shortDatePattern.replace(/(?:[^a-zA-Z']+d+|d+[^a-zA-Z']+)/, '');

  // a pattern the strip did not understand is no basis for a month field
  if (stripped === shortDatePattern || /d/.test(stripped)) {
    return 'MM/yyyy';
  }

  return widenYearToken(stripped);
};

/** `y` / `yy` / `yyy` → `yyyy`, so the pattern is fixed-width and a mask can be derived from it. */
const widenYearToken = (pattern: string) => pattern.replace(/y+/, 'yyyy');
