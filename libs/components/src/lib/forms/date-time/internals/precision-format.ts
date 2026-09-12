import { Locale } from 'date-fns';
import { CalendarPrecision } from '../../../calendar/headless';

/** The `displayFormat` a precision implies, when the consumer has not named one. */
export const displayFormatForPrecision = (precision: CalendarPrecision, locale: Locale | null) => {
  if (precision === 'day') {
    return 'P';
  }

  if (precision === 'year') {
    return 'yyyy';
  }

  return monthYearFormat(locale?.formatLong?.date({ width: 'short' }) ?? 'MM/dd/yyyy');
};

const monthYearFormat = (shortDatePattern: string) => {
  const stripped = shortDatePattern.replace(/(?:[^a-zA-Z']+d+|d+[^a-zA-Z']+)/, '');

  if (stripped === shortDatePattern || /d/.test(stripped)) {
    return 'MM/yyyy';
  }

  return widenYearToken(stripped);
};

/** `y` / `yy` / `yyy` → `yyyy`, so the pattern is fixed-width and a mask can be derived from it. */
const widenYearToken = (pattern: string) => pattern.replace(/y+/, 'yyyy');
