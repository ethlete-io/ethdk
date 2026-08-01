import { Directive, TemplateRef, inject } from '@angular/core';
import { CalendarDirective } from './headless';

/** What a custom header template is handed: the calendar it belongs to, as `$implicit`. */
export type CalendarHeaderContext = {
  $implicit: CalendarDirective;
};

/**
 * Replaces `et-calendar`'s own header, keeping its grid. Put it on an `ng-template` inside the
 * calendar; the template receives the headless directive, which is everything the default header
 * uses - `headerLabel()`, `previous()`/`next()`, `canGoPrev()`/`canGoNext()`, `zoomOut()`,
 * `canZoomOut()`, `view`.
 *
 * @example
 * <et-calendar [(value)]="date">
 *   <ng-template etCalendarHeader let-calendar>
 *     <button (click)="calendar.previous()" [disabled]="!calendar.canGoPrev()">Back</button>
 *     <h3>{{ calendar.headerLabel() }}</h3>
 *     <button (click)="calendar.next()" [disabled]="!calendar.canGoNext()">Next</button>
 *   </ng-template>
 * </et-calendar>
 */
@Directive({
  selector: 'ng-template[etCalendarHeader]',
})
export class CalendarHeaderDirective {
  /** @internal */
  public templateRef = inject<TemplateRef<CalendarHeaderContext>>(TemplateRef);

  /** @internal Lets the template's `let-` bindings be typed without the consumer declaring the shape. */
  public static ngTemplateContextGuard(
    _directive: CalendarHeaderDirective,
    _context: unknown,
  ): _context is CalendarHeaderContext {
    return true;
  }
}
