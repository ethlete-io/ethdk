import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { describeMixedStateContract } from '../../../testing/mixed-state-contract';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { DateTimeRangeInputFieldDirective } from './date-time-range-input-field.directive';
import { DateTimeRangeInputDirective, DateTimeRangeValue } from './date-time-range-input.directive';
import { DatePickerDriver, mountDatePicker } from '../../../testing/date-picker-driver';
import { pressKey, tick } from '../../../../testing/driver-core';

@Component({
  template: `
    <div
      [(value)]="value"
      [(mixed)]="mixed"
      [disabled]="disabled()"
      displayFormat="MM/dd/yyyy, HH:mm"
      etDateTimeRangeInput
      valueFormat="yyyy-MM-dd HH:mm"
    >
      <input class="start" etDateTimeRangeInputField side="start" />
      <input class="end" etDateTimeRangeInputField side="end" />
      <button class="open-picker" etDatePickerTrigger>open</button>

      <ng-template etDatePickerSurface let-rangeInput>
        <button
          (click)="rangeInput.selectCalendarRange({ start: pickStartDay, end: null })"
          class="pick-start-day"
          type="button"
        >
          start day
        </button>
        <button
          (click)="rangeInput.selectCalendarRange({ start: pickStartDay, end: pickEndDay })"
          class="pick-both-days"
          type="button"
        >
          both days
        </button>
        <button (click)="rangeInput.selectTime('start', pickTime)" class="pick-start-time" type="button">
          start time
        </button>
        <button (click)="rangeInput.selectTime('end', pickTime)" class="pick-end-time" type="button">end time</button>
      </ng-template>
    </div>
  `,
  imports: [
    DateTimeRangeInputDirective,
    DateTimeRangeInputFieldDirective,
    DatePickerTriggerDirective,
    DatePickerSurfaceDirective,
  ],
})
class DateTimeRangeInputTestHost {
  value = signal<DateTimeRangeValue>({ start: null, end: null });
  mixed = signal(false);
  disabled = signal(false);
  pickStartDay = new Date(2026, 6, 8);
  pickEndDay = new Date(2026, 6, 23);
  pickTime = new Date(2026, 0, 1, 21, 45);
}

