import { setHours, setMinutes, setSeconds, startOfDay } from 'date-fns';

/** The day of `day` carrying the time of day of `time` - how the date-time controls merge a pick. */
export const withTimeOfDay = (day: Date, time: Date) =>
  setSeconds(setMinutes(setHours(startOfDay(day), time.getHours()), time.getMinutes()), time.getSeconds());
