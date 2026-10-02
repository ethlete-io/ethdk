import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import '../../../test-helpers';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { provideDateFormat, provideDateLocale, provideDateTimeFormat, provideTimeFormat } from './date-time-formats';
import { provideDateTimeLabels } from './date-time-labels';
import {
  dateBounds,
  dateRangeBounds,
  dateRangeOrder,
  dateTimeBounds,
  dateTimeRangeBounds,
  dateTimeRangeOrder,
  RangeOrderOptions,
  timeRangeOrder,
} from './date-time-range-validators';
import { DateRangeValue } from './internals/date-range-picker-input.directive';

type RangePath = Parameters<typeof dateRangeOrder>[0];

const errorsFor = (value: DateRangeValue, apply: (path: RangePath) => void) => {
  const injector = TestBed.inject(Injector);
  const model = signal({ range: value });
  const rangeForm = form(model, (s) => apply(s.range), { injector });

  return rangeForm
    .range()
    .errors()
    .map(({ kind, message }) => ({ kind, message }));
};

const range = (start: string | null, end: string | null): DateRangeValue => ({ start, end });

describe('dateRangeOrder', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  const orderErrors = (value: DateRangeValue, options?: RangeOrderOptions) =>
    errorsFor(value, (path) => dateRangeOrder(path, { valueFormat: 'yyyy-MM-dd', ...options }));

  it('fails a range whose start lies after its end', () => {
    expect(orderErrors(range('2026-03-10', '2026-03-01'))).toEqual([
      { kind: 'rangeOrder', message: 'The start must be before the end' },
    ]);
  });

  it('passes an ordered range and, unless strict, an equal one', () => {
    expect(orderErrors(range('2026-03-01', '2026-03-10'))).toEqual([]);
    expect(orderErrors(range('2026-03-01', '2026-03-01'))).toEqual([]);
    expect(orderErrors(range('2026-03-01', '2026-03-01'), { strict: true })).toHaveLength(1);
  });

  it.each([
    [null, '2026-03-01'],
    ['2026-03-10', null],
    ['nope', '2026-03-01'],
  ])('passes while an end is empty or unparseable (%s – %s)', (start, end) => {
    expect(orderErrors(range(start, end))).toEqual([]);
  });

  it('reads date-only wire values by default', () => {
    expect(errorsFor(range('2026-03-10', '2026-03-01'), (path) => dateRangeOrder(path))).toHaveLength(1);
    expect(errorsFor(range('2026-03-01', '2026-03-10'), (path) => dateRangeOrder(path))).toEqual([]);
  });

  it('reads the DATE_FORMAT token when no valueFormat is given', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideDateFormat('dd.MM.yyyy')] });

    expect(errorsFor(range('02.01.2026', '10.01.2025'), (path) => dateRangeOrder(path))).toHaveLength(1);
    expect(errorsFor(range('10.01.2025', '02.01.2026'), (path) => dateRangeOrder(path))).toEqual([]);
  });

  it('reads its message from DATE_TIME_LABELS', () => {
    TestBed.configureTestingModule({ providers: [provideDateTimeLabels({ rangeOrder: 'Start vor Ende' })] });

    expect(orderErrors(range('2026-03-10', '2026-03-01'))).toEqual([{ kind: 'rangeOrder', message: 'Start vor Ende' }]);
  });

  it('uses a custom message when given one', () => {
    expect(orderErrors(range('2026-03-10', '2026-03-01'), { message: 'Check out after check-in' })).toEqual([
      { kind: 'rangeOrder', message: 'Check out after check-in' },
    ]);
  });
});

describe('timeRangeOrder', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('reads HH:mm by default and fails an end before the start', () => {
    expect(errorsFor(range('17:00', '09:00'), (path) => timeRangeOrder(path))).toEqual([
      { kind: 'rangeOrder', message: 'The start must be before the end' },
    ]);
    expect(errorsFor(range('09:00', '17:00'), (path) => timeRangeOrder(path))).toEqual([]);
  });

  it('follows the TIME_FORMAT token', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideTimeFormat('h:mm a')] });

    expect(errorsFor(range('9:00 PM', '10:00 AM'), (path) => timeRangeOrder(path))).toHaveLength(1);
  });
});

