import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { DateRangeInputFieldDirective } from './date-range-input-field.directive';
import { DateRangeInputDirective, DateRangeValue } from './date-range-input.directive';

@Component({
  template: `
    <div [(value)]="value" [disabled]="disabled()" valueFormat="yyyy-MM-dd" etDateRangeInput>
      <input class="start" etDateRangeInputField side="start" />
      <input class="end" etDateRangeInputField side="end" />
      <button class="open-picker" etDatePickerTrigger>open</button>

      <ng-template etDatePickerSurface let-rangeInput>
        <button
          (click)="rangeInput.selectCalendarRange({ start: pickStart, end: null })"
          class="pick-start"
          type="button"
        >
          start
        </button>
        <button
          (click)="rangeInput.selectCalendarRange({ start: pickStart, end: pickEnd })"
          class="pick-full"
          type="button"
        >
          full
        </button>
      </ng-template>
    </div>
  `,
  imports: [
    DateRangeInputDirective,
    DateRangeInputFieldDirective,
    DatePickerTriggerDirective,
    DatePickerSurfaceDirective,
  ],
})
class DateRangeInputTestHost {
  value = signal<DateRangeValue>({ start: null, end: null });
  disabled = signal(false);
  pickStart = new Date(2026, 6, 8);
  pickEnd = new Date(2026, 6, 23);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('DateRangeInputDirective', () => {
  let fixture: ComponentFixture<DateRangeInputTestHost>;
  let host: DateRangeInputTestHost;
  let rangeInput: DateRangeInputDirective;
  let startField: HTMLInputElement;
  let endField: HTMLInputElement;
  let trigger: HTMLButtonElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;

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

    TestBed.configureTestingModule({ imports: [DateRangeInputTestHost] });
    fixture = TestBed.createComponent(DateRangeInputTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    rangeInput = fixture.debugElement.children[0]!.injector.get(DateRangeInputDirective);
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
    typeAndBlur(startField, '07/08/2026');

    expect(host.value()).toEqual({ start: '2026-07-08', end: null });

    typeAndBlur(endField, '07/23/2026');

    expect(host.value()).toEqual({ start: '2026-07-08', end: '2026-07-23' });
    expect(startField.value).toBe('07/08/2026');
    expect(endField.value).toBe('07/23/2026');
    expect(rangeInput.touched()).toBe(true);
  });

  it('tracks a per-side parse error without touching the other side', () => {
    typeAndBlur(startField, '07/08/2026');
    typeAndBlur(endField, 'garbage');

    expect(host.value()).toEqual({ start: '2026-07-08', end: null });
    expect(rangeInput.startParseError()).toBe(false);
    expect(rangeInput.endParseError()).toBe(true);
    expect(rangeInput.parseError()).toBe(true);
    expect(rangeInput.shouldDisplayError()).toBe(true);
    expect(endField.value).toBe('garbage');
    expect(rangeInput.hasValue()).toBe(true);
  });

  it('clears a side on empty input', () => {
    typeAndBlur(startField, '07/08/2026');
    typeAndBlur(startField, '');

    expect(host.value()).toEqual({ start: null, end: null });
    expect(rangeInput.hasValue()).toBe(false);
  });

  it('commits and reformats on Enter', () => {
    startField.focus();
    startField.value = '7/8/2026';
    startField.dispatchEvent(new Event('input', { bubbles: true }));
    tick();
    startField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    tick();

    expect(host.value().start).toBe('2026-07-08');
    expect(startField.value).toBe('07/08/2026');
  });

  it('displays a prefilled range in the display format', async () => {
    host.value.set({ start: '2026-07-08', end: '2026-07-23' });
    tick();
    await fixture.whenStable();

    expect(startField.value).toBe('07/08/2026');
    expect(endField.value).toBe('07/23/2026');
    expect(rangeInput.calendarRange()).toEqual({ start: new Date(2026, 6, 8), end: new Date(2026, 6, 23) });
  });

  it('reflects focus of either field into the focused signal', () => {
    expect(rangeInput.focused()).toBe(false);

    startField.focus();
    startField.dispatchEvent(new Event('focus'));
    tick();

    expect(rangeInput.focusedSide()).toBe('start');
    expect(rangeInput.focused()).toBe(true);

    startField.dispatchEvent(new Event('blur'));
    tick();

    expect(rangeInput.focused()).toBe(false);
  });

  it('keeps the picker open for a partial pick and closes it on a completed range', async () => {
    await openPicker();

    expect(rangeInput.pickerOpen()).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    pane()?.querySelector<HTMLButtonElement>('.pick-start')?.click();
    tick();
    await flushFrames();

    expect(host.value()).toEqual({ start: '2026-07-08', end: null });
    expect(rangeInput.pickerOpen()).toBe(true);

    pane()?.querySelector<HTMLButtonElement>('.pick-full')?.click();
    tick();
    await flushFrames();
    tick();

    expect(host.value()).toEqual({ start: '2026-07-08', end: '2026-07-23' });
    expect(rangeInput.pickerOpen()).toBe(false);
    expect(startField.value).toBe('07/08/2026');
    expect(endField.value).toBe('07/23/2026');
  });

  it('closes the picker on an outside pointerdown', async () => {
    await openPicker();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    tick();
    await flushFrames();

    expect(rangeInput.pickerOpen()).toBe(false);
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
});
