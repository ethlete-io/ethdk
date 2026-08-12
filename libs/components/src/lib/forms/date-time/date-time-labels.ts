import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * Every string the date/time inputs render or announce themselves - the picker triggers, the two halves
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
  /** Accessible label for the date picker's dialog. */
  chooseDate: string;
  /** Accessible label for the time picker's dialog. */
  chooseTime: string;
  /** Accessible label for the combined date & time picker's dialog. */
  chooseDateTime: string;
  /** Accessible label for the date range picker's dialog. */
  chooseDateRange: string;
  /** Accessible label for the time range picker's dialog. */
  chooseTimeRange: string;
  /** Accessible label for the date & time range picker's dialog. */
  chooseDateTimeRange: string;

  /** Accessible label for a range's start field. */
  startDate: string;
  /** Accessible label for a range's end field. */
  endDate: string;
  /** Accessible label for a time range's start field. */
  startTime: string;
  /** Accessible label for a time range's end field. */
  endTime: string;
  /** Accessible label for a date & time range's start field. */
  startDateTime: string;
  /** Accessible label for a date & time range's end field. */
  endDateTime: string;

  /** The date & time picker's tab showing the calendar. */
  dateTab: string;
  /** The date & time picker's tab showing the clock. */
  timeTab: string;
  /** The date & time range picker's tab showing the calendar. */
  datesTab: string;
  /** The date & time range picker's tab showing the clock. (Which of the two times the reader is
   * setting is chosen inside it, by `TIME_PICKER_LABELS.startTime`/`endTime`.) */
  timesTab: string;

  /** Validation message for text that isn't a date. */
  invalidDate: string;
  /** Validation message for text that isn't a time. */
  invalidTime: string;
  /** Validation message for text that isn't a date and time. */
  invalidDateTime: string;
  /** Validation message for text that isn't a date range. */
  invalidDateRange: string;
  /** Validation message for text that isn't a time range. */
  invalidTimeRange: string;
  /** Validation message for text that isn't a date & time range. */
  invalidDateTimeRange: string;
  /** Validation message for text that isn't a duration. */
  invalidDuration: string;
};

/** The built-in English labels. */
export const DEFAULT_DATE_TIME_LABELS: DateTimeLabels = {
  openCalendar: 'Open calendar',
  openTimePicker: 'Open time picker',
  openDateTimePicker: 'Open date & time picker',
  chooseDate: 'Choose a date',
  chooseTime: 'Choose a time',
  chooseDateTime: 'Choose a date and time',
  chooseDateRange: 'Choose a date range',
  chooseTimeRange: 'Choose a time range',
  chooseDateTimeRange: 'Choose a date and time range',

  startDate: 'Start date',
  endDate: 'End date',
  startTime: 'Start time',
  endTime: 'End time',
  startDateTime: 'Start date and time',
  endDateTime: 'End date and time',

  dateTab: 'Date',
  timeTab: 'Time',
  datesTab: 'Dates',
  timesTab: 'Times',

  invalidDate: 'Please enter a valid date',
  invalidTime: 'Please enter a valid time',
  invalidDateTime: 'Please enter a valid date and time',
  invalidDateRange: 'Please enter a valid date range',
  invalidTimeRange: 'Please enter a valid time range',
  invalidDateTimeRange: 'Please enter a valid date and time range',
  invalidDuration: 'Please enter a valid duration',
};

const DATE_TIME_LABELS_DEF = /* @__PURE__ */ defineLabels<DateTimeLabels>('DATE_TIME_LABELS', DEFAULT_DATE_TIME_LABELS);

/**
 * Localize the date/time inputs' strings for everything below this injector, and read the set in effect
 * here as a signal. Partial - whatever you leave out keeps its {@link DEFAULT_DATE_TIME_LABELS} value.
 * See {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideDateTimeLabels({ openCalendar: 'Kalender öffnen', invalidDate: 'Bitte ein gültiges Datum eingeben' });
 */
export const provideDateTimeLabels = /* @__PURE__ */ toProvideFn(DATE_TIME_LABELS_DEF);
export const injectDateTimeLabels = /* @__PURE__ */ toInjectFn(DATE_TIME_LABELS_DEF);
export const DATE_TIME_LABELS = /* @__PURE__ */ toToken(DATE_TIME_LABELS_DEF);
