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
  /** Accessible label for the step-back control while the month grid is showing. */
  previousYear: string;
  /** Accessible label for the step-forward control while the month grid is showing. */
  nextYear: string;
  /** Accessible label for the step-back control while the year grid is showing. */
  previousYearRange: string;
  /** Accessible label for the step-forward control while the year grid is showing. */
  nextYearRange: string;
  /** Accessible label for the header button while the day grid is showing (it opens the month grid). */
  switchToYearView: string;
  /** Accessible label for the header button while the month grid is showing (it opens the year grid). */
  switchToMultiYearView: string;
  /** Accessible label for the header button while the year grid is showing (it returns to the day grid). */
  switchToMonthView: string;
  /** Names the week-number column, and prefixes each row's number (`Week 31`). */
  week: string;
};

/** The built-in English labels. */
export const DEFAULT_CALENDAR_LABELS: CalendarLabels = {
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  previousYear: 'Previous year',
  nextYear: 'Next year',
  previousYearRange: 'Previous years',
  nextYearRange: 'Next years',
  switchToYearView: 'Choose month and year',
  switchToMultiYearView: 'Choose year',
  switchToMonthView: 'Choose date',
  week: 'Week',
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