describe('dateRangeBounds', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  const valueFormat = 'yyyy-MM-dd';

  it('fails when either end lies before min', () => {
    const min = new Date(2026, 2, 5);

    expect(errorsFor(range('2026-03-04', '2026-03-10'), (path) => dateRangeBounds(path, { min, valueFormat }))).toEqual(
      [{ kind: 'rangeMin', message: 'Choose dates on or after 03/05/2026' }],
    );
    expect(errorsFor(range(null, '2026-03-04'), (path) => dateRangeBounds(path, { min, valueFormat }))).toHaveLength(1);
  });

  it('fails when either end lies after max', () => {
    const max = new Date(2026, 2, 5);

    expect(errorsFor(range('2026-03-01', '2026-03-06'), (path) => dateRangeBounds(path, { max, valueFormat }))).toEqual(
      [{ kind: 'rangeMax', message: 'Choose dates on or before 03/05/2026' }],
    );
  });

  it('reads its messages from DATE_TIME_LABELS and formats the bound in DATE_LOCALE', () => {
    TestBed.configureTestingModule({
      providers: [
        provideDateLocale(de),
        provideDateTimeLabels({ rangeMin: (min) => `Frühestens ${min}`, rangeMax: (max) => `Spätestens ${max}` }),
      ],
    });

    const bound = new Date(2026, 2, 5);

    expect(errorsFor(range('2026-03-04', null), (path) => dateRangeBounds(path, { min: bound, valueFormat }))).toEqual([
      { kind: 'rangeMin', message: 'Frühestens 05.03.2026' },
    ]);
    expect(errorsFor(range(null, '2026-03-06'), (path) => dateRangeBounds(path, { max: bound, valueFormat }))).toEqual([
      { kind: 'rangeMax', message: 'Spätestens 05.03.2026' },
    ]);
  });

  it('compares whole days, so a min carrying a time of day still admits that day', () => {
    const min = new Date(2026, 2, 5, 14, 30);

    expect(errorsFor(range('2026-03-05', '2026-03-06'), (path) => dateRangeBounds(path, { min, valueFormat }))).toEqual(
      [],
    );
  });

  it('compares in the given precision', () => {
    const min = new Date(2026, 2, 20);
    const apply = (path: RangePath) => dateRangeBounds(path, { min, valueFormat: 'yyyy-MM', precision: 'month' });

    expect(errorsFor(range('2026-03', '2026-05'), apply)).toEqual([]);
    expect(errorsFor(range('2026-02', '2026-05'), apply)).toEqual([
      { kind: 'rangeMin', message: 'Choose dates on or after 03/2026' },
    ]);
  });

  it('carries the bound on the error and accepts a bound function', () => {
    const limit = signal(new Date(2026, 2, 5));
    const injector = TestBed.inject(Injector);
    const model = signal({ range: range('2026-03-04', '2026-03-10') });
    const rangeForm = form(model, (s) => dateRangeBounds(s.range, { min: () => limit(), valueFormat }), { injector });

    expect(rangeForm.range().errors()[0]).toMatchObject({ kind: 'rangeMin', min: limit() });

    limit.set(new Date(2026, 2, 1));

    expect(rangeForm.range().errors()).toEqual([]);
  });

  it('passes an empty range', () => {
    expect(errorsFor(range(null, null), (path) => dateRangeBounds(path, { min: new Date(), valueFormat }))).toEqual([]);
  });
});

describe('dateTimeRangeOrder', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('compares instants, not strings, so mixed offsets order correctly', () => {
    const apply = (path: RangePath) => dateTimeRangeOrder(path);

    expect(errorsFor(range('2026-03-01T10:00:00+02:00', '2026-03-01T09:30:00+00:00'), apply)).toEqual([]);
    expect(errorsFor(range('2026-03-01T10:00:00+00:00', '2026-03-01T09:30:00+00:00'), apply)).toHaveLength(1);
  });

  it('reads the DATE_TIME_FORMAT token and ignores DATE_FORMAT', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideDateFormat('yyyy-MM-dd'), provideDateTimeFormat('dd.MM.yyyy HH:mm')],
    });

    const apply = (path: RangePath) => dateTimeRangeOrder(path);

    expect(errorsFor(range('01.03.2026 10:00', '01.03.2026 09:30'), apply)).toHaveLength(1);
    expect(errorsFor(range('01.03.2026 09:30', '01.03.2026 10:00'), apply)).toEqual([]);
  });
});

describe('dateTimeRangeBounds', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('compares to the minute rather than the day', () => {
    const min = new Date('2026-03-05T14:30:00Z');
    const apply = (path: RangePath) => dateTimeRangeBounds(path, { min });

    expect(errorsFor(range('2026-03-05T14:00:00+00:00', '2026-03-05T18:00:00+00:00'), apply)).toMatchObject([
      { kind: 'rangeMin' },
    ]);
    expect(errorsFor(range('2026-03-05T14:30:00+00:00', '2026-03-05T18:00:00+00:00'), apply)).toEqual([]);
  });
});

