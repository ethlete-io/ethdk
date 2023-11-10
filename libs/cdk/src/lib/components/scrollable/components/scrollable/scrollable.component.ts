import { NgClass, NgIf } from '@angular/common';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
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
  CurrentElementVisibility,
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
  isElementVisible,
  nextFrame,
  scrollToElement,
  signalElementIntersection,
  signalElementScrollState,
  signalHostAttributes,
  signalHostClasses,
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

  @Input({ alias: 'itemSize' })
  private set _itemSize(v: 'auto' | 'same' | 'full') {
    this.itemSize.set(v);
  }
  readonly itemSize = signal<'auto' | 'same' | 'full'>('auto');

  @Input({ alias: 'direction' })
  private set _direction(v: 'horizontal' | 'vertical') {
    this.direction.set(v);
  }
  readonly direction = signal<'horizontal' | 'vertical'>('horizontal');

  @Input({ alias: 'scrollableRole' })
  private set _scrollableRole(v: string | null) {
    this.scrollableRole.set(v);
  }
  readonly scrollableRole = signal<string | null>(null);

  @Input({ alias: 'scrollableClass' })
  private set _scrollableClass(v: NgClassType | null) {
    this.scrollableClass.set(v);
  }
  readonly scrollableClass = signal<NgClassType | null>(null);

  @Input({ transform: booleanAttribute, alias: 'renderMasks' })
  private set _renderMasks(v: boolean) {
    this.renderMasks.set(v);
  }
  readonly renderMasks = signal(true);

  @Input({ transform: booleanAttribute, alias: 'renderButtons' })
  private set _renderButtons(v: boolean) {
    this.renderButtons.set(v);
  }
  readonly renderButtons = signal(true);

  @Input({ transform: booleanAttribute, alias: 'renderScrollbars' })
  private set _renderScrollbars(v: boolean) {
    this.renderScrollbars.set(v);
  }
  readonly renderScrollbars = signal(false);

  @Input({ transform: booleanAttribute, alias: 'stickyButtons' })
  private set _stickyButtons(v: boolean) {
    this.stickyButtons.set(v);
  }
  readonly stickyButtons = signal(false);

  @Input({ transform: booleanAttribute, alias: 'cursorDragScroll' })
  private set _cursorDragScroll(v: boolean) {
    this.cursorDragScroll.set(v);
  }
  readonly cursorDragScroll = signal(true);

  @Input({ transform: booleanAttribute, alias: 'disableActiveElementScrolling' })
  private set _disableActiveElementScrolling(v: boolean) {
    this.disableActiveElementScrolling.set(v);
  }
  readonly disableActiveElementScrolling = signal(false);

  @Input({ alias: 'scrollMode' })
  private set _scrollMode(v: ScrollableScrollMode) {
    this.scrollMode.set(v);
  }
  readonly scrollMode = signal<ScrollableScrollMode>('container');

  @Input({ transform: booleanAttribute, alias: 'snap' })
  private set _snap(v: boolean) {
    this.snap.set(v);
  }
  readonly snap = signal(false);

  @Input({ transform: numberAttribute, alias: 'scrollMargin' })
  private set _scrollMargin(v: number) {
    this.scrollMargin.set(v);
  }
  readonly scrollMargin = signal(0);

  @Output()
  readonly scrollStateChange = new EventEmitter<ScrollObserverScrollState>();

  @Output()
  readonly intersectionChange = new EventEmitter<ScrollableIntersectionChange[]>();

  @ViewChild('scrollable', { static: true })
  private set _scrollable(e: ElementRef<HTMLElement>) {
    this.scrollable.set(e);
  }
  readonly scrollable = signal<ElementRef<HTMLElement> | null>(null);

  @ViewChild('firstElement', { static: true })
  private set _firstElement(e: ElementRef<HTMLElement>) {
    this.firstElement.set(e);
  }
  readonly firstElement = signal<ElementRef<HTMLElement> | null>(null);

  @ViewChild('lastElement', { static: true })
  private set _lastElement(e: ElementRef<HTMLElement>) {
    this.lastElement.set(e);
  }
  readonly lastElement = signal<ElementRef<HTMLElement> | null>(null);

  @ContentChildren(IS_ACTIVE_ELEMENT, { descendants: true })
  private set _activeElementList(e: TypedQueryList<IsActiveElementDirective>) {
    this.activeElementList.set(e);
  }
  readonly activeElementList = signal<TypedQueryList<IsActiveElementDirective> | null>(null);

  @ContentChildren(IS_ELEMENT, { descendants: true })
  private set _elementList(e: TypedQueryList<IsElementDirective>) {
    this.elementList.set(e);
  }
  readonly elementList = signal<TypedQueryList<IsElementDirective> | null>(null);

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

  protected readonly containerScrollState = signalElementScrollState(this.scrollable);
  protected readonly firstElementIntersection = signalElementIntersection(this.firstElement);
  protected readonly firstElementVisibility = signal<CurrentElementVisibility | null>(null);
  protected readonly lastElementIntersection = signalElementIntersection(this.lastElement);
  protected readonly lastElementVisibility = signal<CurrentElementVisibility | null>(null);

  protected readonly canScroll = computed(() => {
    const dir = this.direction();

    if (dir === 'horizontal') {
      return this.containerScrollState().canScrollHorizontally;
    }

    return this.containerScrollState().canScrollVertically;
  });

  protected readonly isAtStart = computed(() => {
    if (!this.canScroll()) {
      return true;
    }

    const intersection = this.firstElementIntersection();

    if (!intersection) {
      return this.firstElementVisibility()?.inline ?? true;
    }

    return intersection.isIntersecting;
  });
  protected readonly isAtEnd = computed(() => {
    if (!this.canScroll()) {
      return true;
    }

    const intersection = this.lastElementIntersection();

    if (!intersection) {
      return this.lastElementVisibility()?.inline ?? true;
    }

    return intersection.isIntersecting;
  });

  protected readonly enableOverlayAnimations = signal(false);

  protected readonly hostAttributes = signalHostAttributes({
    'item-size': this.itemSize,
    direction: this.direction,
    'render-scrollbars': this.renderScrollbars,
    'sticky-buttons': this.stickyButtons,
  });

  protected readonly hostClasses = signalHostClasses({
    'et-scrollable--can-scroll': this.canScroll,
    'et-scrollable--is-at-start': this.isAtStart,
    'et-scrollable--is-at-end': this.isAtEnd,
    'et-scrollable--enable-overlay-animations': this.enableOverlayAnimations,
  });

  constructor() {
    effect(
      () => {
        const scrollable = this.scrollable()?.nativeElement;
        const firstElement = this.firstElement()?.nativeElement;
        const lastElement = this.lastElement()?.nativeElement;
        const activeElementList = this.activeElementList()?.toArray();

        if (!scrollable || !firstElement || !lastElement || !activeElementList) {
          return;
        }

        const firstActive = activeElementList.find((a) => a.isActiveElement);

        if (firstActive && !this.disableActiveElementScrolling()) {
          const offsetTop = firstActive.elementRef.nativeElement.offsetTop - scrollable.offsetTop;
          const offsetLeft = firstActive.elementRef.nativeElement.offsetLeft - scrollable.offsetLeft;
          scrollable.scrollLeft = offsetLeft;
          scrollable.scrollTop = offsetTop;
        }

        this.firstElementVisibility.set(
          isElementVisible({
            container: scrollable,
            element: firstElement,
          }),
        );

        this.lastElementVisibility.set(
          isElementVisible({
            container: scrollable,
            element: lastElement,
          }),
        );

        // We need to wait one frame before enabling animations to prevent a animation from playing during initial render.
        nextFrame(() => this.enableOverlayAnimations.set(true));
      },
      { allowSignalWrites: true },
    );

    effect(() => {
      const isAtStart = this.isAtStart();
      const isAtEnd = this.isAtEnd();
      const canScroll = this.canScroll();

      this.scrollStateChange.emit({
        canScroll,
        isAtEnd: !!isAtEnd,
        isAtStart: !!isAtStart,
      });
    });
  }

  ngAfterContentInit(): void {
    this._setupScrollListening();
  }

  scrollOneContainerSize(direction: 'start' | 'end') {
    const scrollElement = this.scrollable()?.nativeElement;

    if (!scrollElement) {
      return;
    }

    const parent = this._elementRef.nativeElement;

    const scrollableSize = this.direction() === 'horizontal' ? parent.clientWidth : parent.clientHeight;
    const currentScroll = this.direction() === 'horizontal' ? scrollElement.scrollLeft : scrollElement.scrollTop;

    scrollElement.scrollTo({
      [this.direction() === 'horizontal' ? 'left' : 'top']:
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
      direction: this.direction() === 'horizontal' ? 'inline' : 'block',
      origin: direction,
      ...(this.direction() === 'horizontal'
        ? { scrollInlineMargin: this.scrollMargin() }
        : { scrollBlockMargin: this.scrollMargin() }),
    });
  }

  scrollToElement(options: Omit<ScrollToElementOptions, 'container'>) {
    const scrollElement = this.scrollable()?.nativeElement;

    scrollToElement({
      container: scrollElement,
      ...(this.direction() === 'horizontal'
        ? { scrollInlineMargin: this.scrollMargin() }
        : { scrollBlockMargin: this.scrollMargin() }),
      ...options,
    });
  }

  scrollToElementByIndex(options: Omit<ScrollToElementOptions, 'container'> & { index: number }) {
    const elements = this.elementList()?.toArray() ?? [];

    if (!elements.length) {
      if (isDevMode()) {
        console.warn(
          'No elements found to scroll to. Make sure to apply the isElement directive to the elements you want to scroll to.',
        );
      }
      return;
    }

    const scrollElement = this.scrollable()?.nativeElement;
    const element = elements[options.index]?.elementRef.nativeElement;

    scrollToElement({
      container: scrollElement,
      element,
      ...(this.direction() === 'horizontal'
        ? { scrollInlineMargin: this.scrollMargin() }
        : { scrollBlockMargin: this.scrollMargin() }),
      ...options,
    });
  }

  protected setIsCursorDragging(isDragging: boolean) {
    this._isCursorDragging$.next(isDragging);
  }

  protected scrollToStartDirection() {
    if (this.scrollMode() === 'container') {
      this.scrollOneContainerSize('start');
    } else {
      this.scrollOneItemSize('start');
    }
  }

  protected scrollToStartEnd() {
    if (this.scrollMode() === 'container') {
      this.scrollOneContainerSize('end');
    } else {
      this.scrollOneItemSize('end');
    }
  }

  private _setupScrollListening() {
    const scrollElement = this.scrollable()?.nativeElement;
    const elements = this.elementList();

    if (!scrollElement || !elements) {
      return;
    }

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
      elements.changes.pipe(startWith(elements)) ?? of(null),
    )
      .pipe(
        debounceTime(300),
        takeUntil(this._destroy$),
        tap(() => {
          const els =
            elements
              ?.toArray()
              .map((e) => e?.elementRef.nativeElement)
              .filter((e): e is HTMLElement => !!e) ?? [];

          if (!els.length) {
            this._latestVisibilityStates$.next([]);

            return;
          }

          const states = getElementVisibleStates({
            elements: els,
            container: scrollElement,
          });

          const prop = this.direction() === 'horizontal' ? 'inlineIntersection' : 'blockIntersection';
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

          if (isSnapping || this._isCursorDragging$.value || !this.snap()) return;

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
            direction: this.direction() === 'horizontal' ? 'inline' : 'block',
            origin,
            scrollBlockMargin: this.direction() === 'horizontal' ? 0 : this.scrollMargin(),
            scrollInlineMargin: this.direction() === 'horizontal' ? this.scrollMargin() : 0,
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
