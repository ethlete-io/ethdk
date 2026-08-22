import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { CalendarCellDirective } from './calendar-cell.directive';
import { createFixedLengthRangeStrategy, createWeekRangeStrategy } from './calendar-range-strategy';
import { CalendarGridDirective } from './calendar-grid.directive';
import {
  CalendarDateClassFn,
  CalendarDirective,
  CalendarMode,
  CalendarPrecision,
  CalendarRange,
  CalendarRangeSelectionStrategy,
  CalendarView,
} from './calendar.directive';

@Component({
  template: `
    <div
      #cal="etCalendar"
      [(value)]="value"
      [(rangeValue)]="rangeValue"
      [(multipleValue)]="multipleValue"
      [(activeMonth)]="activeMonth"
      [mode]="mode()"
      [min]="min()"
      [max]="max()"
      [dateFilter]="dateFilter()"
      [startAt]="startAt()"
      [precision]="precision()"
      [monthsShown]="monthsShown()"
      [startView]="startView()"
      [dateClass]="dateClass()"
      [rangeSelectionStrategy]="rangeStrategy()"
      [comparisonStart]="comparisonStart()"
      [comparisonEnd]="comparisonEnd()"
      [firstDayOfWeek]="1"
      (monthSelect)="monthSelect.set($event)"
      (yearSelect)="yearSelect.set($event)"
      etCalendar
    >
      <div etCalendarGrid>
        @switch (cal.view()) {
          @case ('year') {
            @for (row of cal.monthCells(); track $index) {
              <div role="row">
                @for (cell of row; track cell.date.getTime()) {
                  <button [cell]="cell" class="cell" etCalendarCell type="button">{{ cell.label }}</button>
                }
              </div>
            }
          }
          @case ('multiYear') {
            @for (row of cal.yearCells(); track $index) {
              <div role="row">
                @for (cell of row; track cell.date.getTime()) {
                  <button [cell]="cell" class="cell" etCalendarCell type="button">{{ cell.label }}</button>
                }
              </div>
            }
          }
          @default {
            @for (page of cal.monthPages(); track page.key) {
              @for (week of page.weeks; track $index) {
                <div role="row">
                  @for (cell of week; track cell.date.getTime()) {
                    @if (cell.outsideMonth && cal.monthsShown() > 1) {
                      <span class="empty"></span>
                    } @else {
                      <button [cell]="cell" class="cell" etCalendarCell type="button">{{ cell.label }}</button>
                    }
                  }
                </div>
              }
            }
          }
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
  startAt = signal<Date | null>(null);
  precision = signal<CalendarPrecision>('day');
  monthsShown = signal(1);
  startView = signal<CalendarView>('month');
  dateClass = signal<CalendarDateClassFn | null>(null);
  rangeStrategy = signal<CalendarRangeSelectionStrategy | null>(null);
  comparisonStart = signal<Date | null>(null);
  comparisonEnd = signal<Date | null>(null);
  value = signal<Date | null>(null);
  rangeValue = signal<CalendarRange>({ start: null, end: null });
  multipleValue = signal<Date[]>([]);
  activeMonth = signal<Date | null>(new Date(2026, 6, 1));
  monthSelect = signal<Date | null>(null);
  yearSelect = signal<Date | null>(null);
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

  it('ignores keys that bubble out of a form field inside the grid', () => {
    calendar.focusedDate.set(new Date(2026, 6, 16));
    fixture.detectChanges();

    const input = document.createElement('input');
    grid().appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    input.remove();

    expect(calendar.focusedDate()).toEqual(new Date(2026, 6, 16));
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

  it('opens an empty calendar at startAt and focuses its day', () => {
    host.activeMonth.set(null);
    host.startAt.set(new Date(2027, 2, 12));
    fixture.detectChanges();

    expect(calendar.visibleMonth()).toEqual(new Date(2027, 2, 1));
    expect(focusedCell()?.textContent?.trim()).toBe('12');
  });

  it('lets a value and an explicit activeMonth win over startAt', () => {
    host.activeMonth.set(null);
    host.startAt.set(new Date(2027, 2, 12));
    host.value.set(new Date(2026, 6, 8));
    fixture.detectChanges();

    expect(calendar.visibleMonth()).toEqual(new Date(2026, 6, 1));

    host.activeMonth.set(new Date(2025, 0, 1));
    fixture.detectChanges();

    expect(calendar.visibleMonth()).toEqual(new Date(2025, 0, 1));
  });

  describe('view drilling', () => {
    const cellWithText = (text: string) => cells().find((cell) => cell.textContent?.trim() === text) ?? null;

    it('zooms out through the views and back to the day grid from the last', () => {
      expect(calendar.headerLabel()).toBe('July 2026');
      // read once first: the direction is history, which only starts where a template's first render does
      expect(calendar.navigationDirection()).toBeNull();

      calendar.zoomOut();
      fixture.detectChanges();

      expect(calendar.view()).toBe('year');
      expect(calendar.headerLabel()).toBe('2026');
      expect(cells()).toHaveLength(12);
      expect(calendar.navigationDirection()).toBe('zoomOut');

      calendar.zoomOut();
      fixture.detectChanges();

      expect(calendar.view()).toBe('multiYear');
      expect(calendar.headerLabel()).toBe('2016 – 2039');
      expect(cells()).toHaveLength(24);
      expect(calendar.canZoomOut()).toBe(false);

      calendar.zoomOut();
      fixture.detectChanges();

      expect(calendar.view()).toBe('month');
      expect(calendar.navigationDirection()).toBe('zoomIn');
    });

    it('opens on startView', () => {
      host.startView.set('multiYear');
      fixture.detectChanges();

      expect(calendar.view()).toBe('multiYear');
      expect(cells()).toHaveLength(24);
    });

    it('drills from a year to its months, keeping the month the reader was on', () => {
      host.startView.set('multiYear');
      fixture.detectChanges();

      cellWithText('2031')?.click();
      fixture.detectChanges();

      expect(host.yearSelect()).toEqual(new Date(2031, 0, 1));
      expect(calendar.view()).toBe('year');
      // July, which the day grid was on before the reader drilled out
      expect(calendar.visibleMonth()).toEqual(new Date(2031, 6, 1));
      expect(host.value()).toBeNull();
    });

    it('drills from a month to its day grid without selecting anything', () => {
      host.startView.set('year');
      calendar.focusedDate.set(new Date(2026, 6, 16));
      fixture.detectChanges();

      cellWithText('Mar')?.click();
      fixture.detectChanges();

      expect(host.monthSelect()).toEqual(new Date(2026, 2, 1));
      expect(calendar.view()).toBe('month');
      expect(host.activeMonth()).toEqual(new Date(2026, 2, 1));
      expect(host.value()).toBeNull();
      // the roving focus follows into the month it drilled into, keeping its day
      expect(calendar.focusedDate()).toEqual(new Date(2026, 2, 16));
    });

    it('disables a coarse cell when no day inside it is selectable', () => {
      host.min.set(new Date(2026, 6, 10));
      host.max.set(new Date(2026, 8, 20));
      host.startView.set('year');
      fixture.detectChanges();

      expect(cellWithText('Jun')?.hasAttribute('data-disabled')).toBe(true);
      expect(cellWithText('Jul')?.hasAttribute('data-disabled')).toBe(false);
      expect(cellWithText('Sep')?.hasAttribute('data-disabled')).toBe(false);
      expect(cellWithText('Oct')?.hasAttribute('data-disabled')).toBe(true);

      cellWithText('Oct')?.click();
      fixture.detectChanges();

      expect(calendar.view()).toBe('year');
    });

    it('disables a month the date filter empties out', () => {
      host.dateFilter.set((date) => date.getMonth() !== 7);
      host.startView.set('year');
      fixture.detectChanges();

      expect(cellWithText('Aug')?.hasAttribute('data-disabled')).toBe(true);
      expect(cellWithText('Jul')?.hasAttribute('data-disabled')).toBe(false);
    });

    it('opens the year page on the min bound and disables the years past max', () => {
      host.min.set(new Date(2026, 0, 1));
      host.max.set(new Date(2035, 11, 31));
      host.startView.set('multiYear');
      fixture.detectChanges();

      // pages tile from min's year, so the bound opens one rather than sitting inside it
      expect(calendar.headerLabel()).toBe('2026 – 2049');
      expect(cellWithText('2026')?.hasAttribute('data-disabled')).toBe(false);
      expect(cellWithText('2035')?.hasAttribute('data-disabled')).toBe(false);
      expect(cellWithText('2036')?.hasAttribute('data-disabled')).toBe(true);
      expect(cellWithText('2049')?.hasAttribute('data-disabled')).toBe(true);
    });

    it('moves the roving focus by the unit of the view on show', () => {
      host.startView.set('year');
      fixture.detectChanges();

      keydown('ArrowRight');
      expect(focusedCell()?.textContent?.trim()).toBe('Aug');

      keydown('ArrowDown');
      expect(focusedCell()?.textContent?.trim()).toBe('Dec');

      // out of the visible year, which follows along
      keydown('ArrowRight');
      expect(calendar.visibleYear()).toEqual(new Date(2027, 0, 1));
      expect(focusedCell()?.textContent?.trim()).toBe('Jan');

      keydown('Home');
      expect(focusedCell()?.textContent?.trim()).toBe('Jan');
    });

    it('pages the year grid with the keyboard, taking the visible page along', () => {
      host.startView.set('multiYear');
      fixture.detectChanges();

      expect(focusedCell()?.textContent?.trim()).toBe('2026');

      keydown('ArrowDown');
      expect(focusedCell()?.textContent?.trim()).toBe('2030');

      keydown('PageDown');
      expect(calendar.headerLabel()).toBe('2040 – 2063');
      expect(focusedCell()?.textContent?.trim()).toBe('2054');

      keydown('Home');
      expect(focusedCell()?.textContent?.trim()).toBe('2040');
    });

    it('steps by the unit of the view on show and guards each step against the bounds', () => {
      host.startView.set('year');
      fixture.detectChanges();

      calendar.next();
      fixture.detectChanges();

      expect(calendar.headerLabel()).toBe('2027');
      // the month survives a year step, so drilling back in lands where it left
      expect(calendar.visibleMonth()).toEqual(new Date(2027, 6, 1));

      calendar.previous();
      fixture.detectChanges();

      expect(calendar.headerLabel()).toBe('2026');

      host.min.set(new Date(2026, 0, 1));
      host.max.set(new Date(2026, 11, 31));
      fixture.detectChanges();

      expect(calendar.canGoPrev()).toBe(false);
      expect(calendar.canGoNext()).toBe(false);
    });

    it('does not preview a range while a coarse grid is showing', () => {
      host.mode.set('range');
      fixture.detectChanges();

      cellFor(10)?.click();
      fixture.detectChanges();

      calendar.zoomOut();
      fixture.detectChanges();

      cellWithText('Sep')?.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      fixture.detectChanges();

      expect(calendar.hoveredDate()).toBeNull();
    });
  });

  describe('range selection strategy', () => {
    beforeEach(() => {
      host.mode.set('range');
      fixture.detectChanges();
    });

    it('snaps a pick to its whole week, and previews the week under the pointer', () => {
      host.rangeStrategy.set(createWeekRangeStrategy({ weekStartsOn: 1 }));
      fixture.detectChanges();

      cellFor(16)?.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      fixture.detectChanges();

      // the whole Monday-13th week bands before anything is picked at all
      expect(cellFor(13)?.getAttribute('data-band')).toBe('start');
      expect(cellFor(19)?.getAttribute('data-band')).toBe('end');
      expect(cellFor(20)?.getAttribute('data-band')).toBeNull();

      cellFor(16)?.click();
      fixture.detectChanges();

      expect(host.rangeValue()).toEqual({ start: new Date(2026, 6, 13), end: null });
    });

    it('closes on the second pick, at the end of its week', () => {
      host.rangeStrategy.set(createWeekRangeStrategy({ weekStartsOn: 1 }));
      fixture.detectChanges();

      cellFor(16)?.click();
      cellFor(22)?.click();
      fixture.detectChanges();

      expect(host.rangeValue()).toEqual({ start: new Date(2026, 6, 13), end: new Date(2026, 6, 26) });
      expect(cellFor(13)?.hasAttribute('data-range-start')).toBe(true);
      expect(cellFor(26)?.hasAttribute('data-range-end')).toBe(true);
    });

    it('takes a fixed span from wherever the pick lands, closing the range at once', () => {
      host.rangeStrategy.set(createFixedLengthRangeStrategy({ days: 7 }));
      fixture.detectChanges();

      cellFor(10)?.click();
      fixture.detectChanges();

      expect(host.rangeValue()).toEqual({ start: new Date(2026, 6, 10), end: new Date(2026, 6, 16) });
      expect(cellFor(16)?.hasAttribute('data-range-end')).toBe(true);

      cellFor(20)?.click();
      fixture.detectChanges();

      expect(host.rangeValue()).toEqual({ start: new Date(2026, 6, 20), end: new Date(2026, 6, 26) });
    });

    it('normalizes a strategy result to the calendar precision', () => {
      host.precision.set('month');
      host.rangeStrategy.set(createFixedLengthRangeStrategy({ days: 40 }));
      fixture.detectChanges();

      const monthCell = (label: string) => cells().find((cell) => cell.textContent?.trim() === label) ?? null;

      monthCell('Mar')?.click();
      fixture.detectChanges();

      // March 1st plus 39 days is April 9th, which at month precision is April
      expect(host.rangeValue()).toEqual({ start: new Date(2026, 2, 1), end: new Date(2026, 3, 1) });
    });

    it('keeps the built-in rule when no strategy is named', () => {
      cellFor(10)?.click();
      cellFor(14)?.click();
      fixture.detectChanges();

      expect(host.rangeValue()).toEqual({ start: new Date(2026, 6, 10), end: new Date(2026, 6, 14) });
    });
  });

  describe('comparison range', () => {
    it('bands the compared period alongside the selection', () => {
      host.mode.set('range');
      host.comparisonStart.set(new Date(2026, 6, 3));
      host.comparisonEnd.set(new Date(2026, 6, 9));
      fixture.detectChanges();

      expect(cellFor(3)?.getAttribute('data-comparison-band')).toBe('start');
      expect(cellFor(6)?.getAttribute('data-comparison-band')).toBe('middle');
      expect(cellFor(9)?.getAttribute('data-comparison-band')).toBe('end');
      expect(cellFor(10)?.getAttribute('data-comparison-band')).toBeNull();

      // and it is presentation only: the value is untouched and its cells still select
      expect(host.rangeValue()).toEqual({ start: null, end: null });

      cellFor(6)?.click();
      fixture.detectChanges();

      expect(host.rangeValue().start).toEqual(new Date(2026, 6, 6));
      expect(cellFor(6)?.getAttribute('data-comparison-band')).toBe('middle');
    });

    it('reads the two ends as an interval either way round', () => {
      host.comparisonStart.set(new Date(2026, 6, 9));
      host.comparisonEnd.set(new Date(2026, 6, 3));
      fixture.detectChanges();

      expect(cellFor(3)?.getAttribute('data-comparison-band')).toBe('start');
      expect(cellFor(9)?.getAttribute('data-comparison-band')).toBe('end');
    });

    it('bands a one-day comparison period as a single cell', () => {
      host.comparisonStart.set(new Date(2026, 6, 15));
      host.comparisonEnd.set(new Date(2026, 6, 15));
      fixture.detectChanges();

      expect(cellFor(15)?.getAttribute('data-comparison-band')).toBe('single');
      expect(cellFor(14)?.getAttribute('data-comparison-band')).toBeNull();
    });

    it('needs both ends before it bands anything', () => {
      host.comparisonStart.set(new Date(2026, 6, 3));
      fixture.detectChanges();

      expect(cellFor(3)?.getAttribute('data-comparison-band')).toBeNull();
    });

    it('bands whole months at month precision', () => {
      host.precision.set('month');
      host.comparisonStart.set(new Date(2026, 1, 14));
      host.comparisonEnd.set(new Date(2026, 3, 2));
      fixture.detectChanges();

      const monthCell = (label: string) => cells().find((cell) => cell.textContent?.trim() === label) ?? null;

      expect(monthCell('Feb')?.getAttribute('data-comparison-band')).toBe('start');
      expect(monthCell('Mar')?.getAttribute('data-comparison-band')).toBe('middle');
      expect(monthCell('Apr')?.getAttribute('data-comparison-band')).toBe('end');
      expect(monthCell('May')?.getAttribute('data-comparison-band')).toBeNull();
    });
  });

  describe("'multiple' mode", () => {
    beforeEach(() => {
      host.mode.set('multiple');
      fixture.detectChanges();
    });

    it('collects each pick, ascending, and marks the grid multiselectable', () => {
      expect(grid().getAttribute('aria-multiselectable')).toBe('true');

      cellFor(16)?.click();
      cellFor(3)?.click();
      cellFor(21)?.click();
      fixture.detectChanges();

      expect(host.multipleValue()).toEqual([new Date(2026, 6, 3), new Date(2026, 6, 16), new Date(2026, 6, 21)]);
      expect(cellFor(16)?.getAttribute('aria-selected')).toBe('true');
      expect(cellFor(3)?.hasAttribute('data-selected')).toBe(true);
      expect(cellFor(4)?.hasAttribute('data-selected')).toBe(false);
    });

    it('unpicks a date on a second pick', () => {
      cellFor(16)?.click();
      cellFor(21)?.click();
      fixture.detectChanges();

      cellFor(16)?.click();
      fixture.detectChanges();

      expect(host.multipleValue()).toEqual([new Date(2026, 6, 21)]);
      expect(cellFor(16)?.hasAttribute('data-selected')).toBe(false);
    });

    it('never bands or previews - the dates are unrelated', () => {
      cellFor(10)?.click();
      fixture.detectChanges();

      cellFor(13)?.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      fixture.detectChanges();

      expect(calendar.hoveredDate()).toBeNull();
      expect(cellFor(12)?.hasAttribute('data-in-range')).toBe(false);
      expect(cellFor(12)?.getAttribute('data-band')).toBeNull();
    });

    it('refuses a disabled date and leaves the set alone', () => {
      host.min.set(new Date(2026, 6, 10));
      fixture.detectChanges();

      cellFor(9)?.click();
      fixture.detectChanges();

      expect(host.multipleValue()).toEqual([]);
    });

    it('toggles whole months at month precision', () => {
      host.precision.set('month');
      fixture.detectChanges();

      const monthCell = (label: string) => cells().find((cell) => cell.textContent?.trim() === label) ?? null;

      monthCell('Mar')?.click();
      monthCell('Sep')?.click();
      fixture.detectChanges();

      expect(host.multipleValue()).toEqual([new Date(2026, 2, 1), new Date(2026, 8, 1)]);

      monthCell('Mar')?.click();
      fixture.detectChanges();

      expect(host.multipleValue()).toEqual([new Date(2026, 8, 1)]);
    });

    it('opens at the earliest picked date', () => {
      host.activeMonth.set(null);
      host.multipleValue.set([new Date(2027, 1, 9), new Date(2026, 10, 4)]);
      fixture.detectChanges();

      expect(calendar.visibleMonth()).toEqual(new Date(2027, 1, 1));
    });
  });

  describe('several months at once', () => {
    beforeEach(() => {
      host.monthsShown.set(2);
      fixture.detectChanges();
    });

    it('renders the span, names it, and leaves the neighbouring month’s days to it', () => {
      expect(calendar.monthPages()).toHaveLength(2);
      expect(calendar.monthPages()[0]?.label).toBe('July 2026');
      expect(calendar.monthPages()[1]?.label).toBe('August 2026');
      expect(calendar.headerLabel()).toBe('July – August 2026');
      expect(calendar.lastVisibleMonth()).toEqual(new Date(2026, 7, 1));

      // August 1st belongs to August's grid, and July's own trailing cell for it is not rendered
      const first = cells().filter((cell) => cell.textContent?.trim() === '1');

      expect(first).toHaveLength(2); // July 1st and August 1st, one each
      expect(calendar.weeks()).toEqual(calendar.monthPages()[0]?.weeks);
    });

    it('names the span across a year boundary in full', () => {
      host.activeMonth.set(new Date(2026, 11, 1));
      fixture.detectChanges();

      expect(calendar.headerLabel()).toBe('December 2026 – January 2027');
    });

    it('steps by one month, so the span slides rather than paging', () => {
      calendar.next();
      fixture.detectChanges();

      expect(calendar.visibleMonth()).toEqual(new Date(2026, 7, 1));
      expect(calendar.lastVisibleMonth()).toEqual(new Date(2026, 8, 1));
    });

    it('guards the step against the bounds from the right end of the span', () => {
      host.max.set(new Date(2026, 8, 15));
      fixture.detectChanges();

      // September is still reachable: the span ends in August
      expect(calendar.canGoNext()).toBe(true);

      calendar.next();
      fixture.detectChanges();

      expect(calendar.canGoNext()).toBe(false);
    });

    it('keeps one roving target across the whole span', () => {
      calendar.focusedDate.set(new Date(2026, 7, 12));
      fixture.detectChanges();

      const focused = cells().filter((cell) => cell.tabIndex === 0);

      expect(focused).toHaveLength(1);
      expect(focused[0]?.textContent?.trim()).toBe('12');
    });

    it('only shifts the span once focus leaves it entirely', () => {
      calendar.focusedDate.set(new Date(2026, 6, 31));
      fixture.detectChanges();

      keydown('ArrowRight');

      // August 1st is already on show, so nothing moves
      expect(calendar.visibleMonth()).toEqual(new Date(2026, 6, 1));
      expect(calendar.focusedDate()).toEqual(new Date(2026, 7, 1));

      calendar.focusedDate.set(new Date(2026, 7, 31));
      fixture.detectChanges();

      keydown('ArrowRight');

      // September is not: the span slides by the one month it takes to cover it
      expect(calendar.visibleMonth()).toEqual(new Date(2026, 7, 1));
      expect(calendar.lastVisibleMonth()).toEqual(new Date(2026, 8, 1));
      expect(calendar.focusedDate()).toEqual(new Date(2026, 8, 1));
    });

    it('bands a range across the seam between two months', () => {
      host.mode.set('range');
      fixture.detectChanges();

      const julyCell = (label: string) =>
        cells().find((cell) => cell.textContent?.trim() === label && !cell.hasAttribute('data-outside-month')) ?? null;

      julyCell('28')?.click();
      fixture.detectChanges();

      const augustCells = cells().filter((cell) => cell.textContent?.trim() === '3');

      augustCells.at(-1)?.click();
      fixture.detectChanges();

      expect(host.rangeValue()).toEqual({ start: new Date(2026, 6, 28), end: new Date(2026, 7, 3) });
      // the band runs on through the end of July and into August
      expect(julyCell('30')?.hasAttribute('data-in-range')).toBe(true);
      expect(
        cells()
          .filter((cell) => cell.textContent?.trim() === '1')
          .at(-1)
          ?.hasAttribute('data-in-range'),
      ).toBe(true);
    });

    it('shows one coarse grid however many months the day grid has', () => {
      calendar.zoomOut();
      fixture.detectChanges();

      expect(cells()).toHaveLength(12);
    });
  });

  describe('week numbers', () => {
    it('numbers the rows it renders, following the week start', () => {
      // Monday-based July 2026 covers ISO weeks 27–31, starting with the row that begins June 29th
      expect(calendar.weekNumbers()).toEqual([27, 28, 29, 30, 31]);
      expect(calendar.weekNumbers()).toHaveLength(calendar.weeks().length);
    });

    it('renumbers when the visible month changes', () => {
      host.activeMonth.set(new Date(2026, 0, 1));
      fixture.detectChanges();

      expect(calendar.weekNumbers()[0]).toBe(1);
    });
  });

  describe('precision', () => {
    const cellWithText = (text: string) => cells().find((cell) => cell.textContent?.trim() === text) ?? null;

    it('opens on the grid holding its unit and clamps a finer startView', () => {
      host.precision.set('month');
      fixture.detectChanges();

      expect(calendar.view()).toBe('year');
      expect(calendar.selectionView()).toBe('year');
      expect(cells()).toHaveLength(12);

      host.startView.set('month');
      fixture.detectChanges();

      expect(calendar.view()).toBe('year');
    });

    it('writes the month at month precision instead of drilling', () => {
      host.precision.set('month');
      fixture.detectChanges();

      cellWithText('Mar')?.click();
      fixture.detectChanges();

      expect(host.value()).toEqual(new Date(2026, 2, 1));
      expect(host.monthSelect()).toEqual(new Date(2026, 2, 1));
      // still the month grid: there is nothing finer to drill into
      expect(calendar.view()).toBe('year');
      expect(cellWithText('Mar')?.hasAttribute('data-selected')).toBe(true);
    });

    it('writes the year at year precision', () => {
      host.precision.set('year');
      fixture.detectChanges();

      expect(calendar.view()).toBe('multiYear');
      expect(calendar.canZoomOut()).toBe(false);

      cellWithText('2031')?.click();
      fixture.detectChanges();

      expect(host.value()).toEqual(new Date(2031, 0, 1));
      expect(calendar.view()).toBe('multiYear');
      expect(cellWithText('2031')?.hasAttribute('data-selected')).toBe(true);
    });

    it('zooms back to its own finest grid, not the day grid', () => {
      host.precision.set('month');
      fixture.detectChanges();

      calendar.zoomOut();
      fixture.detectChanges();

      expect(calendar.view()).toBe('multiYear');

      calendar.zoomOut();
      fixture.detectChanges();

      expect(calendar.view()).toBe('year');
    });

    it('bands a month range across month cells', () => {
      host.mode.set('range');
      host.precision.set('month');
      fixture.detectChanges();

      cellWithText('Mar')?.click();
      fixture.detectChanges();

      expect(host.rangeValue()).toEqual({ start: new Date(2026, 2, 1), end: null });

      cellWithText('Jun')?.click();
      fixture.detectChanges();

      expect(host.rangeValue()).toEqual({ start: new Date(2026, 2, 1), end: new Date(2026, 5, 1) });
      expect(cellWithText('Mar')?.getAttribute('data-band')).toBe('start');
      expect(cellWithText('Apr')?.getAttribute('data-band')).toBe('middle');
      expect(cellWithText('May')?.hasAttribute('data-in-range')).toBe(true);
      expect(cellWithText('Jun')?.getAttribute('data-band')).toBe('end');
      expect(cellWithText('Feb')?.getAttribute('data-band')).toBeNull();
    });

    it('previews a pending month range while hovering the month grid', () => {
      host.mode.set('range');
      host.precision.set('month');
      fixture.detectChanges();

      cellWithText('Mar')?.click();
      fixture.detectChanges();

      cellWithText('May')?.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      fixture.detectChanges();

      expect(cellWithText('Apr')?.hasAttribute('data-preview')).toBe(true);
      expect(cellWithText('Jun')?.hasAttribute('data-preview')).toBe(false);
    });

    it('completes a one-month range when the start month is picked again', () => {
      host.mode.set('range');
      host.precision.set('month');
      fixture.detectChanges();

      cellWithText('Mar')?.click();
      fixture.detectChanges();
      cellWithText('Mar')?.click();
      fixture.detectChanges();

      expect(host.rangeValue()).toEqual({ start: new Date(2026, 2, 1), end: new Date(2026, 2, 1) });
    });

    it('still refuses a month with nothing selectable inside it', () => {
      host.precision.set('month');
      host.min.set(new Date(2026, 6, 10));
      fixture.detectChanges();

      cellWithText('Jun')?.click();
      fixture.detectChanges();

      expect(host.value()).toBeNull();
    });
  });

  describe('dateClass', () => {
    it('puts the returned classes on the cell, keeping its own', () => {
      host.dateClass.set((date) => (date.getDate() === 16 ? ['busy', 'marked'] : null));
      fixture.detectChanges();

      const cell = cellFor(16);

      expect(cell?.classList.contains('busy')).toBe(true);
      expect(cell?.classList.contains('marked')).toBe(true);
      expect(cell?.classList.contains('cell')).toBe(true);
      expect(cellFor(17)?.classList.contains('busy')).toBe(false);
    });

    it('accepts a single class and takes it off again when the hook stops returning it', () => {
      host.dateClass.set((date) => (date.getDate() === 16 ? 'busy' : null));
      fixture.detectChanges();

      expect(cellFor(16)?.classList.contains('busy')).toBe(true);

      host.dateClass.set(null);
      fixture.detectChanges();

      expect(cellFor(16)?.classList.contains('busy')).toBe(false);
      expect(cellFor(16)?.classList.contains('cell')).toBe(true);
    });

    it('says which view a cell was rendered by', () => {
      const seen: string[] = [];
      host.dateClass.set((_, view) => {
        seen.push(view);

        return null;
      });
      fixture.detectChanges();

      expect(new Set(seen)).toEqual(new Set(['month']));

      seen.length = 0;
      host.startView.set('multiYear');
      fixture.detectChanges();

      expect(new Set(seen)).toEqual(new Set(['multiYear']));
    });
  });

  it('marks today with aria-current', () => {
    host.activeMonth.set(null);
    host.value.set(null);
    fixture.detectChanges();

    const today = cells().find((cell) => cell.getAttribute('aria-current') === 'date');

    expect(today?.textContent?.trim()).toBe(`${new Date().getDate()}`);
  });
});
