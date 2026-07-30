import { DOCUMENT, Directive, booleanAttribute, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { getScrollSnapTarget } from '@ethlete/core';
import { EMPTY, combineLatest, debounceTime, filter, fromEvent, merge, switchMap, tap } from 'rxjs';
import { ScrollableDirective } from './scrollable.directive';
import { ScrollableScrollOrigin } from './scrollable.types';

/** How long the scrolling has to have settled before the track snaps, in milliseconds. */
const SNAP_SETTLE_DURATION = 150;

@Directive({
  selector: '[etScrollableSnap]',
})
export class ScrollableSnapDirective {
  private scrollable = inject(ScrollableDirective);
  private document = inject(DOCUMENT);

  public enabled = input(true, { transform: booleanAttribute });
  public snapOrigin = input<ScrollableScrollOrigin>('auto');

  /**
   * Whether a pointer is being held on the track right now.
   *
   * Snapping is not allowed while it is. The snap fires once the scrolling has been quiet for a moment,
   * and a gesture is full of such moments — pause mid-drag for longer than that and the track would scroll
   * out from under the finger that is still holding it. `pointerdown`/`pointerup` rather than the drag
   * directive's state so that a touch counts too: a finger resting on the screen mid-swipe is the same
   * situation, and the drag directive only watches the mouse.
   */
  private isPointerDown = signal(false);

  constructor() {
    this.scrollable.activateChildIntersections();
    this.scrollable.snapDirective.set(this);

    const scrollContainerRef$ = toObservable(this.scrollable.getScrollContainerRef());
    const childIntersections$ = toObservable(this.scrollable.childIntersections);
    const isPointerDown$ = toObservable(this.isPointerDown);
    const enabled$ = toObservable(this.enabled);

    scrollContainerRef$
      .pipe(
        switchMap((scrollContainerRef) => {
          const scrollElement = scrollContainerRef?.nativeElement;

          if (!scrollElement) return EMPTY;

          return merge(
            fromEvent(scrollElement, 'pointerdown', { passive: true }).pipe(tap(() => this.isPointerDown.set(true))),
            // on the document, because a drag that starts on the track routinely ends off it
            fromEvent(this.document, 'pointerup', { passive: true }).pipe(tap(() => this.isPointerDown.set(false))),
            fromEvent(this.document, 'pointercancel', { passive: true }).pipe(tap(() => this.isPointerDown.set(false))),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    enabled$
      .pipe(
        takeUntilDestroyed(),
        switchMap((enabled) => {
          if (!enabled) return EMPTY;

          return combineLatest([childIntersections$, isPointerDown$]).pipe(
            // Settle first, then check the pointer — in that order, so that letting go is itself what
            // triggers the snap for a gesture that had already come to a stop before the finger lifted.
            debounceTime(SNAP_SETTLE_DURATION),
            filter(([, isPointerDown]) => !isPointerDown),
            tap(([allIntersections]) => {
              const scrollContainerRef = this.scrollable.getScrollContainerRef();
              const scrollElement = scrollContainerRef()?.nativeElement;
              if (!scrollElement) return;

              const visibleItems = allIntersections
                .filter((i) => i.intersectionRatio > 0)
                .map((i) => i.target as HTMLElement);

              const target = getScrollSnapTarget(
                visibleItems,
                scrollElement,
                this.scrollable.direction(),
                this.snapOrigin(),
                this.scrollable.scrollMargin(),
              );

              if (target) {
                this.scrollable.scrollToElement({
                  element: target.element,
                  origin: target.origin,
                  ignoreForcedOrigin: true,
                });
              }
            }),
          );
        }),
      )
      .subscribe();
  }
}
