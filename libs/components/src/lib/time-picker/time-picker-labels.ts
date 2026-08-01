import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The strings the time picker's columns announce - each is a listbox of numbers with no visible label. */
export type TimePickerLabels = {
  /** Accessible label for the hours column. */
  hours: string;
  /** Accessible label for the minutes column. */
  minutes: string;
  /** Accessible label for the seconds column. */
  seconds: string;
  /** Accessible label for the AM/PM column. */
  period: string;
};

/** The built-in English labels. */
export const DEFAULT_TIME_PICKER_LABELS: TimePickerLabels = {
  hours: 'Hours',
  minutes: 'Minutes',
  seconds: 'Seconds',
  period: 'AM/PM',
};

const TIME_PICKER_LABELS_DEF = /* @__PURE__ */ defineLabels<TimePickerLabels>(
  'TIME_PICKER_LABELS',
  DEFAULT_TIME_PICKER_LABELS,
);

/**
 * Localize the time picker's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_TIME_PICKER_LABELS} value. See {@link defineLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideTimePickerLabels({ hours: 'Stunden', minutes: 'Minuten' });
 */
export const provideTimePickerLabels = /* @__PURE__ */ toProvideFn(TIME_PICKER_LABELS_DEF);
export const injectTimePickerLabels = /* @__PURE__ */ toInjectFn(TIME_PICKER_LABELS_DEF);
export const TIME_PICKER_LABELS = /* @__PURE__ */ toToken(TIME_PICKER_LABELS_DEF);
