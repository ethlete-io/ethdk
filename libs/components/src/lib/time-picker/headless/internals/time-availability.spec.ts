import { TimeBoundsOptions, isTimeSelectable, secondsOfDay, setTimeOfDay } from './time-availability';

const DAY = new Date(2026, 6, 17);

const options = (overrides: Partial<TimeBoundsOptions> = {}): TimeBoundsOptions => ({
  min: null,
  max: null,
  filter: null,
  day: DAY,
  ...overrides,
});

describe('time-availability', () => {
  describe('secondsOfDay', () => {
    it('counts the time of day in seconds', () => {
      expect(secondsOfDay(new Date(2026, 6, 17, 0, 0, 0))).toBe(0);
      expect(secondsOfDay(new Date(2026, 6, 17, 9, 30, 15))).toBe(9 * 3600 + 30 * 60 + 15);
    });
  });

  describe('setTimeOfDay', () => {
    it('puts a candidate onto the day, keeping its milliseconds', () => {
      const day = new Date(2026, 6, 17, 3, 4, 5, 123);
      const result = setTimeOfDay(day, { hour: 18, minute: 45, second: 30 });

      expect([result.getFullYear(), result.getMonth(), result.getDate()]).toEqual([2026, 6, 17]);
      expect([result.getHours(), result.getMinutes(), result.getSeconds()]).toEqual([18, 45, 30]);
      expect(result.getMilliseconds()).toBe(123);
    });
  });

  describe('isTimeSelectable', () => {
    it('accepts everything without bounds or a filter', () => {
      expect(isTimeSelectable({ hour: 3, minute: 0, second: 0 }, options())).toBe(true);
    });

    it('reads only the time of day of the bounds', () => {
      const bounded = options({ min: new Date(2020, 0, 1, 9), max: new Date(2031, 0, 1, 17, 30) });

      expect(isTimeSelectable({ hour: 8, minute: 59, second: 59 }, bounded)).toBe(false);
      expect(isTimeSelectable({ hour: 9, minute: 0, second: 0 }, bounded)).toBe(true);
      expect(isTimeSelectable({ hour: 17, minute: 30, second: 0 }, bounded)).toBe(true);
      expect(isTimeSelectable({ hour: 17, minute: 30, second: 1 }, bounded)).toBe(false);
    });

    it('passes the full candidate timestamp to the filter', () => {
      const seen: Date[] = [];
      const filtered = options({
        filter: (date: Date) => {
          seen.push(date);

          return date.getHours() !== 13;
        },
      });

      expect(isTimeSelectable({ hour: 13, minute: 0, second: 0 }, filtered)).toBe(false);
      expect(isTimeSelectable({ hour: 14, minute: 0, second: 0 }, filtered)).toBe(true);
      expect(seen.map((date) => date.getDate())).toEqual([17, 17]);
    });
  });
});
