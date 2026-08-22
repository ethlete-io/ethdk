import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { pressKey, tick } from '../../../../testing/driver-core';
import { InputMaskDirective } from '../../../masked-input/headless';
import { silenceExpectedConsole } from '../../../../testing/expected-console';
import { DatePickerDriver, mountDatePicker } from '../../../testing/date-picker-driver';
import { describeMixedStateContract } from '../../../testing/mixed-state-contract';
import { describePickerCommitContract } from '../../../testing/picker-commit-contract';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { DateInputFieldDirective } from './date-input-field.directive';
import { DateInputDirective } from './date-input.directive';
import { CalendarPrecision } from '../../../../calendar/headless';

@Component({
  template: `
    <div
      [(value)]="value"
      [(mixed)]="mixed"
      [disabled]="disabled()"
      [precision]="precision()"
      [displayFormat]="displayFormat()"
      [valueFormat]="valueFormat()"
      [readonly]="readonly()"
      etDateInput
    >
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
  mixed = signal(false);
  disabled = signal(false);
  readonly = signal(false);
  valueFormat = signal('yyyy-MM-dd');
  precision = signal<CalendarPrecision>('day');
  displayFormat = signal<string | null>(null);
  pickDate = new Date(2026, 6, 16);
}

describe('DateInputDirective', () => {
  let driver: DatePickerDriver<DateInputTestHost, DateInputDirective>;

  const pickButton = () => driver.paneEl<HTMLButtonElement>('.pick-date');

  beforeEach(() => {
    driver = mountDatePicker(DateInputTestHost, DateInputDirective);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('commits a strict displayFormat parse on blur', () => {
    driver.typeAndBlur('07/16/2026');

    expect(driver.host.value()).toBe('2026-07-16');
    expect(driver.control.parseError()).toBe(false);
    expect(driver.field().value).toBe('07/16/2026');
    expect(driver.control.touched()).toBe(true);
  });

  it('commits and reformats on Enter without losing focus', () => {
    driver.type('7/16/2026');
    driver.pressInField('Enter');

    expect(driver.host.value()).toBe('2026-07-16');
    expect(driver.field().value).toBe('07/16/2026');
  });

  it('keeps unparseable text visible and raises parseError with a null value', () => {
    driver.typeAndBlur('07/16/2026');
    driver.typeAndBlur('not a date');

    expect(driver.host.value()).toBeNull();
    expect(driver.control.parseError()).toBe(true);
    expect(driver.control.shouldDisplayError()).toBe(true);
    expect(driver.field().value).toBe('not a date');
    expect(driver.control.hasValue()).toBe(true);
  });

  it('clears the value on empty input', () => {
    driver.typeAndBlur('07/16/2026');
    driver.typeAndBlur('');

    expect(driver.host.value()).toBeNull();
    expect(driver.control.parseError()).toBe(false);
    expect(driver.control.hasValue()).toBe(false);
  });

  it('clearValue() resets value, pending text and the field element while focused', () => {
    driver.typeAndBlur('07/16/2026');
    driver.type('not a date');

    driver.control.clearValue();
    tick();

    expect(driver.host.value()).toBeNull();
    expect(driver.control.inputText()).toBe('');
    expect(driver.control.parseError()).toBe(false);
    expect(driver.control.hasValue()).toBe(false);
    // the field only mirrors state while unfocused - the clear resets it directly
    expect(driver.field().value).toBe('');
  });

  it('clearValue() is a no-op while readonly or disabled', () => {
    driver.typeAndBlur('07/16/2026');
    driver.host.disabled.set(true);
    driver.detectChanges();

    driver.control.clearValue();
    tick();

    expect(driver.host.value()).toBe('2026-07-16');
  });

  it('displays a prefilled value in the display format', async () => {
    driver.host.value.set('2026-12-24');
    tick();
    await driver.fixture.whenStable();

    expect(driver.field().value).toBe('12/24/2026');
    expect(driver.control.date()).toEqual(new Date(2026, 11, 24));
  });

  it('opens the picker from the trigger and commits a picked date', async () => {
    expect(driver.trigger().getAttribute('aria-haspopup')).toBe('dialog');
    expect(driver.trigger().getAttribute('aria-expanded')).toBe('false');

    await driver.open();

    expect(driver.control.pickerOpen()).toBe(true);
    expect(driver.trigger().getAttribute('aria-expanded')).toBe('true');
    expect(pickButton()).not.toBeNull();

    driver.clickInPane('.pick-date');
    await driver.settle();

    expect(driver.host.value()).toBe('2026-07-16');
    expect(driver.control.pickerOpen()).toBe(false);
    expect(driver.field().value).toBe('07/16/2026');
  });

  it('closes the picker on an outside pointerdown', async () => {
    await driver.open();

    driver.pointerDownOutside();
    await driver.settle();

    expect(driver.control.pickerOpen()).toBe(false);
  });

  it('opens the picker with Alt+ArrowDown from the field', async () => {
    driver.focusField();
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
      driver.host.value.set('2026-03-05');
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
      driver.typeAndBlur('not a date');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toBe('2026-03-05');
      expect(driver.control.parseError()).toBe(true);
      expect(driver.field().value).toBe('not a date');
    });

    it('keeps mixed and the raw value on a blank blur commit', () => {
      enterMixed();
      driver.typeAndBlur('');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toBe('2026-03-05');
    });

    it('gives the picker no selected date and leaves mixed set on open; a pick replaces and resolves', async () => {
      enterMixed();

      expect(driver.control.date()).toBeNull();

      await driver.open();

      expect(driver.host.mixed()).toBe(true);
      expect(driver.control.pickerOpen()).toBe(true);

      driver.clickInPane('.pick-date');
      await driver.settle();

      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toBe('2026-07-16');
      expect(driver.field().value).toBe('07/16/2026');
    });
  });
  describe('precision', () => {
    it('derives a month format and normalizes typed months to the 1st', () => {
      driver.host.precision.set('month');
      tick();

      expect(driver.control.effectiveDisplayFormat()).toBe('MM/yyyy');

      driver.typeAndBlur('07/2026');

      // the 1st, not today's day of July - a coarse format cannot say which day it meant
      expect(driver.host.value()).toBe('2026-07-01');
      expect(driver.control.parseError()).toBe(false);
      expect(driver.field().value).toBe('07/2026');
    });

    it('normalizes a picked date to the month at month precision', async () => {
      driver.host.precision.set('month');
      tick();

      await driver.open();
      driver.clickInPane('.pick-date');

      expect(driver.host.value()).toBe('2026-07-01');
    });

    it('takes a bare year at year precision', () => {
      driver.host.precision.set('year');
      tick();

      expect(driver.control.effectiveDisplayFormat()).toBe('yyyy');

      driver.typeAndBlur('2031');

      expect(driver.host.value()).toBe('2031-01-01');
      expect(driver.field().value).toBe('2031');
    });

    it('refuses text the derived format cannot parse', () => {
      driver.host.precision.set('month');
      tick();

      driver.typeAndBlur('07/16/2026');

      expect(driver.host.value()).toBeNull();
      expect(driver.control.parseError()).toBe(true);
    });

    it('lets an explicit displayFormat win over the precision', () => {
      driver.host.precision.set('month');
      driver.host.displayFormat.set('MMMM yyyy');
      tick();

      expect(driver.control.effectiveDisplayFormat()).toBe('MMMM yyyy');

      driver.typeAndBlur('July 2026');

      expect(driver.host.value()).toBe('2026-07-01');
      expect(driver.field().value).toBe('July 2026');
    });
  });
});

describe('DateInputDirective mixed state', () => {
  describeMixedStateContract(() => {
    const driver = mountDatePicker(DateInputTestHost, DateInputDirective);

    return {
      enterMixed: () => {
        driver.host.value.set('2026-03-05');
        driver.host.mixed.set(true);
        tick();
      },
      rawValue: () => '2026-03-05',
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.element(),
      writeValueExternally: () => {
        driver.host.value.set('2026-01-01');
        tick();
      },
      externallyWrittenValue: () => '2026-01-01',
      commit: () => driver.typeAndBlur('07/20/2026'),
      committedValue: () => '2026-07-20',
      assertMasked: () => {
        expect(driver.control.date()).toBeNull();
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
    <div
      #dateInput="etDateInput"
      [(value)]="value"
      [mask]="mask()"
      [displayFormat]="displayFormat()"
      valueFormat="yyyy-MM-dd"
      etDateInput
    >
      <input [etInputMask]="dateInput.maskPattern()" etDateInputField maskValueMode="masked" placeholderChar="_" />
    </div>
  `,
  imports: [DateInputDirective, DateInputFieldDirective, InputMaskDirective],
})
class MaskedDateInputTestHost {
  value = signal<string | null>(null);
  mask = signal(true);
  displayFormat = signal('dd.MM.yyyy');
}

