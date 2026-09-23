import {
  createTimeTicks,
  createTimeTickValues,
  createTimeValueFormatter,
  instantFromZonedFields,
  pickTimeInterval,
  zonedFields,
} from './chart-time-scale';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const wallClockOf = (instant: number, timeZone: string) => {
  const f = zonedFields(instant, timeZone);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${f.year}-${pad(f.month + 1)}-${pad(f.day)} ${pad(f.hour)}:${pad(f.minute)}`;
};

const at = (iso: string) => Date.parse(iso);

describe('chart time scale', () => {
  describe('zoned wall clock', () => {
    it('reads the wall clock of the given zone, not the process zone', () => {
      const instant = at('2025-03-30T00:30:00Z');

      expect(wallClockOf(instant, 'Europe/Berlin')).toBe('2025-03-30 01:30');
      expect(wallClockOf(instant, 'America/New_York')).toBe('2025-03-29 20:30');
      expect(wallClockOf(instant, 'Asia/Kathmandu')).toBe('2025-03-30 06:15');
    });

    it('resolves a wall clock to its instant on both sides of a daylight-saving change', () => {
      const fields = { year: 2025, month: 2, day: 30, hour: 0, minute: 0, second: 0 };

      expect(instantFromZonedFields(fields, 'Europe/Berlin')).toBe(at('2025-03-29T23:00:00Z'));
      expect(instantFromZonedFields({ ...fields, day: 31 }, 'Europe/Berlin')).toBe(at('2025-03-30T22:00:00Z'));
    });

    it('moves a wall clock the spring-forward jump skipped to the instant after the jump', () => {
      const skipped = { year: 2025, month: 2, day: 30, hour: 2, minute: 30, second: 0 };

      expect(wallClockOf(instantFromZonedFields(skipped, 'Europe/Berlin'), 'Europe/Berlin')).toBe('2025-03-30 03:30');
    });

    it('rolls over fields past the end of a month or year', () => {
      const fields = { year: 2024, month: 11, day: 32, hour: 0, minute: 0, second: 0 };

      expect(wallClockOf(instantFromZonedFields(fields, 'Europe/Berlin'), 'Europe/Berlin')).toBe('2025-01-01 00:00');
    });
  });

  describe('intervals', () => {
    it('picks the finest interval that keeps within the tick count', () => {
      expect(pickTimeInterval(4 * HOUR, 8)).toEqual({ unit: 'minute', step: 30 });
      expect(pickTimeInterval(4 * HOUR, 4)).toEqual({ unit: 'hour', step: 1 });
      expect(pickTimeInterval(7 * DAY, 8)).toEqual({ unit: 'day', step: 1 });
      expect(pickTimeInterval(28 * DAY, 8)).toEqual({ unit: 'week', step: 1 });
      expect(pickTimeInterval(365 * DAY, 8)).toEqual({ unit: 'month', step: 3 });
      expect(pickTimeInterval(30 * 365 * DAY, 8)).toEqual({ unit: 'year', step: 5 });
    });
  });

  describe('tick values', () => {
    it('keeps daily ticks on local midnight across the spring-forward change', () => {
      const domain = [at('2025-03-28T12:00:00Z'), at('2025-04-01T12:00:00Z')] as const;
      const ticks = createTimeTickValues({ domain, interval: { unit: 'day', step: 1 }, timeZone: 'Europe/Berlin' });

      expect(ticks.map((tick) => wallClockOf(tick, 'Europe/Berlin'))).toEqual([
        '2025-03-29 00:00',
        '2025-03-30 00:00',
        '2025-03-31 00:00',
        '2025-04-01 00:00',
      ]);
      expect((ticks[2] ?? 0) - (ticks[1] ?? 0)).toBe(23 * HOUR);
    });

    it('keeps daily ticks on local midnight across the fall-back change', () => {
      const domain = [at('2025-10-25T00:00:00Z'), at('2025-10-28T00:00:00Z')] as const;
      const ticks = createTimeTickValues({ domain, interval: { unit: 'day', step: 1 }, timeZone: 'America/New_York' });

      expect(ticks.map((tick) => wallClockOf(tick, 'America/New_York'))).toEqual([
        '2025-10-25 00:00',
        '2025-10-26 00:00',
        '2025-10-27 00:00',
      ]);

      const berlin = createTimeTickValues({ domain, interval: { unit: 'day', step: 1 }, timeZone: 'Europe/Berlin' });

      expect((berlin[1] ?? 0) - (berlin[0] ?? 0)).toBe(25 * HOUR);
    });

    it('steps hourly ticks by the clock, so the repeated hour of a fall-back change appears twice', () => {
      const domain = [at('2025-10-26T00:00:00Z'), at('2025-10-26T02:00:00Z')] as const;
      const ticks = createTimeTickValues({ domain, interval: { unit: 'hour', step: 1 }, timeZone: 'Europe/Berlin' });

      expect(ticks.map((tick) => wallClockOf(tick, 'Europe/Berlin'))).toEqual([
        '2025-10-26 02:00',
        '2025-10-26 02:00',
        '2025-10-26 03:00',
      ]);
    });

    it('aligns multi-hour ticks to the wall clock and skips no tick across the spring-forward change', () => {
      const domain = [at('2025-03-29T23:00:00Z'), at('2025-03-30T11:00:00Z')] as const;
      const ticks = createTimeTickValues({ domain, interval: { unit: 'hour', step: 3 }, timeZone: 'Europe/Berlin' });

      expect(ticks.map((tick) => wallClockOf(tick, 'Europe/Berlin'))).toEqual([
        '2025-03-30 00:00',
        '2025-03-30 03:00',
        '2025-03-30 06:00',
        '2025-03-30 09:00',
        '2025-03-30 12:00',
      ]);
    });

    it('starts weekly ticks on Mondays', () => {
      const domain = [at('2025-01-01T00:00:00Z'), at('2025-01-31T00:00:00Z')] as const;
      const ticks = createTimeTickValues({ domain, interval: { unit: 'week', step: 1 }, timeZone: 'UTC' });

      expect(ticks.map((tick) => new Date(tick).getUTCDay())).toEqual([1, 1, 1, 1]);
      expect(wallClockOf(ticks[0] ?? 0, 'UTC')).toBe('2025-01-06 00:00');
    });

    it('puts monthly ticks on the first of each month across a year boundary', () => {
      const domain = [at('2024-10-15T00:00:00Z'), at('2025-03-15T00:00:00Z')] as const;
      const ticks = createTimeTickValues({ domain, interval: { unit: 'month', step: 1 }, timeZone: 'Europe/Berlin' });

      expect(ticks.map((tick) => wallClockOf(tick, 'Europe/Berlin'))).toEqual([
        '2024-11-01 00:00',
        '2024-12-01 00:00',
        '2025-01-01 00:00',
        '2025-02-01 00:00',
        '2025-03-01 00:00',
      ]);
    });

    it('aligns quarterly ticks to January, April, July and October', () => {
      const domain = [at('2024-02-01T00:00:00Z'), at('2025-02-01T00:00:00Z')] as const;
      const ticks = createTimeTickValues({ domain, interval: { unit: 'month', step: 3 }, timeZone: 'UTC' });

      expect(ticks.map((tick) => wallClockOf(tick, 'UTC').slice(0, 7))).toEqual([
        '2024-04',
        '2024-07',
        '2024-10',
        '2025-01',
      ]);
    });

    it('includes a tick that falls exactly on either end of the domain', () => {
      const domain = [at('2025-01-01T00:00:00Z'), at('2025-01-03T00:00:00Z')] as const;

      expect(createTimeTickValues({ domain, interval: { unit: 'day', step: 1 }, timeZone: 'UTC' })).toHaveLength(3);
    });
  });

  describe('tick labels', () => {
    it('names the year on January and the month elsewhere', () => {
      const { ticks } = createTimeTicks({
        domain: [at('2024-10-01T00:00:00Z'), at('2025-03-01T00:00:00Z')],
        count: 6,
        timeZone: 'UTC',
        locale: 'en',
      });

      expect(ticks.map((tick) => tick.text)).toEqual(['Oct', 'Nov', 'Dec', '2025', 'Feb', 'Mar']);
    });

    it('labels days with month and day in the chart locale', () => {
      const domain = [at('2025-03-29T00:00:00Z'), at('2025-03-31T00:00:00Z')] as const;

      expect(createTimeTicks({ domain, count: 3, timeZone: 'UTC', locale: 'en' }).ticks.map((t) => t.text)).toEqual([
        'Mar 29',
        'Mar 30',
        'Mar 31',
      ]);
      expect(createTimeTicks({ domain, count: 3, timeZone: 'UTC', locale: 'de' }).ticks.map((t) => t.text)).toEqual([
        '29. März',
        '30. März',
        '31. März',
      ]);
    });

    it('labels hours as times and names the day at midnight', () => {
      const { ticks } = createTimeTicks({
        domain: [at('2025-03-29T18:00:00Z'), at('2025-03-30T06:00:00Z')],
        count: 4,
        timeZone: 'UTC',
        locale: 'en-GB',
      });

      expect(ticks.map((tick) => tick.text)).toEqual(['18:00', '21:00', '30 Mar', '3:00', '6:00']);
    });
  });

  describe('value formatter', () => {
    it('drops the time when every instant is a midnight of the zone', () => {
      const format = createTimeValueFormatter({
        instants: [at('2025-03-29T23:00:00Z'), at('2025-03-30T22:00:00Z')],
        timeZone: 'Europe/Berlin',
        locale: 'en',
      });

      expect(format(at('2025-03-30T22:00:00Z'))).toBe('Mar 31, 2025');
    });

    it('names only the month when every instant is the first of a month', () => {
      const format = createTimeValueFormatter({
        instants: [at('2025-01-01T00:00:00Z'), at('2025-02-01T00:00:00Z')],
        timeZone: 'UTC',
        locale: 'en',
      });

      expect(format(at('2025-02-01T00:00:00Z'))).toBe('February 2025');
    });

    it('keeps the time when an instant is not a midnight', () => {
      const format = createTimeValueFormatter({
        instants: [at('2025-01-01T00:00:00Z'), at('2025-01-01T13:30:00Z')],
        timeZone: 'UTC',
        locale: 'en-GB',
      });

      expect(format(at('2025-01-01T13:30:00Z'))).toBe('1 Jan 2025, 13:30');
    });
  });
});
