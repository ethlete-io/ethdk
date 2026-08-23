import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { tick } from '../../testing/driver-core';
import { column, columns, option, press } from '../testing/time-picker-driver';
import { TimePickerColumnDirective } from './time-picker-column.directive';
import { TimePickerOptionDirective } from './time-picker-option.directive';
import { TimePickerDirective } from './time-picker.directive';

@Component({
  template: `
    <div
      #picker="etTimePicker"
      [(value)]="value"
      [format]="format()"
      [minuteStep]="minuteStep()"
      [min]="min()"
      [max]="max()"
      [timeFilter]="timeFilter()"
      etTimePicker
    >
      @for (column of picker.columns(); track column.unit) {
        <div [column]="column" [attr.data-unit]="column.unit" etTimePickerColumn>
          @for (option of column.options; track option.value) {
            <button [option]="option" [attr.data-value]="option.value" etTimePickerOption>{{ option.label }}</button>
          }
        </div>
      }
    </div>
  `,
  imports: [TimePickerDirective, TimePickerColumnDirective, TimePickerOptionDirective],
})
class TimePickerTestHost {
  value = signal<Date | null>(null);
  format = signal('HH:mm');
  minuteStep = signal(5);
  min = signal<Date | null>(null);
  max = signal<Date | null>(null);
  timeFilter = signal<((date: Date) => boolean) | null>(null);
}