describe('dateBounds and dateTimeBounds', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  const valueFormat = 'yyyy-MM-dd';

  const singleErrors = (value: string | null, apply: (path: Parameters<typeof dateBounds>[0]) => void) => {
    const model = signal({ date: value });
    const dateForm = form(model, (s) => apply(s.date), { injector: TestBed.inject(Injector) });

    return dateForm
      .date()
      .errors()
      .map(({ kind, message }) => ({ kind, message }));
  };

  it('fails a date before min and after max with the range kinds and messages', () => {
    const bound = new Date(2026, 2, 5);

    expect(singleErrors('2026-03-04', (path) => dateBounds(path, { min: bound, valueFormat }))).toEqual([
      { kind: 'rangeMin', message: 'Choose dates on or after 03/05/2026' },
    ]);
    expect(singleErrors('2026-03-06', (path) => dateBounds(path, { max: bound, valueFormat }))).toEqual([
      { kind: 'rangeMax', message: 'Choose dates on or before 03/05/2026' },
    ]);
  });

  it('admits the bound day and passes an empty or unparseable value', () => {
    const bound = new Date(2026, 2, 5, 15);

    expect(singleErrors('2026-03-05', (path) => dateBounds(path, { min: bound, max: bound, valueFormat }))).toEqual([]);
    expect(singleErrors(null, (path) => dateBounds(path, { min: bound, valueFormat }))).toEqual([]);
    expect(singleErrors('nope', (path) => dateBounds(path, { min: bound, valueFormat }))).toEqual([]);
  });

  it('resolves a function bound and honours a custom message', () => {
    expect(
      singleErrors('2026-03-04', (path) =>
        dateBounds(path, { min: () => new Date(2026, 2, 5), valueFormat, message: 'Too early' }),
      ),
    ).toEqual([{ kind: 'rangeMin', message: 'Too early' }]);
  });

  it('reads DATE_FORMAT for dateBounds and DATE_TIME_FORMAT for dateTimeBounds by default', () => {
    const bound = new Date(2026, 2, 5, 12, 0, 0);
    const instant = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm:ssxxx");

    expect(singleErrors('2026-03-04', (path) => dateBounds(path, { min: bound }))).toHaveLength(1);
    expect(singleErrors('2026-03-05', (path) => dateBounds(path, { min: bound }))).toEqual([]);
    expect(
      singleErrors(instant(new Date(2026, 2, 5, 11, 59)), (path) => dateTimeBounds(path, { min: bound })),
    ).toHaveLength(1);
    expect(singleErrors(instant(bound), (path) => dateTimeBounds(path, { min: bound }))).toEqual([]);
  });

  it('reads a provided DATE_TIME_FORMAT in dateTimeBounds', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideDateTimeFormat("yyyy-MM-dd'T'HH:mm")] });

    const apply = (path: Parameters<typeof dateBounds>[0]) => dateTimeBounds(path, { min: new Date(2026, 2, 5, 12) });

    expect(singleErrors('2026-03-05T11:59', apply)).toHaveLength(1);
    expect(singleErrors('2026-03-05T12:00', apply)).toEqual([]);
  });

  it('compares a date-time to the millisecond', () => {
    const bound = new Date(2026, 2, 5, 12, 0, 0);

    expect(
      singleErrors('2026-03-05T11:59:00', (path) =>
        dateTimeBounds(path, { min: bound, valueFormat: "yyyy-MM-dd'T'HH:mm:ss" }),
      ),
    ).toHaveLength(1);
    expect(
      singleErrors('2026-03-05T12:00:00', (path) =>
        dateTimeBounds(path, { min: bound, valueFormat: "yyyy-MM-dd'T'HH:mm:ss" }),
      ),
    ).toEqual([]);
  });

  it('reads an offset-less value in the given timeZone and names the bound in it', () => {
    const noonInTokyo = new Date('2026-03-05T03:00:00Z');
    const apply = (path: Parameters<typeof dateBounds>[0]) =>
      dateTimeBounds(path, { min: noonInTokyo, valueFormat: "yyyy-MM-dd'T'HH:mm", timeZone: 'Asia/Tokyo' });

    expect(singleErrors('2026-03-05T11:59', apply)).toEqual([
      { kind: 'rangeMin', message: 'Choose dates on or after 03/05/2026, 12:00 PM' },
    ]);
    expect(singleErrors('2026-03-05T12:00', apply)).toEqual([]);
  });

  it('orders a range in the given timeZone', () => {
    const errors = errorsFor(range('2026-03-05T12:00', '2026-03-05T11:00'), (path) =>
      dateTimeRangeOrder(path, { valueFormat: "yyyy-MM-dd'T'HH:mm", timeZone: 'Asia/Tokyo' }),
    );

    expect(errors).toMatchObject([{ kind: 'rangeOrder' }]);
  });
});
