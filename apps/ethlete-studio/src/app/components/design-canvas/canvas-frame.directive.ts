import { Directive, ElementRef, inject, signal } from '@angular/core';

/** Marks an element projected into `ethlete-design-canvas` as a frame the camera fits, focuses and selects. */
@Directive({
  selector: '[ethleteCanvasFrame]',
  host: {
    'data-canvas-frame': '',
    '[attr.data-selected]': 'selected() || null',
  },
})
export class CanvasFrameDirective {
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  public selected = signal(false);
}
