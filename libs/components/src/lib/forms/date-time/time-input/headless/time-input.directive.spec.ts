import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { InputMaskDirective } from '../../../masked-input/headless';
import { describeMixedStateContract } from '../../../testing/mixed-state-contract';
import { TimePickerColumnDirective } from '../../../../time-picker/headless/time-picker-column.directive';
import { TimePickerOptionDirective } from '../../../../time-picker/headless/time-picker-option.directive';
import { TimePickerDirective } from '../../../../time-picker/headless/time-picker.directive';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { TimeInputFieldDirective } from './time-input-field.directive';
import { TimeInputDirective } from './time-input.directive';

@Component({
  template: `
    <div [(value)]="value" [(mixed)]="mixed" [disabled]="disabled()" displayFormat="HH:mm" etTimeInput>
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
  mixed = signal(false);
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

  // overlays render into the document - scope queries to the newest pane so a pane
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

    // the hour alone is held by the picker - no minute nobody picked reaches the field
    expect(host.value()).toBeNull();
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

  describe('mixed (bulk edit)', () => {
    const enterMixed = () => {
      host.value.set('14:20');
      host.mixed.set(true);
      tick();
    };

    it('renders the field empty with the mixed label as placeholder', () => {
      enterMixed();

      expect(field.value).toBe('');
      expect(field.getAttribute('placeholder')).toBe('Mixed');
      expect(timeInput.displayValue()).toBe('');
      expect(timeInput.hasValue()).toBe(true);
    });

    it('keeps mixed and the raw value on a failed typed parse', () => {
      enterMixed();
      typeAndBlur('not a time');

      expect(host.mixed()).toBe(true);
      expect(host.value()).toBe('14:20');
      expect(timeInput.parseError()).toBe(true);
      expect(field.value).toBe('not a time');
    });

    it('keeps mixed and the raw value on a blank blur commit', () => {
      enterMixed();
      typeAndBlur('');

      expect(host.mixed()).toBe(true);
      expect(host.value()).toBe('14:20');
    });

    it('gives the picker no selected time and leaves mixed set on open; a pick replaces and resolves', async () => {
      enterMixed();

      expect(timeInput.time()).toBeNull();

      await openPicker();

      expect(host.mixed()).toBe(true);

      pickerOption('hour', 9)?.click();
      pickerOption('minute', 30)?.click();
      tick();

      expect(host.mixed()).toBe(false);
      // replace semantics: the hidden 14:20 does not leak into the picked time
      expect(host.value()).toBe('09:30');
    });
  });
});

describe('TimeInputDirective mixed state', () => {
  describeMixedStateContract(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({ imports: [TimeInputTestHost] });

    const fixture = TestBed.createComponent(TimeInputTestHost);

    fixture.detectChanges();

    const timeInput = fixture.debugElement.children[0]!.injector.get(TimeInputDirective);
    const field = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const tick = () => TestBed.inject(ApplicationRef).tick();

    const typeAndBlur = (text: string) => {
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
        fixture.componentInstance.value.set('14:20');
        fixture.componentInstance.mixed.set(true);
        tick();
      },
      rawValue: () => '14:20',
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => fixture.debugElement.children[0]!.nativeElement as HTMLElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set('10:00');
        tick();
      },
      externallyWrittenValue: () => '10:00',
      commit: () => typeAndBlur('09:30'),
      committedValue: () => '09:30',
      assertMasked: () => {
        expect(timeInput.time()).toBeNull();
        expect(timeInput.displayValue()).toBe('');
        expect(field.value).toBe('');
        expect(field.getAttribute('placeholder')).toBe('Mixed');
      },
      clear: () => {
        timeInput.clearValue();
        tick();
      },
      emptyValue: () => null,
    };
  });
});

@Component({
  template: `
    <div #timeInput="etTimeInput" [(value)]="value" displayFormat="HH:mm" etTimeInput mask>
      <input [etInputMask]="timeInput.maskPattern()" etTimeInputField maskValueMode="masked" placeholderChar="_" />
    </div>
  `,
  imports: [TimeInputDirective, TimeInputFieldDirective, InputMaskDirective],
})
class MaskedTimeInputTestHost {
  value = signal<string | null>(null);
}

describe('TimeInputDirective with the opt-in typing mask', () => {
  it('derives the pattern from the display format, shapes typing and commits on blur', async () => {
    TestBed.configureTestingModule({ imports: [MaskedTimeInputTestHost] });

    const fixture = TestBed.createComponent(MaskedTimeInputTestHost);

    fixture.detectChanges();
    await fixture.whenStable();

    const timeInput = fixture.debugElement.children[0]!.injector.get(TimeInputDirective);
    const field = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(timeInput.maskPattern()).toBe('00:00');

    field.focus();
    field.dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();

    for (const char of '0930') {
      const caret = field.selectionStart ?? field.value.length;

      field.value = field.value.slice(0, caret) + char + field.value.slice(caret);
      field.setSelectionRange(caret + 1, caret + 1);
      field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      await fixture.whenStable();
    }

    expect(field.value).toBe('09:30');

    field.blur();
    field.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('09:30');
    expect(timeInput.parseError()).toBe(false);
  });
});
