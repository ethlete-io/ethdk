import { Directive, booleanAttribute, effect, inject, input } from '@angular/core';
import { useCursorDragScroll } from '@ethlete/core';
import { ScrollableDirective } from './scrollable.directive';

@Directive({
  selector: '[etScrollableDrag]',
})
export class ScrollableDragDirective {
  private scrollable = inject(ScrollableDirective);

  public enabled = input(true, { transform: booleanAttribute });

  public cursorDragScrollState = useCursorDragScroll(this.scrollable.getScrollContainerRef(), {
    enabled: this.enabled,
    allowedDirection: this.scrollable.direction,
    // The scrollable already watches the container for this. Left to measure it itself, the drag put a second
    // MutationObserver and ResizeObserver on the same element asking the same question.
    canScroll: this.scrollable.canScroll,
  });

  constructor() {
    this.scrollable?.dragDirective.set(this);

    // A drag writes the scroll offset on every mouse move, which is exactly what CSS snap overrules - so the
    // scrollable has to know a drag is in progress. `etScrollableSnap` is what acts on it.
    // Not a linkedSignal: it is pushed into the *scrollable's* signal, which is where anything else can see it.
    // eslint-disable-next-line ethlete/prefer-linked-signal
    effect(() => this.scrollable.isCursorDragging.set(this.cursorDragScrollState.isDragging()));
  }
}
