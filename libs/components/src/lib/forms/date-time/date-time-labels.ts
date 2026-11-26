import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * Every string the date/time inputs render or announce themselves - the picker triggers, the two halves
 * of a range, the date/time tabs, and the parse errors a typed value can produce.
 *
 * Month and weekday **names** are not here: they come from the `DATE_LOCALE` date-fns locale.
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
  /** The date & time range picker's tab showing the clock. */
  timesTab: string;
  /** Accessible name of the date/time tab switch in the date & time pickers' bottom sheet. */
  paneSwitch: string;

  /** Accessible label for the preset list in a range picker. */
  presets: string;
  /** {@link todayPreset}'s button. */
  presetToday: string;
  /** {@link yesterdayPreset}'s button. */
  presetYesterday: string;
  /** {@link lastDaysPreset}'s button. */
  presetLastDays: (count: number) => string;
  /** {@link nextDaysPreset}'s button. */
  presetNextDays: (count: number) => string;
  /** {@link thisWeekPreset}'s button. */
  presetThisWeek: string;
  /** {@link lastWeekPreset}'s button. */
  presetLastWeek: string;
  /** {@link thisMonthPreset}'s button. */
  presetThisMonth: string;
  /** {@link lastMonthPreset}'s button. */
  presetLastMonth: string;
  /** {@link thisYearPreset}'s button. */
  presetThisYear: string;

  /** The second reading under a field whose zone is not the reader's. */
  timeZoneReading: (timeZone: string, localTime: string) => string;

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

  /** `dateRangeOrder`/`dateTimeRangeOrder`/`timeRangeOrder` message for a start after the end. */
  rangeOrder: string;
  /** `dateRangeBounds`/`dateTimeRangeBounds`' message for an end before `min`, given the formatted bound. */
  rangeMin: (min: string) => string;
  /** `dateRangeBounds`/`dateTimeRangeBounds`' message for an end after `max`, given the formatted bound. */
  rangeMax: (max: string) => string;
  /** `timeBounds`/`timeRangeBounds`' message for a time before `min`, given the formatted bound. */
  timeMin: (min: string) => string;
  /** `timeBounds`/`timeRangeBounds`' message for a time after `max`, given the formatted bound. */
  timeMax: (max: string) => string;
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
  paneSwitch: 'Picker view',

  presets: 'Presets',
  presetToday: 'Today',
  presetYesterday: 'Yesterday',
  presetLastDays: (count) => `Last ${count} days`,
  presetNextDays: (count) => `Next ${count} days`,
  presetThisWeek: 'This week',
  presetLastWeek: 'Last week',
  presetThisMonth: 'This month',
  presetLastMonth: 'Last month',
  presetThisYear: 'This year',

  timeZoneReading: (timeZone, localTime) => `${timeZone} · ${localTime} your time`,

  invalidDate: 'Please enter a valid date',
  invalidTime: 'Please enter a valid time',
  invalidDateTime: 'Please enter a valid date and time',
  invalidDateRange: 'Please enter a valid date range',
  invalidTimeRange: 'Please enter a valid time range',
  invalidDateTimeRange: 'Please enter a valid date and time range',
  invalidDuration: 'Please enter a valid duration',

  rangeOrder: 'The start must be before the end',
  rangeMin: (min) => `Choose dates on or after ${min}`,
  rangeMax: (max) => `Choose dates on or before ${max}`,
  timeMin: (min) => `Choose a time at or after ${min}`,
  timeMax: (max) => `Choose a time at or before ${max}`,
};

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_DATE_TIME_LABELS: DateTimeLabels = {
  openCalendar: 'Kalender öffnen',
  openTimePicker: 'Zeitauswahl öffnen',
  openDateTimePicker: 'Datums- und Zeitauswahl öffnen',
  chooseDate: 'Datum auswählen',
  chooseTime: 'Uhrzeit auswählen',
  chooseDateTime: 'Datum und Uhrzeit auswählen',
  chooseDateRange: 'Zeitraum auswählen',
  chooseTimeRange: 'Zeitspanne auswählen',
  chooseDateTimeRange: 'Zeitraum mit Uhrzeit auswählen',
  startDate: 'Startdatum',
  endDate: 'Enddatum',
  startTime: 'Startzeit',
  endTime: 'Endzeit',
  startDateTime: 'Startdatum und -zeit',
  endDateTime: 'Enddatum und -zeit',
  dateTab: 'Datum',
  timeTab: 'Uhrzeit',
  datesTab: 'Daten',
  timesTab: 'Uhrzeiten',
  paneSwitch: 'Auswahlansicht',
  presets: 'Voreinstellungen',
  presetToday: 'Heute',
  presetYesterday: 'Gestern',
  presetLastDays: (count) => `Letzte ${count} Tage`,
  presetNextDays: (count) => `Nächste ${count} Tage`,
  presetThisWeek: 'Diese Woche',
  presetLastWeek: 'Letzte Woche',
  presetThisMonth: 'Dieser Monat',
  presetLastMonth: 'Letzter Monat',
  presetThisYear: 'Dieses Jahr',
  timeZoneReading: (timeZone, localTime) => `${timeZone} · ${localTime} Ortszeit`,
  invalidDate: 'Bitte ein gültiges Datum eingeben',
  invalidTime: 'Bitte eine gültige Uhrzeit eingeben',
  invalidDateTime: 'Bitte ein gültiges Datum mit Uhrzeit eingeben',
  invalidDateRange: 'Bitte einen gültigen Zeitraum eingeben',
  invalidTimeRange: 'Bitte eine gültige Zeitspanne eingeben',
  invalidDateTimeRange: 'Bitte einen gültigen Zeitraum mit Uhrzeit eingeben',
  invalidDuration: 'Bitte eine gültige Dauer eingeben',
  rangeOrder: 'Der Beginn muss vor dem Ende liegen',
  rangeMin: (min) => `Ein Datum ab dem ${min} auswählen`,
  rangeMax: (max) => `Ein Datum bis zum ${max} auswählen`,
  timeMin: (min) => `Eine Uhrzeit ab ${min} auswählen`,
  timeMax: (max) => `Eine Uhrzeit bis ${max} auswählen`,
};

/** The label set for a locale. Anything other than English and German needs {@link provideDateTimeLabels}. */
export const dateTimeLabelsForLocale = (locale: string): DateTimeLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_DATE_TIME_LABELS : DEFAULT_DATE_TIME_LABELS;

const DATE_TIME_LABELS_DEF = /* @__PURE__ */ defineLabels<DateTimeLabels>('DATE_TIME_LABELS', dateTimeLabelsForLocale);

/**
 * Localize the date/time inputs' strings for everything below this injector, and read the set in effect
 * here as a signal. Partial - whatever you leave out keeps its {@link DEFAULT_DATE_TIME_LABELS} value.
 *
 * @example
 * provideDateTimeLabels({ openCalendar: 'Kalender öffnen', invalidDate: 'Bitte ein gültiges Datum eingeben' });
 */
export const provideDateTimeLabels = /* @__PURE__ */ toProvideFn(DATE_TIME_LABELS_DEF);
export const injectDateTimeLabels = /* @__PURE__ */ toInjectFn(DATE_TIME_LABELS_DEF);
export const DATE_TIME_LABELS = /* @__PURE__ */ toToken(DATE_TIME_LABELS_DEF);
