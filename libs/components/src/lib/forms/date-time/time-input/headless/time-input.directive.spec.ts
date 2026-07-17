import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { TimePickerColumnDirective } from '../../../../time-picker/headless/time-picker-column.directive';
import { TimePickerOptionDirective } from '../../../../time-picker/headless/time-picker-option.directive';
import { TimePickerDirective } from '../../../../time-picker/headless/time-picker.directive';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { TimeInputFieldDirective } from './time-input-field.directive';
import { TimeInputDirective } from './time-input.directive';

@Component({
  template: `
    <div [(value)]="value" [disabled]="disabled()" displayFormat="HH:mm" etTimeInput>
      <input etTimeInputField />
      <button class="open-picker" etDatePickerTrigger>open</button>

      <ng-template etDatePickerSurface let-timeInput>
        <div
          #picker="etTimePicker"
          [value]="timeInput.time()"
          (valueChange)="timeInput.selectTime($event)"
          etTimePicker
        >
          @for (column of picker.columns(); track column.unit) {
            <div [column]="column" [attr.data-unit]="column.unit" etTimePickerColumn>
              @for (option of column.options; track option.value) {
                <button [option]="option" [attr.data-value]="option.value" etTimePickerOption>
                  {{ option.label }}
                </button>
              }
            </div>
          }
        </div>
      </ng-template>
    </div>
  `,
  imports: [
    TimeInputDirective,
    TimeInputFieldDirective,
    DatePickerTriggerDirective,
    DatePickerSurfaceDirective,
    TimePickerDirective,
    TimePickerColumnDirective,
    TimePickerOptionDirective,
  ],
})
class TimeInputTestHost {
  value = signal<string | null>(null);
  disabled = signal(false);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('TimeInputDirective', () => {
  let fixture: ComponentFixture<TimeInputTestHost>;
  let host: TimeInputTestHost;
  let timeInput: TimeInputDirective;
  let field: HTMLInputElement;
  let trigger: HTMLButtonElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  // overlays render into the document — scope queries to the newest pane so a pane
  // stuck in its leave transition (jsdom fires no transition events) can't pollute them
  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;
  const pickerOption = (unit: string, value: number) =>
    pane()?.querySelector<HTMLButtonElement>(`[data-unit='${unit}'] [data-value='${value}']`) ?? null;

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

    TestBed.configureTestingModule({ imports: [TimeInputTestHost] });
    fixture = TestBed.createComponent(TimeInputTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    timeInput = fixture.debugElement.children[0]!.injector.get(TimeInputDirective);
    field = fixture.nativeElement.querySelector('input');
    trigger = fixture.nativeElement.querySelector('.open-picker');
  });

  afterEach(async () => {
    timeInput.closePicker();
    tick();
    await flushFrames();
  });

  it('commits a strict displayFormat parse on blur', () => {
    typeAndBlur('09:30');

    expect(host.value()).toBe('09:30');
    expect(timeInput.parseError()).toBe(false);
    expect(field.value).toBe('09:30');
    expect(timeInput.touched()).toBe(true);
  });

  it('commits lenient entry and reformats it', () => {
    typeAndBlur('930');

    expect(host.value()).toBe('09:30');
    expect(field.value).toBe('09:30');

    typeAndBlur('9pm');

    expect(host.value()).toBe('21:00');
    expect(field.value).toBe('21:00');
  });

  it('commits and reformats on Enter without losing focus', () => {
    field.focus();
    field.value = '930';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    tick();
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    tick();

    expect(host.value()).toBe('09:30');
    expect(field.value).toBe('09:30');
  });

  it('keeps unparseable text visible and raises parseError with a null value', () => {
    typeAndBlur('09:30');
    typeAndBlur('not a time');

    expect(host.value()).toBeNull();
    expect(timeInput.parseError()).toBe(true);
    expect(timeInput.shouldDisplayError()).toBe(true);
    expect(field.value).toBe('not a time');
    expect(timeInput.hasValue()).toBe(true);
  });

  it('clears the value on empty input', () => {
    typeAndBlur('09:30');
    typeAndBlur('');

    expect(host.value()).toBeNull();
    expect(timeInput.parseError()).toBe(false);
    expect(timeInput.hasValue()).toBe(false);
  });

  it('displays a prefilled value in the display format', async () => {
    host.value.set('14:05');
    tick();
    await fixture.whenStable();

    expect(field.value).toBe('14:05');
    expect(timeInput.time()?.getHours()).toBe(14);
    expect(timeInput.time()?.getMinutes()).toBe(5);
  });

  it('opens the picker from the trigger and keeps it open across part picks', async () => {
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await openPicker();

    expect(timeInput.pickerOpen()).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    pickerOption('hour', 9)?.click();
    tick();

    expect(host.value()).not.toBeNull();
    expect(host.value()?.startsWith('09:')).toBe(true);
    expect(timeInput.pickerOpen()).toBe(true);

    pickerOption('minute', 30)?.click();
    tick();

    expect(host.value()).toBe('09:30');
    expect(timeInput.pickerOpen()).toBe(true);
    expect(timeInput.touched()).toBe(true);
  });

  it('reflects a picked value in the field after closing', async () => {
    await openPicker();

    pickerOption('hour', 9)?.click();
    pickerOption('minute', 30)?.click();
    tick();

    timeInput.closePicker();
    tick();
    await flushFrames();
    tick();

    expect(field.value).toBe('09:30');
  });

  it('closes the picker on an outside pointerdown', async () => {
    await openPicker();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    tick();
    await flushFrames();

    expect(timeInput.pickerOpen()).toBe(false);
  });

  it('opens the picker with Alt+ArrowDown from the field', async () => {
    field.focus();
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    tick();
    await flushFrames();
    tick();

    expect(timeInput.pickerOpen()).toBe(true);
  });

  it('ignores the trigger while disabled', async () => {
    host.disabled.set(true);
    tick();

    expect(trigger.disabled).toBe(true);

    timeInput.openPicker();
    tick();

    expect(timeInput.pickerOpen()).toBe(false);
  });
});
