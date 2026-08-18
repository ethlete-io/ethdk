import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { describeMixedStateContract } from '../../../testing/mixed-state-contract';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { DateTimeRangeInputFieldDirective } from './date-time-range-input-field.directive';
import { DateTimeRangeInputDirective, DateTimeRangeValue } from './date-time-range-input.directive';

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

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('DateTimeRangeInputDirective', () => {
  let fixture: ComponentFixture<DateTimeRangeInputTestHost>;
  let host: DateTimeRangeInputTestHost;
  let rangeInput: DateTimeRangeInputDirective;
  let startField: HTMLInputElement;
  let endField: HTMLInputElement;
  let trigger: HTMLButtonElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  // overlays render into the document - scope queries to the newest pane so a pane
  // stuck in its leave transition (jsdom fires no transition events) can't pollute them
  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;
  const paneButton = (selector: string) => pane()?.querySelector<HTMLButtonElement>(selector) ?? null;

  const typeAndBlur = (field: HTMLInputElement, text: string) => {
    field.focus();
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    tick();
    field.blur();
    field.dispatchEvent(new Event('blur'));
    tick();
  };

  const openPicker = async () => {
    trigger.click();
    tick();
    await flushFrames();
    tick();
  };

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({ imports: [DateTimeRangeInputTestHost] });
    fixture = TestBed.createComponent(DateTimeRangeInputTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    rangeInput = fixture.debugElement.children[0]!.injector.get(DateTimeRangeInputDirective);
    startField = fixture.nativeElement.querySelector('.start');
    endField = fixture.nativeElement.querySelector('.end');
    trigger = fixture.nativeElement.querySelector('.open-picker');
  });

  afterEach(async () => {
    rangeInput.closePicker();
    tick();
    await flushFrames();
  });

  it('commits each side independently on blur', () => {
    typeAndBlur(startField, '07/08/2026, 09:00');

    expect(host.value()).toEqual({ start: '2026-07-08 09:00', end: null });

    typeAndBlur(endField, '07/23/2026, 17:30');

    expect(host.value()).toEqual({ start: '2026-07-08 09:00', end: '2026-07-23 17:30' });
    expect(rangeInput.parseError()).toBe(false);
    expect(rangeInput.touched()).toBe(true);
  });

  it('commits lenient entry per side and reformats it', () => {
    typeAndBlur(startField, '07/08/2026 930pm');

    expect(host.value().start).toBe('2026-07-08 21:30');
    expect(startField.value).toBe('07/08/2026, 21:30');
  });

  it('commits a bare date at midnight', () => {
    typeAndBlur(endField, '07/23/2026');

    expect(host.value().end).toBe('2026-07-23 00:00');
  });

  it('tracks a per-side parse error without touching the other side', () => {
    typeAndBlur(startField, '07/08/2026, 09:00');
    typeAndBlur(endField, 'nope');

    expect(host.value()).toEqual({ start: '2026-07-08 09:00', end: null });
    expect(rangeInput.sideParseError('start')).toBe(false);
    expect(rangeInput.sideParseError('end')).toBe(true);
    expect(rangeInput.shouldDisplayError()).toBe(true);
    expect(endField.value).toBe('nope');
  });

  it('leaves an end before the start alone - ordering is a validator concern', () => {
    typeAndBlur(startField, '07/23/2026, 17:30');
    typeAndBlur(endField, '07/08/2026, 09:00');

    expect(host.value()).toEqual({ start: '2026-07-23 17:30', end: '2026-07-08 09:00' });
  });

  it('displays a prefilled range in the combined display format', async () => {
    host.value.set({ start: '2026-12-24 09:15', end: '2026-12-26 18:00' });
    tick();
    await fixture.whenStable();

    expect(startField.value).toBe('12/24/2026, 09:15');
    expect(endField.value).toBe('12/26/2026, 18:00');
    expect(rangeInput.calendarRange()).toEqual({
      start: new Date(2026, 11, 24, 9, 15),
      end: new Date(2026, 11, 26, 18, 0),
    });
  });

  it('keeps each side time of day when a picked day range lands, and keeps the picker open', async () => {
    host.value.set({ start: '2026-12-24 09:15', end: '2026-12-26 18:00' });
    tick();

    await openPicker();

    paneButton('.pick-both-days')?.click();
    tick();

    expect(host.value()).toEqual({ start: '2026-07-08 09:15', end: '2026-07-23 18:00' });
    // a complete day range is only half a date-time range - the times are still to come
    expect(rangeInput.pickerOpen()).toBe(true);
    expect(rangeInput.touched()).toBe(true);
  });

  it('holds both days picked from an empty range until their times arrive', async () => {
    await openPicker();

    paneButton('.pick-both-days')?.click();
    tick();

    expect(host.value()).toEqual({ start: null, end: null });
    expect(rangeInput.hasValue()).toBe(true);
    expect(rangeInput.displayValue('start')).toBe('07/08/2026, __:__');
    expect(rangeInput.displayValue('end')).toBe('07/23/2026, __:__');
    expect(rangeInput.pickerDateRange()).toEqual({ start: host.pickStartDay, end: host.pickEndDay });
    expect(rangeInput.pickerTimeRange()).toEqual({ start: null, end: null });

    paneButton('.pick-start-time')?.click();
    tick();

    expect(host.value()).toEqual({ start: '2026-07-08 21:45', end: null });
    expect(rangeInput.displayValue('end')).toBe('07/23/2026, __:__');
  });

  it('clears held halves with the range', async () => {
    await openPicker();

    paneButton('.pick-both-days')?.click();
    tick();

    rangeInput.clearRange();
    tick();

    expect(rangeInput.displayValue('start')).toBe('');
    expect(rangeInput.hasValue()).toBe(false);
  });

  it('drops the end while the calendar reopens the range', async () => {
    host.value.set({ start: '2026-12-24 09:15', end: '2026-12-26 18:00' });
    tick();

    await openPicker();

    paneButton('.pick-start-day')?.click();
    tick();

    expect(host.value()).toEqual({ start: '2026-07-08 09:15', end: null });
  });

  it('merges a picked time into that side only', async () => {
    host.value.set({ start: '2026-12-24 09:15', end: '2026-12-26 18:00' });
    tick();

    await openPicker();

    paneButton('.pick-end-time')?.click();
    tick();

    expect(host.value()).toEqual({ start: '2026-12-24 09:15', end: '2026-12-26 21:45' });

    paneButton('.pick-start-time')?.click();
    tick();

    expect(host.value()).toEqual({ start: '2026-12-24 21:45', end: '2026-12-26 21:45' });
  });

  it("takes the other side's day for a time picked on a side with no day yet", async () => {
    typeAndBlur(startField, '07/08/2026, 09:00');

    await openPicker();

    paneButton('.pick-end-time')?.click();
    tick();

    // the end time of an appointment whose start day is known means that day, not today
    expect(host.value()).toEqual({ start: '2026-07-08 09:00', end: '2026-07-08 21:45' });
  });

  it('holds a time picked while the range is empty until a day arrives', async () => {
    await openPicker();

    paneButton('.pick-start-time')?.click();
    tick();

    expect(host.value()).toEqual({ start: null, end: null });
    expect(rangeInput.displayValue('start')).toBe('__/__/____, 21:45');
    expect(rangeInput.pickerTimeRange()).toEqual({ start: host.pickTime, end: null });

    paneButton('.pick-both-days')?.click();
    tick();

    // the held start time completes on the day it was waiting for; the end has none yet
    expect(host.value()).toEqual({ start: '2026-07-08 21:45', end: null });
    expect(rangeInput.displayValue('end')).toBe('07/23/2026, __:__');
  });

  it('keeps a time held for the end while the calendar has only its first day', async () => {
    await openPicker();

    paneButton('.pick-end-time')?.click();
    tick();

    // the calendar reports `end: null` for its whole first click - that says nothing about the time
    paneButton('.pick-start-day')?.click();
    tick();

    expect(rangeInput.displayValue('end')).toBe('__/__/____, 21:45');

    paneButton('.pick-both-days')?.click();
    tick();

    expect(host.value()).toEqual({ start: null, end: '2026-07-23 21:45' });
  });

  it('clears both sides', () => {
    typeAndBlur(startField, '07/08/2026, 09:00');
    typeAndBlur(endField, '07/23/2026, 17:30');

    rangeInput.clearRange();
    tick();

    expect(host.value()).toEqual({ start: null, end: null });
    expect(rangeInput.hasValue()).toBe(false);
    expect(startField.value).toBe('');
    expect(endField.value).toBe('');
  });

  it('opens the picker with Alt+ArrowDown from either field', async () => {
    endField.focus();
    endField.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    tick();
    await flushFrames();
    tick();

    expect(rangeInput.pickerOpen()).toBe(true);
  });

  it('ignores the trigger while disabled', () => {
    host.disabled.set(true);
    tick();

    expect(trigger.disabled).toBe(true);
    expect(startField.disabled).toBe(true);

    rangeInput.openPicker();
    tick();

    expect(rangeInput.pickerOpen()).toBe(false);
  });

  describe('mixed (bulk edit)', () => {
    const enterMixed = () => {
      host.value.set({ start: '2026-03-01 08:15', end: '2026-03-10 19:45' });
      host.mixed.set(true);
      tick();
    };

    it('renders both fields empty with the mixed label as placeholder', () => {
      enterMixed();

      expect(startField.value).toBe('');
      expect(endField.value).toBe('');
      expect(startField.getAttribute('placeholder')).toBe('Mixed');
      expect(rangeInput.calendarRange()).toEqual({ start: null, end: null });
      expect(rangeInput.hasValue()).toBe(true);
    });

    it('keeps mixed and the raw range on a failed typed parse', () => {
      enterMixed();
      typeAndBlur(startField, 'nope');

      expect(host.mixed()).toBe(true);
      expect(host.value()).toEqual({ start: '2026-03-01 08:15', end: '2026-03-10 19:45' });
      expect(rangeInput.parseError()).toBe(true);
    });

    it('starts a fresh range on the first typed commit - the hidden other side does not leak', () => {
      enterMixed();
      typeAndBlur(endField, '07/23/2026, 17:30');

      expect(host.mixed()).toBe(false);
      expect(host.value()).toEqual({ start: null, end: '2026-07-23 17:30' });
    });

    it('replaces on a picked time: no merge with the hidden day or the hidden other side', async () => {
      enterMixed();
      await openPicker();

      paneButton('.pick-start-time')?.click();
      tick();

      expect(host.mixed()).toBe(false);
      // neither the hidden 2026-03-01 nor the hidden end may survive the fresh pick
      expect(host.value()).toEqual({ start: null, end: null });
      expect(rangeInput.displayValue('start')).toBe('__/__/____, 21:45');
      expect(rangeInput.displayValue('end')).toBe('');
    });

    it('replaces on a picked day range: both days held, the hidden range gone', async () => {
      enterMixed();
      await openPicker();

      paneButton('.pick-both-days')?.click();
      tick();

      expect(host.mixed()).toBe(false);
      expect(host.value()).toEqual({ start: null, end: null });
      expect(rangeInput.displayValue('start')).toBe('07/08/2026, __:__');
      expect(rangeInput.displayValue('end')).toBe('07/23/2026, __:__');
    });
  });
});