describe('TimePickerDirective', () => {
  let fixture: ComponentFixture<TimePickerTestHost>;
  let host: TimePickerTestHost;

  const selectedIn = (unit: string) =>
    column(fixture, unit)?.querySelector<HTMLButtonElement>('[data-selected]') ?? null;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TimePickerTestHost] });
    fixture = TestBed.createComponent(TimePickerTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders hour and minute columns for a 24-hour format without seconds', () => {
    expect(columns(fixture).map((columnElement) => columnElement.dataset['unit'])).toEqual(['hour', 'minute']);
    expect(column(fixture, 'hour')?.querySelectorAll('button').length).toBe(24);
    expect(column(fixture, 'minute')?.querySelectorAll('button').length).toBe(12);
    expect(column(fixture, 'hour')?.getAttribute('role')).toBe('listbox');
    expect(column(fixture, 'hour')?.getAttribute('aria-label')).toBe('Hours');
  });

  it('adds seconds and period columns per format', () => {
    host.format.set('h:mm:ss a');
    tick();

    expect(columns(fixture).map((columnElement) => columnElement.dataset['unit'])).toEqual([
      'hour',
      'minute',
      'second',
      'period',
    ]);
    expect(column(fixture, 'hour')?.querySelectorAll('button').length).toBe(12);
    expect(option(fixture, 'hour', 0)?.textContent?.trim()).toBe('12');
  });

  it('holds the picks made while empty and commits once every column has one', () => {
    option(fixture, 'minute', 30)?.click();
    tick();

    // a minute alone is not a time; committing one would invent the hour
    expect(host.value()).toBeNull();
    expect(selectedIn('minute')?.dataset['value']).toBe('30');
    expect(selectedIn('hour')).toBeNull();

    option(fixture, 'hour', 9)?.click();
    tick();

    expect(host.value()?.getHours()).toBe(9);
    expect(host.value()?.getMinutes()).toBe(30);
    expect(selectedIn('hour')?.dataset['value']).toBe('9');
    expect(selectedIn('hour')?.getAttribute('aria-selected')).toBe('true');
  });

  it('edits the value directly once it is whole', () => {
    option(fixture, 'minute', 30)?.click();
    option(fixture, 'hour', 9)?.click();
    tick();

    option(fixture, 'hour', 11)?.click();
    tick();

    expect(host.value()?.getHours()).toBe(11);
    expect(host.value()?.getMinutes()).toBe(30);
  });

  it('keeps an off-step selection visible in its column', async () => {
    host.value.set(new Date(2026, 6, 17, 9, 32));
    tick();
    await fixture.whenStable();

    expect(selectedIn('minute')?.textContent?.trim()).toBe('32');

    const values = Array.from(column(fixture, 'minute')?.querySelectorAll<HTMLElement>('button') ?? []).map(
      (button) => button.dataset['value'],
    );

    expect(values).toContain('32');
    expect(values.indexOf('32')).toBe(values.indexOf('30') + 1);
  });

  it('clamps a zero, negative or fractional minuteStep to one minute instead of hanging', () => {
    host.minuteStep.set(0);
    tick();

    expect(column(fixture, 'minute')?.querySelectorAll('button').length).toBe(60);

    host.minuteStep.set(-5);
    tick();

    expect(column(fixture, 'minute')?.querySelectorAll('button').length).toBe(60);

    host.minuteStep.set(0.5);
    tick();

    expect(column(fixture, 'minute')?.querySelectorAll('button').length).toBe(60);
  });

  it('keeps a clamped step focusable by the keyboard', async () => {
    host.minuteStep.set(Number.NaN);
    tick();
    await fixture.whenStable();

    const options = Array.from(column(fixture, 'minute')?.querySelectorAll<HTMLButtonElement>('button') ?? []);

    expect(options.length).toBe(60);
    expect(options.some((option) => option.tabIndex === 0)).toBe(true);
  });

  it('maps 12-hour picks through the period', async () => {
    host.format.set('h:mm a');
    host.value.set(new Date(2026, 6, 17, 14, 0));
    tick();
    await fixture.whenStable();

    expect(selectedIn('hour')?.textContent?.trim()).toBe('2');
    expect(selectedIn('period')?.dataset['value']).toBe('1');

    option(fixture, 'hour', 9)?.click();
    tick();

    expect(host.value()?.getHours()).toBe(21);

    option(fixture, 'period', 0)?.click();
    tick();

    expect(host.value()?.getHours()).toBe(9);
  });

  it('holds an AM/PM pick made while empty instead of committing a time nobody chose', () => {
    host.format.set('h:mm a');
    tick();

    option(fixture, 'period', 1)?.click();
    tick();

    expect(host.value()).toBeNull();
    // the half-day still reads as picked, and no other column claims a value
    expect(selectedIn('period')?.dataset['value']).toBe('1');
    expect(selectedIn('hour')).toBeNull();
    expect(selectedIn('minute')).toBeNull();
  });

  it('commits without an AM/PM pick, in the half-day the anchor already sits in', () => {
    host.format.set('h:mm a');
    tick();

    option(fixture, 'hour', 9)?.click();
    option(fixture, 'minute', 30)?.click();
    tick();

    // an hour is always in some half-day, so an untouched AM/PM column holds nothing up
    expect(host.value()?.getHours()).toBe(new Date().getHours() < 12 ? 9 : 21);
    expect(host.value()?.getMinutes()).toBe(30);
    expect(selectedIn('period')).not.toBeNull();
  });

  it('completes a held AM/PM into the half-day the later picks land in', () => {
    host.format.set('h:mm a');
    tick();

    option(fixture, 'period', 1)?.click();
    tick();

    option(fixture, 'hour', 9)?.click();
    tick();

    // an hour on top of a half-day is still not a time - the minute is nobody's pick yet
    expect(host.value()).toBeNull();
    expect(selectedIn('hour')?.dataset['value']).toBe('9');
    expect(selectedIn('minute')).toBeNull();

    option(fixture, 'minute', 30)?.click();
    tick();

    expect(host.value()?.getHours()).toBe(21);
    expect(host.value()?.getMinutes()).toBe(30);
  });

  it('moves the selection with arrows, wrapping at the edges', async () => {
    host.value.set(new Date(2026, 6, 17, 23, 0));
    tick();
    await fixture.whenStable();

    press(fixture, 'hour', 'ArrowDown');
    tick();

    expect(host.value()?.getHours()).toBe(0);

    press(fixture, 'hour', 'ArrowUp');
    tick();

    expect(host.value()?.getHours()).toBe(23);

    press(fixture, 'minute', 'End');
    tick();

    expect(host.value()?.getMinutes()).toBe(55);

    press(fixture, 'minute', 'Home');
    tick();

    expect(host.value()?.getMinutes()).toBe(0);
  });

  it('jumps to a typed option', async () => {
    host.value.set(new Date(2026, 6, 17, 8, 0));
    tick();
    await fixture.whenStable();

    press(fixture, 'hour', '1');
    press(fixture, 'hour', '7');
    tick();

    expect(host.value()?.getHours()).toBe(17);
  });

  describe('bounds and filter', () => {
    const disabledIn = (unit: string) =>
      Array.from(column(fixture, unit)?.querySelectorAll<HTMLElement>('[data-disabled]') ?? []).map(
        (button) => button.dataset['value'],
      );

    beforeEach(async () => {
      host.value.set(new Date(2026, 6, 17, 12, 0));
      tick();
      await fixture.whenStable();
    });

    it('leaves every option selectable without bounds or a filter', () => {
      expect(disabledIn('hour')).toEqual([]);
      expect(disabledIn('minute')).toEqual([]);
      expect(option(fixture, 'hour', 3)?.hasAttribute('aria-disabled')).toBe(false);
    });

    it('disables the hours and minutes outside min/max', () => {
      host.min.set(new Date(2026, 6, 17, 9, 30));
      host.max.set(new Date(2026, 6, 17, 17, 0));
      tick();

      expect(disabledIn('hour')).toEqual([
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '18',
        '19',
        '20',
        '21',
        '22',
        '23',
      ]);
      expect(option(fixture, 'hour', 8)?.getAttribute('aria-disabled')).toBe('true');

      // the noon selection is inside the bounds, so every minute of it is open
      expect(disabledIn('minute')).toEqual([]);

      // …at the boundary hour only the minutes at or after 09:30 are
      host.value.set(new Date(2026, 6, 17, 9, 30));
      tick();

      expect(disabledIn('minute')).toEqual(['0', '5', '10', '15', '20', '25']);
    });

    it('disables an hour only when no minute inside it is selectable', () => {
      // 14:00–14:59 stays open through its later minutes
      host.max.set(new Date(2026, 6, 17, 14, 20));
      tick();

      expect(disabledIn('hour')).toEqual(['15', '16', '17', '18', '19', '20', '21', '22', '23']);
    });

    it('asks the filter with the full candidate timestamp', () => {
      const seen: Date[] = [];

      host.timeFilter.set((date) => {
        seen.push(date);

        return date.getHours() % 2 === 0;
      });
      tick();

      expect(disabledIn('hour')).toEqual(['1', '3', '5', '7', '9', '11', '13', '15', '17', '19', '21', '23']);
      expect(seen.every((date) => date.getDate() === 17)).toBe(true);
    });

    it('refuses a click on a disabled option', () => {
      host.min.set(new Date(2026, 6, 17, 9));
      tick();

      option(fixture, 'hour', 4)!.click();
      tick();

      expect(host.value()?.getHours()).toBe(12);
    });

    it('moves the finer parts of a pick onto the first selectable value', () => {
      host.min.set(new Date(2026, 6, 17, 9, 40));
      host.max.set(new Date(2026, 6, 17, 18, 10));
      tick();

      // 09:00 is out of bounds, so the hour pick lands on the first open minute
      option(fixture, 'hour', 9)?.click();
      tick();

      expect([host.value()?.getHours(), host.value()?.getMinutes()]).toEqual([9, 40]);

      option(fixture, 'hour', 18)?.click();
      tick();

      expect([host.value()?.getHours(), host.value()?.getMinutes()]).toEqual([18, 0]);
    });

    it('skips disabled options with the keyboard', () => {
      host.timeFilter.set((date) => date.getHours() % 2 === 0);
      tick();

      press(fixture, 'hour', 'ArrowDown');
      tick();

      expect(host.value()?.getHours()).toBe(14);

      press(fixture, 'hour', 'ArrowUp');
      press(fixture, 'hour', 'ArrowUp');
      tick();

      expect(host.value()?.getHours()).toBe(10);

      press(fixture, 'hour', 'Home');
      tick();

      expect(host.value()?.getHours()).toBe(0);

      press(fixture, 'hour', 'End');
      tick();

      expect(host.value()?.getHours()).toBe(22);
    });

    it('skips disabled options when typing', () => {
      host.min.set(new Date(2026, 6, 17, 10));
      tick();

      press(fixture, 'hour', '1');
      tick();

      // hour 1 is out of bounds, so the query falls through to the next match
      expect(host.value()?.getHours()).toBe(10);
    });

    it('selects nothing when a typed query only matches a disabled option', () => {
      host.min.set(new Date(2026, 6, 17, 10));
      tick();

      // "4" matches hour 4 alone - 14 and 24 read as "14"/"24", not "4"
      press(fixture, 'hour', '4');
      tick();

      expect(host.value()?.getHours()).toBe(12);
    });

    it('moves the hour inside the picked half-day when the clock position is closed', async () => {
      host.format.set('h:mm a');
      host.value.set(new Date(2026, 6, 17, 10, 0));
      host.timeFilter.set((date) => date.getHours() >= 9 && date.getHours() < 17);
      tick();
      await fixture.whenStable();

      // 10 PM is closed, so the pick lands on the closest open PM hour instead of doing nothing
      option(fixture, 'period', 1)?.click();
      tick();

      expect([host.value()?.getHours(), host.value()?.getMinutes()]).toEqual([16, 0]);

      option(fixture, 'period', 0)?.click();
      tick();

      // 4 AM is closed too - back to the closest open AM hour
      expect(host.value()?.getHours()).toBe(9);
    });

    it('disables a half-day with no selectable hour', async () => {
      host.format.set('h:mm a');
      host.min.set(new Date(2026, 6, 17, 13));
      tick();
      await fixture.whenStable();

      expect(option(fixture, 'period', 0)?.getAttribute('aria-disabled')).toBe('true');
      expect(option(fixture, 'period', 1)?.hasAttribute('aria-disabled')).toBe(false);
    });
  });

  it('roves the tabindex with the selection', async () => {
    host.value.set(new Date(2026, 6, 17, 9, 15));
    tick();
    await fixture.whenStable();

    expect(option(fixture, 'hour', 9)?.tabIndex).toBe(0);
    expect(option(fixture, 'hour', 10)?.tabIndex).toBe(-1);

    option(fixture, 'hour', 10)?.click();
    tick();

    expect(option(fixture, 'hour', 9)?.tabIndex).toBe(-1);
    expect(option(fixture, 'hour', 10)?.tabIndex).toBe(0);
  });
});
