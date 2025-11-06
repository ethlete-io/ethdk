import {
  Directive,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  numberAttribute,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { debounceTime, takeUntil, tap } from 'rxjs';
import { ContentObserverService, ResizeObserverService } from '../../services';
import { createDestroy, elementCanScroll } from '../../utils';
import { SCROLL_OBSERVER_FIRST_ELEMENT_CLASS } from '../scroll-observer-first-element';
import { SCROLL_OBSERVER_IGNORE_TARGET_CLASS } from '../scroll-observer-ignore-target';
import { SCROLL_OBSERVER_LAST_ELEMENT_CLASS } from '../scroll-observer-last-element';
import { OBSERVE_SCROLL_STATE } from './observe-scroll-state.constants';
import { ScrollObserverScrollState } from './observe-scroll-state.types';

export const SCROLL_OBSERVER_OBSERVING_FIRST_ELEMENT_CLASS = 'et-scroll-observer-observing-first-element';
export const SCROLL_OBSERVER_OBSERVING_LAST_ELEMENT_CLASS = 'et-scroll-observer-observing-last-element';

@Directive({
  selector: '[etObserveScrollState]',
  exportAs: 'etObserveScrollState',
  standalone: true,
  providers: [
    {
      provide: OBSERVE_SCROLL_STATE,
      useExisting: ObserveScrollStateDirective,
    },
  ],
})
export class ObserveScrollStateDirective implements OnInit, OnDestroy {
  private readonly _destroy$ = createDestroy();

  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _contentObserverService = inject(ContentObserverService);
  private readonly _resizeObserverService = inject(ResizeObserverService);

  private get _firstCurrentChild() {
    const explicitFirstElement = this._elementRef.nativeElement.querySelector(
      `.${SCROLL_OBSERVER_FIRST_ELEMENT_CLASS}`,
    ) as HTMLElement | null;

    if (explicitFirstElement) {
      return explicitFirstElement;
    }

    const element = this._elementRef.nativeElement.children[0] as HTMLElement | null;

    return this._getNonIgnoredChild(element, 'next');
  }

  private get _lastCurrentChild() {
    const explicitLastElement = this._elementRef.nativeElement.querySelector(
      `.${SCROLL_OBSERVER_LAST_ELEMENT_CLASS}`,
    ) as HTMLElement | null;

    if (explicitLastElement) {
      return explicitLastElement;
    }

    const element = this._elementRef.nativeElement.children[
      this._elementRef.nativeElement.children.length - 1
    ] as HTMLElement | null;

    return this._getNonIgnoredChild(element, 'previous');
  }

  @Input({ transform: numberAttribute })
  rootMargin = 0;

  @Input()
  get observerThreshold(): number | number[] {
    return this._threshold;
  }
  set observerThreshold(value: unknown) {
    if (Array.isArray(value)) {
      this._threshold = value.map((threshold) => numberAttribute(threshold));
      return;
    }

    this._threshold = numberAttribute(value);
  }
  private _threshold: number | number[] = [0.99, 0.99999, 0.9999, 0.999, 1];

  private _intersectionObserver: IntersectionObserver | null = null;

  private get _observerElements() {
    const firstEl = this._elementRef.nativeElement.querySelector(`.${SCROLL_OBSERVER_FIRST_ELEMENT_CLASS}`);
    const lastEl = this._elementRef.nativeElement.querySelector(`.${SCROLL_OBSERVER_LAST_ELEMENT_CLASS}`);

    if (!firstEl || !lastEl) return null;

    return {
      first: firstEl,
      last: lastEl,
    };
  }

  @Output('etObserveScrollState')
  valueChange = new EventEmitter<ScrollObserverScrollState>();

  ngOnInit(): void {
    this._contentObserverService
      .observe(this._elementRef.nativeElement)
      .pipe(
        debounceTime(25),
        tap(() => this._checkChildren()),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._resizeObserverService
      .observe(this._elementRef.nativeElement)
      .pipe(
        debounceTime(25),
        tap(() => {
          const canScroll = elementCanScroll(this._elementRef.nativeElement);
          if ((!this._intersectionObserver && canScroll) || (this._intersectionObserver && !canScroll)) {
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
      this._unobserve();

      this.valueChange.emit({
        isAtStart: true,
        isAtEnd: true,
        canScroll: false,
      });
    } else {
      this._intersectionObserver = this._initiateIntersectionObserver();

      this._observe();
    }
  }

  private _initiateIntersectionObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        const elements = this._observerElements;

        if (!elements) return;

        const isAtStart = entries.find((entry) => entry.target === elements.first)?.isIntersecting ?? false;
        const isAtEnd = entries.find((entry) => entry.target === elements.last)?.isIntersecting ?? false;

        this.valueChange.emit({
          isAtStart,
          isAtEnd,
          canScroll: !isAtStart || !isAtEnd,
        });
      },
      {
        root: this._elementRef.nativeElement,
        rootMargin: this.rootMargin ? `${this.rootMargin}px` : undefined,
        threshold: this._threshold,
      },
    );

    return observer;
  }

  private _observe() {
    const elements = this._observerElements;

    if (!elements) return;

    this._intersectionObserver?.observe(elements.first);
    this._intersectionObserver?.observe(elements.last);

    elements.first.classList.add(SCROLL_OBSERVER_OBSERVING_FIRST_ELEMENT_CLASS);
    elements.last.classList.add(SCROLL_OBSERVER_OBSERVING_LAST_ELEMENT_CLASS);
  }

  private _unobserve() {
    const elements = this._observerElements;

    if (!elements) return;

    this._intersectionObserver?.unobserve(elements.first);
    this._intersectionObserver?.unobserve(elements.last);

    elements.first.classList.remove(SCROLL_OBSERVER_OBSERVING_FIRST_ELEMENT_CLASS);
    elements.last.classList.remove(SCROLL_OBSERVER_OBSERVING_LAST_ELEMENT_CLASS);
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
