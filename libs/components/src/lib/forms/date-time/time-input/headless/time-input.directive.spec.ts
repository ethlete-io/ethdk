import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { InputMaskDirective } from '../../../masked-input/headless';
import { describeMixedStateContract } from '../../../testing/mixed-state-contract';
import { describePickerCommitContract } from '../../../testing/picker-commit-contract';
import { TimePickerColumnDirective } from '../../../../time-picker/headless/time-picker-column.directive';
import { TimePickerOptionDirective } from '../../../../time-picker/headless/time-picker-option.directive';
import { TimePickerDirective } from '../../../../time-picker/headless/time-picker.directive';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { TimeInputFieldDirective } from './time-input-field.directive';
import { TimeInputDirective } from './time-input.directive';
import { DatePickerDriver, mountDatePicker } from '../../../testing/date-picker-driver';
import { pressKey, tick } from '../../../../testing/driver-core';

@Component({
  template: `
    <div
      [(value)]="value"
      [(mixed)]="mixed"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [valueFormat]="valueFormat()"
      displayFormat="HH:mm"
      etTimeInput
    >
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
  readonly = signal(false);
  valueFormat = signal<string | undefined>(undefined);
}

describe('TimeInputDirective', () => {
  let driver: DatePickerDriver<TimeInputTestHost, TimeInputDirective>;

  const pickOption = (unit: string, value: number) =>
    driver.clickInPane(`[data-unit='${unit}'] [data-value='${value}']`);

  beforeEach(() => {
    driver = mountDatePicker(TimeInputTestHost, TimeInputDirective);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('commits a strict displayFormat parse on blur', () => {
    driver.typeAndBlur('09:30');

    expect(driver.host.value()).toBe('09:30');
    expect(driver.control.parseError()).toBe(false);
    expect(driver.field().value).toBe('09:30');
    expect(driver.control.touched()).toBe(true);
  });

  it('commits lenient entry and reformats it', () => {
    driver.typeAndBlur('930');

    expect(driver.host.value()).toBe('09:30');
    expect(driver.field().value).toBe('09:30');

    driver.typeAndBlur('9pm');

    expect(driver.host.value()).toBe('21:00');
    expect(driver.field().value).toBe('21:00');
  });

  it('commits and reformats on Enter without losing focus', () => {
    driver.type('930');
    driver.pressInField('Enter');

    expect(driver.host.value()).toBe('09:30');
    expect(driver.field().value).toBe('09:30');
  });

  it('keeps unparseable text visible and raises parseError with a null value', () => {
    driver.typeAndBlur('09:30');
    driver.typeAndBlur('not a time');

    expect(driver.host.value()).toBeNull();
    expect(driver.control.parseError()).toBe(true);
    expect(driver.control.shouldDisplayError()).toBe(true);
    expect(driver.field().value).toBe('not a time');
    expect(driver.control.hasValue()).toBe(true);
  });

  it('clears the value on empty input', () => {
    driver.typeAndBlur('09:30');
    driver.typeAndBlur('');

    expect(driver.host.value()).toBeNull();
    expect(driver.control.parseError()).toBe(false);
    expect(driver.control.hasValue()).toBe(false);
  });

  it('displays a prefilled value in the display format', async () => {
    driver.host.value.set('14:05');
    tick();
    await driver.fixture.whenStable();

    expect(driver.field().value).toBe('14:05');
    expect(driver.control.time()?.getHours()).toBe(14);
    expect(driver.control.time()?.getMinutes()).toBe(5);
  });

  it('opens the picker from the trigger and keeps it open across part picks', async () => {
    expect(driver.trigger().getAttribute('aria-expanded')).toBe('false');

    await driver.open();

    expect(driver.control.pickerOpen()).toBe(true);
    expect(driver.trigger().getAttribute('aria-expanded')).toBe('true');

    pickOption('hour', 9);

    // the hour alone is held by the picker - no minute nobody picked reaches the field
    expect(driver.host.value()).toBeNull();
    expect(driver.control.pickerOpen()).toBe(true);

    pickOption('minute', 30);

    expect(driver.host.value()).toBe('09:30');
    expect(driver.control.pickerOpen()).toBe(true);
    expect(driver.control.touched()).toBe(true);
  });

  it('reflects a picked value in the field after closing', async () => {
    await driver.open();

    pickOption('hour', 9);
    pickOption('minute', 30);

    driver.control.closePicker();
    tick();
    await driver.settle();

    expect(driver.field().value).toBe('09:30');
  });

  it('closes the picker on an outside pointerdown', async () => {
    await driver.open();

    driver.pointerDownOutside();
    await driver.settle();

    expect(driver.control.pickerOpen()).toBe(false);
  });

  it('opens the picker with Alt+ArrowDown from the field', async () => {
    driver.field().focus();
    pressKey(driver.field(), 'ArrowDown', { altKey: true });
    await driver.settle();

    expect(driver.control.pickerOpen()).toBe(true);
  });

  it('ignores the trigger while disabled', async () => {
    driver.host.disabled.set(true);
    tick();

    expect(driver.trigger<HTMLButtonElement>().disabled).toBe(true);

    driver.control.openPicker();
    tick();

    expect(driver.control.pickerOpen()).toBe(false);
  });

  describe('mixed (bulk edit)', () => {
    const enterMixed = () => {
      driver.host.value.set('14:20');
      driver.host.mixed.set(true);
      tick();
    };

    it('renders the field empty with the mixed label as placeholder', () => {
      enterMixed();

      expect(driver.field().value).toBe('');
      expect(driver.field().getAttribute('placeholder')).toBe('Mixed');
      expect(driver.control.displayValue()).toBe('');
      expect(driver.control.hasValue()).toBe(true);
    });

    it('keeps mixed and the raw value on a failed typed parse', () => {
      enterMixed();
      driver.typeAndBlur('not a time');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toBe('14:20');
      expect(driver.control.parseError()).toBe(true);
      expect(driver.field().value).toBe('not a time');
    });

    it('keeps mixed and the raw value on a blank blur commit', () => {
      enterMixed();
      driver.typeAndBlur('');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toBe('14:20');
    });

    it('gives the picker no selected time and leaves mixed set on open; a pick replaces and resolves', async () => {
      enterMixed();

      expect(driver.control.time()).toBeNull();

      await driver.open();

      expect(driver.host.mixed()).toBe(true);

      pickOption('hour', 9);
      pickOption('minute', 30);

      expect(driver.host.mixed()).toBe(false);
      // replace semantics: the hidden 14:20 does not leak into the picked time
      expect(driver.host.value()).toBe('09:30');
    });
  });
});

describe('TimeInputDirective mixed state', () => {
  describeMixedStateContract(() => {
    const driver = mountDatePicker(TimeInputTestHost, TimeInputDirective);

    return {
      enterMixed: () => {
        driver.host.value.set('14:20');
        driver.host.mixed.set(true);
        tick();
      },
      rawValue: () => '14:20',
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.element(),
      writeValueExternally: () => {
        driver.host.value.set('10:00');
        tick();
      },
      externallyWrittenValue: () => '10:00',
      resolveMixedFromConsumer: () => {
        driver.host.mixed.set(false);
        tick();
      },
      mixedLabel: () => 'Mixed',
      mixedDisplayText: () => driver.field().placeholder,
      commit: () => driver.typeAndBlur('09:30'),
      committedValue: () => '09:30',
      assertMasked: () => {
        expect(driver.control.time()).toBeNull();
        expect(driver.control.displayValue()).toBe('');
        expect(driver.field().value).toBe('');
        expect(driver.field().getAttribute('placeholder')).toBe('Mixed');
      },
      clear: () => {
        driver.control.clearValue();
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

describe('TimeInputDirective commit contract', () => {
  describePickerCommitContract(() => {
    // a wire format carrying seconds against an HH:mm display is what makes an unedited blur
    // observable: re-parsing "14:30" would write back a zeroed second
    const driver = mountDatePicker(TimeInputTestHost, TimeInputDirective);

    driver.host.valueFormat.set('HH:mm:ss');
    driver.host.value.set('14:30:45');
    tick();

    return {
      commitValue: () => tick(),
      committedValue: () => '14:30:45',
      emptyValue: () => null,
      value: () => driver.host.value(),
      parseError: () => driver.control.parseError(),
      focus: () => driver.focusField(),
      blur: () => driver.blurField(),
      typeAndBlur: (text: string) => driver.typeAndBlur(text),
      makeReadonly: () => {
        driver.host.readonly.set(true);
        tick();
      },
    };
  });
});
