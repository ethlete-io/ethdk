import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  contentChild,
  contentChildren,
  inject,
  input,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  NgClassType,
  ScrollObserverDirective,
  ScrollObserverEndDirective,
  ScrollObserverStartDirective,
  ScrollToElementOptions,
  boolBreakpointTransform,
  createCanAnimateSignal,
  getElementScrollCoordinates,
  getScrollContainerTarget,
  getScrollItemTarget,
  getScrollSnapTarget,
  numberBreakpointTransform,
  provideBreakpointInstance,
  signalClasses,
  signalElementChildren,
  signalElementDimensions,
  signalElementIntersection,
  signalElementScrollState,
  signalHostAttributes,
  signalHostClasses,
  signalHostStyles,
  signalStyles,
  typedBreakpointTransform,
  useCursorDragScroll,
} from '@ethlete/core';
import { EMPTY, combineLatest, debounceTime, filter, fromEvent, map, switchMap, tap } from 'rxjs';
import { CHEVRON_ICON } from '../../../icons/chevron-icon';
import { provideIcons } from '../../../icons/icon-provider';
import { IconDirective } from '../../../icons/icon.directive';
import { ScrollableIgnoreChildDirective, isScrollableChildIgnored } from '../../directives/scrollable-ignore-child';
import { SCROLLABLE_IS_ACTIVE_CHILD_TOKEN } from '../../directives/scrollable-is-active-child';
import { SCROLLABLE_LOADING_TEMPLATE_TOKEN } from '../../directives/scrollable-loading-template';
import { ScrollableIntersectionChange, ScrollableScrollMode } from '../../types';

export type ScrollObserverScrollState = {
  isAtStart: boolean;
  isAtEnd: boolean;
  canScroll: boolean;
};

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

type ScrollableNavigationItem = {
  isActive: boolean;
  activeOffset: number;
  element: HTMLElement;
};

type ScrollableNavigation = {
  items: ScrollableNavigationItem[];
  activeIndex: number;
};

export type ScrollableButtonPosition = 'inside' | 'footer';
export type ScrollableScrollOrigin = 'auto' | 'center' | 'start' | 'end';
export type ScrollableDirection = 'horizontal' | 'vertical';
export type ScrollableItemSize = 'auto' | 'same' | 'half' | 'third' | 'quarter' | 'full';
export type ScrollableLoadingTemplatePosition = 'start' | 'end';

@Component({
  selector: 'et-scrollable',
  templateUrl: './scrollable.component.html',
  styleUrls: ['./scrollable.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass,
    ScrollableIgnoreChildDirective,
    NgTemplateOutlet,
    IconDirective,
    ScrollObserverDirective,
    ScrollObserverStartDirective,
    ScrollObserverEndDirective,
  ],
  host: {
    class: 'et-scrollable',
  },
  providers: [provideIcons(CHEVRON_ICON), provideBreakpointInstance(ScrollableComponent)],
})
export class ScrollableComponent {
  private manualActiveNavigationIndex = signal<number | null>(null);

  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  itemSize = input('auto', { transform: typedBreakpointTransform<ScrollableItemSize>() });
  direction = input('horizontal', { transform: typedBreakpointTransform<ScrollableDirection>() });
  scrollableRole = input<string | null>(null);
  scrollableClass = input<NgClassType | null>(null);
  renderNavigation = input(false, { transform: boolBreakpointTransform() });
  renderMasks = input(true, { transform: boolBreakpointTransform() });
  renderButtons = input(true, { transform: boolBreakpointTransform() });
  buttonPosition = input('inside', { transform: typedBreakpointTransform<ScrollableButtonPosition>() });
  renderScrollbars = input(false, { transform: boolBreakpointTransform() });
  stickyButtons = input(false, { transform: boolBreakpointTransform() });
  cursorDragScroll = input(true, { transform: boolBreakpointTransform() });
  disableActiveElementScrolling = input(false, { transform: boolBreakpointTransform() });
  scrollMode = input('container', { transform: typedBreakpointTransform<ScrollableScrollMode>() });
  snap = input(false, { transform: boolBreakpointTransform() });
  scrollMargin = input(0, { transform: numberBreakpointTransform() });
  scrollOrigin = input('auto', { transform: typedBreakpointTransform<ScrollableScrollOrigin>() });
  darkenNonIntersectingItems = input(false, { transform: boolBreakpointTransform() });
  showLoadingTemplate = input(false, { transform: boolBreakpointTransform() });
  loadingTemplatePosition = input('end', { transform: typedBreakpointTransform<ScrollableLoadingTemplatePosition>() });

