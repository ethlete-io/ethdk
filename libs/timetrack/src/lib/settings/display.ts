export type DateStyle = 'day-month' | 'month-day' | 'iso';

export type ClockStyle = '24h' | '12h';

export type TimetrackDisplaySettings = {
  dateStyle: DateStyle;
  clock: ClockStyle;
};

export const DATE_STYLES: readonly DateStyle[] = ['day-month', 'month-day', 'iso'];

export const CLOCK_STYLES: readonly ClockStyle[] = ['24h', '12h'];

export const DEFAULT_DISPLAY_SETTINGS: TimetrackDisplaySettings = { dateStyle: 'day-month', clock: '24h' };

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const pad = (value: number) => String(value).padStart(2, '0');

const isoDate = (at: Date) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

export type FormatDateOptions = {
  style: DateStyle;
  /** `long` writes names out, `short` cuts them to three letters. ISO has no names. */
  width: 'long' | 'short';
  weekday?: boolean;
  year?: boolean;
};

/** A calendar date in the user's chosen style — `Wed, 7 Oct`, `Wed, Oct 7` or `2026-10-07`. Local time. */
export const formatDate = (at: Date, options: FormatDateOptions) => {
  const { style } = options;

  if (style === 'iso') return options.year === false ? isoDate(at).slice(5) : isoDate(at);

  const cut = (name: string) => (options.width === 'short' ? name.slice(0, 3) : name);
  const month = cut(MONTHS[at.getMonth()] ?? '');
  const date = at.getDate();
  const weekday = options.weekday ? `${cut(WEEKDAYS[at.getDay()] ?? '')}, ` : '';

  if (style === 'month-day') return `${weekday}${month} ${date}${options.year ? `, ${at.getFullYear()}` : ''}`;

  return `${weekday}${date} ${month}${options.year ? ` ${at.getFullYear()}` : ''}`;
};

/** A clock time in the user's chosen clock — `21:45` or `9:45 PM`. Local time. */
export const formatClock = (at: Date, options: { clock: ClockStyle; seconds?: boolean }) => {
  const { clock } = options;
  const seconds = options.seconds ? `:${pad(at.getSeconds())}` : '';

  if (clock === '24h') return `${pad(at.getHours())}:${pad(at.getMinutes())}${seconds}`;

  return `${at.getHours() % 12 || 12}:${pad(at.getMinutes())}${seconds} ${at.getHours() < 12 ? 'AM' : 'PM'}`;
};

/** The span between two dates, the way a week header names it — `7 Oct – 13 Oct 2026`. */
export const formatDateRange = (range: { from: Date; to: Date; style: DateStyle }) => {
  const { from, to, style } = range;

  return style === 'iso'
    ? `${isoDate(from)} – ${isoDate(to)}`
    : `${formatDate(from, { style, width: 'short' })} – ${formatDate(to, { style, width: 'short', year: true })}`;
};

/** The date-fns pattern the `@ethlete/components` time controls take as `displayFormat`. */
export const clockDisplayFormat = (clock: ClockStyle) => (clock === '24h' ? 'HH:mm' : 'h:mm a');
