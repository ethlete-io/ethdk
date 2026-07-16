import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { DateInputFieldDirective } from './date-input-field.directive';
import { DateInputDirective } from './date-input.directive';

@Component({
  template: `
    <div [(value)]="value" [disabled]="disabled()" valueFormat="yyyy-MM-dd" etDateInput>
      <input etDateInputField />
      <button class="open-picker" etDatePickerTrigger>open</button>

      <ng-template etDatePickerSurface let-dateInput>
        <button (click)="dateInput.selectDate(pickDate)" class="pick-date" type="button">pick</button>
      </ng-template>
    </div>
  `,
  imports: [DateInputDirective, DateInputFieldDirective, DatePickerTriggerDirective, DatePickerSurfaceDirective],
})
class DateInputTestHost {
  value = signal<string | null>(null);
  disabled = signal(false);
  pickDate = new Date(2026, 6, 16);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('DateInputDirective', () => {
  let fixture: ComponentFixture<DateInputTestHost>;
  let host: DateInputTestHost;
  let dateInput: DateInputDirective;
  let field: HTMLInputElement;
  let trigger: HTMLButtonElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  // overlays render into the document — scope queries to the newest pane so a pane
  // stuck in its leave transition (jsdom fires no transition events) can't pollute them
  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;
  const pickButton = () => pane()?.querySelector<HTMLButtonElement>('.pick-date') ?? null;

  const typeAndBlur = (text: string) => {
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

    TestBed.configureTestingModule({ imports: [DateInputTestHost] });
    fixture = TestBed.createComponent(DateInputTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    dateInput = fixture.debugElement.children[0]!.injector.get(DateInputDirective);
    field = fixture.nativeElement.querySelector('input');
    trigger = fixture.nativeElement.querySelector('.open-picker');
  });

  afterEach(async () => {
    dateInput.closePicker();
    tick();
    await flushFrames();
  });

  it('commits a strict displayFormat parse on blur', () => {
    typeAndBlur('07/16/2026');

    expect(host.value()).toBe('2026-07-16');
    expect(dateInput.parseError()).toBe(false);
    expect(field.value).toBe('07/16/2026');
    expect(dateInput.touched()).toBe(true);
  });

  it('commits and reformats on Enter without losing focus', () => {
    field.focus();
    field.value = '7/16/2026';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    tick();
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    tick();

    expect(host.value()).toBe('2026-07-16');
    expect(field.value).toBe('07/16/2026');
  });

  it('keeps unparseable text visible and raises parseError with a null value', () => {
    typeAndBlur('07/16/2026');
    typeAndBlur('not a date');

    expect(host.value()).toBeNull();
    expect(dateInput.parseError()).toBe(true);
    expect(dateInput.shouldDisplayError()).toBe(true);
    expect(field.value).toBe('not a date');
    expect(dateInput.hasValue()).toBe(true);
  });

  it('clears the value on empty input', () => {
    typeAndBlur('07/16/2026');
    typeAndBlur('');

    expect(host.value()).toBeNull();
    expect(dateInput.parseError()).toBe(false);
    expect(dateInput.hasValue()).toBe(false);
  });

  it('displays a prefilled value in the display format', async () => {
    host.value.set('2026-12-24');
    tick();
    await fixture.whenStable();

    expect(field.value).toBe('12/24/2026');
    expect(dateInput.date()).toEqual(new Date(2026, 11, 24));
  });

  it('opens the picker from the trigger and commits a picked date', async () => {
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await openPicker();

    expect(dateInput.pickerOpen()).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(pickButton()).not.toBeNull();

    pickButton()?.click();
    tick();
    await flushFrames();
    tick();

    expect(host.value()).toBe('2026-07-16');
    expect(dateInput.pickerOpen()).toBe(false);
    expect(field.value).toBe('07/16/2026');
  });

  it('closes the picker on an outside pointerdown', async () => {
    await openPicker();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    tick();
    await flushFrames();

    expect(dateInput.pickerOpen()).toBe(false);
  });

  it('opens the picker with Alt+ArrowDown from the field', async () => {
    field.focus();
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    tick();
    await flushFrames();
    tick();

    expect(dateInput.pickerOpen()).toBe(true);
  });

  it('ignores the trigger while disabled', async () => {
    host.disabled.set(true);
    tick();

    expect(trigger.disabled).toBe(true);

    dateInput.openPicker();
    tick();

    expect(dateInput.pickerOpen()).toBe(false);
  });
});
