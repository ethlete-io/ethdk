import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField, form, required } from '@angular/forms/signals';
import '../../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../../form-field/headless';
import { InputMaskDirective } from '../../../masked-input/headless';
import { silenceExpectedConsole } from '../../../../testing/expected-console';
import { pressKey, tick } from '../../../../testing/driver-core';
import { DatePickerDriver, mountDatePicker } from '../../../testing/date-picker-driver';
import { describeMixedStateContract } from '../../../testing/mixed-state-contract';
import { describePickerCommitContract } from '../../../testing/picker-commit-contract';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { DateRangeInputFieldDirective } from './date-range-input-field.directive';
import { DateRangeInputDirective, DateRangeValue } from './date-range-input.directive';
import { CalendarPrecision } from '../../../../calendar/headless';

@Component({
  template: `
    <div
      [(value)]="value"
      [(mixed)]="mixed"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [precision]="precision()"
      [valueFormat]="valueFormat()"
      etDateRangeInput
    >
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
  mixed = signal(false);
  disabled = signal(false);
  readonly = signal(false);
  valueFormat = signal('yyyy-MM-dd');
  precision = signal<CalendarPrecision>('day');
  pickStart = new Date(2026, 6, 8);
  pickEnd = new Date(2026, 6, 23);
}

describe('DateRangeInputDirective', () => {
  let driver: DatePickerDriver<DateRangeInputTestHost, DateRangeInputDirective>;

  beforeEach(() => {
    driver = mountDatePicker(DateRangeInputTestHost, DateRangeInputDirective);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('commits each side independently on blur', () => {
    driver.typeAndBlur('07/08/2026', '.start');

    expect(driver.host.value()).toEqual({ start: '2026-07-08', end: null });

    driver.typeAndBlur('07/23/2026', '.end');

    expect(driver.host.value()).toEqual({ start: '2026-07-08', end: '2026-07-23' });
    expect(driver.field('.start').value).toBe('07/08/2026');
    expect(driver.field('.end').value).toBe('07/23/2026');
    expect(driver.control.touched()).toBe(true);
  });

  it('tracks a per-side parse error without touching the other side', () => {
    driver.typeAndBlur('07/08/2026', '.start');
    driver.typeAndBlur('garbage', '.end');

    expect(driver.host.value()).toEqual({ start: '2026-07-08', end: null });
    expect(driver.control.startParseError()).toBe(false);
    expect(driver.control.endParseError()).toBe(true);
    expect(driver.control.parseError()).toBe(true);
    expect(driver.control.shouldDisplayError()).toBe(true);
    expect(driver.field('.end').value).toBe('garbage');
    expect(driver.control.hasValue()).toBe(true);
  });

  it('clears a side on empty input', () => {
    driver.typeAndBlur('07/08/2026', '.start');
    driver.typeAndBlur('', '.start');

    expect(driver.host.value()).toEqual({ start: null, end: null });
    expect(driver.control.hasValue()).toBe(false);
  });

  it('commits and reformats on Enter', () => {
    driver.type('7/8/2026', '.start');
    driver.pressInField('Enter', '.start');

    expect(driver.host.value().start).toBe('2026-07-08');
    expect(driver.field('.start').value).toBe('07/08/2026');
  });

  it('displays a prefilled range in the display format', async () => {
    driver.host.value.set({ start: '2026-07-08', end: '2026-07-23' });
    tick();
    await driver.fixture.whenStable();

    expect(driver.field('.start').value).toBe('07/08/2026');
    expect(driver.field('.end').value).toBe('07/23/2026');
    expect(driver.control.calendarRange()).toEqual({ start: new Date(2026, 6, 8), end: new Date(2026, 6, 23) });
  });

  it('reflects focus of either field into the focused signal', () => {
    expect(driver.control.focused()).toBe(false);

    driver.field('.start').focus();
    driver.focusField('.start');

    expect(driver.control.focusedSide()).toBe('start');
    expect(driver.control.focused()).toBe(true);

    driver.blurField('.start');

    expect(driver.control.focused()).toBe(false);
  });

  it('keeps the picker open for a partial pick and closes it on a completed range', async () => {
    await driver.open();

    expect(driver.control.pickerOpen()).toBe(true);
    expect(driver.trigger().getAttribute('aria-expanded')).toBe('true');

    driver.clickInPane('.pick-start');
    await driver.settle();

    expect(driver.host.value()).toEqual({ start: '2026-07-08', end: null });
    expect(driver.control.pickerOpen()).toBe(true);

    driver.clickInPane('.pick-full');
    await driver.settle();

    expect(driver.host.value()).toEqual({ start: '2026-07-08', end: '2026-07-23' });
    expect(driver.control.pickerOpen()).toBe(false);
    expect(driver.field('.start').value).toBe('07/08/2026');
    expect(driver.field('.end').value).toBe('07/23/2026');
  });

  it('closes the picker on an outside pointerdown', async () => {
    await driver.open();

    driver.pointerDownOutside();
    await driver.settle();

    expect(driver.control.pickerOpen()).toBe(false);
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
    const rawRange = { start: '2026-03-01', end: '2026-03-10' };

    const enterMixed = () => {
      driver.host.value.set({ ...rawRange });
      driver.host.mixed.set(true);
      tick();
    };

    it('renders both fields empty with the mixed label as placeholder - one flag masks the whole range', () => {
      enterMixed();

      expect(driver.field('.start').value).toBe('');
      expect(driver.field('.end').value).toBe('');
      expect(driver.field('.start').getAttribute('placeholder')).toBe('Mixed');
      expect(driver.field('.end').getAttribute('placeholder')).toBe('Mixed');
      expect(driver.control.displayValue('start')).toBe('');
      expect(driver.control.displayValue('end')).toBe('');
      expect(driver.control.calendarRange()).toEqual({ start: null, end: null });
      expect(driver.control.hasValue()).toBe(true);
    });

    it('starts a fresh range on the first typed commit - the hidden other side does not leak', () => {
      enterMixed();
      driver.typeAndBlur('07/20/2026', '.end');

      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toEqual({ start: null, end: '2026-07-20' });
    });

    it('keeps mixed and the raw range on a failed typed parse', () => {
      enterMixed();
      driver.typeAndBlur('not a date', '.start');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toEqual(rawRange);
      expect(driver.control.startParseError()).toBe(true);
    });

    it('keeps mixed and the raw range on a blank blur commit', () => {
      enterMixed();
      driver.typeAndBlur('', '.start');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toEqual(rawRange);
    });

    it('gives the calendar no selection while mixed; the first pick starts a fresh range and resolves', async () => {
      enterMixed();
      await driver.open();

      expect(driver.host.mixed()).toBe(true);
      expect(driver.control.calendarRange()).toEqual({ start: null, end: null });

      driver.clickInPane('.pick-start');

      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toEqual({ start: '2026-07-08', end: null });
      expect(driver.control.pickerOpen()).toBe(true);
    });
  });

  describe('precision', () => {
    it('derives a month format and normalizes both typed ends to the 1st', () => {
      driver.host.precision.set('month');
      tick();

      expect(driver.control.effectiveDisplayFormat()).toBe('MM/yyyy');

      driver.typeAndBlur('07/2025', '.start');
      driver.typeAndBlur('03/2026', '.end');

      expect(driver.host.value()).toEqual({ start: '2025-07-01', end: '2026-03-01' });
      expect(driver.control.parseError()).toBe(false);
      expect(driver.field('.start').value).toBe('07/2025');
      expect(driver.field('.end').value).toBe('03/2026');
    });

    it('normalizes a picked month range', async () => {
      driver.host.precision.set('month');
      tick();

      await driver.open();
      driver.clickInPane('.pick-full');

      expect(driver.host.value()).toEqual({ start: '2026-07-01', end: '2026-07-01' });
    });

    it('refuses a full date once the format is month-only', () => {
      driver.host.precision.set('month');
      tick();

      driver.typeAndBlur('07/08/2026', '.start');

      expect(driver.host.value().start).toBeNull();
      expect(driver.control.startParseError()).toBe(true);
    });
  });
});

@Component({
  template: `
    <div etFormField>
      <et-label>Range</et-label>
      <div [formField]="rangeForm.range" valueFormat="yyyy-MM-dd" etDateRangeInput>
        <input class="start" etDateRangeInputField side="start" />
        <input class="end" etDateRangeInputField side="end" />
      </div>
    </div>
  `,
  imports: [FormField, FormFieldDirective, LabelDirective, DateRangeInputDirective, DateRangeInputFieldDirective],
})
class RangeSubfieldErrorTestHost {
  model = signal<{ range: DateRangeValue }>({ range: { start: null, end: null } });
  rangeForm = form(this.model, (schema) => {
    required(schema.range.start);
  });
}

describe('DateRangeInputDirective descendant (subfield) errors', () => {
  it('surfaces a `schema.start.required()` error in the form field error area, not just the range field itself', () => {
    TestBed.configureTestingModule({ imports: [RangeSubfieldErrorTestHost] });
    const fixture = TestBed.createComponent(RangeSubfieldErrorTestHost);
    fixture.detectChanges();

    const formField = fixture.debugElement.children[0]!.injector.get(FormFieldDirective);
    const rangeInput = fixture.debugElement.children[0]!.children[1]!.injector.get(DateRangeInputDirective);

    // the range field itself carries no own error - `required` targets the `start` subfield
    expect(rangeInput.errors()).toEqual([]);
    // the form field's single error area still shows it, via the field's error summary
    expect(formField.errors().length).toBeGreaterThan(0);
  });
});

describe('DateRangeInputDirective mixed state', () => {
  describeMixedStateContract(() => {
    const driver = mountDatePicker(DateRangeInputTestHost, DateRangeInputDirective);

    return {
      enterMixed: () => {
        driver.host.value.set({ start: '2026-03-01', end: '2026-03-10' });
        driver.host.mixed.set(true);
        tick();
      },
      rawValue: () => ({ start: '2026-03-01', end: '2026-03-10' }),
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.element(),
      writeValueExternally: () => {
        driver.host.value.set({ start: '2026-01-01', end: '2026-01-05' });
        tick();
      },
      externallyWrittenValue: () => ({ start: '2026-01-01', end: '2026-01-05' }),
      resolveMixedFromConsumer: () => {
        driver.host.mixed.set(false);
        tick();
      },
      mixedLabel: () => 'Mixed',
      mixedDisplayText: () => driver.field('.start').placeholder,
      // replace semantics: the resolving commit starts a fresh range - no merge with the hidden end
      commit: () => driver.typeAndBlur('07/20/2026', '.start'),
      committedValue: () => ({ start: '2026-07-20', end: null }),
      assertMasked: () => {
        expect(driver.control.calendarRange()).toEqual({ start: null, end: null });
        expect(driver.field('.start').value).toBe('');
        expect(driver.field('.end').value).toBe('');
        expect(driver.field('.start').getAttribute('placeholder')).toBe('Mixed');
        expect(driver.field('.end').getAttribute('placeholder')).toBe('Mixed');
      },
      clear: () => {
        driver.control.clearRange();
        tick();
      },
      emptyValue: () => ({ start: null, end: null }),
    };
  });
});

@Component({
  template: `
    <div
      #rangeInput="etDateRangeInput"
      [(value)]="value"
      [mask]="mask()"
      [displayFormat]="displayFormat()"
      valueFormat="yyyy-MM-dd"
      etDateRangeInput
    >
      <input
        [etInputMask]="rangeInput.maskPattern()"
        class="start"
        etDateRangeInputField
        maskValueMode="masked"
        placeholderChar="_"
        side="start"
      />
      <input
        [etInputMask]="rangeInput.maskPattern()"
        class="end"
        etDateRangeInputField
        maskValueMode="masked"
        placeholderChar="_"
        side="end"
      />
    </div>
  `,
  imports: [DateRangeInputDirective, DateRangeInputFieldDirective, InputMaskDirective],
})
class MaskedDateRangeInputTestHost {
  value = signal<DateRangeValue>({ start: null, end: null });
  mask = signal(true);
  displayFormat = signal('dd.MM.yyyy');
}

describe('DateRangeInputDirective with the opt-in typing mask', () => {
  let fixture: ComponentFixture<MaskedDateRangeInputTestHost>;
  let host: MaskedDateRangeInputTestHost;
  let rangeInput: DateRangeInputDirective;
  let startField: HTMLInputElement;
  let endField: HTMLInputElement;

  const focus = async (field: HTMLInputElement) => {
    field.focus();
    field.dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();
  };

  const blur = async (field: HTMLInputElement) => {
    field.blur();
    field.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };

  const type = async (field: HTMLInputElement, text: string) => {
    for (const char of text) {
      const caret = field.selectionStart ?? field.value.length;

      field.value = field.value.slice(0, caret) + char + field.value.slice(caret);
      field.setSelectionRange(caret + 1, caret + 1);
      field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      await fixture.whenStable();
    }
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [MaskedDateRangeInputTestHost] });
    fixture = TestBed.createComponent(MaskedDateRangeInputTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    rangeInput = fixture.debugElement.children[0]!.injector.get(DateRangeInputDirective);
    startField = fixture.nativeElement.querySelector('.start');
    endField = fixture.nativeElement.querySelector('.end');
  });

  it('derives the pattern from the display format and refuses non-fixed-width formats', () => {
    silenceExpectedConsole('warn');

    expect(rangeInput.maskPattern()).toBe('00.00.0000');

    host.displayFormat.set('P');
    fixture.detectChanges();
    expect(rangeInput.maskPattern()).toBeNull();

    host.mask.set(false);
    host.displayFormat.set('dd.MM.yyyy');
    fixture.detectChanges();
    expect(rangeInput.maskPattern()).toBeNull();
  });

  it('shapes typing per side with guide placeholders and commits on blur', async () => {
    await focus(startField);

    expect(startField.value).toBe('__.__.____');
    // the other side stays untouched - each field is its own mask host
    expect(endField.value).toBe('');

    await type(startField, '0807');

    expect(startField.value).toBe('08.07.____');
    // masked typing must feed hasValue like native typing (the clear affordance depends on it)
    expect(rangeInput.inputText('start')).toBe('08.07.');
    expect(rangeInput.hasValue()).toBe(true);

    await type(startField, '2026');
    await blur(startField);

    expect(host.value()).toEqual({ start: '2026-07-08', end: null });
    expect(startField.value).toBe('08.07.2026');

    await focus(endField);
    await type(endField, '23072026');
    await blur(endField);

    expect(host.value()).toEqual({ start: '2026-07-08', end: '2026-07-23' });
    expect(endField.value).toBe('23.07.2026');
  });

  it('commits the shaped text without guide placeholders - a partial entry is a parse error on its side only', async () => {
    await focus(endField);
    await type(endField, '2307');
    await blur(endField);

    expect(host.value()).toEqual({ start: null, end: null });
    expect(rangeInput.endParseError()).toBe(true);
    expect(rangeInput.startParseError()).toBe(false);
    // the kept text is the display-shaped entry, not `23.07.____`
    expect(rangeInput.inputText('end')).toBe('23.07.');
    expect(endField.value).toBe('23.07.');
  });

  it('shows the guide only on the focused side and removes it again on blur', async () => {
    await focus(startField);

    expect(startField.value).toBe('__.__.____');
    expect(endField.value).toBe('');

    await blur(startField);

    expect(host.value()).toEqual({ start: null, end: null });
    expect(startField.value).toBe('');
  });

  it('keeps a committed range visible when masked and clears a side via delete-all + blur', async () => {
    host.value.set({ start: '2026-07-08', end: '2026-07-23' });
    await fixture.whenStable();

    expect(startField.value).toBe('08.07.2026');
    expect(endField.value).toBe('23.07.2026');

    await focus(startField);

    expect(startField.value).toBe('08.07.2026');

    startField.value = '';
    startField.setSelectionRange(0, 0);
    startField.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    await fixture.whenStable();

    expect(startField.value).toBe('__.__.____');

    await blur(startField);

    expect(host.value()).toEqual({ start: null, end: '2026-07-23' });
    expect(startField.value).toBe('');
    expect(endField.value).toBe('23.07.2026');
  });

  it('commits on Enter and keeps the reformatted text in place', async () => {
    await focus(startField);
    await type(startField, '08072026');
    startField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();

    expect(host.value().start).toBe('2026-07-08');
    expect(startField.value).toBe('08.07.2026');
  });

  it('falls back to native, unmasked typing while the pattern is refused', async () => {
    silenceExpectedConsole('warn');

    host.displayFormat.set('P');
    await fixture.whenStable();

    await focus(startField);
    startField.value = '07/16/2026';
    startField.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    await fixture.whenStable();

    // no mask: arbitrary text stays, native input sync tracks it
    expect(startField.value).toBe('07/16/2026');
    expect(rangeInput.inputText('start')).toBe('07/16/2026');

    await blur(startField);

    expect(host.value().start).toBe('2026-07-16');
  });
});

describe('DateRangeInputDirective commit contract', () => {
  describePickerCommitContract(() => {
    const driver = mountDatePicker(DateRangeInputTestHost, DateRangeInputDirective);

    // a wire format carrying a time against the date-only display default is what makes an
    // unedited blur observable: re-parsing "07/20/2026" would write back midnight
    driver.host.valueFormat.set('yyyy-MM-dd HH:mm');
    driver.host.value.set({ start: '2026-07-20 14:30', end: null });
    tick();
    return {
      commitValue: () => tick(),
      committedValue: () => ({ start: '2026-07-20 14:30', end: null }),
      emptyValue: () => ({ start: null, end: null }),
      value: () => driver.host.value(),
      parseError: () => driver.control.sideParseError('start'),
      focus: () => driver.focusField('.start'),
      blur: () => driver.blurField('.start'),
      typeAndBlur: (text: string) => driver.typeAndBlur(text, '.start'),
      makeReadonly: () => {
        driver.host.readonly.set(true);
        tick();
      },
    };
  });
});
