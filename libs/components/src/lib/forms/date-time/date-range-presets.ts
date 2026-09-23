import {
  addDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  Locale,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { DateTimeLabels } from './date-time-labels';

/** What a preset's `resolve` receives besides `now`. */
export type DateRangePresetContext = {
  /** The control's date-fns locale in effect - it decides where a week starts. */
  locale: Locale | null;
};

/** The range a preset stands for, as local wall-clock dates. */
export type DateRangePresetRange = {
  start: Date;
  end: Date;
};

/**
 * One entry of a range input's `presets` list. `resolve` is called with the current wall-clock time
 * (in the control's `timeZone`, where it has one) whenever the list renders or a preset is picked.
 */
export type DateRangePreset = {
  /** The button text, or a function reading it from the `DATE_TIME_LABELS` in effect. */
  label: string | ((labels: DateTimeLabels) => string);
  resolve: (now: Date, context: DateRangePresetContext) => DateRangePresetRange;
};

/** One rendered preset: its resolved label and whether the current value is exactly its range. */
export type DateRangePresetOption = {
  preset: DateRangePreset;
  label: string;
  active: boolean;
};

/** Options every preset factory takes. */
export type DateRangePresetOptions = {
  /** Replaces the label the factory reads from `DATE_TIME_LABELS`. */
  label?: string;
};

const endOfDayMinute = (date: Date) => {
  const end = startOfDay(date);

  end.setHours(23, 59);

  return end;
};

const dayRange = (start: Date, end: Date): DateRangePresetRange => ({
  start: startOfDay(start),
  end: endOfDayMinute(end),
});

const weekOptions = ({ locale }: DateRangePresetContext) => (locale ? { locale } : undefined);

type CreatePresetConfig = {
  defaultLabel: (labels: DateTimeLabels) => string;
  resolve: DateRangePreset['resolve'];
  options: DateRangePresetOptions;
};

const createPreset = ({ defaultLabel, resolve, options }: CreatePresetConfig): DateRangePreset => ({
  label: options.label ?? defaultLabel,
  resolve,
});

/** Today alone. Every factory's range starts at 00:00 and ends at 23:59. */
export const todayPreset = (options: DateRangePresetOptions = {}) =>
  createPreset({ defaultLabel: (labels) => labels.presetToday, resolve: (now) => dayRange(now, now), options });

/** Yesterday alone. */
export const yesterdayPreset = (options: DateRangePresetOptions = {}) =>
  createPreset({
    defaultLabel: (labels) => labels.presetYesterday,
    resolve: (now) => dayRange(subDays(now, 1), subDays(now, 1)),
    options,
  });

/** The last `count` days, today included - `lastDaysPreset(7)` is today and the six days before it. */
export const lastDaysPreset = (count: number, options: DateRangePresetOptions = {}) =>
  createPreset({
    defaultLabel: (labels) => labels.presetLastDays(count),
    resolve: (now) => dayRange(subDays(now, Math.max(1, count) - 1), now),
    options,
  });

/** The next `count` days, tomorrow onwards - `nextDaysPreset(7)` is the coming week. */
export const nextDaysPreset = (count: number, options: DateRangePresetOptions = {}) =>
  createPreset({
    defaultLabel: (labels) => labels.presetNextDays(count),
    resolve: (now) => dayRange(addDays(now, 1), addDays(now, Math.max(1, count))),
    options,
  });

/** The current week, starting on the locale's first day of the week. */
export const thisWeekPreset = (options: DateRangePresetOptions = {}) =>
  createPreset({
    defaultLabel: (labels) => labels.presetThisWeek,
    resolve: (now, context) => dayRange(startOfWeek(now, weekOptions(context)), endOfWeek(now, weekOptions(context))),
    options,
  });

/** The week before the current one. */
export const lastWeekPreset = (options: DateRangePresetOptions = {}) =>
  createPreset({
    defaultLabel: (labels) => labels.presetLastWeek,
    resolve: (now, context) => {
      const lastWeek = subWeeks(now, 1);

      return dayRange(startOfWeek(lastWeek, weekOptions(context)), endOfWeek(lastWeek, weekOptions(context)));
    },
    options,
  });

/** The current calendar month. */
export const thisMonthPreset = (options: DateRangePresetOptions = {}) =>
  createPreset({
    defaultLabel: (labels) => labels.presetThisMonth,
    resolve: (now) => dayRange(startOfMonth(now), endOfMonth(now)),
    options,
  });

/** The calendar month before the current one. */
export const lastMonthPreset = (options: DateRangePresetOptions = {}) =>
  createPreset({
    defaultLabel: (labels) => labels.presetLastMonth,
    resolve: (now) => dayRange(startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1))),
    options,
  });

/** The current calendar year. */
export const thisYearPreset = (options: DateRangePresetOptions = {}) =>
  createPreset({
    defaultLabel: (labels) => labels.presetThisYear,
    resolve: (now) => dayRange(startOfYear(now), endOfYear(now)),
    options,
  });
