import { Directive, inject, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { getScrollSnapTarget } from '@ethlete/core';
import { EMPTY, debounceTime, switchMap, tap } from 'rxjs';
import { ScrollableDirective } from './scrollable.directive';
import { ScrollableScrollOrigin } from './scrollable.types';

@Directive({
  selector: '[etScrollableSnap]',
})
export class ScrollableSnapDirective {
  private scrollable = inject(ScrollableDirective);

  enabled = input(true);
  snapOrigin = input<ScrollableScrollOrigin>('auto');

  constructor() {
    this.scrollable.activateChildIntersections();
    this.scrollable.snapDirective.set(this);

    const childIntersections$ = toObservable(this.scrollable.childIntersections);
    const enabled$ = toObservable(this.enabled);

    enabled$
      .pipe(
        takeUntilDestroyed(),
        switchMap((enabled) => {
          if (!enabled) return EMPTY;

          return childIntersections$.pipe(
            debounceTime(150),
            tap((allIntersections) => {
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
