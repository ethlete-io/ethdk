import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CALENDAR_ERROR_CODES } from '../calendar-errors';
import { CalendarDirective } from './calendar.directive';

/**
 * The ARIA grid hosting the cell rows of whichever view is showing: routes the
 * keyboard model to the calendar and claims its focus while DOM focus is inside -
 * which is what lets a cell pull DOM focus along, and a range preview anchor,
 * only while the reader is really keyboard-navigating the grid.
 */
@Directive({
  selector: '[etCalendarGrid]',
  exportAs: 'etCalendarGrid',
  host: {
    role: 'grid',
    '[attr.aria-label]': 'calendar?.headerLabel()',
    '[attr.aria-multiselectable]': "calendar?.mode() === 'multiple' ? true : null",
    '(keydown)': 'calendar?.handleKeydown($event)',
    '(focusin)': 'claimFocus()',
    '(focusout)': 'handleFocusOut($event)',
    '(pointerleave)': 'calendar?.hoveredDate?.set(null)',
  },
})
export class CalendarGridDirective {
  protected calendar = inject(CalendarDirective, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @internal */
  public focusIsInside = computed(() => this.calendar?.focusedGrid() === this);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.releaseFocus());

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

  protected claimFocus() {
    this.calendar?.focusedGrid.set(this);
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
        this.releaseFocus();
      }
    });
  }

  // only ever give back a claim that is still ours: focus moving to a sibling grid claims it
  // there before this microtask runs
  private releaseFocus() {
    const calendar = this.calendar;

    if (calendar?.focusedGrid() === this) {
      calendar.focusedGrid.set(null);
    }
  }
}
