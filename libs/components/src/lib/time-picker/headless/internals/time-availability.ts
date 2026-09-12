import { setHours, setMinutes, setSeconds } from 'date-fns';

export type TimeCandidate = {
  /** `0–23`, regardless of the picker's hour cycle. */
  hour: number;
  minute: number;
  second: number;
};

export type PartialTimeCandidate = {
  hour: number;
  minute?: number | null;
  second?: number | null;
};

export type TimeBoundsOptions = {
  min: Date | null;
  max: Date | null;
  filter: ((date: Date) => boolean) | null;
  day: Date;
};

export type TimeAvailabilityOptions = TimeBoundsOptions & {
  minuteValues: readonly number[];
  secondValues: readonly number[];
};

export const secondsOfDay = (date: Date) => date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();

export const setTimeOfDay = (day: Date, candidate: TimeCandidate) =>
  setSeconds(setMinutes(setHours(day, candidate.hour), candidate.minute), candidate.second);

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

export const hasSelectableTime = (fixed: PartialTimeCandidate, options: TimeAvailabilityOptions) =>
  findSelectableTime(fixed, options) !== null;
