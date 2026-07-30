import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { InputMaskDirective } from '../../../masked-input/headless';
import { describeMixedStateContract } from '../../../testing/mixed-state-contract';
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
      [precision]="precision()"
      valueFormat="yyyy-MM-dd"
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
  precision = signal<CalendarPrecision>('day');
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

  describe('mixed (bulk edit)', () => {
    const rawRange = { start: '2026-03-01', end: '2026-03-10' };

    const enterMixed = () => {
      host.value.set({ ...rawRange });
      host.mixed.set(true);
      tick();
    };

    it('renders both fields empty with the mixed label as placeholder — one flag masks the whole range', () => {
      enterMixed();

      expect(startField.value).toBe('');
      expect(endField.value).toBe('');
      expect(startField.getAttribute('placeholder')).toBe('Mixed');
      expect(endField.getAttribute('placeholder')).toBe('Mixed');
      expect(rangeInput.displayValue('start')).toBe('');
      expect(rangeInput.displayValue('end')).toBe('');
      expect(rangeInput.calendarRange()).toEqual({ start: null, end: null });
      expect(rangeInput.hasValue()).toBe(true);
    });

    it('starts a fresh range on the first typed commit — the hidden other side does not leak', () => {
      enterMixed();
      typeAndBlur(endField, '07/20/2026');

      expect(host.mixed()).toBe(false);
      expect(host.value()).toEqual({ start: null, end: '2026-07-20' });
    });

    it('keeps mixed and the raw range on a failed typed parse', () => {
      enterMixed();
      typeAndBlur(startField, 'not a date');

      expect(host.mixed()).toBe(true);
      expect(host.value()).toEqual(rawRange);
      expect(rangeInput.startParseError()).toBe(true);
    });

    it('keeps mixed and the raw range on a blank blur commit', () => {
      enterMixed();
      typeAndBlur(startField, '');

      expect(host.mixed()).toBe(true);
      expect(host.value()).toEqual(rawRange);
    });

    it('gives the calendar no selection while mixed; the first pick starts a fresh range and resolves', async () => {
      enterMixed();
      await openPicker();

      expect(host.mixed()).toBe(true);
      expect(rangeInput.calendarRange()).toEqual({ start: null, end: null });

      pane()?.querySelector<HTMLButtonElement>('.pick-start')?.click();
      tick();

      expect(host.mixed()).toBe(false);
      expect(host.value()).toEqual({ start: '2026-07-08', end: null });
      expect(rangeInput.pickerOpen()).toBe(true);
    });
  });

  describe('precision', () => {
    it('derives a month format and normalizes both typed ends to the 1st', () => {
      host.precision.set('month');
      tick();

      expect(rangeInput.effectiveDisplayFormat()).toBe('MM/yyyy');

      typeAndBlur(startField, '07/2025');
      typeAndBlur(endField, '03/2026');

      expect(host.value()).toEqual({ start: '2025-07-01', end: '2026-03-01' });
      expect(rangeInput.parseError()).toBe(false);
      expect(startField.value).toBe('07/2025');
      expect(endField.value).toBe('03/2026');
    });

    it('normalizes a picked month range', async () => {
      host.precision.set('month');
      tick();

      await openPicker();
      pane()?.querySelector<HTMLButtonElement>('.pick-full')?.click();
      tick();

      expect(host.value()).toEqual({ start: '2026-07-01', end: '2026-07-01' });
    });

    it('refuses a full date once the format is month-only', () => {
      host.precision.set('month');
      tick();

      typeAndBlur(startField, '07/08/2026');

      expect(host.value().start).toBeNull();
      expect(rangeInput.startParseError()).toBe(true);
    });
  });
});

describe('DateRangeInputDirective mixed state', () => {
  describeMixedStateContract(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({ imports: [DateRangeInputTestHost] });

    const fixture = TestBed.createComponent(DateRangeInputTestHost);

    fixture.detectChanges();

    const rangeInput = fixture.debugElement.children[0]!.injector.get(DateRangeInputDirective);
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
        fixture.componentInstance.value.set({ start: '2026-03-01', end: '2026-03-10' });
        fixture.componentInstance.mixed.set(true);
        tick();
      },
      rawValue: () => ({ start: '2026-03-01', end: '2026-03-10' }),
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => fixture.debugElement.children[0]!.nativeElement as HTMLElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set({ start: '2026-01-01', end: '2026-01-05' });
        tick();
      },
      externallyWrittenValue: () => ({ start: '2026-01-01', end: '2026-01-05' }),
      // replace semantics: the resolving commit starts a fresh range — no merge with the hidden end
      commit: () => typeAndBlur(startField, '07/20/2026'),
      committedValue: () => ({ start: '2026-07-20', end: null }),
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
    // the other side stays untouched — each field is its own mask host
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

  it('commits the shaped text without guide placeholders — a partial entry is a parse error on its side only', async () => {
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
