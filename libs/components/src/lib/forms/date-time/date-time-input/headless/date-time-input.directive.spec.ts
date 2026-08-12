import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { describeMixedStateContract } from '../../../testing/mixed-state-contract';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { DateTimeInputFieldDirective } from './date-time-input-field.directive';
import { DateTimeInputDirective } from './date-time-input.directive';

@Component({
  template: `
    <div
      [(value)]="value"
      [(mixed)]="mixed"
      [disabled]="disabled()"
      displayFormat="MM/dd/yyyy, HH:mm"
      etDateTimeInput
      valueFormat="yyyy-MM-dd HH:mm"
    >
      <input etDateTimeInputField />
      <button class="open-picker" etDatePickerTrigger>open</button>

      <ng-template etDatePickerSurface let-dateTimeInput>
        <button (click)="dateTimeInput.selectDate(pickDate)" class="pick-date" type="button">pick date</button>
        <button (click)="dateTimeInput.selectTime(pickTime)" class="pick-time" type="button">pick time</button>
      </ng-template>
    </div>
  `,
  imports: [
    DateTimeInputDirective,
    DateTimeInputFieldDirective,
    DatePickerTriggerDirective,
    DatePickerSurfaceDirective,
  ],
})
class DateTimeInputTestHost {
  value = signal<string | null>(null);
  mixed = signal(false);
  disabled = signal(false);
  pickDate = new Date(2026, 6, 16);
  pickTime = new Date(2026, 0, 1, 21, 45);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('DateTimeInputDirective', () => {
  let fixture: ComponentFixture<DateTimeInputTestHost>;
  let host: DateTimeInputTestHost;
  let dateTimeInput: DateTimeInputDirective;
  let field: HTMLInputElement;
  let trigger: HTMLButtonElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  // overlays render into the document - scope queries to the newest pane so a pane
  // stuck in its leave transition (jsdom fires no transition events) can't pollute them
  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;
  const paneButton = (selector: string) => pane()?.querySelector<HTMLButtonElement>(selector) ?? null;

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

    TestBed.configureTestingModule({ imports: [DateTimeInputTestHost] });
    fixture = TestBed.createComponent(DateTimeInputTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    dateTimeInput = fixture.debugElement.children[0]!.injector.get(DateTimeInputDirective);
    field = fixture.nativeElement.querySelector('input');
    trigger = fixture.nativeElement.querySelector('.open-picker');
  });

  afterEach(async () => {
    dateTimeInput.closePicker();
    tick();
    await flushFrames();
  });

  it('commits a strict displayFormat parse on blur', () => {
    typeAndBlur('07/16/2026, 14:30');

    expect(host.value()).toBe('2026-07-16 14:30');
    expect(dateTimeInput.parseError()).toBe(false);
    expect(field.value).toBe('07/16/2026, 14:30');
    expect(dateTimeInput.touched()).toBe(true);
  });

  it('commits lenient entry and reformats it', () => {
    typeAndBlur('07/16/2026 930pm');

    expect(host.value()).toBe('2026-07-16 21:30');
    expect(field.value).toBe('07/16/2026, 21:30');
  });

  it('commits a bare date at midnight', () => {
    typeAndBlur('07/16/2026');

    expect(host.value()).toBe('2026-07-16 00:00');
    expect(field.value).toBe('07/16/2026, 00:00');
  });

  it('commits and reformats on Enter without losing focus', () => {
    field.focus();
    field.value = '07/16/2026 930';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    tick();
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    tick();

    expect(host.value()).toBe('2026-07-16 09:30');
    expect(field.value).toBe('07/16/2026, 09:30');
  });

  it('keeps unparseable text visible and raises parseError with a null value', () => {
    typeAndBlur('07/16/2026, 14:30');
    typeAndBlur('not a date');

    expect(host.value()).toBeNull();
    expect(dateTimeInput.parseError()).toBe(true);
    expect(dateTimeInput.shouldDisplayError()).toBe(true);
    expect(field.value).toBe('not a date');
    expect(dateTimeInput.hasValue()).toBe(true);
  });

  it('clears the value on empty input', () => {
    typeAndBlur('07/16/2026, 14:30');
    typeAndBlur('');

    expect(host.value()).toBeNull();
    expect(dateTimeInput.parseError()).toBe(false);
    expect(dateTimeInput.hasValue()).toBe(false);
  });

  it('displays a prefilled value in the display format', async () => {
    host.value.set('2026-12-24 09:15');
    tick();
    await fixture.whenStable();

    expect(field.value).toBe('12/24/2026, 09:15');
    expect(dateTimeInput.dateTime()).toEqual(new Date(2026, 11, 24, 9, 15));
  });

  it('merges a picked day into the committed time and keeps the picker open', async () => {
    host.value.set('2026-12-24 09:15');
    tick();

    await openPicker();

    expect(dateTimeInput.pickerOpen()).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    paneButton('.pick-date')?.click();
    tick();

    expect(host.value()).toBe('2026-07-16 09:15');
    expect(dateTimeInput.pickerOpen()).toBe(true);
    expect(dateTimeInput.touched()).toBe(true);
  });

  it('merges a picked time into the committed day and keeps the picker open', async () => {
    host.value.set('2026-12-24 09:15');
    tick();

    await openPicker();

    paneButton('.pick-time')?.click();
    tick();

    expect(host.value()).toBe('2026-12-24 21:45');
    expect(dateTimeInput.pickerOpen()).toBe(true);
  });

  it('holds a day picked from empty until a time completes it', async () => {
    await openPicker();

    paneButton('.pick-date')?.click();
    tick();

    expect(host.value()).toBeNull();
    expect(dateTimeInput.hasValue()).toBe(true);
    expect(dateTimeInput.displayValue()).toBe('07/16/2026, __:__');
    expect(dateTimeInput.pickerDate()).toEqual(host.pickDate);
    expect(dateTimeInput.pickerTime()).toBeNull();

    paneButton('.pick-time')?.click();
    tick();

    expect(host.value()).toBe('2026-07-16 21:45');
    expect(field.value).toBe('07/16/2026, 21:45');
  });

  it('holds a time picked from empty until a day completes it', async () => {
    await openPicker();

    paneButton('.pick-time')?.click();
    tick();

    expect(host.value()).toBeNull();
    expect(dateTimeInput.displayValue()).toBe('__/__/____, 21:45');
    expect(dateTimeInput.pickerDate()).toBeNull();
    expect(dateTimeInput.pickerTime()).toEqual(host.pickTime);

    paneButton('.pick-date')?.click();
    tick();

    expect(host.value()).toBe('2026-07-16 21:45');
  });

  it('keeps a held half across an unedited blur', async () => {
    await openPicker();

    paneButton('.pick-date')?.click();
    tick();

    field.focus();
    field.blur();
    field.dispatchEvent(new Event('blur'));
    tick();

    expect(dateTimeInput.parseError()).toBe(false);
    expect(dateTimeInput.displayValue()).toBe('07/16/2026, __:__');
  });

  it('drops a held half once the field is typed into', async () => {
    await openPicker();

    paneButton('.pick-date')?.click();
    tick();

    typeAndBlur('12/24/2026, 08:00');

    expect(host.value()).toBe('2026-12-24 08:00');

    paneButton('.pick-time')?.click();
    tick();

    // the typed day won, so the time lands on it rather than completing the dropped half
    expect(host.value()).toBe('2026-12-24 21:45');
  });

  it('clears a held half with the value', async () => {
    await openPicker();

    paneButton('.pick-date')?.click();
    tick();

    dateTimeInput.clearValue();
    tick();

    expect(dateTimeInput.displayValue()).toBe('');
    expect(dateTimeInput.hasValue()).toBe(false);
  });

  it('closes the picker on an outside pointerdown', async () => {
    await openPicker();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    tick();
    await flushFrames();

    expect(dateTimeInput.pickerOpen()).toBe(false);
  });

  it('opens the picker with Alt+ArrowDown from the field', async () => {
    field.focus();
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    tick();
    await flushFrames();
    tick();

    expect(dateTimeInput.pickerOpen()).toBe(true);
  });

  it('ignores the trigger while disabled', async () => {
    host.disabled.set(true);
    tick();

    expect(trigger.disabled).toBe(true);

    dateTimeInput.openPicker();
    tick();

    expect(dateTimeInput.pickerOpen()).toBe(false);
  });

  describe('mixed (bulk edit)', () => {
    const enterMixed = () => {
      host.value.set('2026-03-05 08:15');
      host.mixed.set(true);
      tick();
    };

    it('renders the field empty with the mixed label as placeholder', () => {
      enterMixed();

      expect(field.value).toBe('');
      expect(field.getAttribute('placeholder')).toBe('Mixed');
      expect(dateTimeInput.displayValue()).toBe('');
      expect(dateTimeInput.dateTime()).toBeNull();
      expect(dateTimeInput.hasValue()).toBe(true);
    });

    it('keeps mixed and the raw value on a failed typed parse', () => {
      enterMixed();
      typeAndBlur('not a date');

      expect(host.mixed()).toBe(true);
      expect(host.value()).toBe('2026-03-05 08:15');
      expect(dateTimeInput.parseError()).toBe(true);
    });

    it('keeps mixed and the raw value on a blank blur commit', () => {
      enterMixed();
      typeAndBlur('');

      expect(host.mixed()).toBe(true);
      expect(host.value()).toBe('2026-03-05 08:15');
    });

    it('replaces on a picked day: the hidden value goes, the day is held', async () => {
      enterMixed();
      await openPicker();

      expect(host.mixed()).toBe(true);

      paneButton('.pick-date')?.click();
      tick();

      expect(host.mixed()).toBe(false);
      // the hidden 08:15 must not leak into the fresh pick - replace semantics
      expect(host.value()).toBeNull();
      expect(dateTimeInput.displayValue()).toBe('07/16/2026, __:__');
      expect(dateTimeInput.pickerOpen()).toBe(true);

      paneButton('.pick-time')?.click();
      tick();

      expect(host.value()).toBe('2026-07-16 21:45');
    });

    it('replaces on a picked time: the hidden value goes, the time is held', async () => {
      enterMixed();
      await openPicker();

      paneButton('.pick-time')?.click();
      tick();

      expect(host.mixed()).toBe(false);
      // the hidden 2026-03-05 must not leak into the fresh pick - replace semantics
      expect(host.value()).toBeNull();
      expect(dateTimeInput.displayValue()).toBe('__/__/____, 21:45');
    });
  });
});

describe('DateTimeInputDirective mixed state', () => {
  describeMixedStateContract(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({ imports: [DateTimeInputTestHost] });

    const fixture = TestBed.createComponent(DateTimeInputTestHost);

    fixture.detectChanges();

    const dateTimeInput = fixture.debugElement.children[0]!.injector.get(DateTimeInputDirective);
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
        fixture.componentInstance.value.set('2026-03-05 08:15');
        fixture.componentInstance.mixed.set(true);
        tick();
      },
      rawValue: () => '2026-03-05 08:15',
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => fixture.debugElement.children[0]!.nativeElement as HTMLElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set('2026-01-01 12:00');
        tick();
      },
      externallyWrittenValue: () => '2026-01-01 12:00',
      commit: () => typeAndBlur('07/20/2026, 14:30'),
      committedValue: () => '2026-07-20 14:30',
      assertMasked: () => {
        expect(dateTimeInput.dateTime()).toBeNull();
        expect(dateTimeInput.displayValue()).toBe('');
        expect(field.value).toBe('');
        expect(field.getAttribute('placeholder')).toBe('Mixed');
      },
      clear: () => {
        dateTimeInput.clearValue();
        tick();
      },
      emptyValue: () => null,
    };
  });
});
