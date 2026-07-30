import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { CalendarCellDirective } from './calendar-cell.directive';
import { CalendarGridDirective } from './calendar-grid.directive';
import {
  CalendarDateClassFn,
  CalendarDirective,
  CalendarMode,
  CalendarRange,
  CalendarView,
} from './calendar.directive';

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
      [startAt]="startAt()"
      [startView]="startView()"
      [dateClass]="dateClass()"
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
            @for (week of cal.weeks(); track $index) {
              <div role="row">
                @for (cell of week; track cell.date.getTime()) {
                  <button [cell]="cell" class="cell" etCalendarCell type="button">{{ cell.label }}</button>
                }
              </div>
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
  startView = signal<CalendarView>('month');
  dateClass = signal<CalendarDateClassFn | null>(null);
  value = signal<Date | null>(null);
  rangeValue = signal<CalendarRange>({ start: null, end: null });
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
