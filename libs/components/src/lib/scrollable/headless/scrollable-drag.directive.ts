import { Directive, inject, input } from '@angular/core';
import { useCursorDragScroll } from '@ethlete/core';
import { ScrollableDirective } from './scrollable.directive';

@Directive({
  selector: '[etScrollableDrag]',
})
export class ScrollableDragDirective {
  private scrollable = inject(ScrollableDirective);

  public enabled = input(true);

  public cursorDragScrollState = useCursorDragScroll(this.scrollable.getScrollContainerRef(), {
    enabled: this.enabled,
    allowedDirection: this.scrollable.direction,
  });

  constructor() {
    this.scrollable?.dragDirective.set(this);
  }
}
