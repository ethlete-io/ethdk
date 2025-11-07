import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  isDevMode,
  numberAttribute,
  signal,
  viewChild,
} from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  NgClassType,
  ScrollToElementOptions,
  createCanAnimateSignal,
  createIsRenderedSignal,
  getElementScrollCoordinates,
  getIntersectionInfo,
  signalClasses,
  signalElementChildren,
  signalElementDimensions,
  signalElementIntersection,
  signalElementScrollState,
  signalHostAttributes,
  signalHostClasses,
  signalHostStyles,
  signalStyles,
  useCursorDragScroll,
} from '@ethlete/core';
import { Subject, combineLatest, debounceTime, filter, fromEvent, map, of, switchMap, takeUntil, tap } from 'rxjs';
import { CHEVRON_ICON } from '../../../icons/chevron-icon';
import { provideIcons } from '../../../icons/icon-provider';
import { IconDirective } from '../../../icons/icon.directive';
import { ScrollableIgnoreChildDirective, isScrollableChildIgnored } from '../../directives/scrollable-ignore-child';
import { SCROLLABLE_IS_ACTIVE_CHILD_TOKEN } from '../../directives/scrollable-is-active-child';
import { SCROLLABLE_LOADING_TEMPLATE_TOKEN } from '../../directives/scrollable-loading-template';
import { ScrollableIntersectionChange, ScrollableScrollMode } from '../../types';

export interface ScrollObserverScrollState {
  isAtStart: boolean;
  isAtEnd: boolean;
  canScroll: boolean;
}

// Thresholds for the intersection observer.
const ELEMENT_INTERSECTION_THRESHOLD = [
  // 5% steps
  ...Array.from({ length: 21 }, (_, i) => i * 0.05),

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
  activeOffset: number;
  element: HTMLElement;
}

export type ScrollableButtonPosition = 'inside' | 'footer';
export type ScrollableScrollOrigin = 'auto' | 'center' | 'start' | 'end';
export type ScrollableDirection = 'horizontal' | 'vertical';
export type ScrollableItemSize = 'auto' | 'same' | 'full';
export type ScrollableLoadingTemplatePosition = 'start' | 'end';