  scrollable = viewChild<ElementRef<HTMLElement>>('scrollable');
  scrollObserver = viewChild.required(ScrollObserverDirective);
  activeElementList = contentChildren(SCROLLABLE_IS_ACTIVE_CHILD_TOKEN, { descendants: true });
  navigationDotsContainer = viewChild<ElementRef<HTMLElement>>('navigationDotsContainer');
  firstNavigationDot = viewChild<ElementRef<HTMLButtonElement>>('navigationDot');

  loadingTemplate = contentChild(SCROLLABLE_LOADING_TEMPLATE_TOKEN);

  scrollableDimensions = signalElementDimensions(this.scrollable);

  navigationDotDimensions = signalElementDimensions(this.firstNavigationDot);

  canAnimate = createCanAnimateSignal();

  cursorDragScrollState = useCursorDragScroll(this.scrollable, {
    enabled: this.cursorDragScroll,
    allowedDirection: this.direction,
  });

  renderButtonsInside = computed(() => this.buttonPosition() === 'inside' && this.renderButtons());
  renderButtonsInFooter = computed(() => this.buttonPosition() === 'footer' && this.renderButtons());

  containerScrollState = signalElementScrollState(this.scrollable, {
    initialScrollPosition: computed(() => {
      const scrollable = this.scrollable()?.nativeElement;
      const activeElementList = this.activeElementList();

      if (!scrollable || !activeElementList.length) return null;

      const firstActive = activeElementList.find((a) => a.isActiveChildEnabled());

      if (firstActive && !this.disableActiveElementScrolling()) {
        return this.getElementScrollCoordinates({ element: firstActive.elementRef.nativeElement });
      }

      return null;
    }),
  });
  allScrollableChildren = signalElementChildren(this.scrollable);
  scrollableChildren = computed(() => this.allScrollableChildren().filter((c) => !isScrollableChildIgnored(c)));

  scrollableContentIntersections = signalElementIntersection(this.scrollableChildren, {
    root: this.scrollable,
    threshold: ELEMENT_INTERSECTION_THRESHOLD,
  });

  scrollableContentIntersections$ = toObservable(this.scrollableContentIntersections);

  maxVisibleItemCount = toSignal(
    this.scrollableContentIntersections$.pipe(
      takeUntilDestroyed(),
      debounceTime(150),
      map((entries) => entries.filter((i) => i.intersectionRatio > 0).length),
    ),
    { initialValue: 0 },
  );