describe('DateTimeRangeInputDirective', () => {
  let driver: DatePickerDriver<DateTimeRangeInputTestHost, DateTimeRangeInputDirective>;

  beforeEach(() => {
    driver = mountDatePicker(DateTimeRangeInputTestHost, DateTimeRangeInputDirective);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('commits each side independently on blur', () => {
    driver.typeAndBlur('07/08/2026, 09:00', '.start');

    expect(driver.host.value()).toEqual({ start: '2026-07-08 09:00', end: null });

    driver.typeAndBlur('07/23/2026, 17:30', '.end');

    expect(driver.host.value()).toEqual({ start: '2026-07-08 09:00', end: '2026-07-23 17:30' });
    expect(driver.control.parseError()).toBe(false);
    expect(driver.control.touched()).toBe(true);
  });

  it('commits lenient entry per side and reformats it', () => {
    driver.typeAndBlur('07/08/2026 930pm', '.start');

    expect(driver.host.value().start).toBe('2026-07-08 21:30');
    expect(driver.field('.start').value).toBe('07/08/2026, 21:30');
  });

  it('commits a bare date at midnight', () => {
    driver.typeAndBlur('07/23/2026', '.end');

    expect(driver.host.value().end).toBe('2026-07-23 00:00');
  });

  it('tracks a per-side parse error without touching the other side', () => {
    driver.typeAndBlur('07/08/2026, 09:00', '.start');
    driver.typeAndBlur('nope', '.end');

    expect(driver.host.value()).toEqual({ start: '2026-07-08 09:00', end: null });
    expect(driver.control.sideParseError('start')).toBe(false);
    expect(driver.control.sideParseError('end')).toBe(true);
    expect(driver.control.shouldDisplayError()).toBe(true);
    expect(driver.field('.end').value).toBe('nope');
  });

  it('leaves an end before the start alone - ordering is a validator concern', () => {
    driver.typeAndBlur('07/23/2026, 17:30', '.start');
    driver.typeAndBlur('07/08/2026, 09:00', '.end');

    expect(driver.host.value()).toEqual({ start: '2026-07-23 17:30', end: '2026-07-08 09:00' });
  });

  it('displays a prefilled range in the combined display format', async () => {
    driver.host.value.set({ start: '2026-12-24 09:15', end: '2026-12-26 18:00' });
    tick();
    await driver.fixture.whenStable();

    expect(driver.field('.start').value).toBe('12/24/2026, 09:15');
    expect(driver.field('.end').value).toBe('12/26/2026, 18:00');
    expect(driver.control.calendarRange()).toEqual({
      start: new Date(2026, 11, 24, 9, 15),
      end: new Date(2026, 11, 26, 18, 0),
    });
  });

  it('keeps each side time of day when a picked day range lands, and keeps the picker open', async () => {
    driver.host.value.set({ start: '2026-12-24 09:15', end: '2026-12-26 18:00' });
    tick();

    await driver.open();

    driver.clickInPane('.pick-both-days');

    expect(driver.host.value()).toEqual({ start: '2026-07-08 09:15', end: '2026-07-23 18:00' });
    // a complete day range is only half a date-time range - the times are still to come
    expect(driver.control.pickerOpen()).toBe(true);
    expect(driver.control.touched()).toBe(true);
  });

  it('holds both days picked from an empty range until their times arrive', async () => {
    await driver.open();

    driver.clickInPane('.pick-both-days');

    expect(driver.host.value()).toEqual({ start: null, end: null });
    expect(driver.control.hasValue()).toBe(true);
    expect(driver.control.displayValue('start')).toBe('07/08/2026, __:__');
    expect(driver.control.displayValue('end')).toBe('07/23/2026, __:__');
    expect(driver.control.pickerDateRange()).toEqual({ start: driver.host.pickStartDay, end: driver.host.pickEndDay });
    expect(driver.control.pickerTimeRange()).toEqual({ start: null, end: null });

    driver.clickInPane('.pick-start-time');

    expect(driver.host.value()).toEqual({ start: '2026-07-08 21:45', end: null });
    expect(driver.control.displayValue('end')).toBe('07/23/2026, __:__');
  });

  it('clears held halves with the range', async () => {
    await driver.open();

    driver.clickInPane('.pick-both-days');

    driver.control.clearRange();
    tick();

    expect(driver.control.displayValue('start')).toBe('');
    expect(driver.control.hasValue()).toBe(false);
  });

  it('drops the end while the calendar reopens the range', async () => {
    driver.host.value.set({ start: '2026-12-24 09:15', end: '2026-12-26 18:00' });
    tick();

    await driver.open();

    driver.clickInPane('.pick-start-day');

    expect(driver.host.value()).toEqual({ start: '2026-07-08 09:15', end: null });
  });

  it('merges a picked time into that side only', async () => {
    driver.host.value.set({ start: '2026-12-24 09:15', end: '2026-12-26 18:00' });
    tick();

    await driver.open();

    driver.clickInPane('.pick-end-time');

    expect(driver.host.value()).toEqual({ start: '2026-12-24 09:15', end: '2026-12-26 21:45' });

    driver.clickInPane('.pick-start-time');

    expect(driver.host.value()).toEqual({ start: '2026-12-24 21:45', end: '2026-12-26 21:45' });
  });

  it("takes the other side's day for a time picked on a side with no day yet", async () => {
    driver.typeAndBlur('07/08/2026, 09:00', '.start');

    await driver.open();

    driver.clickInPane('.pick-end-time');

    // the end time of an appointment whose start day is known means that day, not today
    expect(driver.host.value()).toEqual({ start: '2026-07-08 09:00', end: '2026-07-08 21:45' });
  });

  it('holds a time picked while the range is empty until a day arrives', async () => {
    await driver.open();

    driver.clickInPane('.pick-start-time');

    expect(driver.host.value()).toEqual({ start: null, end: null });
    expect(driver.control.displayValue('start')).toBe('__/__/____, 21:45');
    expect(driver.control.pickerTimeRange()).toEqual({ start: driver.host.pickTime, end: null });

    driver.clickInPane('.pick-both-days');

    // the held start time completes on the day it was waiting for; the end has none yet
    expect(driver.host.value()).toEqual({ start: '2026-07-08 21:45', end: null });
    expect(driver.control.displayValue('end')).toBe('07/23/2026, __:__');
  });

  it('keeps a time held for the end while the calendar has only its first day', async () => {
    await driver.open();

    driver.clickInPane('.pick-end-time');

    // the calendar reports `end: null` for its whole first click - that says nothing about the time
    driver.clickInPane('.pick-start-day');

    expect(driver.control.displayValue('end')).toBe('__/__/____, 21:45');

    driver.clickInPane('.pick-both-days');

    expect(driver.host.value()).toEqual({ start: null, end: '2026-07-23 21:45' });
  });

  it('clears both sides', () => {
    driver.typeAndBlur('07/08/2026, 09:00', '.start');
    driver.typeAndBlur('07/23/2026, 17:30', '.end');

    driver.control.clearRange();
    tick();

    expect(driver.host.value()).toEqual({ start: null, end: null });
    expect(driver.control.hasValue()).toBe(false);
    expect(driver.field('.start').value).toBe('');
    expect(driver.field('.end').value).toBe('');
  });

  it('opens the picker with Alt+ArrowDown from either field', async () => {
    driver.field('.end').focus();
    pressKey(driver.field('.end'), 'ArrowDown', { altKey: true });
    await driver.settle();

    expect(driver.control.pickerOpen()).toBe(true);
  });

  it('ignores the trigger while disabled', () => {
    driver.host.disabled.set(true);
    tick();

    expect(driver.trigger<HTMLButtonElement>().disabled).toBe(true);
    expect(driver.field('.start').disabled).toBe(true);

    driver.control.openPicker();
    tick();

    expect(driver.control.pickerOpen()).toBe(false);
  });

  describe('mixed (bulk edit)', () => {
    const enterMixed = () => {
      driver.host.value.set({ start: '2026-03-01 08:15', end: '2026-03-10 19:45' });
      driver.host.mixed.set(true);
      tick();
    };

    it('renders both fields empty with the mixed label as placeholder', () => {
      enterMixed();

      expect(driver.field('.start').value).toBe('');
      expect(driver.field('.end').value).toBe('');
      expect(driver.field('.start').getAttribute('placeholder')).toBe('Mixed');
      expect(driver.control.calendarRange()).toEqual({ start: null, end: null });
      expect(driver.control.hasValue()).toBe(true);
    });

    it('keeps mixed and the raw range on a failed typed parse', () => {
      enterMixed();
      driver.typeAndBlur('nope', '.start');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toEqual({ start: '2026-03-01 08:15', end: '2026-03-10 19:45' });
      expect(driver.control.parseError()).toBe(true);
    });

    it('starts a fresh range on the first typed commit - the hidden other side does not leak', () => {
      enterMixed();
      driver.typeAndBlur('07/23/2026, 17:30', '.end');

      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toEqual({ start: null, end: '2026-07-23 17:30' });
    });

    it('replaces on a picked time: no merge with the hidden day or the hidden other side', async () => {
      enterMixed();
      await driver.open();

      driver.clickInPane('.pick-start-time');

      expect(driver.host.mixed()).toBe(false);
      // neither the hidden 2026-03-01 nor the hidden end may survive the fresh pick
      expect(driver.host.value()).toEqual({ start: null, end: null });
      expect(driver.control.displayValue('start')).toBe('__/__/____, 21:45');
      expect(driver.control.displayValue('end')).toBe('');
    });

    it('replaces on a picked day range: both days held, the hidden range gone', async () => {
      enterMixed();
      await driver.open();

      driver.clickInPane('.pick-both-days');

      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toEqual({ start: null, end: null });
      expect(driver.control.displayValue('start')).toBe('07/08/2026, __:__');
      expect(driver.control.displayValue('end')).toBe('07/23/2026, __:__');
    });
  });
});

describe('DateTimeRangeInputDirective mixed state', () => {
  describeMixedStateContract(() => {
    const driver = mountDatePicker(DateTimeRangeInputTestHost, DateTimeRangeInputDirective);

    return {
      enterMixed: () => {
        driver.host.value.set({ start: '2026-03-01 08:15', end: '2026-03-10 19:45' });
        driver.host.mixed.set(true);
        tick();
      },
      rawValue: () => ({ start: '2026-03-01 08:15', end: '2026-03-10 19:45' }),
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.element(),
      writeValueExternally: () => {
        driver.host.value.set({ start: '2026-01-01 12:00', end: '2026-01-05 13:00' });
        tick();
      },
      externallyWrittenValue: () => ({ start: '2026-01-01 12:00', end: '2026-01-05 13:00' }),
      // replace semantics: the resolving commit starts a fresh range - no merge with the hidden end
      commit: () => driver.typeAndBlur('07/20/2026, 14:30', '.start'),
      committedValue: () => ({ start: '2026-07-20 14:30', end: null }),
      assertMasked: () => {
        expect(driver.control.calendarRange()).toEqual({ start: null, end: null });
        expect(driver.field('.start').value).toBe('');
        expect(driver.field('.end').value).toBe('');
        expect(driver.field('.start').getAttribute('placeholder')).toBe('Mixed');
        expect(driver.field('.end').getAttribute('placeholder')).toBe('Mixed');
      },
    };
  });
});

@Component({
  template: `
    <div
      [(value)]="value"
      [timeZone]="timeZone()"
      displayFormat="MM/dd/yyyy, HH:mm"
      etDateTimeRangeInput
      valueFormat="yyyy-MM-dd'T'HH:mm:ssxxx"
    >
      <input class="start" etDateTimeRangeInputField side="start" />
      <input class="end" etDateTimeRangeInputField side="end" />
    </div>
  `,
  imports: [DateTimeRangeInputDirective, DateTimeRangeInputFieldDirective],
})
class ZonedDateTimeRangeInputTestHost {
  value = signal<DateTimeRangeValue>({ start: null, end: null });
  timeZone = signal<string | null>(null);
}

const RUNTIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** 2026-08-18, 14:00 to 18:00 in Tokyo - the same two instants read in New York. */
const RANGE =
  RUNTIME_ZONE === 'Asia/Tokyo'
    ? {
        zone: 'America/New_York',
        name: 'New York',
        wire: { start: '2026-08-18T01:00:00-04:00', end: '2026-08-18T05:00:00-04:00' },
        display: { start: '08/18/2026, 01:00', end: '08/18/2026, 05:00' },
        afterStartTimePick: '2026-08-18T21:45:00-04:00',
        afterDayPick: '2026-07-16T01:00:00-04:00',
      }
    : {
        zone: 'Asia/Tokyo',
        name: 'Tokyo',
        wire: { start: '2026-08-18T14:00:00+09:00', end: '2026-08-18T18:00:00+09:00' },
        display: { start: '08/18/2026, 14:00', end: '08/18/2026, 18:00' },
        afterStartTimePick: '2026-08-18T21:45:00+09:00',
        afterDayPick: '2026-07-16T14:00:00+09:00',
      };

describe('DateTimeRangeInputDirective time zone', () => {
  let fixture: ComponentFixture<ZonedDateTimeRangeInputTestHost>;
  let host: ZonedDateTimeRangeInputTestHost;
  let rangeInput: DateTimeRangeInputDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ZonedDateTimeRangeInputTestHost] });
    fixture = TestBed.createComponent(ZonedDateTimeRangeInputTestHost);
    host = fixture.componentInstance;
    host.timeZone.set(RANGE.zone);
    fixture.detectChanges();
    rangeInput = fixture.debugElement.children[0].injector.get(DateTimeRangeInputDirective);
  });

  const setValue = (value: DateTimeRangeValue) => {
    host.value.set(value);
    fixture.detectChanges();
  };

  it('renders both fields in the given zone', () => {
    setValue(RANGE.wire);

    expect(rangeInput.displayValue('start')).toBe(RANGE.display.start);
    expect(rangeInput.displayValue('end')).toBe(RANGE.display.end);
  });

  it('reads typed text as that zone and writes the zone offset', () => {
    rangeInput.commitSide('start', RANGE.display.start);

    expect(host.value().start).toBe(RANGE.wire.start);
  });

  it('keeps the zone day when a time is picked', () => {
    setValue(RANGE.wire);
    rangeInput.selectTime('start', new Date(2026, 0, 1, 21, 45));

    expect(host.value().start).toBe(RANGE.afterStartTimePick);
  });

  it('keeps each side zone time of day when the days are picked', () => {
    setValue(RANGE.wire);
    rangeInput.selectCalendarRange({ start: new Date(2026, 6, 16), end: null });

    expect(host.value().start).toBe(RANGE.afterDayPick);
  });

  it('offers one second reading covering both ends', () => {
    setValue(RANGE.wire);

    expect(rangeInput.localReading('start')).not.toBeNull();
    expect(rangeInput.localReading('end')).not.toBeNull();
    expect(rangeInput.localReadingId()).not.toBeNull();
  });

  it('offers no second reading while the field zone is the runtime zone', () => {
    host.timeZone.set(RUNTIME_ZONE);
    setValue(RANGE.wire);

    expect(rangeInput.localReading('start')).toBeNull();
    expect(rangeInput.localReadingId()).toBeNull();
  });

  it('ignores a zone name Intl does not know', () => {
    host.timeZone.set('Middle/Earth');
    setValue(RANGE.wire);

    expect(rangeInput.effectiveTimeZone()).toBeNull();
    expect(rangeInput.localReadingId()).toBeNull();
  });
});
