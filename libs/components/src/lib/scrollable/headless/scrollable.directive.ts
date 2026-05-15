import {
  Directive,
  ElementRef,
  Signal,
  TemplateRef,
  afterNextRender,
  computed,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import {
  RuntimeError,
  ScrollObserverDirective,
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
} from '@ethlete/core';
import { ScrollableErrorCode } from './scrollable-errors';
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

// Thresholds for the intersection observer.
const ELEMENT_INTERSECTION_THRESHOLD = [
  ...Array.from({ length: 21 }, (_, i) => i * 0.05),
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
  // --- Inputs ---

  itemSize = input('auto', { transform: typedBreakpointTransform<ScrollableItemSize>() });
  direction = input('horizontal', {
    transform: typedBreakpointTransform<ScrollableDirection>(),
  });
  scrollMode = input('container', {
    transform: typedBreakpointTransform<ScrollableScrollMode>(),
  });
  scrollOrigin = input<ScrollableScrollOrigin>('auto');
  scrollMargin = input(0, { transform: numberAttribute });
  renderScrollbars = input(false);

  // --- Internal template refs (set by Tier 3 template) ---

  /** @internal */
  scrollContainerRef = signal<ElementRef<HTMLElement> | null>(null);

  // --- Lazy intersection ---

  private childIntersectionsActivated = signal(false);

  // --- Child tracking ---

  private allScrollableChildren = signalElementChildren(this.scrollContainerRef);

  scrollableChildren = computed(() => this.allScrollableChildren().filter((c) => !isScrollableChildIgnored(c)));

  // --- Scroll state ---

  /** @internal */
  scrollObserverRef = signal<ScrollObserverDirective | null>(null);

  containerScrollState = signalElementScrollState(this.scrollContainerRef);

  isAtStart = computed(() => this.scrollObserverRef()?.isAtStart() ?? false);
  isAtEnd = computed(() => this.scrollObserverRef()?.isAtEnd() ?? false);

  canScroll = computed(() =>
    this.direction() === 'horizontal'
      ? this.containerScrollState().canScrollHorizontally
      : this.containerScrollState().canScrollVertically,
  );

  // --- Lazy child intersections ---

  childIntersections = signalElementIntersection(this.scrollableChildren, {
    root: this.scrollContainerRef,
    threshold: ELEMENT_INTERSECTION_THRESHOLD,
    enabled: this.childIntersectionsActivated,
  });

  // --- Container dimensions (always available, cheap) ---

  scrollableDimensions = signalElementDimensions(this.scrollContainerRef);

  // --- Active children (self-registration) ---

  private activeChildren = signal<ScrollableActiveChildRef[]>([]);

  // --- Loading template (self-registration) ---

  /** @internal */
  loadingTemplateRef = signal<ScrollableLoadingTemplateRef | null>(null);

  loadingTemplate = this.loadingTemplateRef.asReadonly();

  // --- Sub-directive registrations ---

  /** @internal */
  masksDirective = signal<unknown | null>(null);
  /** @internal */
  buttonsDirective = signal<unknown | null>(null);
  /** @internal */
  navigationDirective = signal<unknown | null>(null);
  /** @internal */
  snapDirective = signal<unknown | null>(null);
  /** @internal */
  dragDirective = signal<unknown | null>(null);
  /** @internal */
  darkenDirective = signal<unknown | null>(null);

  // --- Host bindings ---

  /** @internal */
  hostAttributeBindings = signalHostAttributes({
    'item-size': this.itemSize,
    direction: this.direction,
    'render-scrollbars': this.renderScrollbars,
  });

  /** @internal */
  hostClassBindings = signalHostClasses({
    'et-scrollable--can-scroll': this.canScroll,
    'et-scrollable--is-at-start': this.isAtStart,
    'et-scrollable--is-at-end': this.isAtEnd,
    'et-scrollable--has-partial-items': computed(() =>
      this.childIntersections().some((i) => i.intersectionRatio > 0 && i.intersectionRatio < 1),
    ),
  });

  // --- Computed ---

  gapValue = computed(() => {
    this.scrollableDimensions();

    const scrollable = this.scrollContainerRef()?.nativeElement;
    if (!scrollable) return null;

    const computedStyle = getComputedStyle(scrollable);
    const gap = computedStyle.gap;

    if (gap === 'normal') return '0px';

    return gap;
  });

  /** @internal */
  hostStyleBindings = signalHostStyles({
    '--item-count': computed(() => this.scrollableChildren().length),
    '--item-gap': this.gapValue,
  });

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.scrollContainerRef()) {
          throw new RuntimeError(
            ScrollableErrorCode.MISSING_SCROLL_CONTAINER,
            '[ScrollableDirective] No scroll container registered. ' +
              'Use registerScrollContainer() from the Tier 3 template or provide a scroll container element.',
          );
        }
      });
    }
  }

  // --- Registration API ---

  /** @internal */
  unregisterActiveChild(child: ScrollableActiveChildRef) {
    this.activeChildren.update((children) => children.filter((c) => c !== child));
  }

  activateChildIntersections() {
    this.childIntersectionsActivated.set(true);
  }

  // --- Scroll methods ---

  scrollOneContainerSize(scrollDirection: 'start' | 'end') {
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

  scrollOneItemSize(scrollDirection: 'start' | 'end') {
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

  getElementScrollCoordinates(options: Omit<ScrollToElementOptions, 'container'> & { ignoreForcedOrigin?: boolean }) {
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

  scrollToElement(options: Omit<ScrollToElementOptions, 'container'> & { ignoreForcedOrigin?: boolean }) {
    this.scrollContainerRef()?.nativeElement.scroll(this.getElementScrollCoordinates(options));
  }

  scrollToElementByIndex(
    options: Omit<ScrollToElementOptions, 'container'> & { index: number; ignoreForcedOrigin?: boolean },
  ) {
    const elements = this.scrollableChildren();
    const element = elements[options.index];
    if (!element) return;

    this.scrollToElement({ element, ...options });
  }

  scrollToStartDirection() {
    if (this.scrollMode() === 'container') {
      this.scrollOneContainerSize('start');
    } else {
      this.scrollOneItemSize('start');
    }
  }

  scrollToEndDirection() {
    if (this.scrollMode() === 'container') {
      this.scrollOneContainerSize('end');
    } else {
      this.scrollOneItemSize('end');
    }
  }

  getActiveChildren() {
    return this.activeChildren.asReadonly();
  }

  getScrollContainerRef() {
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
