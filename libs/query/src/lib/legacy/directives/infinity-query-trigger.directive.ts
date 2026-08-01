import { computed, Directive, ElementRef, inject, input, OnDestroy, OnInit } from '@angular/core';
import { fromEvent, Subject, takeUntil } from 'rxjs';
import { INFINITY_QUERY_TOKEN, InfinityQueryDirective } from './infinity-query.directive';

@Directive({
  selector: '[etInfinityQueryTrigger], et-infinity-query-trigger',
})
export class InfinityQueryTriggerDirective implements OnInit, OnDestroy {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private _infinityQuery = inject(INFINITY_QUERY_TOKEN);

  scrollContainerSelector = input<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  infinityQueryOverride = input<InfinityQueryDirective<any> | null>(null);

  private destroy = new Subject<boolean>();
  private observer: IntersectionObserver | null = null;

  click$ = fromEvent(this.elementRef.nativeElement, 'click');

  infinityQuery = computed(() => this.infinityQueryOverride() ?? this._infinityQuery);

  ngOnInit() {
    const isInteractive = this.elementRef.nativeElement.tagName === 'BUTTON';

    if (isInteractive) {
      this.click$.pipe(takeUntil(this.destroy)).subscribe(() => this.infinityQuery().loadNextPage());
    } else {
      this.setupIntersectionObserver();
    }
  }

  ngOnDestroy() {
    this.destroy.next(true);
    this.destroy.unsubscribe();
    this.observer?.disconnect();
  }

  private setupIntersectionObserver() {
    const scrollContainerSelector = this.scrollContainerSelector();
    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry) return;

        if (entry.isIntersecting && !this.infinityQuery().context.loading) {
          this.infinityQuery().loadNextPage();
        }
      },
      {
        root: scrollContainerSelector ? document.querySelector(scrollContainerSelector) : null,
        rootMargin: '0px',
        threshold: [0.25, 0.5, 0.75, 1],
      },
    );

    this.observer.observe(this.elementRef.nativeElement);
  }
}
