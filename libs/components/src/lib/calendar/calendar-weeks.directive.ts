import { DestroyRef, Directive, ElementRef, inject, Renderer2 } from '@angular/core';

/** @internal */
@Directive({
  selector: '[etCalendarWeeks]',
})
export class CalendarWeeksDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private renderer = inject(Renderer2);

  constructor() {
    // A destroyed view stops updating its bindings, yet `animate.leave` keeps its element on screen until the
    // leave animation ends - this is the last point where the grid can still be taken out of focus order and AT.
    inject(DestroyRef).onDestroy(() => this.renderer.setAttribute(this.elementRef.nativeElement, 'inert', ''));
  }
}
