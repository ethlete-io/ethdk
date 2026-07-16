import { Directive, ElementRef, afterNextRender, effect, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CALENDAR_ERROR_CODES } from '../calendar-errors';
import { CalendarGridDirective } from './calendar-grid.directive';
import { CalendarCell, CalendarDirective } from './calendar.directive';

/**
 * One day cell (place it on the cell's `<button>`): ARIA/data attributes,
 * selection on activation, hover preview, and the roving-tabindex focus pull.
 */
@Directive({
  selector: '[etCalendarCell]',
  exportAs: 'etCalendarCell',
  host: {
    role: 'gridcell',
    '[attr.tabindex]': 'cell().focused ? 0 : -1',
    '[attr.aria-label]': 'cell().ariaLabel',
    '[attr.aria-selected]': 'cell().selected',
    '[attr.aria-disabled]': 'cell().disabled ? true : null',
    '[attr.aria-current]': "cell().today ? 'date' : null",
    '[attr.data-selected]': "cell().selected ? '' : null",
    '[attr.data-disabled]': "cell().disabled ? '' : null",
    '[attr.data-today]': "cell().today ? '' : null",
    '[attr.data-range-start]': "cell().rangeStart ? '' : null",
    '[attr.data-range-end]': "cell().rangeEnd ? '' : null",
    '[attr.data-in-range]': "cell().inRange ? '' : null",
    '[attr.data-preview]': "cell().inHoverPreview ? '' : null",
    '[attr.data-band]': 'cell().band',
    '[attr.data-outside-month]': "cell().outsideMonth ? '' : null",
    '(click)': 'calendar?.selectDate(cell().date)',
    '(pointerenter)': 'handlePointerEnter()',
  },
})
export class CalendarCellDirective {
  protected calendar = inject(CalendarDirective, { optional: true });
  private grid = inject(CalendarGridDirective, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public cell = input.required<CalendarCell>();

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.calendar) {
          throw new RuntimeError(
            CALENDAR_ERROR_CODES.CELL_OUTSIDE_CALENDAR,
            'An [etCalendarCell] must be placed inside an [etCalendar].',
          );
        }
      });
    }

    // pull DOM focus along while the user keyboard-navigates the grid
    effect(() => {
      if (this.cell().focused && this.grid?.focusIsInside()) {
        this.elementRef.nativeElement.focus();
      }
    });
  }

  protected handlePointerEnter() {
    if (this.calendar?.mode() === 'range' && !this.cell().disabled) {
      this.calendar.hoveredDate.set(this.cell().date);
    }
  }
}
