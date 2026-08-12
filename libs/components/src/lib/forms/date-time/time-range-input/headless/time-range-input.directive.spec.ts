import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { describeMixedStateContract } from '../../../testing/mixed-state-contract';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { TimeRangeInputFieldDirective } from './time-range-input-field.directive';
import { TimeRangeInputDirective, TimeRangeValue } from './time-range-input.directive';

@Component({
  template: `
    <div
      [(value)]="value"
      [(mixed)]="mixed"
      [disabled]="disabled()"
      displayFormat="HH:mm"
      etTimeRangeInput
      valueFormat="HH:mm"
    >
      <input class="start" etTimeRangeInputField side="start" />
      <input class="end" etTimeRangeInputField side="end" />
      <button class="open-picker" etDatePickerTrigger>open</button>

      <ng-template etDatePickerSurface let-rangeInput>
        <button (click)="rangeInput.selectTime('start', pickTime)" class="pick-start-time" type="button">
          start time
        </button>
        <button (click)="rangeInput.selectTime('end', pickTime)" class="pick-end-time" type="button">end time</button>
      </ng-template>
    </div>
  `,
  imports: [
    TimeRangeInputDirective,
    TimeRangeInputFieldDirective,
    DatePickerTriggerDirective,
    DatePickerSurfaceDirective,
  ],
})
class TimeRangeInputTestHost {
  value = signal<TimeRangeValue>({ start: null, end: null });
  mixed = signal(false);
  disabled = signal(false);
  pickTime = new Date(2026, 0, 1, 21, 45);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** The wire values parse against today, so expectations about `Date`s have to be built on it too. */
const today = (hours: number, minutes: number) => {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
};

describe('TimeRangeInputDirective', () => {
  let fixture: ComponentFixture<TimeRangeInputTestHost>;
  let host: TimeRangeInputTestHost;
  let rangeInput: TimeRangeInputDirective;
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

    TestBed.configureTestingModule({ imports: [TimeRangeInputTestHost] });
    fixture = TestBed.createComponent(TimeRangeInputTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    rangeInput = fixture.debugElement.children[0]!.injector.get(TimeRangeInputDirective);
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
    typeAndBlur(startField, '09:00');

    expect(host.value()).toEqual({ start: '09:00', end: null });

    typeAndBlur(endField, '17:30');

    expect(host.value()).toEqual({ start: '09:00', end: '17:30' });
    expect(rangeInput.parseError()).toBe(false);
    expect(rangeInput.touched()).toBe(true);
  });

  it('commits lenient entry per side and reformats it', () => {
    typeAndBlur(startField, '930');

    expect(host.value().start).toBe('09:30');
    expect(startField.value).toBe('09:30');

    typeAndBlur(endField, '930pm');

    expect(host.value().end).toBe('21:30');
    expect(endField.value).toBe('21:30');
  });

  it('tracks a per-side parse error without touching the other side', () => {
    typeAndBlur(startField, '09:00');
    typeAndBlur(endField, 'nope');

    expect(host.value()).toEqual({ start: '09:00', end: null });
    expect(rangeInput.sideParseError('start')).toBe(false);
    expect(rangeInput.sideParseError('end')).toBe(true);
    expect(rangeInput.shouldDisplayError()).toBe(true);
    expect(endField.value).toBe('nope');
  });

  it('leaves an end before the start alone - ordering is a validator concern', () => {
    typeAndBlur(startField, '17:30');
    typeAndBlur(endField, '09:00');

    expect(host.value()).toEqual({ start: '17:30', end: '09:00' });
  });

  it('displays a prefilled range in the display format', async () => {
    host.value.set({ start: '09:15', end: '18:00' });
    tick();
    await fixture.whenStable();

    expect(startField.value).toBe('09:15');
    expect(endField.value).toBe('18:00');
    expect(rangeInput.calendarRange()).toEqual({ start: today(9, 15), end: today(18, 0) });
  });

  it('commits a picked time into that side only, and keeps the picker open', async () => {
    host.value.set({ start: '09:15', end: '18:00' });
    tick();

    await openPicker();

    paneButton('.pick-end-time')?.click();
    tick();

    expect(host.value()).toEqual({ start: '09:15', end: '21:45' });
    // one end filled is only half a range - the other is still to come
    expect(rangeInput.pickerOpen()).toBe(true);
    expect(rangeInput.touched()).toBe(true);

    paneButton('.pick-start-time')?.click();
    tick();

    expect(host.value()).toEqual({ start: '21:45', end: '21:45' });
  });

  it('clears both sides', () => {
    typeAndBlur(startField, '09:00');
    typeAndBlur(endField, '17:30');

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
      host.value.set({ start: '08:15', end: '19:45' });
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
      expect(host.value()).toEqual({ start: '08:15', end: '19:45' });
      expect(rangeInput.parseError()).toBe(true);
    });

    it('starts a fresh range on the first typed commit - the hidden other side does not leak', () => {
      enterMixed();
      typeAndBlur(endField, '17:30');

      expect(host.mixed()).toBe(false);
      expect(host.value()).toEqual({ start: null, end: '17:30' });
    });

    it('replaces on a picked time: the hidden other side does not survive', async () => {
      enterMixed();
      await openPicker();

      paneButton('.pick-start-time')?.click();
      tick();

      expect(host.mixed()).toBe(false);
      expect(host.value()).toEqual({ start: '21:45', end: null });
    });
  });
});

describe('TimeRangeInputDirective mixed state', () => {
  describeMixedStateContract(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({ imports: [TimeRangeInputTestHost] });

    const fixture = TestBed.createComponent(TimeRangeInputTestHost);

    fixture.detectChanges();

    const rangeInput = fixture.debugElement.children[0]!.injector.get(TimeRangeInputDirective);
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
        fixture.componentInstance.value.set({ start: '08:15', end: '19:45' });
        fixture.componentInstance.mixed.set(true);
        tick();
      },
      rawValue: () => ({ start: '08:15', end: '19:45' }),
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => fixture.debugElement.children[0]!.nativeElement as HTMLElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set({ start: '12:00', end: '13:00' });
        tick();
      },
      externallyWrittenValue: () => ({ start: '12:00', end: '13:00' }),
      // replace semantics: the resolving commit starts a fresh range - no merge with the hidden end
      commit: () => typeAndBlur(startField, '14:30'),
      committedValue: () => ({ start: '14:30', end: null }),
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
