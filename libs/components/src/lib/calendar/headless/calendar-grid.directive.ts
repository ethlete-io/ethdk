import { Directive, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CALENDAR_ERROR_CODES } from '../calendar-errors';
import { CalendarDirective } from './calendar.directive';

/**
 * The ARIA grid hosting the cell rows of whichever view is showing: routes the
 * keyboard model to the calendar and tracks whether focus is inside (cells only
 * pull DOM focus along while the user is actually keyboard-navigating the grid).
 */
@Directive({
  selector: '[etCalendarGrid]',
  exportAs: 'etCalendarGrid',
  host: {
    role: 'grid',
    '[attr.aria-label]': 'calendar?.headerLabel()',
    '[attr.aria-multiselectable]': "calendar?.mode() === 'multiple' ? true : null",
    '(keydown)': 'calendar?.handleKeydown($event)',
    '(focusin)': 'focusIsInside.set(true)',
    '(focusout)': 'handleFocusOut($event)',
    '(pointerleave)': 'calendar?.hoveredDate?.set(null)',
  },
})
export class CalendarGridDirective {
  protected calendar = inject(CalendarDirective, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @internal */
  public focusIsInside = signal(false);

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.calendar) {
          throw new RuntimeError(
            CALENDAR_ERROR_CODES.GRID_OUTSIDE_CALENDAR,
            'An [etCalendarGrid] must be placed inside an [etCalendar].',
            { element: this.elementRef.nativeElement },
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

    // a cell removal during month re-render also lands here (focus falls to body
    // before the new roving target pulls it back in the same tick) - settle the
    // tick first, then decide based on where focus actually ended up
    queueMicrotask(() => {
      const element = this.elementRef.nativeElement;
      const active = element.ownerDocument.activeElement;

      if (!(active instanceof Node) || !element.contains(active)) {
        this.focusIsInside.set(false);
      }
    });
  }
}
