export type ChartTimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export type ChartTimeInterval = {
  unit: ChartTimeUnit;
  step: number;
};

export type ChartTimeTick = {
  value: number;
  text: string;
};

export type ChartTimeTicks = {
  interval: ChartTimeInterval;
  ticks: ChartTimeTick[];
};

export type ChartTimeTicksOptions = {
  domain: readonly [number, number];
  count: number;
  timeZone: string;
  locale: string;
};

export type ChartZonedFields = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const SECOND = 1000;

const UNIT_DURATION: Record<ChartTimeUnit, number> = {
  second: SECOND,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000,
  year: 31_536_000_000,
};

const INTERVALS: readonly ChartTimeInterval[] = [
  { unit: 'second', step: 1 },
  { unit: 'second', step: 5 },
  { unit: 'second', step: 15 },
  { unit: 'second', step: 30 },
  { unit: 'minute', step: 1 },
  { unit: 'minute', step: 5 },
  { unit: 'minute', step: 15 },
  { unit: 'minute', step: 30 },
  { unit: 'hour', step: 1 },
  { unit: 'hour', step: 3 },
  { unit: 'hour', step: 6 },
  { unit: 'hour', step: 12 },
  { unit: 'day', step: 1 },
  { unit: 'day', step: 2 },
  { unit: 'week', step: 1 },
  { unit: 'month', step: 1 },
  { unit: 'month', step: 3 },
  { unit: 'month', step: 6 },
];

const MAX_TICKS = 1000;

const fieldFormats = /* @__PURE__ */ new Map<string, Intl.DateTimeFormat>();

const fieldFormat = (timeZone: string) => {
  let format = fieldFormats.get(timeZone);

  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    fieldFormats.set(timeZone, format);
  }

  return format;
};

