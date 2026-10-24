import { Directive, booleanAttribute, effect, inject, input, untracked } from '@angular/core';
import { useCursorDragScroll } from '@ethlete/core';
import { ScrollableDirective } from './scrollable.directive';

/**
 * Lets a mouse drag the track, as a finger already can.
 *
 * Opt-in, applied on the `<et-scrollable>` itself. Ships in `SCROLLABLE_DRAG_IMPORTS` - alongside
 * `etScrollableSnap`, which settles the release a drag gives the platform no momentum to decelerate into.
 */
@Directive({
  selector: '[etScrollableDrag]',
})
export class ScrollableDragDirective {
  private scrollable = inject(ScrollableDirective);

  public enabled = input(true, { transform: booleanAttribute, alias: 'etScrollableDrag' });

  public cursorDragScrollState = useCursorDragScroll(this.scrollable.getScrollContainerRef(), {
    enabled: this.enabled,
    allowedDirection: this.scrollable.direction,
    canScroll: this.scrollable.canScroll,
  });

  constructor() {
    effect(() => {
      const dragging = this.cursorDragScrollState.isDragging();

      untracked(() => {
        this.scrollable.cursorDragReleaseVelocity.set(this.cursorDragScrollState.releaseVelocity());
        this.scrollable.isCursorDragging.set(dragging);
      });
    });
  }
}
