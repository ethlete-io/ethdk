import { createLabels } from '@ethlete/core';

/**
 * The strings the calendar renders or announces itself. Month and weekday **names** are not here — those
 * come from the `DATE_LOCALE` date-fns locale, which is what a localized app provides.
 */
export type CalendarLabels = {
  /** Accessible label for the control that steps back a month. */
  previousMonth: string;
  /** Accessible label for the control that steps forward a month. */
  nextMonth: string;
};

/** The built-in English labels. */
export const DEFAULT_CALENDAR_LABELS: CalendarLabels = {
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
};

/**
 * Localize the calendar's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial — whatever you leave out keeps its {@link DEFAULT_CALENDAR_LABELS} value. See {@link createLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideCalendarLabels({ previousMonth: 'Vorheriger Monat', nextMonth: 'Nächster Monat' });
 */
export const [provideCalendarLabels, injectCalendarLabels, CALENDAR_LABELS] = createLabels<CalendarLabels>(
  'CALENDAR_LABELS',
  DEFAULT_CALENDAR_LABELS,
);