  nonScrollableIntersections = computed(
    () => {
      const allIntersections = this.scrollableContentIntersections();
      return allIntersections.filter((i) => i.intersectionRatio !== 1).map((i) => i.target as HTMLElement);
    },
    { equal: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]) },
  );

  isAtStart = computed(() => this.scrollObserver().isAtStart());
  isAtEnd = computed(() => this.scrollObserver().isAtEnd());

  canScroll = computed(() =>
    this.direction() === 'horizontal'
      ? this.containerScrollState().canScrollHorizontally
      : this.containerScrollState().canScrollVertically,
  );

  scrollableNavigation = computed<ScrollableNavigation>(
    () => {
      const allIntersections = this.scrollableContentIntersections();
      const manualActiveNavigationIndex = this.manualActiveNavigationIndex();
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
        return { items: [], activeIndex: -1 };
      }

      const activeIndex =
        manualActiveNavigationIndex !== null
          ? manualActiveNavigationIndex
          : allIntersections.findIndex((i) => i === highestIntersection);

      const items = allIntersections.map((i, index) => ({
        isActive:
          manualActiveNavigationIndex !== null
            ? manualActiveNavigationIndex === index
            : i === highestIntersection && highestIntersection.intersectionRatio > 0,
        activeOffset: index === activeIndex ? 0 : Math.abs(index - activeIndex),
        element: i.target as HTMLElement,
      }));

      return { items, activeIndex };
    },
    {
      equal: (a, b) =>
        a.activeIndex === b.activeIndex &&
        a.items.length === b.items.length &&
        a.items.every((v, i) => v.isActive === b.items[i]?.isActive && v.activeOffset === b.items[i]?.activeOffset),
    },
  );

  activeIndex = computed(() => this.scrollableNavigation().activeIndex);

  gapValue = computed(() => {
    this.scrollableDimensions();

    const scrollable = this.scrollable()?.nativeElement;
    if (!scrollable) return null;

    const computedStyle = getComputedStyle(scrollable);

    const gap = computedStyle.gap;

    // This will return normal if gap is not set.
    if (gap === 'normal') return '0px';

    return gap;
  });

  intersectionChange = outputFromObservable<ScrollableIntersectionChange[]>(
    toObservable(this.scrollableContentIntersections).pipe(
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
      computed(() => ({
        canScroll: this.canScroll(),
        isAtEnd: this.isAtEnd(),
        isAtStart: this.isAtStart(),
      })),
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
    'et-scrollable--has-partial-items': computed(() =>
      this.scrollableContentIntersections().some((i) => i.intersectionRatio > 0 && i.intersectionRatio < 1),
    ),
    'et-scrollable--darken-non-intersecting-items': computed(
      () => this.darkenNonIntersectingItems() && this.maxVisibleItemCount() > 1,
    ),
  });

  hostStyleBindings = signalHostStyles({
    '--item-count': computed(() => this.scrollableChildren().length),
    '--item-gap': this.gapValue,
  });

  scrollableDotsContainerStyleBindings = signalStyles(this.navigationDotsContainer, {
    // Responsible for centering the active dot in navigation bar by using 'translate'
    transform: computed(() => {
      const activeIndex = this.scrollableNavigation().activeIndex;
      const childCount = this.scrollableNavigation().items.length;
      const offset = this.getNavigationDotsContainerTranslate(childCount, activeIndex);
      const dir = this.direction() === 'horizontal' ? 'X' : 'Y';

      return `translate${dir}(${offset})`;
    }),
  });

  constructor() {
    const isDragging$ = toObservable(this.cursorDragScrollState.isDragging);
    const scrollable$ = toObservable(this.scrollable);

    toObservable(this.snap)
      .pipe(
        takeUntilDestroyed(),
        switchMap((enabled) => {
          if (!enabled) return EMPTY;

          return combineLatest([this.scrollableContentIntersections$, isDragging$]).pipe(
            filter(([, isDragging]) => !isDragging),
            map(([intersections]) => intersections),
            debounceTime(150),
            tap((allIntersections) => {
              const scrollElement = this.scrollable()?.nativeElement;

              if (!scrollElement) return;

              const visibleItems = allIntersections
                .filter((i) => i.intersectionRatio > 0)
                .map((i) => i.target as HTMLElement);

              const target = getScrollSnapTarget(
                visibleItems,
                scrollElement,
                this.direction(),
                this.scrollOrigin(),
                this.scrollMargin(),
              );

              if (target) {
                this.scrollToElement({ element: target.element, origin: target.origin, ignoreForcedOrigin: true });
              }
            }),
          );
        }),
      )
      .subscribe();

    toObservable(this.manualActiveNavigationIndex)
      .pipe(
        takeUntilDestroyed(),
        filter((i) => i !== null),
        switchMap(() =>
          scrollable$.pipe(
            switchMap((ref) => {
              if (!ref) return EMPTY;
              return fromEvent(ref.nativeElement, 'scroll');
            }),
          ),
        ),
        debounceTime(50),
        tap(() => this.manualActiveNavigationIndex.set(null)),
      )
      .subscribe();
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

    const isSnappingEnabled = this.snap();

    if (isSnappingEnabled) {
      const target = getScrollContainerTarget(this.scrollableContentIntersections(), direction);
      if (target) this.scrollToElement(target);
    } else {
      // Just scroll one size of the scrollable container.
      const dimensions = this.scrollableDimensions().client;
      const scrollableSize = this.direction() === 'horizontal' ? (dimensions?.width ?? 0) : (dimensions?.height ?? 0);
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

    if (!scrollElement) return;

    const target = getScrollItemTarget(
      allIntersections,
      scrollElement,
      direction,
      this.scrollOrigin(),
      this.direction(),
    );

    if (!target) return;

    this.scrollToElement(target);
    this.manualActiveNavigationIndex.set(target.index);
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
    this.manualActiveNavigationIndex.set(elementIndex);

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
}
