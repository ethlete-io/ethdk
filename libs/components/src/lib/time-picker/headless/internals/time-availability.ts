import { endOfDay, setHours, setMinutes, setSeconds, startOfDay, subWeeks } from 'date-fns';

export type TimeCandidate = {
  /** `0–23`, regardless of the picker's hour cycle. */
  hour: number;
  minute: number;
  second: number;
};

export type TimeBoundsOptions = {
  min: Date | null;
  max: Date | null;
  filter: ((date: Date) => boolean) | null;
  day: Date;
};

export const secondsOfDay = (date: Date) => date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();

/**
 * The start of `date`'s day, or of the same weekday a week earlier when the runtime's clocks change on it,
 * so every wall-clock time exists on the returned day.
 */
export const clockSafeDay = (date: Date) => {
  const day = startOfDay(date);

  return day.getTimezoneOffset() === endOfDay(day).getTimezoneOffset() ? day : subWeeks(day, 1);
};

export const setTimeOfDay = (day: Date, candidate: TimeCandidate) =>
  setSeconds(setMinutes(setHours(day, candidate.hour), candidate.minute), candidate.second);

export const isTimeSelectable = (candidate: TimeCandidate, options: TimeBoundsOptions) => {
  const { min, max, filter, day } = options;
  const candidateSeconds = candidate.hour * 3600 + candidate.minute * 60 + candidate.second;

  const afterMin = min === null || candidateSeconds >= secondsOfDay(min);
  const beforeMax = max === null || candidateSeconds <= secondsOfDay(max);
  const wrapsMidnight = min !== null && max !== null && secondsOfDay(min) > secondsOfDay(max);
  const inBounds = wrapsMidnight ? afterMin || beforeMax : afterMin && beforeMax;

  if (!inBounds) {
    return false;
  }

  return filter === null || filter(setTimeOfDay(day, candidate));
};
