import { SchedulerBusinessHours } from '../../scheduler.types';
import { buildSchedulerNonBusinessTime } from './scheduler-business-hours';

const build = (days: readonly Date[], hours: readonly SchedulerBusinessHours[], reportError = () => undefined) =>
  buildSchedulerNonBusinessTime({ days, businessHours: hours, reportError });

const wednesday = new Date(2026, 6, 15);
const saturday = new Date(2026, 6, 18);

const WEEKDAYS_9_TO_17: SchedulerBusinessHours[] = [{ daysOfWeek: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }];

const percentOf = (hours: number) => (hours / 24) * 100;

describe('buildSchedulerNonBusinessTime', () => {
  it('closes the stretches before and after the open hours', () => {
    const [segments] = build([wednesday], WEEKDAYS_9_TO_17);

    expect(segments).toEqual([
      { offset: 0, span: percentOf(9) },
      { offset: percentOf(17), span: percentOf(7) },
    ]);
  });

  it('closes a weekday no entry lists for the whole day', () => {
    const [segments] = build([saturday], WEEKDAYS_9_TO_17);

    expect(segments).toEqual([{ offset: 0, span: 100 }]);
  });

  it('keeps the gap between two ranges on the same day closed', () => {
    const [segments] = build(
      [wednesday],
      [
        { daysOfWeek: [3], start: '13:00', end: '17:30' },
        { daysOfWeek: [3], start: '08:00', end: '12:00' },
      ],
    );

    expect(segments).toEqual([
      { offset: 0, span: percentOf(8) },
      { offset: percentOf(12), span: percentOf(1) },
      { offset: percentOf(17.5), span: percentOf(6.5) },
    ]);
  });

  it('merges overlapping ranges', () => {
    const [segments] = build(
      [wednesday],
      [
        { daysOfWeek: [3], start: '08:00', end: '14:00' },
        { daysOfWeek: [3], start: '12:00', end: '18:00' },
      ],
    );

    expect(segments).toEqual([
      { offset: 0, span: percentOf(8) },
      { offset: percentOf(18), span: percentOf(6) },
    ]);
  });

  it('leaves nothing closed after a range that runs to 24:00', () => {
    const [segments] = build([wednesday], [{ daysOfWeek: [3], start: '00:00', end: '24:00' }]);

    expect(segments).toEqual([]);
  });

  it('returns one list per day', () => {
    expect(build([wednesday, saturday], WEEKDAYS_9_TO_17)).toHaveLength(2);
  });

  it.each([
    ['9am', '17:00'],
    ['09:00', '25:00'],
    ['17:00', '09:00'],
    ['09:00', '09:00'],
  ])('reports the range %s-%s and shades nothing', (start, end) => {
    const reportError = vi.fn();

    expect(build([wednesday], [...WEEKDAYS_9_TO_17, { daysOfWeek: [3], start, end }], reportError)).toEqual([[]]);
    expect(String(reportError.mock.calls[0]?.[0])).toContain('ET4506');
  });
});
