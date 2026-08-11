import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { InputMaskDirective } from '../../../masked-input/headless';
import { silenceExpectedConsole } from '../../../../testing/expected-console';
import { describeMixedStateContract } from '../../../testing/mixed-state-contract';
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
      valueFormat="yyyy-MM-dd"
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
  precision = signal<CalendarPrecision>('day');
  displayFormat = signal<string | null>(null);
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

  // overlays render into the document - scope queries to the newest pane so a pane
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

  it('clearValue() resets value, pending text and the field element while focused', () => {
    typeAndBlur('07/16/2026');
    field.focus();
    field.value = 'not a date';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    tick();

    dateInput.clearValue();
    tick();

    expect(host.value()).toBeNull();
    expect(dateInput.inputText()).toBe('');
    expect(dateInput.parseError()).toBe(false);
    expect(dateInput.hasValue()).toBe(false);
    // the field only mirrors state while unfocused - the clear resets it directly
    expect(field.value).toBe('');
  });

  it('clearValue() is a no-op while readonly or disabled', () => {
    typeAndBlur('07/16/2026');
    host.disabled.set(true);
    fixture.detectChanges();

    dateInput.clearValue();
    tick();

    expect(host.value()).toBe('2026-07-16');
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

  describe('mixed (bulk edit)', () => {
    const enterMixed = () => {
      host.value.set('2026-03-05');
      host.mixed.set(true);
      tick();
    };

    it('renders the field empty with the mixed label as placeholder', () => {
      enterMixed();

      expect(field.value).toBe('');
      expect(field.getAttribute('placeholder')).toBe('Mixed');
      expect(dateInput.displayValue()).toBe('');
      expect(dateInput.hasValue()).toBe(true);
    });

    it('keeps mixed and the raw value on a failed typed parse', () => {
      enterMixed();
      typeAndBlur('not a date');

      expect(host.mixed()).toBe(true);
      expect(host.value()).toBe('2026-03-05');
      expect(dateInput.parseError()).toBe(true);
      expect(field.value).toBe('not a date');
    });

    it('keeps mixed and the raw value on a blank blur commit', () => {
      enterMixed();
      typeAndBlur('');

      expect(host.mixed()).toBe(true);
      expect(host.value()).toBe('2026-03-05');
    });

    it('gives the picker no selected date and leaves mixed set on open; a pick replaces and resolves', async () => {
      enterMixed();

      expect(dateInput.date()).toBeNull();

      await openPicker();

      expect(host.mixed()).toBe(true);
      expect(dateInput.pickerOpen()).toBe(true);

      pickButton()?.click();
      tick();
      await flushFrames();
      tick();

      expect(host.mixed()).toBe(false);
      expect(host.value()).toBe('2026-07-16');
      expect(field.value).toBe('07/16/2026');
    });
  });
  describe('precision', () => {
    it('derives a month format and normalizes typed months to the 1st', () => {
      host.precision.set('month');
      tick();

      expect(dateInput.effectiveDisplayFormat()).toBe('MM/yyyy');

      typeAndBlur('07/2026');

      // the 1st, not today's day of July - a coarse format cannot say which day it meant
      expect(host.value()).toBe('2026-07-01');
      expect(dateInput.parseError()).toBe(false);
      expect(field.value).toBe('07/2026');
    });

    it('normalizes a picked date to the month at month precision', async () => {
      host.precision.set('month');
      tick();

      await openPicker();
      pickButton()?.click();
      tick();

      expect(host.value()).toBe('2026-07-01');
    });

    it('takes a bare year at year precision', () => {
      host.precision.set('year');
      tick();

      expect(dateInput.effectiveDisplayFormat()).toBe('yyyy');

      typeAndBlur('2031');

      expect(host.value()).toBe('2031-01-01');
      expect(field.value).toBe('2031');
    });

    it('refuses text the derived format cannot parse', () => {
      host.precision.set('month');
      tick();

      typeAndBlur('07/16/2026');

      expect(host.value()).toBeNull();
      expect(dateInput.parseError()).toBe(true);
    });

    it('lets an explicit displayFormat win over the precision', () => {
      host.precision.set('month');
      host.displayFormat.set('MMMM yyyy');
      tick();

      expect(dateInput.effectiveDisplayFormat()).toBe('MMMM yyyy');

      typeAndBlur('July 2026');

      expect(host.value()).toBe('2026-07-01');
      expect(field.value).toBe('July 2026');
    });
  });
});

describe('DateInputDirective mixed state', () => {
  describeMixedStateContract(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({ imports: [DateInputTestHost] });

    const fixture = TestBed.createComponent(DateInputTestHost);

    fixture.detectChanges();

    const dateInput = fixture.debugElement.children[0]!.injector.get(DateInputDirective);
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
        fixture.componentInstance.value.set('2026-03-05');
        fixture.componentInstance.mixed.set(true);
        tick();
      },
      rawValue: () => '2026-03-05',
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => fixture.debugElement.children[0]!.nativeElement as HTMLElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set('2026-01-01');
        tick();
      },
      externallyWrittenValue: () => '2026-01-01',
      commit: () => typeAndBlur('07/20/2026'),
      committedValue: () => '2026-07-20',
      assertMasked: () => {
        expect(dateInput.date()).toBeNull();
        expect(dateInput.displayValue()).toBe('');
        expect(field.value).toBe('');
        expect(field.getAttribute('placeholder')).toBe('Mixed');
      },
      clear: () => {
        dateInput.clearValue();
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
