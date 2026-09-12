import { generateMonthGrid } from './calendar-month';

describe('generateMonthGrid', () => {
  it('covers July 2026 with full weeks starting Monday', () => {
    const weeks = generateMonthGrid(new Date(2026, 6, 1), 1);

    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]?.[0]).toEqual(new Date(2026, 5, 29));
    expect(weeks[4]?.[6]).toEqual(new Date(2026, 7, 2));
  });

  it('respects the week start day', () => {
    const weeks = generateMonthGrid(new Date(2026, 6, 1), 0);

    expect(weeks[0]?.[0]).toEqual(new Date(2026, 5, 28));
  });

  it('produces six weeks when the month spills into them', () => {
    const weeks = generateMonthGrid(new Date(2026, 7, 1), 1);

    expect(weeks).toHaveLength(6);
  });

  it('produces four weeks for a February starting on the week start', () => {
    const weeks = generateMonthGrid(new Date(2027, 1, 1), 1);

    expect(weeks).toHaveLength(4);
    expect(weeks[0]?.[0]).toEqual(new Date(2027, 1, 1));
    expect(weeks[3]?.[6]).toEqual(new Date(2027, 1, 28));
  });
});
