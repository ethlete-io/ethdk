import { coerceNumberProperty, NumberInput } from '@angular/cdk/coercion';
import { Directive, ElementRef, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { debounceTime, takeUntil, tap } from 'rxjs';
import { ContentObserverService, DestroyService, ResizeObserverService } from '../../services';
import { elementCanScroll } from '../../utils';
import { SCROLL_OBSERVER_IGNORE_TARGET_CLASS } from '../scroll-observer-ignore-target';
import { OBSERVE_SCROLL_STATE } from './observe-scroll-state.constants';
import { ObservedScrollableChild, ScrollObserverScrollState } from './observe-scroll-state.types';

@Directive({
  selector: '[etObserveScrollState]',
  exportAs: 'etObserveScrollState',
  standalone: true,
  providers: [
    {
      provide: OBSERVE_SCROLL_STATE,
      useExisting: ObserveScrollStateDirective,
    },
    DestroyService,
  ],
})
export class ObserveScrollStateDirective implements OnInit, OnDestroy {
  private readonly _destroy$ = inject(DestroyService).destroy$;

  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _contentObserverService = inject(ContentObserverService);
  private readonly _resizeObserverService = inject(ResizeObserverService);

  private readonly _observedChildren = {
    first: this._firstCurrentChild,
    last: this._lastCurrentChild,
  };

  private get _firstCurrentChild() {
    const element = this._elementRef.nativeElement.children[0] as HTMLElement | null;

    return this._getNonIgnoredChild(element, 'next');
  }

  private get _lastCurrentChild() {
    const element = this._elementRef.nativeElement.children[
      this._elementRef.nativeElement.children.length - 1
    ] as HTMLElement | null;

    return this._getNonIgnoredChild(element, 'previous');
  }

  @Input()
  get observerRootMargin(): number {
    return this._rootMargin;
  }
  set observerRootMargin(value: NumberInput) {
    this._rootMargin = coerceNumberProperty(value);
  }
  private _rootMargin = 0;

  @Input()
  get observerThreshold(): number {
    return this._threshold;
  }
  set observerThreshold(value: NumberInput) {
    this._threshold = coerceNumberProperty(value);
  }
  private _threshold = 1;

  private _intersectionObserver: IntersectionObserver | null = null;

  @Output()
  etObserveScrollState = new EventEmitter<ScrollObserverScrollState>();

  ngOnInit(): void {
    this._contentObserverService
      .observe(this._elementRef.nativeElement)
      .pipe(
        tap(() => this._checkChildren()),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._resizeObserverService
      .observe(this._elementRef.nativeElement)
      .pipe(
        debounceTime(25),
        tap(() => {
          if (!this._intersectionObserver && elementCanScroll(this._elementRef.nativeElement)) {
            this._checkChildren();
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._checkChildren();
  }

  ngOnDestroy(): void {
    this._clearIntersectionObserver();
  }

  private _checkChildren() {
    this._clearIntersectionObserver();

    if (
      this._firstCurrentChild === this._lastCurrentChild ||
      !this._firstCurrentChild ||
      !this._lastCurrentChild ||
      !elementCanScroll(this._elementRef.nativeElement)
    ) {
      this._unobserveChild('first');
      this._unobserveChild('last');

      this.etObserveScrollState.emit({
        isAtStart: true,
        isAtEnd: true,
        canScroll: false,
      });
    } else {
      this._intersectionObserver = this._initiateIntersectionObserver();

      this._observeChild('first', this._firstCurrentChild);
      this._observeChild('last', this._lastCurrentChild);
    }
  }

  private _initiateIntersectionObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        const { first, last } = this._observedChildren;

        const isAtStart = entries.find((entry) => entry.target === first)?.isIntersecting ?? false;
        const isAtEnd = entries.find((entry) => entry.target === last)?.isIntersecting ?? false;

        this.etObserveScrollState.emit({
          isAtStart,
          isAtEnd,
          canScroll: !isAtStart || !isAtEnd,
        });
      },
      {
        root: this._elementRef.nativeElement,
        rootMargin: `${this._rootMargin}px`,
        threshold: this._threshold,
      },
    );

    return observer;
  }

  private _observeChild(child: ObservedScrollableChild, element: HTMLElement) {
    this._intersectionObserver?.observe(element);
    this._observedChildren[child] = element;
  }

  private _unobserveChild(child: ObservedScrollableChild) {
    const observedChild = this._observedChildren[child];

    if (!observedChild) {
      return;
    }

    this._intersectionObserver?.unobserve(observedChild);
    this._observedChildren[child] = null;
  }

  private _clearIntersectionObserver() {
    this._intersectionObserver?.disconnect();
    this._intersectionObserver = null;
  }

  private _getNonIgnoredChild(element: HTMLElement | null, direction: 'previous' | 'next'): HTMLElement | null {
    if (!element) {
      return null;
    }

    if (element?.classList.contains(SCROLL_OBSERVER_IGNORE_TARGET_CLASS)) {
      const nextElement = element[`${direction}ElementSibling`] as HTMLElement | null;

      if (!nextElement) {
        return null;
      }

      return this._getNonIgnoredChild(nextElement, direction);
    }

    return element;
  }
}
