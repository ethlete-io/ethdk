import { createLabels } from '@ethlete/core';

/**
 * Every string the date/time inputs render or announce themselves — the picker triggers, the two halves
 * of a range, the date/time tabs, and the parse errors a typed value can produce.
 *
 * Month and weekday **names** are not here: they come from the `DATE_LOCALE` date-fns locale, which is
 * the other half of localizing these controls. See the localization guide.
 */
export type DateTimeLabels = {
  /** Accessible label for the control that opens a date picker. */
  openCalendar: string;
  /** Accessible label for the control that opens a time picker. */
  openTimePicker: string;
  /** Accessible label for the control that opens a combined date & time picker. */
  openDateTimePicker: string;
  /** Accessible label for the picker's dialog. */
  chooseDate: string;

  /** Accessible label for a range's start field. */
  startDate: string;
  /** Accessible label for a range's end field. */
  endDate: string;

  /** The date & time picker's tab showing the calendar. */
  dateTab: string;
  /** The date & time picker's tab showing the clock. */
  timeTab: string;

  /** Validation message for text that isn't a date. */
  invalidDate: string;
  /** Validation message for text that isn't a time. */
  invalidTime: string;
  /** Validation message for text that isn't a date and time. */
  invalidDateTime: string;
  /** Validation message for text that isn't a date range. */
  invalidDateRange: string;
  /** Validation message for text that isn't a duration. */
  invalidDuration: string;
};

/** The built-in English labels. */
export const DEFAULT_DATE_TIME_LABELS: DateTimeLabels = {
  openCalendar: 'Open calendar',
  openTimePicker: 'Open time picker',
  openDateTimePicker: 'Open date & time picker',
  chooseDate: 'Choose a date',

  startDate: 'Start date',
  endDate: 'End date',

  dateTab: 'Date',
  timeTab: 'Time',

  invalidDate: 'Please enter a valid date',
  invalidTime: 'Please enter a valid time',
  invalidDateTime: 'Please enter a valid date and time',
  invalidDateRange: 'Please enter a valid date range',
  invalidDuration: 'Please enter a valid duration',
};

/**
 * Localize the date/time inputs' strings for everything below this injector, and read the set in effect
 * here as a signal. Partial — whatever you leave out keeps its {@link DEFAULT_DATE_TIME_LABELS} value.
 * See {@link createLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideDateTimeLabels({ openCalendar: 'Kalender öffnen', invalidDate: 'Bitte ein gültiges Datum eingeben' });
 */
export const [provideDateTimeLabels, injectDateTimeLabels, DATE_TIME_LABELS] = createLabels<DateTimeLabels>(
  'DATE_TIME_LABELS',
  DEFAULT_DATE_TIME_LABELS,
);
