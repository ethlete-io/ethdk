import { NgClass } from '@angular/common';
import {
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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  CurrentElementVisibility,
  CursorDragScrollDirective,
  LetDirective,
  NgClassType,
  ObserveScrollStateDirective,
  ScrollObserverScrollState,
  ScrollToElementOptions,
  TypedQueryList,
  getFirstAndLastPartialIntersection,
  isElementVisible,
  nextFrame,
  scrollToElement,
  signalElementChildren,
  signalElementIntersection,
  signalElementScrollState,
  signalHostAttributes,
  signalHostClasses,
  signalHostElementDimensions,
  signalHostStyles,
} from '@ethlete/core';
import {
  BehaviorSubject,
  Subject,
  combineLatest,
  debounceTime,
  filter,
  fromEvent,
  map,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { ChevronIconComponent } from '../../../icons/chevron-icon';
import { ScrollableIgnoreChildDirective, isScrollableChildIgnored } from '../../directives/scrollable-ignore-child';
import {
  SCROLLABLE_IS_ACTIVE_CHILD_TOKEN,
  ScrollableIsActiveChildDirective,
} from '../../directives/scrollable-is-active-child';
import { ScrollableIntersectionChange, ScrollableScrollMode } from '../../types';

// Thresholds for the intersection observer.
const ELEMENT_INTERSECTION_THRESHOLD = [
  // We use 51 steps to get a 2% step size.
  ...Array.from({ length: 51 }, (_, i) => i / 50),

  // Additional steps needed since display scaling can cause the intersection ratio to be slightly off.
  0.01,
  0.005,
  0.001,
  0.99,
  0.995,
  0.999,
];

interface ScrollableNavigationItem {
  isActive: boolean;
  element: HTMLElement;
}

@Component({
  selector: 'et-scrollable',
  templateUrl: './scrollable.component.html',
  styleUrls: ['./scrollable.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CursorDragScrollDirective,
    ObserveScrollStateDirective,
    NgClass,
    LetDirective,
    ChevronIconComponent,
    ScrollableIsActiveChildDirective,
    ScrollableIgnoreChildDirective,
  ],
  host: {
    class: 'et-scrollable',
  },
})
export class ScrollableComponent {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _isCursorDragging$ = new BehaviorSubject<boolean>(false);

  @Input({ alias: 'itemSize' })
  set _itemSize(v: 'auto' | 'same' | 'full') {
    this.itemSize.set(v);
  }
  readonly itemSize = signal<'auto' | 'same' | 'full'>('auto');

  @Input({ alias: 'direction' })
  set _direction(v: 'horizontal' | 'vertical') {
    this.direction.set(v);
  }
  readonly direction = signal<'horizontal' | 'vertical'>('horizontal');

  @Input({ alias: 'scrollableRole' })
  set _scrollableRole(v: string | null) {
    this.scrollableRole.set(v);
  }
  readonly scrollableRole = signal<string | null>(null);

  @Input({ alias: 'scrollableClass' })
  set _scrollableClass(v: NgClassType | null) {
    this.scrollableClass.set(v);
  }
  readonly scrollableClass = signal<NgClassType | null>(null);

  @Input({ transform: booleanAttribute, alias: 'renderNavigation' })
  set _renderNavigation(v: boolean) {
    this.renderNavigation.set(v);
  }
  readonly renderNavigation = signal(false);

  @Input({ transform: booleanAttribute, alias: 'renderMasks' })
  set _renderMasks(v: boolean) {
    this.renderMasks.set(v);
  }
  readonly renderMasks = signal(true);

  @Input({ transform: booleanAttribute, alias: 'renderButtons' })
  set _renderButtons(v: boolean) {
    this.renderButtons.set(v);
  }
  readonly renderButtons = signal(true);

  @Input({ transform: booleanAttribute, alias: 'renderScrollbars' })
  set _renderScrollbars(v: boolean) {
    this.renderScrollbars.set(v);
  }
  readonly renderScrollbars = signal(false);

  @Input({ transform: booleanAttribute, alias: 'stickyButtons' })
  set _stickyButtons(v: boolean) {
    this.stickyButtons.set(v);
  }
  readonly stickyButtons = signal(false);

  @Input({ transform: booleanAttribute, alias: 'cursorDragScroll' })
  set _cursorDragScroll(v: boolean) {
    this.cursorDragScroll.set(v);
  }
  readonly cursorDragScroll = signal(true);

  @Input({ transform: booleanAttribute, alias: 'disableActiveElementScrolling' })
  set _disableActiveElementScrolling(v: boolean) {
    this.disableActiveElementScrolling.set(v);
  }
  readonly disableActiveElementScrolling = signal(false);

  @Input({ alias: 'scrollMode' })
  set _scrollMode(v: ScrollableScrollMode) {
    this.scrollMode.set(v);
  }
  readonly scrollMode = signal<ScrollableScrollMode>('container');

  @Input({ transform: booleanAttribute, alias: 'snap' })
  set _snap(v: boolean) {
    this.snap.set(v);
  }
  readonly snap = signal(false);

  @Input({ transform: numberAttribute, alias: 'scrollMargin' })
  set _scrollMargin(v: number) {
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

  @ViewChild('scrollableContainer', { static: true })
  private set _scrollableContainer(e: ElementRef<HTMLElement>) {
    this.scrollableContainer.set(e);
  }
  readonly scrollableContainer = signal<ElementRef<HTMLElement> | null>(null);

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

  @ContentChildren(SCROLLABLE_IS_ACTIVE_CHILD_TOKEN, { descendants: true })
  private set _activeElementList(e: TypedQueryList<ScrollableIsActiveChildDirective>) {
    this.activeElementList.set(e);
  }
  readonly activeElementList = signal<TypedQueryList<ScrollableIsActiveChildDirective> | null>(null);

  private readonly containerScrollState = signalElementScrollState(this.scrollable);
  private readonly firstElementIntersection = signalElementIntersection(this.firstElement, { root: this.scrollable });
  private readonly firstElementVisibility = signal<CurrentElementVisibility | null>(null);
  private readonly lastElementIntersection = signalElementIntersection(this.lastElement, { root: this.scrollable });
  private readonly lastElementVisibility = signal<CurrentElementVisibility | null>(null);

  private readonly allScrollableChildren = signalElementChildren(this.scrollableContainer);
  private readonly scrollableDimensions = signalHostElementDimensions();
  private readonly scrollableChildren = computed(() =>
    this.allScrollableChildren().filter((c) => !isScrollableChildIgnored(c)),
  );

  private readonly _disableSnapping$ = new Subject<void>();

  private readonly scrollableContentIntersections = signalElementIntersection(this.scrollableChildren, {
    root: this.scrollable,
    threshold: ELEMENT_INTERSECTION_THRESHOLD,
  });

  private readonly scrollableContentIntersections$ = toObservable(this.scrollableContentIntersections);

  private readonly manualActiveNavigationIndex = signal<number | null>(null);

  private readonly canScroll = computed(() => {
    const dir = this.direction();

    if (dir === 'horizontal') {
      return this.containerScrollState().canScrollHorizontally;
    }

    return this.containerScrollState().canScrollVertically;
  });

  readonly isAtStart = computed(() => {
    if (!this.canScroll()) {
      return true;
    }

    const intersection = this.firstElementIntersection()[0];

    if (!intersection) {
      return this.firstElementVisibility()?.inline ?? true;
    }

    return intersection.isIntersecting;
  });
  readonly isAtEnd = computed(() => {
    if (!this.canScroll()) {
      return true;
    }

    const intersection = this.lastElementIntersection()[0];

    if (!intersection) {
      return this.lastElementVisibility()?.inline ?? true;
    }

    return intersection.isIntersecting;
  });

  private readonly _actualItemSize = computed(() => {
    if (this.itemSize() !== 'full') return null;

    const dimensions = this.scrollableDimensions();

    if (this.direction() === 'horizontal') {
      return dimensions.rect?.width ?? null;
    } else {
      return dimensions.rect?.height ?? null;
    }
  });

  private readonly enableOverlayAnimations = signal(false);

  private readonly _initialScrollableNavigation = signal<ScrollableNavigationItem[]>([]);

  protected readonly scrollableNavigation = computed<ScrollableNavigationItem[]>(() => {
    const allIntersections = this.scrollableContentIntersections();
    const manualActiveNavigationIndex = this.manualActiveNavigationIndex();
    const initialScrollableNavigation = this._initialScrollableNavigation();

    if (!allIntersections.length) {
      return initialScrollableNavigation;
    }

    const highestIntersection = allIntersections.reduce((prev, curr) => {
      if (prev && prev.intersectionRatio > curr.intersectionRatio) {
        return prev;
      }

      return curr;
    }, allIntersections[0]);

    if (!highestIntersection) {
      return [];
    }

    return allIntersections.map((i, index) => ({
      isActive:
        manualActiveNavigationIndex !== null
          ? manualActiveNavigationIndex === index
          : i === highestIntersection && highestIntersection.intersectionRatio > 0,
      element: i.target as HTMLElement,
    }));
  });

  readonly hostAttributeBindings = signalHostAttributes({
    'item-size': this.itemSize,
    'actual-item-size': this._actualItemSize,
    direction: this.direction,
    'render-scrollbars': this.renderScrollbars,
    'sticky-buttons': this.stickyButtons,
  });

  readonly hostClassBindings = signalHostClasses({
    'et-scrollable--can-scroll': computed(() => this.canScroll() && !this.isAtStart() && !this.isAtEnd()),
    'et-scrollable--is-at-start': this.isAtStart,
    'et-scrollable--is-at-end': this.isAtEnd,
    'et-scrollable--enable-overlay-animations': this.enableOverlayAnimations,
  });

  readonly hostStyleBindings = signalHostStyles({
    '--actual-item-size': computed(() => (this._actualItemSize() !== null ? `${this._actualItemSize()}px` : undefined)),
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

        const firstActive = activeElementList.find((a) => a.isActiveChildEnabled());

        if (firstActive && !this.disableActiveElementScrolling()) {
          const offsetTop = firstActive.elementRef.nativeElement.offsetTop - scrollable.offsetTop;
          const offsetLeft = firstActive.elementRef.nativeElement.offsetLeft - scrollable.offsetLeft;
          scrollable.scrollLeft = offsetLeft - this.scrollMargin();
          scrollable.scrollTop = offsetTop - this.scrollMargin();
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

    effect(
      () => {
        const elementList = this.scrollableChildren();
        const scrollable = this.scrollable()?.nativeElement;
        const renderNavigation = this.renderNavigation();

        if (!elementList || !scrollable || !renderNavigation) {
          return;
        }

        const firstVisibleElement = elementList.find((e) => isElementVisible({ container: scrollable, element: e }));

        if (!firstVisibleElement) {
          return;
        }

        const initialNavigationItems: ScrollableNavigationItem[] = elementList.map((e) => ({
          isActive: e === firstVisibleElement,
          element: e,
        }));

        this._initialScrollableNavigation.set(initialNavigationItems);
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

    effect(() => {
      const enableSnapping = this.snap();

      if (enableSnapping) {
        this._enableSnapping();
      } else {
        this._disableSnapping();
      }
    });

    this.scrollableContentIntersections$
      .pipe(
        takeUntilDestroyed(),
        debounceTime(10),
        tap((entries) => {
          this.intersectionChange.emit(
            entries.map((i, index) => ({
              index,
              element: i.target as HTMLElement,
              intersectionRatio: i.intersectionRatio,
              isIntersecting: i.isIntersecting,
            })),
          );
        }),
      )
      .subscribe();
  }

  scrollOneContainerSize(direction: 'start' | 'end') {
    const scrollElement = this.scrollable()?.nativeElement;

    if (!scrollElement) {
      return;
    }

    const parent = this._elementRef.nativeElement;

    const isSnappingEnabled = this.snap();

    if (isSnappingEnabled) {
      // If snapping is enabled we want to scroll to a position where no further snapping will happen after the scroll.
      const allIntersections = this.scrollableContentIntersections();
      const intersections = getFirstAndLastPartialIntersection(allIntersections);
      const relevantIntersection = direction === 'start' ? intersections?.first : intersections?.last;

      if (!relevantIntersection) return;

      const nextIndex =
        relevantIntersection.intersection.intersectionRatio !== 1
          ? relevantIntersection.index
          : direction === 'start'
            ? relevantIntersection.index - 1
            : relevantIntersection.index + 1;

      const element =
        (allIntersections[nextIndex]?.target as HTMLElement) ||
        (relevantIntersection.intersection.target as HTMLElement);

      this.scrollToElement({
        element: element,
        origin: direction === 'end' ? 'start' : 'end',
      });
    } else {
      // Just scroll one size of the scrollable container.
      const scrollableSize = this.direction() === 'horizontal' ? parent.clientWidth : parent.clientHeight;
      const currentScroll = this.direction() === 'horizontal' ? scrollElement.scrollLeft : scrollElement.scrollTop;

      scrollElement.scrollTo({
        [this.direction() === 'horizontal' ? 'left' : 'top']:
          currentScroll + (direction === 'start' ? -scrollableSize : scrollableSize),
        behavior: 'smooth',
      });
    }
  }

  scrollOneItemSize(direction: 'start' | 'end') {
    const allIntersections = this.scrollableContentIntersections();
    const scrollElement = this.scrollable()?.nativeElement;

    if (!allIntersections.length) {
      if (isDevMode()) {
        console.warn(
          'No elements found to scroll to. Make sure to apply the isElement directive to the elements you want to scroll to.',
        );
      }
      return;
    }

    const intersections = getFirstAndLastPartialIntersection(allIntersections);

    if (!intersections || !scrollElement) return;

    // Means the current element is bigger than the scrollable container.
    // In this case we should scroll to the start of the current element. If we are already there we should scroll to the end of the previous element.
    // This applies to the other direction as well.
    const isFirstAndLastIntersectionEqual = intersections.first.intersection === intersections.last.intersection;
    const scrollableRect = scrollElement.getBoundingClientRect();

    if (isFirstAndLastIntersectionEqual) {
      const intersection = intersections.first.intersection.target.getBoundingClientRect();
      const isStartOfElementVisible =
        this.direction() === 'horizontal'
          ? Math.round(intersection.left) >= Math.round(scrollableRect.left)
          : Math.round(intersection.top) >= Math.round(scrollableRect.top);

      const isEndOfElementVisible =
        this.direction() === 'horizontal'
          ? Math.round(intersection.right) <= Math.round(scrollableRect.right)
          : Math.round(intersection.bottom) <= Math.round(scrollableRect.bottom);

      if (!isStartOfElementVisible || !isEndOfElementVisible) {
        if (direction === 'start') {
          if (isStartOfElementVisible) {
            // to the end of the previous element
            const previousIndex = intersections.first.index - 1;
            const elementToScrollTo = allIntersections[previousIndex]?.target as HTMLElement;

            if (!elementToScrollTo) return;

            this.scrollToElement({
              element: elementToScrollTo,
              origin: 'end',
            });
          } else {
            // to the start of the current element
            this.scrollToElement({
              element: intersections.first.intersection.target as HTMLElement,
              origin: 'start',
            });
          }
        } else {
          if (isEndOfElementVisible) {
            // to the start of the next element
            const nextIndex = intersections.last.index + 1;
            const elementToScrollTo = allIntersections[nextIndex]?.target as HTMLElement;

            if (!elementToScrollTo) return;

            this.scrollToElement({
              element: elementToScrollTo,
              origin: 'start',
            });
          } else {
            // to the end of the current element
            this.scrollToElement({
              element: intersections.last.intersection.target as HTMLElement,
              origin: 'end',
            });
          }
        }

        return;
      }
    }

    const data = direction === 'start' ? intersections.first : intersections.last;
    let elementToScrollTo = data.intersection.target as HTMLElement;

    if (Math.round(data.intersection.intersectionRatio) === 1) {
      if (direction === 'start' && data.index === 0) {
        return;
      }

      if (direction === 'end' && data.index === allIntersections.length - 1) {
        return;
      }

      const nextIndex = direction === 'start' ? data.index - 1 : data.index + 1;

      elementToScrollTo = allIntersections[nextIndex]?.target as HTMLElement;
    }

    if (!elementToScrollTo) return;

    this.scrollToElement({
      element: elementToScrollTo,
      origin: direction,
    });
  }

  scrollToElement(options: Omit<ScrollToElementOptions, 'container'>) {
    const scrollElement = this.scrollable()?.nativeElement;

    scrollToElement({
      container: scrollElement,
      direction: this.direction() === 'horizontal' ? 'inline' : 'block',
      ...(this.direction() === 'horizontal'
        ? { scrollInlineMargin: this.scrollMargin() }
        : { scrollBlockMargin: this.scrollMargin() }),
      ...options,
    });
  }

  scrollToElementByIndex(options: Omit<ScrollToElementOptions, 'container'> & { index: number }) {
    const elements = this.scrollableChildren();

    if (!elements.length) {
      if (isDevMode()) {
        console.warn(
          'No elements found to scroll to. Make sure to apply the isElement directive to the elements you want to scroll to.',
        );
      }
      return;
    }

    const scrollElement = this.scrollable()?.nativeElement;
    const element = elements[options.index];

    scrollToElement({
      container: scrollElement,
      element,
      ...(this.direction() === 'horizontal'
        ? { scrollInlineMargin: this.scrollMargin() }
        : { scrollBlockMargin: this.scrollMargin() }),
      ...options,
    });
  }

  protected scrollToElementViaNavigation(elementIndex: number, element: HTMLElement) {
    this.manualActiveNavigationIndex.set(elementIndex);

    this.scrollToElement({
      element,
    });

    const scrollElement = this.scrollable()?.nativeElement;

    if (!scrollElement) return;

    fromEvent(scrollElement, 'scroll')
      .pipe(
        debounceTime(50),
        take(1),
        tap(() => this.manualActiveNavigationIndex.set(null)),
      )
      .subscribe();
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

  protected scrollToEndDirection() {
    if (this.scrollMode() === 'container') {
      this.scrollOneContainerSize('end');
    } else {
      this.scrollOneItemSize('end');
    }
  }

  private _enableSnapping() {
    combineLatest([this.scrollableContentIntersections$, this._isCursorDragging$])
      .pipe(
        filter(([, isDragging]) => !isDragging),
        map(([intersections]) => intersections),
        debounceTime(150),
        tap((allIntersections) => {
          const scrollElement = this.scrollable()?.nativeElement;

          if (!scrollElement) return;

          const intersections = getFirstAndLastPartialIntersection(allIntersections);

          if (!intersections) return;

          const isFirstAndLastIntersectionEqual = intersections.first.intersection === intersections.last.intersection;
          const scrollableRect = scrollElement.getBoundingClientRect();

          if (isFirstAndLastIntersectionEqual) {
            const intersection = intersections.first.intersection.target.getBoundingClientRect();
            const isStartOfElementVisible =
              this.direction() === 'horizontal'
                ? intersection.left >= scrollableRect.left
                : intersection.top >= scrollableRect.top;

            const isEndOfElementVisible =
              this.direction() === 'horizontal'
                ? intersection.right <= scrollableRect.right
                : intersection.bottom <= scrollableRect.bottom;

            // Don't snap if neither the start nor the end of the current element is visible.
            // Otherwise this would result in parts of the element being inaccessible.
            if (!isStartOfElementVisible && !isEndOfElementVisible) return;

            // If the start of the element is visible we should snap to the start.
            if (isStartOfElementVisible) {
              this.scrollToElement({
                element: intersections.first.intersection.target as HTMLElement,
                origin: 'start',
              });
              return;
            }

            // If the end of the element is visible we should snap to the end.
            if (isEndOfElementVisible) {
              this.scrollToElement({
                element: intersections.last.intersection.target as HTMLElement,
                origin: 'end',
              });
              return;
            }
          } else if (
            (this.direction() === 'horizontal' &&
              intersections.biggest.intersection.boundingClientRect.width > scrollableRect.width) ||
            (this.direction() === 'vertical' &&
              intersections.biggest.intersection.boundingClientRect.height > scrollableRect.height)
          ) {
            // If the current element is bigger than the scrollable container we should snap to the start of the current element if the scroll direction is forward
            // and to the end of the current element if the scroll direction is backwards.
            const origin = intersections.biggest.index === intersections.first.index ? 'end' : 'start';

            this.scrollToElement({
              element: intersections.biggest.intersection.target as HTMLElement,
              origin,
            });
          } else {
            // No special case. Just snap to the biggest intersection.
            this.scrollToElement({
              element: intersections.biggest.intersection.target as HTMLElement,
            });
          }
        }),
        takeUntil(this._disableSnapping$),
      )
      .subscribe();
  }

  private _disableSnapping() {
    this._disableSnapping$.next();
  }
}
