import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { CalendarCellDirective } from './calendar-cell.directive';
import { CalendarGridDirective } from './calendar-grid.directive';
import { CalendarDirective, CalendarMode, CalendarRange } from './calendar.directive';

@Component({
  template: `
    <div
      #cal="etCalendar"
      [(value)]="value"
      [(rangeValue)]="rangeValue"
      [(activeMonth)]="activeMonth"
      [mode]="mode()"
      [min]="min()"
      [max]="max()"
      [dateFilter]="dateFilter()"
      [firstDayOfWeek]="1"
      etCalendar
    >
      <div etCalendarGrid>
        @for (week of cal.weeks(); track $index) {
          <div role="row">
            @for (cell of week; track cell.date.getTime()) {
              <button [cell]="cell" etCalendarCell type="button">{{ cell.dayOfMonth }}</button>
            }
          </div>
        }
      </div>
    </div>
  `,
  imports: [CalendarDirective, CalendarGridDirective, CalendarCellDirective],
})
class HostComponent {
  mode = signal<CalendarMode>('single');
  min = signal<Date | null>(null);
  max = signal<Date | null>(null);
  dateFilter = signal<((date: Date) => boolean) | null>(null);
  value = signal<Date | null>(null);
  rangeValue = signal<CalendarRange>({ start: null, end: null });
  activeMonth = signal<Date | null>(new Date(2026, 6, 1));
}

describe('CalendarDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let calendar: CalendarDirective;

  const grid = () => fixture.nativeElement.querySelector('[role="grid"]') as HTMLElement;
  const cells = () => Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('[etcalendarcell]'));
  const cellFor = (label: number, extraSelector = '') => {
    const matches = cells().filter(
      (cell) => cell.textContent?.trim() === `${label}` && (!extraSelector || cell.matches(extraSelector)),
    );

    return matches.find((cell) => !cell.hasAttribute('data-outside-month')) ?? matches[0] ?? null;
  };
  const focusedCell = () => cells().find((cell) => cell.tabIndex === 0) ?? null;

  const keydown = (key: string, shiftKey = false) => {
    grid().dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    calendar = fixture.debugElement.children[0]!.injector.get(CalendarDirective);
    await fixture.whenStable();
  });

  it('renders the weeks covering the active month', () => {
    expect(calendar.weeks()).toHaveLength(5);
    expect(cells()).toHaveLength(35);
    // Monday-based July 2026 starts with June 29th from the outside month
    expect(cells()[0]?.textContent?.trim()).toBe('29');
    expect(cells()[0]?.hasAttribute('data-outside-month')).toBe(true);
  });

  it('selects a single date on click', () => {
    cellFor(16)?.click();
    fixture.detectChanges();

    expect(host.value()).toEqual(new Date(2026, 6, 16));
    expect(cellFor(16)?.getAttribute('aria-selected')).toBe('true');
    expect(cellFor(16)?.hasAttribute('data-selected')).toBe(true);
  });

  it('builds a range across two clicks and restarts on an earlier third click', () => {
    host.mode.set('range');
    fixture.detectChanges();

    cellFor(10)?.click();
    fixture.detectChanges();

    expect(host.rangeValue()).toEqual({ start: new Date(2026, 6, 10), end: null });

    cellFor(14)?.click();
    fixture.detectChanges();

    expect(host.rangeValue()).toEqual({ start: new Date(2026, 6, 10), end: new Date(2026, 6, 14) });
    expect(cellFor(10)?.hasAttribute('data-range-start')).toBe(true);
    expect(cellFor(14)?.hasAttribute('data-range-end')).toBe(true);
    expect(cellFor(12)?.hasAttribute('data-in-range')).toBe(true);
    expect(cellFor(10)?.getAttribute('data-band')).toBe('start');
    expect(cellFor(12)?.getAttribute('data-band')).toBe('middle');
    expect(cellFor(14)?.getAttribute('data-band')).toBe('end');

    cellFor(5)?.click();
    fixture.detectChanges();

    expect(host.rangeValue()).toEqual({ start: new Date(2026, 6, 5), end: null });
  });

  it('previews the pending range while hovering', () => {
    host.mode.set('range');
    fixture.detectChanges();

    cellFor(10)?.click();
    fixture.detectChanges();

    cellFor(13)?.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    fixture.detectChanges();

    expect(cellFor(11)?.hasAttribute('data-preview')).toBe(true);
    expect(cellFor(13)?.hasAttribute('data-preview')).toBe(true);
    expect(cellFor(15)?.hasAttribute('data-preview')).toBe(false);

    grid().dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
    fixture.detectChanges();

    expect(cellFor(11)?.hasAttribute('data-preview')).toBe(false);
  });

  it('moves the roving focus with the keyboard', () => {
    cellFor(16)?.focus();
    calendar.focusedDate.set(new Date(2026, 6, 16));
    fixture.detectChanges();

    keydown('ArrowRight');
    expect(focusedCell()?.textContent?.trim()).toBe('17');

    keydown('ArrowDown');
    expect(focusedCell()?.textContent?.trim()).toBe('24');

    keydown('Home');
    expect(focusedCell()?.textContent?.trim()).toBe('20');
  });

  it('follows keyboard focus across month boundaries', () => {
    calendar.focusedDate.set(new Date(2026, 6, 31));
    fixture.detectChanges();

    keydown('ArrowRight');

    expect(host.activeMonth()).toEqual(new Date(2026, 7, 1));
    expect(calendar.focusedDate()).toEqual(new Date(2026, 7, 1));
  });

  it('jumps months and years with PageUp/PageDown', () => {
    calendar.focusedDate.set(new Date(2026, 6, 16));
    fixture.detectChanges();

    keydown('PageDown');
    expect(host.activeMonth()).toEqual(new Date(2026, 7, 1));

    keydown('PageUp', true);
    expect(host.activeMonth()).toEqual(new Date(2025, 7, 1));
  });

  it('disables dates outside min/max and via the date filter', () => {
    host.min.set(new Date(2026, 6, 10));
    host.max.set(new Date(2026, 6, 20));
    host.dateFilter.set((date) => date.getDay() !== 0);
    fixture.detectChanges();

    expect(cellFor(9)?.hasAttribute('data-disabled')).toBe(true);
    expect(cellFor(21)?.hasAttribute('data-disabled')).toBe(true);
    // July 12th 2026 is a Sunday inside min/max
    expect(cellFor(12)?.hasAttribute('data-disabled')).toBe(true);
    expect(cellFor(15)?.hasAttribute('data-disabled')).toBe(false);

    cellFor(9)?.click();
    fixture.detectChanges();

    expect(host.value()).toBeNull();
  });

  it('navigates months and honors min/max on the nav guards', () => {
    calendar.nextMonth();
    fixture.detectChanges();

    expect(host.activeMonth()).toEqual(new Date(2026, 7, 1));

    calendar.previousMonth();
    fixture.detectChanges();

    expect(host.activeMonth()).toEqual(new Date(2026, 6, 1));

    host.min.set(new Date(2026, 6, 10));
    host.max.set(new Date(2026, 6, 20));
    fixture.detectChanges();

    expect(calendar.canGoPrev()).toBe(false);
    expect(calendar.canGoNext()).toBe(false);
  });

  it('marks today with aria-current', () => {
    host.activeMonth.set(null);
    host.value.set(null);
    fixture.detectChanges();

    const today = cells().find((cell) => cell.getAttribute('aria-current') === 'date');

    expect(today?.textContent?.trim()).toBe(`${new Date().getDate()}`);
  });
});