@Component({
  selector: 'et-scrollable',
  templateUrl: './scrollable.component.html',
  styleUrls: ['./scrollable.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, ScrollableIgnoreChildDirective, NgTemplateOutlet, IconDirective],
  host: {
    class: 'et-scrollable',
  },
  providers: [provideIcons(CHEVRON_ICON)],
})
export class ScrollableComponent {
  private _disableSnapping$ = new Subject<void>();
  private _manualActiveNavigationIndex = signal<number | null>(null);

  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  itemSize = input<ScrollableItemSize>('auto');
  direction = input<ScrollableDirection>('horizontal');
  scrollableRole = input<string | null>(null);
  scrollableClass = input<NgClassType | null>(null);
  renderNavigation = input(false, { transform: booleanAttribute });
  renderMasks = input(true, { transform: booleanAttribute });
  renderButtons = input(true, { transform: booleanAttribute });
  buttonPosition = input<ScrollableButtonPosition>('inside');
  renderScrollbars = input(false, { transform: booleanAttribute });
  stickyButtons = input(false, { transform: booleanAttribute });
  cursorDragScroll = input(true, { transform: booleanAttribute });
  disableActiveElementScrolling = input(false, { transform: booleanAttribute });
  scrollMode = input<ScrollableScrollMode>('container');
  snap = input(false, { transform: booleanAttribute });
  scrollMargin = input(0, { transform: numberAttribute });
  scrollOrigin = input<ScrollableScrollOrigin>('auto');
  darkenNonIntersectingItems = input(false, { transform: booleanAttribute });
  showLoadingTemplate = input(false, { transform: booleanAttribute });
  loadingTemplatePosition = input<ScrollableLoadingTemplatePosition>('end');

  scrollable = viewChild<ElementRef<HTMLElement>>('scrollable');
  firstElement = viewChild<ElementRef<HTMLElement>>('firstElement');
  lastElement = viewChild<ElementRef<HTMLElement>>('lastElement');
  activeElementList = contentChildren(SCROLLABLE_IS_ACTIVE_CHILD_TOKEN, { descendants: true });
  navigationDotsContainer = viewChild<ElementRef<HTMLElement>>('navigationDotsContainer');
  firstNavigationDot = viewChild<ElementRef<HTMLButtonElement>>('navigationDot');

  loadingTemplate = contentChild(SCROLLABLE_LOADING_TEMPLATE_TOKEN);

  navigationDotDimensions = signalElementDimensions(this.firstNavigationDot);
  scrollState = signalElementScrollState(this.scrollable);

  isRendered = createIsRenderedSignal();
  canAnimate = createCanAnimateSignal();

  cursorDragScrollState = useCursorDragScroll(this.scrollable, {
    enabled: this.cursorDragScroll,
    allowedDirection: this.direction,
  });
  isCursorDragging$ = toObservable(this.cursorDragScrollState.isDragging);

  renderButtonsInside = computed(() => this.buttonPosition() === 'inside' && this.renderButtons());
  renderButtonsInFooter = computed(() => this.buttonPosition() === 'footer' && this.renderButtons());

  containerScrollState = signalElementScrollState(this.scrollable, {
    initialScrollPosition: computed(() => {
      const scrollable = this.scrollable()?.nativeElement;
      const activeElementList = this.activeElementList();

      if (!scrollable || !activeElementList.length || !this.isRendered.state()) return null;

      const firstActive = activeElementList.find((a) => a.isActiveChildEnabled());

      if (firstActive && !this.disableActiveElementScrolling()) {
        return this.getElementScrollCoordinates({ element: firstActive.elementRef.nativeElement });
      }

      return null;
    }),
  });
  firstElementIntersection = signalElementIntersection(this.firstElement, {
    root: this.scrollable,
    enabled: this.isRendered.state,
  });
  lastElementIntersection = signalElementIntersection(this.lastElement, {
    root: this.scrollable,
    enabled: this.isRendered.state,
  });

  allScrollableChildren = signalElementChildren(this.scrollable);
  scrollableChildren = computed(() => this.allScrollableChildren().filter((c) => !isScrollableChildIgnored(c)));

  scrollableContentIntersections = signalElementIntersection(this.scrollableChildren, {
    root: this.scrollable,
    threshold: ELEMENT_INTERSECTION_THRESHOLD,
    enabled: this.isRendered.state,
  });
  scrollableContentIntersections$ = toObservable(this.scrollableContentIntersections);

  nonScrollableIntersections = computed(
    () => {
      const allIntersections = this.scrollableContentIntersections();
      return allIntersections.filter((i) => i.intersectionRatio !== 1).map((i) => i.target as HTMLElement);
    },
    { equal: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]) },
  );

  isAtStart = computed(() => {
    const intersection = this.firstElementIntersection()[0];

    if (!intersection) return false;

    return intersection.isIntersecting;
  });

  isAtEnd = computed(() => {
    const intersection = this.lastElementIntersection()[0];

    if (!intersection) return false;

    return intersection.isIntersecting;
  });

  canScroll = computed(() =>
    this.direction() === 'horizontal'
      ? this.scrollState().canScrollHorizontally
      : this.scrollState().canScrollVertically,
  );

  scrollableNavigation = computed<ScrollableNavigationItem[]>(
    () => {
      const allIntersections = this.scrollableContentIntersections();
      const manualActiveNavigationIndex = this._manualActiveNavigationIndex();
      const isAtStart = this.isAtStart();
      const isAtEnd = this.isAtEnd();

      const firstIntersection = allIntersections[0];
      const lastIntersection = allIntersections[allIntersections.length - 1];

      const highestIntersection = isAtStart
        ? firstIntersection
        : isAtEnd
          ? lastIntersection
          : allIntersections.reduce((prev, curr) => {
              if (prev && prev.intersectionRatio > curr.intersectionRatio) {
                return prev;
              }

              return curr;
            }, allIntersections[0]);

      if (!highestIntersection) {
        return [];
      }

      const activeIndex =
        manualActiveNavigationIndex !== null
          ? manualActiveNavigationIndex
          : allIntersections.findIndex((i) => i === highestIntersection);

      return allIntersections.map((i, index) => ({
        isActive:
          manualActiveNavigationIndex !== null
            ? manualActiveNavigationIndex === index
            : i === highestIntersection && highestIntersection.intersectionRatio > 0,
        activeOffset: index === activeIndex ? 0 : Math.abs(index - activeIndex),
        element: i.target as HTMLElement,
      }));
    },
    { equal: (a, b) => a.length === b.length && a.every((v, i) => v.activeOffset === b[i]?.activeOffset) },
  );

  activeIndex = computed(() => {
    const scrollableNavigation = this.scrollableNavigation();
    const activeIndex = scrollableNavigation.findIndex((element) => element.isActive);

    return activeIndex;
  });

  intersectionChange = outputFromObservable<ScrollableIntersectionChange[]>(
    this.scrollableContentIntersections$.pipe(
      takeUntilDestroyed(),
      debounceTime(50),
      map((entries) =>
        entries.map((i, index) => ({
          index,
          element: i.target as HTMLElement,
          intersectionRatio: i.intersectionRatio,
          isIntersecting: i.isIntersecting,
        })),
      ),
    ),
  );

  scrollStateChange = outputFromObservable<ScrollObserverScrollState>(
    toObservable(
      computed(() => {
        const isAtStart = this.isAtStart();
        const isAtEnd = this.isAtEnd();
        const canScroll = this.canScroll();

        return {
          canScroll,
          isAtEnd: !!isAtEnd,
          isAtStart: !!isAtStart,
        };
      }),
    ),
  );

  allChildElementClassBindings = signalClasses(this.scrollableChildren, {
    'et-scrollable-item': signal(true),
  });

  nonFullIntersectingElementClassBindings = signalClasses(this.nonScrollableIntersections, {
    'et-scrollable-item--not-intersecting': signal(true),
  });

  hostAttributeBindings = signalHostAttributes({
    'item-size': this.itemSize,
    direction: this.direction,
    'render-scrollbars': this.renderScrollbars,
    'sticky-buttons': computed(() => this.stickyButtons() && this.renderButtonsInside()),
  });

  hostClassBindings = signalHostClasses({
    'et-scrollable--can-scroll': this.canScroll,
    'et-scrollable--is-at-start': this.isAtStart,
    'et-scrollable--is-at-end': this.isAtEnd,
    'et-scrollable--can-animate': this.canAnimate.state,
    'et-scrollable--darken-non-intersecting-items': this.darkenNonIntersectingItems,
  });

  hostStyleBindings = signalHostStyles({
    '--item-count': computed(() => this.scrollableChildren().length),
  });

  scrollableDotsContainerStyleBindings = signalStyles(this.navigationDotsContainer, {
    // Responsible for centering the active dot in navigation bar by using 'translate'
    transform: computed(() => {
      const activeIndex = this.activeIndex();
      const childCount = this.scrollableChildren().length;
      const offset = this.getNavigationDotsContainerTranslate(childCount, activeIndex);
      const dir = this.direction() === 'horizontal' ? 'X' : 'Y';

      return `translate${dir}(${offset})`;
    }),
  });

  constructor() {
    effect(() => {
      const enableSnapping = this.snap();

      if (enableSnapping) {
        this._enableSnapping();
      } else {
        this._disableSnapping();
      }
    });

    toObservable(this._manualActiveNavigationIndex)
      .pipe(
        filter((i) => i !== null),
        takeUntilDestroyed(),
        switchMap(() => {
          const scrollable = this.scrollable()?.nativeElement;

          if (!scrollable) {
            return of(null);
          }

          return fromEvent(scrollable, 'scroll');
        }),
        debounceTime(50),
        tap(() => this._manualActiveNavigationIndex.set(null)),
      )
      .subscribe();

    this.isRendered.bind();
  }

  getNavigationDotsContainerTranslate(navigationDotCount: number, activeIndex: number) {
    if (navigationDotCount <= 5) {
      return '0px';
    } else {
      const dotContainerWidth = this.navigationDotDimensions().client?.width ?? 20;
      let offset = -(activeIndex - 2);
      if (activeIndex < 3) {
        offset = 0;
      } else if (activeIndex >= navigationDotCount - 3) {
        offset = 5 - navigationDotCount;
      }
      return `${offset * dotContainerWidth}px`;
    }
  }

  scrollOneContainerSize(direction: 'start' | 'end') {
    const scrollElement = this.scrollable()?.nativeElement;

    if (!scrollElement) {
      return;
    }

    const parent = this.elementRef.nativeElement;

    const isSnappingEnabled = this.snap();

    if (isSnappingEnabled) {
      // If snapping is enabled we want to scroll to a position where no further snapping will happen after the scroll.
      const allIntersections = this.scrollableContentIntersections();
      const intersections = getIntersectionInfo(allIntersections);
      const relevantIntersection = direction === 'start' ? intersections?.partial.first : intersections?.partial.last;

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

    const intersections = getIntersectionInfo(allIntersections);

    if (!intersections || !scrollElement) return;

    // Means the current element is bigger than the scrollable container.
    // In this case we should scroll to the start of the current element. If we are already there we should scroll to the end of the previous element.
    // This applies to the other direction as well.
    const isFirstAndLastIntersectionEqual =
      intersections.partial.first.intersection === intersections.partial.last.intersection;
    const scrollableRect = scrollElement.getBoundingClientRect();

    if (isFirstAndLastIntersectionEqual) {
      const intersection = intersections.partial.first.intersection.target.getBoundingClientRect();
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
            const previousIndex = intersections.partial.first.index - 1;
            const elementToScrollTo = allIntersections[previousIndex]?.target as HTMLElement;

            if (!elementToScrollTo) return;
            this.scrollToElement({
              element: elementToScrollTo,
              origin: 'end',
            });
            this._manualActiveNavigationIndex.set(previousIndex);
          } else {
            // to the start of the current element
            this.scrollToElement({
              element: intersections.partial.first.intersection.target as HTMLElement,
              origin: 'start',
            });
            this._manualActiveNavigationIndex.set(intersections.partial.first.index);
          }
        } else {
          if (isEndOfElementVisible) {
            // to the start of the next element
            const nextIndex = intersections.partial.last.index + 1;
            const elementToScrollTo = allIntersections[nextIndex]?.target as HTMLElement;

            if (!elementToScrollTo) return;
            this.scrollToElement({
              element: elementToScrollTo,
              origin: 'start',
            });
            this._manualActiveNavigationIndex.set(nextIndex);
          } else {
            // to the end of the current element
            this.scrollToElement({
              element: intersections.partial.last.intersection.target as HTMLElement,
              origin: 'end',
            });

            this._manualActiveNavigationIndex.set(intersections.partial.last.index);
          }
        }

        return;
      }
    } else if (this.scrollOrigin() === 'center') {
      // If the scroll origin is forced to be center we should always snap to the center of the next partial intersection in the scroll direction.
      const nextPartialIntersection = direction === 'start' ? intersections.partial.first : intersections.partial.last;
      const nextIndex = nextPartialIntersection.index;

      this.scrollToElement({
        element: nextPartialIntersection.intersection.target as HTMLElement,
        origin: 'center',
      });
      this._manualActiveNavigationIndex.set(nextIndex);

      return;
    }

    const data = direction === 'start' ? intersections.partial.first : intersections.partial.last;
    let elementToScrollTo = data.intersection.target as HTMLElement;
    let nextIndex = data.index;

    if (Math.round(data.intersection.intersectionRatio) === 1) {
      if (direction === 'start' && data.index === 0) {
        return;
      }

      if (direction === 'end' && data.index === allIntersections.length - 1) {
        return;
      }

      nextIndex = direction === 'start' ? data.index - 1 : data.index + 1;

      elementToScrollTo = allIntersections[nextIndex]?.target as HTMLElement;

      if (!elementToScrollTo) return;
    }

    this.scrollToElement({
      element: elementToScrollTo,
      origin: direction,
    });

    this._manualActiveNavigationIndex.set(nextIndex);
  }

  getElementScrollCoordinates(options: Omit<ScrollToElementOptions, 'container'> & { ignoreForcedOrigin?: boolean }) {
    const scrollElement = this.scrollable()?.nativeElement;
    const { origin } = options;
    const forcedOrigin = this.scrollOrigin();

    return getElementScrollCoordinates({
      container: scrollElement,
      direction: this.direction() === 'horizontal' ? 'inline' : 'block',
      ...(this.direction() === 'horizontal'
        ? { scrollInlineMargin: this.scrollMargin() }
        : { scrollBlockMargin: this.scrollMargin() }),
      ...options,
      ...(forcedOrigin === 'auto' || options.ignoreForcedOrigin ? { origin } : { origin: forcedOrigin }),
    });
  }

  scrollToElement(options: Omit<ScrollToElementOptions, 'container'> & { ignoreForcedOrigin?: boolean }) {
    this.scrollable()?.nativeElement.scroll(this.getElementScrollCoordinates(options));
  }

  scrollToElementByIndex(
    options: Omit<ScrollToElementOptions, 'container'> & { index: number; ignoreForcedOrigin?: boolean },
  ) {
    const elements = this.scrollableChildren();
    const element = elements[options.index];

    if (!element) return;

    this.scrollToElement({
      element,
      ...options,
    });
  }

  protected scrollToElementViaNavigation(elementIndex: number) {
    const element = this.scrollableChildren()[elementIndex];
    this._manualActiveNavigationIndex.set(elementIndex);

    this.scrollToElement({
      element,
    });
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
    combineLatest([this.scrollableContentIntersections$, this.isCursorDragging$])
      .pipe(
        filter(([, isDragging]) => !isDragging),
        map(([intersections]) => intersections),
        debounceTime(150),
        tap((allIntersections) => {
          const scrollElement = this.scrollable()?.nativeElement;

          if (!scrollElement) return;

          const intersections = getIntersectionInfo(allIntersections);

          if (!intersections) return;

          const isFirstAndLastIntersectionEqual =
            intersections.partial.first.intersection === intersections.partial.last.intersection;
          const scrollableRect = scrollElement.getBoundingClientRect();

          if (this.scrollOrigin() === 'center' && intersections.full.hasMultiple) {
            // If there is more than one fully visible element we should not snap at all.
            return;
          } else if (this.scrollOrigin() === 'center' && intersections.full.first.intersection) {
            // If there is already a fully visible element we should snap it to the center.
            this.scrollToElement({
              element: intersections.full.first.intersection.target as HTMLElement,
              origin: 'center',
            });
            return;
          } else if (isFirstAndLastIntersectionEqual) {
            const intersection = intersections.partial.first.intersection.target.getBoundingClientRect();
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
                element: intersections.partial.first.intersection.target as HTMLElement,
                origin: 'start',
              });
              return;
            }

            // If the end of the element is visible we should snap to the end.
            if (isEndOfElementVisible) {
              this.scrollToElement({
                element: intersections.partial.last.intersection.target as HTMLElement,
                origin: 'end',
              });
              return;
            }
          } else if (
            (this.direction() === 'horizontal' &&
              intersections.partial.biggest.intersection.boundingClientRect.width > scrollableRect.width) ||
            (this.direction() === 'vertical' &&
              intersections.partial.biggest.intersection.boundingClientRect.height > scrollableRect.height)
          ) {
            // If the current element is bigger than the scrollable container we should snap to the start of the current element if the scroll direction is forward
            // and to the end of the current element if the scroll direction is backwards.
            const origin = intersections.partial.biggest.index === intersections.partial.first.index ? 'end' : 'start';

            this.scrollToElement({
              element: intersections.partial.biggest.intersection.target as HTMLElement,
              origin,
              ignoreForcedOrigin: true,
            });
          } else {
            // No special case. Just snap to the biggest intersection.
            this.scrollToElement({
              element: intersections.partial.biggest.intersection.target as HTMLElement,
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
