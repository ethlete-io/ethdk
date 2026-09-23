import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import '../../../test-helpers';
import { provideDateFormat, provideTimeFormat } from './date-time-formats';
import {
  dateRangeBounds,
  dateRangeOrder,
  dateTimeRangeBounds,
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

  it('compares instants, not strings, so mixed offsets order correctly', () => {
    const errors = errorsFor(range('2026-03-01T10:00:00+02:00', '2026-03-01T09:30:00+00:00'), (path) =>
      dateRangeOrder(path),
    );

    expect(errors).toEqual([]);
  });

  it('reads the DATE_FORMAT token when no valueFormat is given', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideDateFormat('dd.MM.yyyy')] });

    expect(errorsFor(range('02.01.2026', '10.01.2025'), (path) => dateRangeOrder(path))).toHaveLength(1);
    expect(errorsFor(range('10.01.2025', '02.01.2026'), (path) => dateRangeOrder(path))).toEqual([]);
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
