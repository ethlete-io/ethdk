import {
  Directive,
  ElementRef,
  Signal,
  TemplateRef,
  afterNextRender,
  booleanAttribute,
  computed,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import {
  RuntimeError,
  ScrollObserverDirective,
  injectHostElement,
  ScrollToElementOptions,
  getElementScrollCoordinates,
  getScrollContainerTarget,
  getScrollItemTarget,
  provideBreakpointInstance,
  signalElementChildren,
  signalElementDimensions,
  signalElementIntersection,
  signalElementScrollState,
  signalHostAttributes,
  signalHostClasses,
  signalHostStyles,
  typedBreakpointTransform,
  mountEasingTokens,
} from '@ethlete/core';
import { ResolvedScrollableChrome, ScrollableChrome } from './scrollable-chrome';
import { SCROLLABLE_ERROR_CODES } from './scrollable-errors';
import {
  ScrollableDirection,
  ScrollableItemSize,
  ScrollableScrollMode,
  ScrollableScrollOrigin,
} from './scrollable.types';

const SCROLLABLE_IGNORE_CHILD_ATTRIBUTE = 'etScrollableIgnoreChild';

const isScrollableChildIgnored = (el: HTMLElement) => {
  const attr = el.attributes.getNamedItem(SCROLLABLE_IGNORE_CHILD_ATTRIBUTE)?.value;
  return attr === 'true' || attr === '';
};

const ELEMENT_INTERSECTION_THRESHOLD = [
  .../* @__PURE__ */ Array.from({ length: 21 }, (_, i) => i * 0.05),
  0.01,
  0.005,
  0.001,
  0.99,
  0.995,
  0.999,
];

@Directive({
  selector: '[etScrollable]',
  exportAs: 'etScrollable',
  providers: [provideBreakpointInstance(ScrollableDirective)],
  host: {
    class: 'et-scrollable',
  },
})
export class ScrollableDirective {
  private hostElement = injectHostElement();

  public itemSize = input('auto', { transform: typedBreakpointTransform<ScrollableItemSize>('auto') });
  public direction = input('horizontal', {
    transform: typedBreakpointTransform<ScrollableDirection>('horizontal'),
  });
  public scrollMode = input('container', {
    transform: typedBreakpointTransform<ScrollableScrollMode>('container'),
  });
  public scrollOrigin = input<ScrollableScrollOrigin>('auto');
  public scrollMargin = input(0, { transform: numberAttribute });
  public renderScrollbars = input(false, { transform: booleanAttribute });

  /** @internal */
  public scrollContainerRef = signal<ElementRef<HTMLElement> | null>(null);

  private childIntersectionsActivated = signal(false);

  // Left broad, every inline style written anywhere inside the track re-runs it - and a carousel's JS
  // transition driver writes one per slide per animation frame, so a scroll cost a change detection tick a
  // frame for nothing.
  private allScrollableChildren = signalElementChildren(this.scrollContainerRef, {
    mutations: { childList: true, subtree: true, attributeFilter: [SCROLLABLE_IGNORE_CHILD_ATTRIBUTE] },
  });

  public scrollableChildren = computed(() => this.allScrollableChildren().filter((c) => !isScrollableChildIgnored(c)));

  private activeChildren = signal<ScrollableActiveChildRef[]>([]);

  private initialActiveChildScrollPosition = computed(() => {
    const firstActive = this.activeChildren().find((child) => child.isActiveChildEnabled());

    if (!firstActive) return null;

    const position = this.getElementScrollCoordinates({ element: firstActive.elementRef.nativeElement });

    // `signalElementScrollState` stops watching once it gets a position, and the coordinates come back
    // offsetless while the track cannot scroll yet - handing those over would spend the one shot on nothing.
    return position.left === undefined && position.top === undefined ? null : position;
  });

  /** @internal */
  public scrollObserverRef = signal<ScrollObserverDirective | null>(null);

  // `class` and `hidden` are the attributes that plausibly resize something; `style` is left out deliberately:
  // it is the one written per animation frame (a carousel's JS transition driver, any inline-style animation)
  // and every such write re-measured `scrollWidth`, which is a forced layout, and ran a change detection tick
  // with it.
  public containerScrollState = signalElementScrollState(this.scrollContainerRef, {
    mutations: { childList: true, subtree: true, attributeFilter: ['class', 'hidden'] },
    initialScrollPosition: this.initialActiveChildScrollPosition,
  });

  public isAtStart = computed(() => this.scrollObserverRef()?.isAtStart() ?? false);
  public isAtEnd = computed(() => this.scrollObserverRef()?.isAtEnd() ?? false);

  public canScroll = computed(() =>
    this.direction() === 'horizontal'
      ? this.containerScrollState().canScrollHorizontally
      : this.containerScrollState().canScrollVertically,
  );

  public childIntersections = signalElementIntersection(this.scrollableChildren, {
    root: this.scrollContainerRef,
    threshold: ELEMENT_INTERSECTION_THRESHOLD,
    enabled: this.childIntersectionsActivated,
  });

  public scrollableDimensions = signalElementDimensions(this.scrollContainerRef);

  /** @internal */
  public loadingTemplateRef = signal<ScrollableLoadingTemplateRef | null>(null);

  public loadingTemplate = this.loadingTemplateRef.asReadonly();

  /** @internal */
  public masksDirective = signal<unknown | null>(null);
  /** @internal */
  public snapDirective = signal<unknown | null>(null);
  /**
   * @internal Where a snapped child comes to rest, or `null` when nothing is snapping. Set by
   * `etScrollableSnap`.
   */
  public activeSnapOrigin = signal<ScrollableScrollOrigin | null>(null);

  /** @internal Whether a cursor drag is moving the track right now. Set by `etScrollableDrag`. */
  public isCursorDragging = signal(false);

  private snapSuspensions = signal(0);

  /** @internal */
  public isSnapSuspended = computed(() => this.snapSuspensions() > 0);

  private registeredChrome = signal<readonly ScrollableChrome[]>([]);

  /** @internal */
  public activeChrome = computed<readonly ResolvedScrollableChrome[]>(() =>
    this.registeredChrome()
      .filter((chrome) => chrome.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((chrome) => ({
        key: chrome.key,
        slot: typeof chrome.slot === 'function' ? chrome.slot() : chrome.slot,
        component: chrome.component,
        inputs: chrome.inputs?.() ?? {},
        injector: chrome.injector,
      })),
  );

  /** @internal */
  public hostAttributeBindings = signalHostAttributes({
    'item-size': this.itemSize,
    direction: this.direction,
    'render-scrollbars': this.renderScrollbars,
    snap: computed(() => (this.activeSnapOrigin() === null ? null : '')),
    'snap-origin': this.activeSnapOrigin,
    'snap-suspended': computed(() => (this.isSnapSuspended() ? '' : null)),
  });

  /** @internal */
  public hostClassBindings = signalHostClasses({
    'et-scrollable--can-scroll': this.canScroll,
    'et-scrollable--is-at-start': this.isAtStart,
    'et-scrollable--is-at-end': this.isAtEnd,
    'et-scrollable--has-partial-items': computed(
      () =>
        !!this.masksDirective() &&
        this.childIntersections().some((i) => i.intersectionRatio > 0 && i.intersectionRatio < 1),
    ),
  });

  public gapValue = computed(() => {
    this.scrollableDimensions();

    const scrollable = this.scrollContainerRef()?.nativeElement;
    if (!scrollable) return null;

    const computedStyle = getComputedStyle(scrollable);
    const gap = computedStyle.gap;

    if (gap === 'normal') return '0px';

    return gap;
  });

  /** @internal */
  public hostStyleBindings = signalHostStyles({
    '--item-count': computed(() => this.scrollableChildren().length),
    '--item-gap': this.gapValue,
    // `scrollMargin` has to reach the CSS snap positions too, or a snapped child would come to rest
    // somewhere a programmatic `scrollToElement` would not put it.
    '--_et-scrollable-scroll-margin': computed(() => `${this.scrollMargin()}px`),
  });

  constructor() {
    mountEasingTokens();
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.scrollContainerRef()) {
          throw new RuntimeError(
            SCROLLABLE_ERROR_CODES.MISSING_SCROLL_CONTAINER,
            '[ScrollableDirective] No scroll container registered. ' +
              'Use the default <et-scrollable> component; headless [etScrollable] does not provide a scroll container.',
            { element: this.hostElement },
          );
        }
      });
    }
  }

  /**
   * Contribute a component to the scrollable's own DOM. Call once, from an opt-in feature's constructor -
   * see {@link ScrollableChrome}.
   */
  public registerChrome(chrome: ScrollableChrome) {
    this.registeredChrome.update((entries) => [...entries, chrome]);
  }

  /**
   * Register a child as the one to open the track on. Registration order is DOM order, and the first
   * registered child whose `isActiveChildEnabled` reads `true` wins.
   *
   * @internal
   */
  public registerActiveChild(child: ScrollableActiveChildRef) {
    this.activeChildren.update((children) => [...children, child]);
  }

  /** @internal */
  public unregisterActiveChild(child: ScrollableActiveChildRef) {
    this.activeChildren.update((children) => children.filter((c) => c !== child));
  }

  public activateChildIntersections() {
    this.childIntersectionsActivated.set(true);
  }

  /**
   * Hold CSS snap off until the returned function is called.
   *
   * `scroll-snap-type: mandatory` does not merely influence where a scroll comes to rest - it overrules a
   * programmatic offset outright, and silently. Any code that means a specific offset therefore has to take
   * snapping off the table while it writes one.
   *
   * Ref-counted: two of them can overlap, and whichever finishes first must not hand snapping back to the
   * other.
   *
   * @internal
   */
  public suspendSnap() {
    this.snapSuspensions.update((count) => count + 1);

    let hasReleased = false;

    return () => {
      if (hasReleased) return;

      hasReleased = true;
      this.snapSuspensions.update((count) => Math.max(0, count - 1));
    };
  }

  /**
   * Write a scroll offset that CSS snap cannot overrule - see {@link suspendSnap}.
   *
   * @internal
   */
  public scrollToOffsetUnsnapped(options: ScrollToOptions) {
    const scrollElement = this.scrollContainerRef()?.nativeElement;

    if (!scrollElement) return;

    const release = this.suspendSnap();

    scrollElement.scroll({ ...options, behavior: 'instant' });

    requestAnimationFrame(release);
  }

  public scrollOneContainerSize(scrollDirection: 'start' | 'end') {
    const scrollElement = this.scrollContainerRef()?.nativeElement;
    if (!scrollElement) return;

    const snap = this.snapDirective();

    if (snap) {
      const target = getScrollContainerTarget(this.childIntersections(), scrollDirection);
      if (target) this.scrollToElement(target);
    } else {
      const dimensions = this.scrollableDimensions().client;
      const scrollableSize = this.direction() === 'horizontal' ? (dimensions?.width ?? 0) : (dimensions?.height ?? 0);
      const currentScroll = this.direction() === 'horizontal' ? scrollElement.scrollLeft : scrollElement.scrollTop;

      scrollElement.scrollTo({
        [this.direction() === 'horizontal' ? 'left' : 'top']:
          currentScroll + (scrollDirection === 'start' ? -scrollableSize : scrollableSize),
        behavior: 'smooth',
      });
    }
  }

  public scrollOneItemSize(scrollDirection: 'start' | 'end') {
    const allIntersections = this.childIntersections();
    const scrollElement = this.scrollContainerRef()?.nativeElement;

    if (!allIntersections.length || !scrollElement) return;

    const target = getScrollItemTarget(
      allIntersections,
      scrollElement,
      scrollDirection,
      this.scrollOrigin(),
      this.direction(),
    );

    if (!target) return;

    this.scrollToElement(target);
  }

  public getElementScrollCoordinates(
    options: Omit<ScrollToElementOptions, 'container'> & { ignoreForcedOrigin?: boolean },
  ) {
    const scrollElement = this.scrollContainerRef()?.nativeElement;
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

  public scrollToElement(options: Omit<ScrollToElementOptions, 'container'> & { ignoreForcedOrigin?: boolean }) {
    this.scrollContainerRef()?.nativeElement.scroll(this.getElementScrollCoordinates(options));
  }

  public scrollToElementByIndex(
    options: Omit<ScrollToElementOptions, 'container'> & { index: number; ignoreForcedOrigin?: boolean },
  ) {
    const elements = this.scrollableChildren();
    const element = elements[options.index];
    if (!element) return;

    this.scrollToElement({ element, ...options });
  }

  public scrollToStartDirection() {
    if (this.scrollMode() === 'container') {
      this.scrollOneContainerSize('start');
    } else {
      this.scrollOneItemSize('start');
    }
  }

  public scrollToEndDirection() {
    if (this.scrollMode() === 'container') {
      this.scrollOneContainerSize('end');
    } else {
      this.scrollOneItemSize('end');
    }
  }

  public getActiveChildren() {
    return this.activeChildren.asReadonly();
  }

  public getScrollContainerRef() {
    return this.scrollContainerRef.asReadonly();
  }
}

export type ScrollableActiveChildRef = {
  elementRef: ElementRef<HTMLElement>;
  isActiveChildEnabled: Signal<boolean>;
};

export type ScrollableLoadingTemplateRef = {
  templateRef: TemplateRef<unknown>;
  repeat: Signal<unknown[]>;
};
