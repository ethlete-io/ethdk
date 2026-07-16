import { Directive, afterNextRender, inject, signal } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CALENDAR_ERROR_CODES } from '../calendar-errors';
import { CalendarDirective } from './calendar.directive';

/**
 * The ARIA grid hosting the week rows: routes the keyboard model to the
 * calendar and tracks whether focus is inside (cells only pull DOM focus
 * along while the user is actually keyboard-navigating the grid).
 */
@Directive({
  selector: '[etCalendarGrid]',
  exportAs: 'etCalendarGrid',
  host: {
    role: 'grid',
    '[attr.aria-label]': 'calendar?.visibleMonthLabel()',
    '(keydown)': 'calendar?.handleKeydown($event)',
    '(focusin)': 'focusIsInside.set(true)',
    '(focusout)': 'handleFocusOut($event)',
    '(pointerleave)': 'calendar?.hoveredDate?.set(null)',
  },
})
export class CalendarGridDirective {
  protected calendar = inject(CalendarDirective, { optional: true });

  /** @internal */
  public focusIsInside = signal(false);

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.calendar) {
          throw new RuntimeError(
            CALENDAR_ERROR_CODES.GRID_OUTSIDE_CALENDAR,
            'An [etCalendarGrid] must be placed inside an [etCalendar].',
          );
        }
      });
    }
  }

  protected handleFocusOut(event: FocusEvent) {
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    this.focusIsInside.set(false);
  }
}
