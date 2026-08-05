import { Directive, ElementRef, afterNextRender, computed, effect, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CALENDAR_ERROR_CODES } from '../calendar-errors';
import { CalendarGridDirective } from './calendar-grid.directive';
import { CalendarCellBase, CalendarDirective } from './calendar.directive';

/**
 * One cell of whichever grid is showing - a day, a month or a year (place it on
 * the cell's `<button>`): ARIA/data attributes, activation, hover preview, and
 * the roving-tabindex focus pull.
 */
@Directive({
  selector: '[etCalendarCell]',
  exportAs: 'etCalendarCell',
  host: {
    role: 'gridcell',
    '[class]': 'dynamicClasses()',
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
    '[attr.data-comparison-band]': 'cell().comparisonBand',
    '[attr.data-outside-month]': "cell().outsideMonth ? '' : null",
    '(click)': 'calendar?.activateCell(cell().date)',
    '(pointerenter)': 'handlePointerEnter()',
  },
})
export class CalendarCellDirective {
  protected calendar = inject(CalendarDirective, { optional: true });
  private grid = inject(CalendarGridDirective, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public cell = input.required<CalendarCellBase>();

  /**
   * `dateClass`'s classes, as a map rather than a list so the element's static classes survive the
   * binding - and so a class the hook stops returning is taken back off.
   */
  protected dynamicClasses = computed(() => {
    const classes = this.cell().classes;

    return classes === null ? {} : Object.fromEntries(classes.map((className) => [className, true]));
  });

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.calendar) {
          throw new RuntimeError(
            CALENDAR_ERROR_CODES.CELL_OUTSIDE_CALENDAR,
            'An [etCalendarCell] must be placed inside an [etCalendar].',
            { element: this.elementRef.nativeElement },
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
    // only the grid that selects previews a range - anywhere coarser, a cell is a place to look
    // rather than an endpoint
    if (
      this.calendar?.mode() === 'range' &&
      this.calendar.view() === this.calendar.selectionView() &&
      !this.cell().disabled
    ) {
      this.calendar.hoveredDate.set(this.cell().date);
    }
  }
}
