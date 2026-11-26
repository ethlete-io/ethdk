import { Component, Injector, Provider, signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import '../../../test-helpers';
import { DateInputDirective } from './date-input';
import { DateRangeInputDirective } from './date-range-input';
import { DateTimeInputDirective } from './date-time-input';
import { DateTimeRangeInputDirective } from './date-time-range-input';
import { injectDateTimeZone, provideDateTimeZone } from './date-time-formats';
import { dateTimeBounds } from './date-time-range-validators';

type Zone = string | null | undefined;

/** 23:30 UTC on 15 July: still the 15th in UTC, already the 16th in the specs' runtime zone (Europe/Berlin). */
const NEAR_MIDNIGHT = '2026-07-15T23:30:00+00:00';
const OFFSET_FORMAT = "yyyy-MM-dd'T'HH:mm:ssxxx";

@Component({
  template: `<div
    [(value)]="value"
    [timeZone]="zone()"
    [valueFormat]="valueFormat()"
    displayFormat="MM/dd/yyyy"
    etDateInput
  ></div>`,
  imports: [DateInputDirective],
})
class DateHost {
  value = signal<string | null>(NEAR_MIDNIGHT);
  zone = signal<Zone>(undefined);
  valueFormat = signal(OFFSET_FORMAT);
}

@Component({
  template: `<div
    [(value)]="value"
    [timeZone]="zone()"
    [valueFormat]="valueFormat"
    displayFormat="MM/dd/yyyy"
    etDateRangeInput
  ></div>`,
  imports: [DateRangeInputDirective],
})
class DateRangeHost {
  value = signal({ start: NEAR_MIDNIGHT, end: NEAR_MIDNIGHT });
  zone = signal<Zone>(undefined);
  valueFormat = OFFSET_FORMAT;
}

@Component({
  template: `<div [(value)]="value" [timeZone]="zone()" displayFormat="MM/dd/yyyy, HH:mm" etDateTimeInput></div>`,
  imports: [DateTimeInputDirective],
})
class DateTimeHost {
  value = signal<string | null>(NEAR_MIDNIGHT);
  zone = signal<Zone>(undefined);
}

@Component({
  template: `<div [(value)]="value" [timeZone]="zone()" displayFormat="MM/dd/yyyy, HH:mm" etDateTimeRangeInput></div>`,
  imports: [DateTimeRangeInputDirective],
})
class DateTimeRangeHost {
  value = signal({ start: NEAR_MIDNIGHT, end: NEAR_MIDNIGHT });
  zone = signal<Zone>(undefined);
}

const mount = <THost extends { zone: { set: (zone: Zone) => void } }, TDirective>(
  hostType: Type<THost>,
  directiveType: Type<TDirective>,
  { providers = [], zone }: { providers?: Provider[]; zone?: Zone } = {},
) => {
  TestBed.configureTestingModule({ imports: [hostType], providers });
  const fixture = TestBed.createComponent(hostType);
  fixture.componentInstance.zone.set(zone);
  fixture.detectChanges();

  return {
    fixture,
    host: fixture.componentInstance,
    control: fixture.debugElement.query(By.directive(directiveType)).injector.get(directiveType),
  };
};

const IN_UTC = [provideDateTimeZone('UTC')];

describe('provideDateTimeZone', () => {
  it('resolves to null without a provider', () => {
    expect(TestBed.runInInjectionContext(() => injectDateTimeZone())).toBeNull();
  });

  describe('without the provider', () => {
    it('keeps every control in the runtime zone', () => {
      expect(mount(DateHost, DateInputDirective).control.displayValue()).toBe('07/16/2026');
      TestBed.resetTestingModule();
      expect(mount(DateRangeHost, DateRangeInputDirective).control.displayValue('end')).toBe('07/16/2026');
      TestBed.resetTestingModule();
      expect(mount(DateTimeHost, DateTimeInputDirective).control.displayValue()).toBe('07/16/2026, 01:30');
      TestBed.resetTestingModule();
      expect(mount(DateTimeRangeHost, DateTimeRangeInputDirective).control.displayValue('start')).toBe(
        '07/16/2026, 01:30',
      );
    });

    it('writes a picked day as the runtime zone midnight', () => {
      const { host, control } = mount(DateHost, DateInputDirective);

      control.selectDate(new Date(2026, 6, 15));

      expect(host.value()).toBe('2026-07-15T00:00:00+02:00');
    });
  });

  describe('with provideDateTimeZone("UTC")', () => {
    it('shows the UTC wall clock in every control', () => {
      expect(mount(DateHost, DateInputDirective, { providers: IN_UTC }).control.displayValue()).toBe('07/15/2026');
      TestBed.resetTestingModule();
      expect(mount(DateRangeHost, DateRangeInputDirective, { providers: IN_UTC }).control.displayValue('end')).toBe(
        '07/15/2026',
      );
      TestBed.resetTestingModule();
      expect(mount(DateTimeHost, DateTimeInputDirective, { providers: IN_UTC }).control.displayValue()).toBe(
        '07/15/2026, 23:30',
      );
      TestBed.resetTestingModule();
      expect(
        mount(DateTimeRangeHost, DateTimeRangeInputDirective, { providers: IN_UTC }).control.displayValue('start'),
      ).toBe('07/15/2026, 23:30');
    });

    it('highlights the UTC day in the date picker calendar', () => {
      const { control } = mount(DateHost, DateInputDirective, { providers: IN_UTC });

      expect(control.pickerDate()).toEqual(new Date(2026, 6, 15, 23, 30));
    });

    it('writes a picked or typed date as its UTC midnight', () => {
      const { host, control } = mount(DateHost, DateInputDirective, { providers: IN_UTC });

      control.selectDate(new Date(2026, 6, 14));
      expect(host.value()).toBe('2026-07-14T00:00:00+00:00');

      control.commitInput('07/13/2026');
      expect(host.value()).toBe('2026-07-13T00:00:00+00:00');
    });

    it('writes a picked or typed range as the UTC midnight of each end', () => {
      const { host, control } = mount(DateRangeHost, DateRangeInputDirective, { providers: IN_UTC });

      control.selectCalendarRange({ start: new Date(2026, 6, 10), end: new Date(2026, 6, 12) });
      expect(host.value()).toEqual({ start: '2026-07-10T00:00:00+00:00', end: '2026-07-12T00:00:00+00:00' });

      control.commitSide('end', '07/20/2026');
      expect(host.value().end).toBe('2026-07-20T00:00:00+00:00');
    });

    it('leaves a date-only wire format untouched', () => {
      const { fixture, host, control } = mount(DateHost, DateInputDirective, { providers: IN_UTC });

      fixture.componentInstance.valueFormat.set('yyyy-MM-dd');
      host.value.set('2026-07-15');
      fixture.detectChanges();

      expect(control.displayValue()).toBe('07/15/2026');

      control.selectDate(new Date(2026, 6, 16));
      expect(host.value()).toBe('2026-07-16');
    });

    it('lets the instance timeZone win', () => {
      const { host, control } = mount(DateHost, DateInputDirective, { providers: IN_UTC, zone: 'Asia/Tokyo' });

      expect(control.displayValue()).toBe('07/16/2026');

      control.selectDate(new Date(2026, 6, 15));
      expect(host.value()).toBe('2026-07-15T00:00:00+09:00');
    });

    it('keeps the runtime zone for an instance timeZone of null', () => {
      expect(mount(DateHost, DateInputDirective, { providers: IN_UTC, zone: null }).control.displayValue()).toBe(
        '07/16/2026',
      );
      TestBed.resetTestingModule();
      expect(
        mount(DateTimeHost, DateTimeInputDirective, { providers: IN_UTC, zone: null }).control.displayValue(),
      ).toBe('07/16/2026, 01:30');
    });

    it('names a date-time bound in the zone', () => {
      TestBed.configureTestingModule({ providers: IN_UTC });

      const model = signal({ at: '2026-07-15T21:00:00+00:00' });
      const errors = form(model, (s) => dateTimeBounds(s.at, { min: new Date('2026-07-15T23:30:00Z') }), {
        injector: TestBed.inject(Injector),
      })
        .at()
        .errors();

      expect(errors[0]?.message).toContain('7/15/2026, 11:30');
    });
  });
});