/** `month` is zero-based. */
export const zonedFields = (instant: number, timeZone: string): ChartZonedFields => {
  const parts: Record<string, number> = {};

  for (const part of fieldFormat(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }

  return {
    year: parts['year'] ?? 1970,
    month: (parts['month'] ?? 1) - 1,
    day: parts['day'] ?? 1,
    hour: (parts['hour'] ?? 0) % 24,
    minute: parts['minute'] ?? 0,
    second: parts['second'] ?? 0,
  };
};

const wallClock = (fields: ChartZonedFields) =>
  Date.UTC(fields.year, fields.month, fields.day, fields.hour, fields.minute, fields.second);

const zoneOffset = (instant: number, timeZone: string) => {
  const whole = instant - (((instant % SECOND) + SECOND) % SECOND);

  return wallClock(zonedFields(whole, timeZone)) - whole;
};

/** Fields out of range roll over. A wall clock a daylight-saving jump skipped resolves to the instant after the jump. */
export const instantFromZonedFields = (fields: ChartZonedFields, timeZone: string) => {
  const guess = wallClock(fields);
  const firstOffset = zoneOffset(guess, timeZone);
  const instant = guess - firstOffset;
  const secondOffset = zoneOffset(instant, timeZone);

  return secondOffset === firstOffset ? instant : guess - secondOffset;
};

const weekdayOf = (fields: ChartZonedFields) => new Date(Date.UTC(fields.year, fields.month, fields.day)).getUTCDay();

const floorFields = (fields: ChartZonedFields, interval: ChartTimeInterval): ChartZonedFields => {
  const { step } = interval;
  const floorTo = (value: number) => Math.floor(value / step) * step;

  switch (interval.unit) {
    case 'second':
      return { ...fields, second: floorTo(fields.second) };
    case 'minute':
      return { ...fields, minute: floorTo(fields.minute), second: 0 };
    case 'hour':
      return { ...fields, hour: floorTo(fields.hour), minute: 0, second: 0 };
    case 'day':
      return { ...fields, hour: 0, minute: 0, second: 0 };
    case 'week':
      return { ...fields, day: fields.day - ((weekdayOf(fields) + 6) % 7), hour: 0, minute: 0, second: 0 };
    case 'month':
      return { ...fields, month: floorTo(fields.month), day: 1, hour: 0, minute: 0, second: 0 };
    case 'year':
      return { year: floorTo(fields.year), month: 0, day: 1, hour: 0, minute: 0, second: 0 };
  }
};

const isFixedDuration = (interval: ChartTimeInterval) =>
  interval.unit === 'second' || interval.unit === 'minute' || (interval.unit === 'hour' && interval.step === 1);

const advanceFields = (fields: ChartZonedFields, interval: ChartTimeInterval & { times: number }): ChartZonedFields => {
  const amount = interval.step * interval.times;

  switch (interval.unit) {
    case 'hour':
      return { ...fields, hour: fields.hour + amount };
    case 'day':
      return { ...fields, day: fields.day + amount };
    case 'week':
      return { ...fields, day: fields.day + amount * 7 };
    case 'month':
      return { ...fields, month: fields.month + amount };
    default:
      return { ...fields, year: fields.year + amount };
  }
};

const niceYearStep = (years: number, count: number) => {
  const raw = Math.max(1, years / Math.max(1, count));
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const error = raw / magnitude;

  if (error > 5) return magnitude * 10;
  if (error > 2) return magnitude * 5;
  if (error > 1) return magnitude * 2;

  return magnitude;
};

export const pickTimeInterval = (span: number, count: number): ChartTimeInterval => {
  const target = Math.max(1, count);
  const interval = INTERVALS.find((entry) => span / (UNIT_DURATION[entry.unit] * entry.step) <= target);

  return interval ?? { unit: 'year', step: niceYearStep(span / UNIT_DURATION.year, target) };
};

export const createTimeTickValues = (options: {
  domain: readonly [number, number];
  interval: ChartTimeInterval;
  timeZone: string;
}): number[] => {
  const { domain, interval, timeZone } = options;
  const [start, end] = domain;
  const values: number[] = [];

  if (isFixedDuration(interval)) {
    const duration = UNIT_DURATION[interval.unit] * interval.step;
    const wall = start + zoneOffset(start, timeZone);
    let value = start - (((wall % duration) + duration) % duration);

    for (let i = 0; value <= end && i < MAX_TICKS; i++, value += duration) {
      if (value >= start) values.push(value);
    }

    return values;
  }

  const origin = floorFields(zonedFields(start, timeZone), interval);

  for (let i = 0; i < MAX_TICKS; i++) {
    const value = instantFromZonedFields(advanceFields(origin, { ...interval, times: i }), timeZone);

    if (value > end) break;
    if (value >= start && value > (values.at(-1) ?? -Infinity)) values.push(value);
  }

  return values;
};

const labelFormats = /* @__PURE__ */ new Map<string, Intl.DateTimeFormat>();

type LabelFormatOptions = { locale: string; timeZone: string; options: Intl.DateTimeFormatOptions };

const labelFormat = ({ locale, timeZone, options }: LabelFormatOptions) => {
  const key = `${locale}|${timeZone}|${JSON.stringify(options)}`;
  let format = labelFormats.get(key);

  if (!format) {
    format = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    labelFormats.set(key, format);
  }

  return format;
};

const YEAR: Intl.DateTimeFormatOptions = { year: 'numeric' };
const MONTH: Intl.DateTimeFormatOptions = { month: 'short' };
const MONTH_DAY: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
const TIME_SECONDS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', second: '2-digit' };

const tickLabelOptions = (interval: ChartTimeInterval, fields: ChartZonedFields): Intl.DateTimeFormatOptions => {
  switch (interval.unit) {
    case 'year':
      return YEAR;
    case 'month':
      return fields.month === 0 ? YEAR : MONTH;
    case 'day':
    case 'week':
      return MONTH_DAY;
    case 'second':
      return TIME_SECONDS;
    default:
      return fields.hour === 0 && fields.minute === 0 ? MONTH_DAY : TIME;
  }
};

export const createTimeTicks = (options: ChartTimeTicksOptions): ChartTimeTicks => {
  const { domain, count, timeZone, locale } = options;
  const interval = pickTimeInterval(domain[1] - domain[0], count);
  const ticks = createTimeTickValues({ domain, interval, timeZone }).map((value) => ({
    value,
    text: labelFormat({ locale, timeZone, options: tickLabelOptions(interval, zonedFields(value, timeZone)) }).format(
      value,
    ),
  }));

  return { interval, ticks };
};

export const createTimeValueFormatter = (options: {
  instants: readonly number[];
  timeZone: string;
  locale: string;
}): ((instant: number) => string) => {
  const { instants, timeZone, locale } = options;
  const fields = instants.map((instant) => zonedFields(instant, timeZone));
  const atMidnight = fields.every((entry) => entry.hour === 0 && entry.minute === 0 && entry.second === 0);
  const atMonthStart = atMidnight && fields.every((entry) => entry.day === 1);

  const format = labelFormat({
    locale,
    timeZone,
    options: atMonthStart
      ? { month: 'long', year: 'numeric' }
      : atMidnight
        ? { dateStyle: 'medium' }
        : { dateStyle: 'medium', timeStyle: 'short' },
  });

  return (instant) => format.format(instant);
};

export const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
