import { resolveCalendarKeyboardDate, ResolveCalendarKeyboardDateOptions } from './calendar-keyboard';

const resolve = (key: string, focusedDate: Date, options: Partial<ResolveCalendarKeyboardDateOptions> = {}) =>
  resolveCalendarKeyboardDate(key, { shiftKey: false, focusedDate, weekStartsOn: 1, ...options });

describe('resolveCalendarKeyboardDate at month and year edges', () => {
  it('crosses the year boundary with the arrow keys', () => {
    expect(resolve('ArrowRight', new Date(2026, 11, 31))).toEqual(new Date(2027, 0, 1));
    expect(resolve('ArrowLeft', new Date(2027, 0, 1))).toEqual(new Date(2026, 11, 31));
    expect(resolve('ArrowDown', new Date(2026, 11, 28))).toEqual(new Date(2027, 0, 4));
    expect(resolve('ArrowUp', new Date(2027, 0, 3))).toEqual(new Date(2026, 11, 27));
  });

  it('clamps PageUp/PageDown to the last day of a shorter month', () => {
    expect(resolve('PageDown', new Date(2026, 0, 31))).toEqual(new Date(2026, 1, 28));
    expect(resolve('PageDown', new Date(2024, 0, 31))).toEqual(new Date(2024, 1, 29));
    expect(resolve('PageUp', new Date(2026, 2, 31))).toEqual(new Date(2026, 1, 28));
  });

  it('moves a leap day to Feb 28 with Shift+PageUp/PageDown', () => {
    expect(resolve('PageDown', new Date(2024, 1, 29), { shiftKey: true })).toEqual(new Date(2025, 1, 28));
    expect(resolve('PageUp', new Date(2024, 1, 29), { shiftKey: true })).toEqual(new Date(2023, 1, 28));
  });

  it('keeps local midnight when a week step crosses a daylight-saving change', () => {
    expect(resolve('ArrowDown', new Date(2026, 2, 25))).toEqual(new Date(2026, 3, 1));
    expect(resolve('ArrowUp', new Date(2026, 9, 29))).toEqual(new Date(2026, 9, 22));
    expect(resolve('ArrowRight', new Date(2026, 2, 28))).toEqual(new Date(2026, 2, 29));
    expect(resolve('ArrowRight', new Date(2026, 2, 29))).toEqual(new Date(2026, 2, 30));
  });

  it('finds the week bounds across a year boundary', () => {
    expect(resolve('Home', new Date(2027, 0, 1))).toEqual(new Date(2026, 11, 28));
    expect(resolve('End', new Date(2026, 11, 30))).toEqual(new Date(2027, 0, 3));
  });

  it('clamps the day when the year grid moves a month-end across months', () => {
    expect(resolve('ArrowRight', new Date(2026, 0, 31), { view: 'year' })).toEqual(new Date(2026, 1, 28));
    expect(resolve('ArrowDown', new Date(2026, 9, 31), { view: 'year' })).toEqual(new Date(2027, 1, 28));
    expect(resolve('End', new Date(2026, 1, 28), { view: 'year' })).toEqual(new Date(2026, 11, 28));
  });

  it('keeps a leap day in February when the year grid jumps to another year', () => {
    expect(resolve('PageDown', new Date(2024, 1, 29), { view: 'year' })).toEqual(new Date(2025, 1, 28));
  });

  it('keeps a leap day in February when Home/End jump across the multi-year page', () => {
    const multiYearPageStart = new Date(2016, 0, 1);

    expect(resolve('Home', new Date(2024, 1, 29), { view: 'multiYear', multiYearPageStart })).toEqual(
      new Date(2016, 1, 29),
    );
    expect(resolve('End', new Date(2024, 1, 29), { view: 'multiYear', multiYearPageStart })).toEqual(
      new Date(2039, 1, 28),
    );
  });

  it('keeps a leap day in February when the multi-year arrows step a year', () => {
    expect(resolve('ArrowRight', new Date(2024, 1, 29), { view: 'multiYear' })).toEqual(new Date(2025, 1, 28));
  });
});
