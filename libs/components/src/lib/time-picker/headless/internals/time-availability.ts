import { setHours, setMinutes, setSeconds } from 'date-fns';

/** A fully specified time of day in 24-hour terms. */
export type TimeCandidate = {
  /** `0–23`, regardless of the picker's hour cycle. */
  hour: number;
  minute: number;
  second: number;
};

/** A candidate with the finer units left open - `null`/absent means "any value in the column". */
export type PartialTimeCandidate = {
  hour: number;
  minute?: number | null;
  second?: number | null;
};

export type TimeBoundsOptions = {
  /** Earliest selectable time of day, or `null`. Only the time of day is read. */
  min: Date | null;
  /** Latest selectable time of day, or `null`. Only the time of day is read. */
  max: Date | null;
  /** Receives the full candidate timestamp, so it can depend on the day (opening hours per weekday). */
  filter: ((date: Date) => boolean) | null;
  /** The day candidates are built on - what `filter` sees. */
  day: Date;
};

export type TimeAvailabilityOptions = TimeBoundsOptions & {
  /** The minute column's values - the search space for an open minute. */
  minuteValues: readonly number[];
  /** The second column's values, or the committed second while the picker shows no seconds. */
  secondValues: readonly number[];
};

/** Seconds since midnight of a `Date`'s time of day. */
export const secondsOfDay = (date: Date) => date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();

/** Puts a candidate's time of day onto `day`, leaving its milliseconds alone. */
export const setTimeOfDay = (day: Date, candidate: TimeCandidate) =>
  setSeconds(setMinutes(setHours(day, candidate.hour), candidate.minute), candidate.second);

/** Whether a fully specified time of day passes the bounds and the filter. */
export const isTimeSelectable = (candidate: TimeCandidate, options: TimeBoundsOptions) => {
  const { min, max, filter, day } = options;
  const candidateSeconds = candidate.hour * 3600 + candidate.minute * 60 + candidate.second;

  if (min !== null && candidateSeconds < secondsOfDay(min)) {
    return false;
  }

  if (max !== null && candidateSeconds > secondsOfDay(max)) {
    return false;
  }

  return filter === null || filter(setTimeOfDay(day, candidate));
};

/**
 * The first selectable time matching the fixed parts, scanning the open columns in
 * their display order - or `null` when the fixed parts admit no selectable time.
 */
export const findSelectableTime = (
  fixed: PartialTimeCandidate,
  options: TimeAvailabilityOptions,
): TimeCandidate | null => {
  const minutes = fixed.minute ?? null;
  const seconds = fixed.second ?? null;
  const minuteValues = minutes === null ? options.minuteValues : [minutes];
  const secondValues = seconds === null ? options.secondValues : [seconds];

  for (const minute of minuteValues) {
    for (const second of secondValues) {
      const candidate = { hour: fixed.hour, minute, second };

      if (isTimeSelectable(candidate, options)) {
        return candidate;
      }
    }
  }

  return null;
};

/**
 * Whether the fixed parts admit any selectable time - how a column decides an
 * option is disabled: an hour is out when no minute inside it works, a minute
 * when no second inside it does.
 */
export const hasSelectableTime = (fixed: PartialTimeCandidate, options: TimeAvailabilityOptions) =>
  findSelectableTime(fixed, options) !== null;
