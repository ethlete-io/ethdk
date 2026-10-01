import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The strings the time picker shows and announces. */
export type TimePickerLabels = {
  /** Accessible name of the handle of a single time ring. */
  time: string;
  /** Accessible name of a time range's start handle, and its note in the ring centre. */
  startTime: string;
  /** Accessible name of a time range's end handle, and its note in the ring centre. */
  endTime: string;
  /** Short hint in the centre of an empty ring, and the value an empty handle announces. */
  emptyHint: string;
  /** Unit after the hours of a range's duration in the centre of the ring, as in `8 h 30 min`. */
  durationHours: string;
  /** Unit after the minutes of a range's duration in the centre of the ring. */
  durationMinutes: string;
  /** Note under a range's duration when the end is earlier in the day than the start. */
  endsNextDay: string;
};

/** The built-in English labels. */
export const DEFAULT_TIME_PICKER_LABELS: TimePickerLabels = {
  time: 'Time',
  startTime: 'Start time',
  endTime: 'End time',
  emptyHint: 'Pick a time',
  durationHours: 'h',
  durationMinutes: 'min',
  endsNextDay: 'ends next day',
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
 * provideTimePickerLabels({ startTime: 'Beginn', endTime: 'Ende' });
 */
export const provideTimePickerLabels = /* @__PURE__ */ toProvideFn(TIME_PICKER_LABELS_DEF);
export const injectTimePickerLabels = /* @__PURE__ */ toInjectFn(TIME_PICKER_LABELS_DEF);
export const TIME_PICKER_LABELS = /* @__PURE__ */ toToken(TIME_PICKER_LABELS_DEF);
