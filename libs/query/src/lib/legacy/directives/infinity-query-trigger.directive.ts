import { Directive, ElementRef, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { fromEvent, Subject, takeUntil } from 'rxjs';
import { INFINITY_QUERY_TOKEN } from './infinity-query.directive';

@Directive({
  selector: '[etInfinityQueryTrigger], et-infinity-query-trigger',
})
export class InfinityQueryTriggerDirective implements OnInit, OnDestroy {
  private _elementRef = inject(ElementRef<HTMLElement>);
  private _infinityQuery = inject(INFINITY_QUERY_TOKEN);

  private _destroy = new Subject<boolean>();
  private _observer: IntersectionObserver | null = null;

  click$ = fromEvent(this._elementRef.nativeElement, 'click');

  @Input()
  scrollContainerSelector: string | null = null;

  ngOnInit(): void {
    const isInteractive = this._elementRef.nativeElement.tagName === 'BUTTON';

    if (isInteractive) {
      this.click$.pipe(takeUntil(this._destroy)).subscribe(() => this._infinityQuery.loadNextPage());
    } else {
      this._setupIntersectionObserver();
    }
  }

  ngOnDestroy(): void {
    this._destroy.next(true);
    this._destroy.unsubscribe();
    this._observer?.disconnect();
  }

  private _setupIntersectionObserver(): void {
    this._observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry) return;

        if (entry.isIntersecting && !this._infinityQuery.context.loading) {
          this._infinityQuery.loadNextPage();
        }
      },
      {
        root: this.scrollContainerSelector ? document.querySelector(this.scrollContainerSelector) : null,
        rootMargin: '0px',
        threshold: [0.25, 0.5, 0.75, 1],
      },
    );

    this._observer.observe(this._elementRef.nativeElement);
  }
}
