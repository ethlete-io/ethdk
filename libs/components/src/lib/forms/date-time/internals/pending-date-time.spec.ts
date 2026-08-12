import { de } from 'date-fns/locale/de';
import { splitDateTimeFormat } from './date-time-format-split';
import { createPendingDateTime, renderPartialDateTime } from './pending-date-time';

const day = new Date(2026, 7, 13);
const time = new Date(2026, 0, 1, 15, 40);

describe('splitDateTimeFormat', () => {
  it('expands the locale date-time format before splitting it', () => {
    expect(splitDateTimeFormat('Pp', null)).toEqual({ datePrefix: 'MM/dd/yyyy, ', time: 'h:mm a', dateSuffix: '' });
  });

  it('follows the locale', () => {
    expect(splitDateTimeFormat('Pp', de)).toEqual({ datePrefix: 'dd.MM.y ', time: 'HH:mm', dateSuffix: '' });
  });

  it('splits an explicit format, keeping the separator on the date side', () => {
    expect(splitDateTimeFormat('MM/dd/yyyy, HH:mm', null)).toEqual({
      datePrefix: 'MM/dd/yyyy, ',
      time: 'HH:mm',
      dateSuffix: '',
    });
  });

  it('keeps date tokens that follow the time half', () => {
    expect(splitDateTimeFormat("HH:mm 'on' dd.MM.yyyy", null)).toEqual({
      datePrefix: '',
      time: 'HH:mm',
      dateSuffix: " 'on' dd.MM.yyyy",
    });
  });

  it('refuses a format with only one of the two halves', () => {
    expect(splitDateTimeFormat('P', null)).toBeNull();
    expect(splitDateTimeFormat('HH:mm', null)).toBeNull();
  });

  it('refuses interleaved halves - there is no single span to blank', () => {
    expect(splitDateTimeFormat('HH:mm dd.MM.yyyy ss', null)).toBeNull();
  });

  it('refuses a whole-timestamp token', () => {
    expect(splitDateTimeFormat('t', null)).toBeNull();
  });
});

describe('renderPartialDateTime', () => {
  const render = (parts: { day: Date | null; time: Date | null }, format = 'Pp') =>
    renderPartialDateTime({ ...parts, format, locale: null });

  it('blanks the time half of a day-only pick', () => {
    expect(render({ day, time: null })).toBe('08/13/2026, __:__ __');
  });

  it('blanks the date half of a time-only pick', () => {
    expect(render({ day: null, time })).toBe('__/__/____, 3:40 PM');
  });

  it('blanks around an explicit 24-hour format', () => {
    expect(render({ day, time: null }, 'dd.MM.yyyy HH:mm')).toBe('13.08.2026 __:__');
  });

  it('has nothing to render without a half', () => {
    expect(render({ day: null, time: null })).toBeNull();
  });

  it('has nothing to render for a format it cannot split', () => {
    expect(render({ day, time: null }, 'P')).toBeNull();
  });
});

describe('createPendingDateTime', () => {
  it('completes a held time with the day that arrives after it', () => {
    const pending = createPendingDateTime();

    expect(pending.holdTime(time)).toBeNull();
    expect(pending.holdDay(day)).toEqual(new Date(2026, 7, 13, 15, 40));
    expect(pending.active()).toBe(false);
  });

  it('drops a held day on its own, leaving a held time standing', () => {
    const pending = createPendingDateTime();

    pending.holdDay(day);
    pending.clearDay();

    expect(pending.day()).toBeNull();

    pending.holdTime(time);
    pending.clearDay();

    expect(pending.time()).toEqual(time);
    expect(pending.active()).toBe(true);
  });
});
