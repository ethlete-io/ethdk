import { resolveCalendarKeyboardDate } from './calendar-keyboard';
import { CalendarWeekStartsOn } from './calendar-month';

const FOCUSED = new Date(2026, 6, 16); // Thursday

const resolve = (key: string, shiftKey = false, weekStartsOn: CalendarWeekStartsOn = 1) =>
  resolveCalendarKeyboardDate(key, { shiftKey, focusedDate: FOCUSED, weekStartsOn });

describe('resolveCalendarKeyboardDate', () => {
  it('moves by single days horizontally', () => {
    expect(resolve('ArrowLeft')).toEqual(new Date(2026, 6, 15));
    expect(resolve('ArrowRight')).toEqual(new Date(2026, 6, 17));
  });

  it('moves by weeks vertically', () => {
    expect(resolve('ArrowUp')).toEqual(new Date(2026, 6, 9));
    expect(resolve('ArrowDown')).toEqual(new Date(2026, 6, 23));
  });

  it('moves by months with PageUp/PageDown', () => {
    expect(resolve('PageUp')).toEqual(new Date(2026, 5, 16));
    expect(resolve('PageDown')).toEqual(new Date(2026, 7, 16));
  });

  it('moves by years with Shift+PageUp/PageDown', () => {
    expect(resolve('PageUp', true)).toEqual(new Date(2025, 6, 16));
    expect(resolve('PageDown', true)).toEqual(new Date(2027, 6, 16));
  });

  it('jumps to the week bounds with Home/End honoring the week start', () => {
    expect(resolve('Home')).toEqual(new Date(2026, 6, 13));
    expect(resolve('End')).toEqual(new Date(2026, 6, 19));
    expect(resolve('Home', false, 0)).toEqual(new Date(2026, 6, 12));
    expect(resolve('End', false, 0)).toEqual(new Date(2026, 6, 18));
  });

  it('ignores keys outside the grid model', () => {
    expect(resolve('Enter')).toBeNull();
    expect(resolve('a')).toBeNull();
  });
});