describe('DateInputDirective with the opt-in typing mask', () => {
  let fixture: ComponentFixture<MaskedDateInputTestHost>;
  let host: MaskedDateInputTestHost;
  let dateInput: DateInputDirective;
  let field: HTMLInputElement;

  const focus = async () => {
    field.focus();
    field.dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();
  };

  const blur = async () => {
    field.blur();
    field.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };

  const edit = async (mutate: (el: HTMLInputElement) => void, inputType: string) => {
    mutate(field);
    field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }));
    await fixture.whenStable();
  };

  const type = async (text: string) => {
    for (const char of text) {
      await edit((el) => {
        const caret = el.selectionStart ?? el.value.length;

        el.value = el.value.slice(0, caret) + char + el.value.slice(caret);
        el.setSelectionRange(caret + 1, caret + 1);
      }, 'insertText');
    }
  };

  const paste = (text: string) =>
    edit((el) => {
      el.value = text;
      el.setSelectionRange(text.length, text.length);
    }, 'insertFromPaste');

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [MaskedDateInputTestHost] });
    fixture = TestBed.createComponent(MaskedDateInputTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    dateInput = fixture.debugElement.children[0]!.injector.get(DateInputDirective);
    field = fixture.nativeElement.querySelector('input');
  });

  it('derives the pattern from the display format and refuses non-fixed-width formats', () => {
    silenceExpectedConsole('warn');

    expect(dateInput.maskPattern()).toBe('00.00.0000');

    host.displayFormat.set('P');
    fixture.detectChanges();
    expect(dateInput.maskPattern()).toBeNull();

    host.mask.set(false);
    host.displayFormat.set('dd.MM.yyyy');
    fixture.detectChanges();
    expect(dateInput.maskPattern()).toBeNull();
  });

  it('shapes typing with guide placeholders and auto-inserted separators, then commits on blur', async () => {
    await focus();
    await type('1807');

    expect(field.value).toBe('18.07.____');
    // masked typing must feed hasValue like native typing (the clear button depends on it)
    expect(dateInput.inputText()).toBe('18.07.');
    expect(dateInput.hasValue()).toBe(true);

    await type('2026');

    expect(field.value).toBe('18.07.2026');

    await blur();

    expect(host.value()).toBe('2026-07-18');
    expect(dateInput.parseError()).toBe(false);
    expect(field.value).toBe('18.07.2026');
  });

  it('commits the shaped text without guide placeholders - a partial entry is a parse error, not guide noise', async () => {
    await focus();
    await type('1807');
    await blur();

    expect(host.value()).toBeNull();
    expect(dateInput.parseError()).toBe(true);
    // the kept text is the display-shaped entry, not `18.07.____`
    expect(dateInput.inputText()).toBe('18.07.');
    expect(field.value).toBe('18.07.');
  });

  it('shows the full guide on focusing an empty field and removes it again on blur', async () => {
    await focus();

    expect(field.value).toBe('__.__.____');

    await blur();

    expect(host.value()).toBeNull();
    expect(dateInput.parseError()).toBe(false);
    expect(field.value).toBe('');
  });

  it('keeps a committed value visible when focused and clears it via delete-all + blur', async () => {
    host.value.set('2026-07-18');
    await fixture.whenStable();

    expect(field.value).toBe('18.07.2026');

    await focus();

    expect(field.value).toBe('18.07.2026');

    await edit((el) => {
      el.value = '';
      el.setSelectionRange(0, 0);
    }, 'deleteContentBackward');

    expect(field.value).toBe('__.__.____');

    await blur();

    expect(host.value()).toBeNull();
    expect(field.value).toBe('');
  });

  it('does not bring cleared text back on the next blur', async () => {
    await focus();
    await type('1807');

    expect(field.value).toBe('18.07.____');

    dateInput.clearValue();
    await fixture.whenStable();

    expect(field.value).toBe('__.__.____');
    expect(dateInput.hasValue()).toBe(false);

    await blur();

    expect(host.value()).toBeNull();
    expect(dateInput.parseError()).toBe(false);
    expect(field.value).toBe('');
  });

  it('filters pasted text down to the mask shape', async () => {
    await focus();
    await paste('18/07/2026');

    expect(field.value).toBe('18.07.2026');

    await blur();

    expect(host.value()).toBe('2026-07-18');
  });

  it('drops a paste with no maskable content entirely', async () => {
    await focus();
    await paste('not a date');

    expect(field.value).toBe('__.__.____');

    await blur();

    expect(host.value()).toBeNull();
    expect(dateInput.parseError()).toBe(false);
  });

  it('commits on Enter and keeps the reformatted text in place', async () => {
    await focus();
    await type('18072026');
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();

    expect(host.value()).toBe('2026-07-18');
    expect(field.value).toBe('18.07.2026');
  });

  it('falls back to native, unmasked typing while the pattern is refused', async () => {
    silenceExpectedConsole('warn');

    host.displayFormat.set('P');
    await fixture.whenStable();

    await focus();
    await edit((el) => {
      el.value = '07/16/2026';
    }, 'insertText');

    // no mask: arbitrary text stays, native input sync tracks it
    expect(field.value).toBe('07/16/2026');
    expect(dateInput.inputText()).toBe('07/16/2026');

    await blur();

    expect(host.value()).toBe('2026-07-16');
  });
});

describe('DateInputDirective commit contract', () => {
  describePickerCommitContract(() => {
    // a wire format carrying a time against the date-only display default is what makes an
    // unedited blur observable: re-parsing "07/20/2026" would write back midnight
    const driver = mountDatePicker(DateInputTestHost, DateInputDirective);

    driver.host.valueFormat.set('yyyy-MM-dd HH:mm');
    driver.host.value.set('2026-07-20 14:30');
    tick();

    return {
      commitValue: () => tick(),
      committedValue: () => '2026-07-20 14:30',
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