describe('DateTimeRangeInputDirective mixed state', () => {
  describeMixedStateContract(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({ imports: [DateTimeRangeInputTestHost] });

    const fixture = TestBed.createComponent(DateTimeRangeInputTestHost);

    fixture.detectChanges();

    const rangeInput = fixture.debugElement.children[0]!.injector.get(DateTimeRangeInputDirective);
    const startField = fixture.nativeElement.querySelector('.start') as HTMLInputElement;
    const endField = fixture.nativeElement.querySelector('.end') as HTMLInputElement;
    const tick = () => TestBed.inject(ApplicationRef).tick();

    const typeAndBlur = (field: HTMLInputElement, text: string) => {
      field.focus();
      field.value = text;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      tick();
      field.blur();
      field.dispatchEvent(new Event('blur'));
      tick();
    };

    return {
      enterMixed: () => {
        fixture.componentInstance.value.set({ start: '2026-03-01 08:15', end: '2026-03-10 19:45' });
        fixture.componentInstance.mixed.set(true);
        tick();
      },
      rawValue: () => ({ start: '2026-03-01 08:15', end: '2026-03-10 19:45' }),
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => fixture.debugElement.children[0]!.nativeElement as HTMLElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set({ start: '2026-01-01 12:00', end: '2026-01-05 13:00' });
        tick();
      },
      externallyWrittenValue: () => ({ start: '2026-01-01 12:00', end: '2026-01-05 13:00' }),
      // replace semantics: the resolving commit starts a fresh range - no merge with the hidden end
      commit: () => typeAndBlur(startField, '07/20/2026, 14:30'),
      committedValue: () => ({ start: '2026-07-20 14:30', end: null }),
      assertMasked: () => {
        expect(rangeInput.calendarRange()).toEqual({ start: null, end: null });
        expect(startField.value).toBe('');
        expect(endField.value).toBe('');
        expect(startField.getAttribute('placeholder')).toBe('Mixed');
        expect(endField.getAttribute('placeholder')).toBe('Mixed');
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
