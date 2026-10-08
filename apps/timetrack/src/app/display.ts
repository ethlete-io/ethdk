import { signal } from '@angular/core';
import {
  ClockStyle,
  DateStyle,
  DEFAULT_DISPLAY_SETTINGS,
  formatClock,
  formatDate,
  formatDateRange,
  TimetrackDisplaySettings,
} from '@ethlete/timetrack';

const display = signal<TimetrackDisplaySettings>(DEFAULT_DISPLAY_SETTINGS);

/** Set by the settings store; every formatter below reads it, so a template re-renders when the user changes it. */
export const setDisplaySettings = (next: TimetrackDisplaySettings) => display.set(next);

export const displayClock = (): ClockStyle => display().clock;

export const displayDateStyle = (): DateStyle => display().dateStyle;

export const formatClockTime = (at: Date, options: { seconds?: boolean } = {}) =>
  formatClock(at, { clock: display().clock, ...options });

/** A date, by calendar day (`2026-10-07`) or instant. */
const dayStart = (day: string) => new Date(`${day}T00:00:00`);

export const formatDayLabel = (day: string) =>
  formatDate(dayStart(day), { style: display().dateStyle, width: 'long', weekday: true });

/** A weekday and its date, for a list of days — `Wed, 7 Oct`. */
export const formatWeekdayLabel = (day: string) =>
  formatDate(dayStart(day), { style: display().dateStyle, width: 'short', weekday: true });

/** The span a week covers, as one label — `5 Oct – 11 Oct 2026`. */
export const formatDayRangeLabel = (from: string, to: string) =>
  formatDateRange({ from: dayStart(from), to: dayStart(to), style: display().dateStyle });

/** A date with no weekday, from an instant — `7 Oct`. */
export const formatShortDate = (at: Date) => formatDate(at, { style: display().dateStyle, width: 'short' });

/** A date and a clock time together, for a timestamp that is not on today's screen. */
export const formatDateTime = (at: Date) =>
  `${formatDate(at, { style: display().dateStyle, width: 'short', year: true })} ${formatClockTime(at)}`;
