import { NgClass, NgIf } from '@angular/common';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  ViewChild,
  ViewChildren,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  effect,
  inject,
  isDevMode,
  numberAttribute,
  signal,
} from '@angular/core';
import {
  CursorDragScrollDirective,
  IS_ACTIVE_ELEMENT,
  IS_ELEMENT,
  IsActiveElementDirective,
  IsElementDirective,
  LetDirective,
  NgClassType,
  ObserveScrollStateDirective,
  ScrollObserverScrollState,
  ScrollToElementOptions,
  TypedQueryList,
  createDestroy,
  getElementVisibleStates,
  scrollToElement,
  signalElementIntersection,
  signalElementScrollState,
  signalHostAttributes,
} from '@ethlete/core';
import { BehaviorSubject, debounceTime, fromEvent, merge, of, startWith, takeUntil, tap } from 'rxjs';
import { ChevronIconComponent } from '../../../icons';
import { ScrollableIntersectionChange, ScrollableScrollMode } from '../../types';

@Component({
  selector: 'et-scrollable',
  templateUrl: './scrollable.component.html',
  styleUrls: ['./scrollable.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CursorDragScrollDirective, ObserveScrollStateDirective, NgClass, NgIf, LetDirective, ChevronIconComponent],
  host: {
    class: 'et-scrollable',
  },
})
export class ScrollableComponent implements AfterContentInit {
  private readonly _destroy$ = createDestroy();
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly _isCursorDragging$ = new BehaviorSubject<boolean>(false);
  private readonly _latestVisibilityStates$ = new BehaviorSubject<ScrollableIntersectionChange[]>([]);

  @Input()
  @HostBinding('attr.item-size')
  itemSize: 'auto' | 'same' | 'full' = 'auto';

  @Input()
  @HostBinding('attr.direction')
  direction: 'horizontal' | 'vertical' = 'horizontal';

  @Input()
  scrollableRole?: string;

  @Input()
  scrollableClass?: NgClassType;

  @Input({ transform: booleanAttribute })
  renderMasks = true;

  @Input({ transform: booleanAttribute })
  renderButtons = true;

  @Input({ transform: booleanAttribute })
  @HostBinding('attr.render-scrollbars')
  renderScrollbars = false;

  @Input({ transform: booleanAttribute })
  @HostBinding('attr.sticky-buttons')
  stickyButtons = false;

  @Input({ transform: booleanAttribute })
  cursorDragScroll = true;

  @Input({ transform: booleanAttribute })
  disableActiveElementScrolling = false;

  @Input()
  scrollMode: ScrollableScrollMode = 'container';

  @Input({ transform: booleanAttribute })
  snap = false;

  @Input({ transform: numberAttribute })
  scrollMargin = 0;

  @Output()
  readonly scrollStateChange = new EventEmitter<ScrollObserverScrollState>();

  @Output()
  readonly intersectionChange = new EventEmitter<ScrollableIntersectionChange[]>();

  @ViewChild('scrollable', { static: true })
  scrollable!: ElementRef<HTMLElement>;

  @ViewChildren('scrollable')
  protected set scrollableList(list: TypedQueryList<ElementRef<HTMLElement>>) {
    this._scrollableList.set(list);
  }
  private readonly _scrollableList = signal<TypedQueryList<ElementRef<HTMLElement>> | null>(null);

  @ViewChildren('firstElement')
  protected set firstElementList(list: TypedQueryList<ElementRef<HTMLElement>>) {
    this._firstElementList.set(list);
  }
  private readonly _firstElementList = signal<TypedQueryList<ElementRef<HTMLElement>> | null>(null);

  @ViewChildren('lastElement')
  protected set lastElementList(list: TypedQueryList<ElementRef<HTMLElement>>) {
    this._lastElementList.set(list);
  }
  private readonly _lastElementList = signal<TypedQueryList<ElementRef<HTMLElement>> | null>(null);

  @ContentChildren(IS_ACTIVE_ELEMENT, { descendants: true })
  activeElements: TypedQueryList<IsActiveElementDirective> | null = null;

  @ContentChildren(IS_ELEMENT, { descendants: true })
  elements: TypedQueryList<IsElementDirective> | null = null;

  get highestVisibleIntersection() {
    const elements = this._latestVisibilityStates$.value;

    if (!elements.length) {
      return null;
    }

    return elements.reduce((prev, curr) => {
      if (!prev) {
        return curr;
      }

      return curr.intersectionRatio > prev.intersectionRatio ? curr : prev;
    });
  }

  get nextPartialIntersection() {
    const elements = this._latestVisibilityStates$.value;

    if (!elements.length) {
      return null;
    }

    const highestVisibleIntersection = this.highestVisibleIntersection;

    if (!highestVisibleIntersection) {
      return null;
    }

    const nextIndex = elements.slice(highestVisibleIntersection.index).findIndex((e) => !e.isIntersecting);

    if (nextIndex === -1) {
      return null;
    }

    const nextElement = elements[highestVisibleIntersection.index + nextIndex];

    return nextElement || null;
  }

  get previousPartialIntersection() {
    const elements = this._latestVisibilityStates$.value;

    if (!elements.length) {
      return null;
    }

    const highestVisibleIntersection = this.highestVisibleIntersection;

    if (!highestVisibleIntersection) {
      return null;
    }

    const previousIndex = elements
      .slice(0, highestVisibleIntersection.index)
      .reverse()
      .findIndex((e) => !e.isIntersecting);

    if (previousIndex === -1) {
      return null;
    }

    const previousElement = elements[highestVisibleIntersection.index - previousIndex - 1];

    return previousElement || null;
  }

  protected readonly containerScrollState = signalElementScrollState(this._scrollableList);
  protected readonly firstElementIntersection = signalElementIntersection(this._firstElementList, this._scrollableList);
  protected readonly lastElementIntersection = signalElementIntersection(this._lastElementList, this._scrollableList);

  protected readonly shouldAnimateOverlays = computed(
    () => !!this.firstElementIntersection() && !!this.lastElementIntersection(),
  );

  protected readonly canScroll = computed(() => {
    const dir = this.direction;

    if (dir === 'horizontal') {
      return this.containerScrollState().canScrollHorizontally;
    }

    return this.containerScrollState().canScrollVertically;
  });

  protected readonly isAtStart = computed(() =>
    this.canScroll() ? this.firstElementIntersection().isIntersecting : true,
  );
  protected readonly isAtEnd = computed(() =>
    this.canScroll() ? this.lastElementIntersection().isIntersecting : true,
  );

  protected readonly hostAttributes = signalHostAttributes({
    'can-scroll': this.canScroll,
    'at-start': this.isAtStart,
    'at-end': this.isAtEnd,
    'animate-overlays': this.shouldAnimateOverlays,
  });

  constructor() {
    effect(() => {
      const isAtStart = this.isAtStart();
      const isAtEnd = this.isAtEnd();
      const canScroll = this.canScroll();

      this.scrollStateChange.emit({
        canScroll,
        isAtEnd,
        isAtStart,
      });
    });
  }

  ngAfterContentInit(): void {
    if (!this.activeElements || !this.elements) {
      return;
    }

    this.activeElements.changes
      .pipe(
        startWith(this.activeElements),
        tap((activeElements) => {
          if (this.disableActiveElementScrolling) {
            return;
          }

          const firstActive = activeElements
            .filter((a): a is IsActiveElementDirective => !!a)
            .find((a) => a.isActiveElement);

          if (!firstActive) {
            return;
          }

          scrollToElement({
            behavior: 'auto',
            container: this.scrollable.nativeElement,
            element: firstActive.elementRef.nativeElement,
            scrollInlineMargin: this.direction === 'horizontal' ? this.scrollMargin : 0,
            scrollBlockMargin: this.direction === 'horizontal' ? 0 : this.scrollMargin,
          });
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._setupScrollListening();
  }

  scrollOneContainerSize(direction: 'start' | 'end') {
    const scrollElement = this.scrollable.nativeElement;
    const parent = this._elementRef.nativeElement;

    const scrollableSize = this.direction === 'horizontal' ? parent.clientWidth : parent.clientHeight;
    const currentScroll = this.direction === 'horizontal' ? scrollElement.scrollLeft : scrollElement.scrollTop;

    scrollElement.scrollTo({
      [this.direction === 'horizontal' ? 'left' : 'top']:
        currentScroll + (direction === 'start' ? -scrollableSize : scrollableSize),
      behavior: 'smooth',
    });
  }

  scrollOneItemSize(direction: 'start' | 'end') {
    const elements = this._latestVisibilityStates$.value;

    if (!elements.length) {
      if (isDevMode()) {
        console.warn(
          'No elements found to scroll to. Make sure to apply the isElement directive to the elements you want to scroll to.',
        );
      }
      return;
    }

    const el = direction === 'start' ? this.previousPartialIntersection : this.nextPartialIntersection;

    if (!el) {
      return;
    }

    this.scrollToElement({
      element: el?.element,
      direction: this.direction === 'horizontal' ? 'inline' : 'block',
      origin: direction,
      ...(this.direction === 'horizontal'
        ? { scrollInlineMargin: this.scrollMargin }
        : { scrollBlockMargin: this.scrollMargin }),
    });
  }

  scrollToElement(options: Omit<ScrollToElementOptions, 'container'>) {
    const scrollElement = this.scrollable.nativeElement;

    scrollToElement({
      container: scrollElement,
      ...(this.direction === 'horizontal'
        ? { scrollInlineMargin: this.scrollMargin }
        : { scrollBlockMargin: this.scrollMargin }),
      ...options,
    });
  }

  scrollToElementByIndex(options: Omit<ScrollToElementOptions, 'container'> & { index: number }) {
    const elements = this.elements?.toArray() ?? [];

    if (!elements.length) {
      if (isDevMode()) {
        console.warn(
          'No elements found to scroll to. Make sure to apply the isElement directive to the elements you want to scroll to.',
        );
      }
      return;
    }

    const scrollElement = this.scrollable.nativeElement;
    const element = elements[options.index]?.elementRef.nativeElement;

    scrollToElement({
      container: scrollElement,
      element,
      ...(this.direction === 'horizontal'
        ? { scrollInlineMargin: this.scrollMargin }
        : { scrollBlockMargin: this.scrollMargin }),
      ...options,
    });
  }

  protected setIsCursorDragging(isDragging: boolean) {
    this._isCursorDragging$.next(isDragging);
  }

  protected scrollToStartDirection() {
    if (this.scrollMode === 'container') {
      this.scrollOneContainerSize('start');
    } else {
      this.scrollOneItemSize('start');
    }
  }

  protected scrollToStartEnd() {
    if (this.scrollMode === 'container') {
      this.scrollOneContainerSize('end');
    } else {
      this.scrollOneItemSize('end');
    }
  }

  private _setupScrollListening() {
    const scrollElement = this.scrollable.nativeElement;
    let isSnapping = false;
    let snapTimeout = 0;

    merge(fromEvent<WheelEvent>(scrollElement, 'wheel'), fromEvent<TouchEvent>(scrollElement, 'touchstart'))
      .pipe(
        takeUntil(this._destroy$),
        tap(() => {
          isSnapping = false;
        }),
      )
      .subscribe();

    merge(
      fromEvent(scrollElement, 'scroll'),
      this._isCursorDragging$,
      this.elements?.changes.pipe(startWith(this.elements)) ?? of(null),
    )
      .pipe(
        debounceTime(300),
        takeUntil(this._destroy$),
        tap(() => {
          const elements =
            this.elements
              ?.toArray()
              .map((e) => e?.elementRef.nativeElement)
              .filter((e): e is HTMLElement => !!e) ?? [];

          if (!elements.length) {
            this._latestVisibilityStates$.next([]);

            return;
          }

          const states = getElementVisibleStates({
            elements,
            container: scrollElement,
          });

          const prop = this.direction === 'horizontal' ? 'inlineIntersection' : 'blockIntersection';
          const stateClass = `et-element--is-intersecting`;

          for (const state of states) {
            if (state[prop] === 100) {
              state.element.classList.add(stateClass);
            } else {
              state.element.classList.remove(stateClass);
            }
          }

          const intersectionChanges = states.map((s, i) => {
            const state: ScrollableIntersectionChange = {
              element: s.element,
              intersectionRatio: s[prop] / 100,
              isIntersecting: s[prop] === 100,
              index: i,
            };

            return state;
          });

          this.intersectionChange.emit(intersectionChanges);

          this._latestVisibilityStates$.next(intersectionChanges);

          if (isSnapping || this._isCursorDragging$.value || !this.snap) return;

          const prev = this.previousPartialIntersection;
          const next = this.nextPartialIntersection;
          const skipSnap =
            !prev ||
            !next ||
            prev.intersectionRatio === 0 ||
            next.intersectionRatio === 0 ||
            prev.intersectionRatio === next.intersectionRatio;

          if (skipSnap) return;

          const highestIntersecting = prev.intersectionRatio > next.intersectionRatio ? prev : next;
          const fullIntersectionIndex = this.highestVisibleIntersection?.index;

          if (fullIntersectionIndex === undefined) return;

          const highestIntersectingIndex = highestIntersecting.index;
          const origin = highestIntersectingIndex > fullIntersectionIndex ? 'end' : 'start';

          scrollToElement({
            container: scrollElement,
            element: highestIntersecting.element,
            direction: this.direction === 'horizontal' ? 'inline' : 'block',
            origin,
            scrollBlockMargin: this.direction === 'horizontal' ? 0 : this.scrollMargin,
            scrollInlineMargin: this.direction === 'horizontal' ? this.scrollMargin : 0,
          });

          isSnapping = true;

          window.clearTimeout(snapTimeout);

          snapTimeout = window.setTimeout(() => {
            isSnapping = false;
          }, 1000);
        }),
      )
      .subscribe();
  }
}
