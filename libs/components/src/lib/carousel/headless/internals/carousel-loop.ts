import { Signal, effect, untracked } from '@angular/core';
import { ScrollableDirective } from '../../../scrollable';
import { CarouselSlideAlign } from '../carousel.directive';

export type CarouselLoopConfig = {
  scrollable: Signal<ScrollableDirective | null | undefined>;
  cloneCount: Signal<number>;
  count: Signal<number>;
  domCount: Signal<number>;
  slideAlign: Signal<CarouselSlideAlign>;
  activeIndex: Signal<number>;
};

type LoopGeometry = {
  scrollable: ScrollableDirective;
  container: HTMLElement;
  horizontal: boolean;
  rtl: boolean;
  children: HTMLElement[];
  trackLength: number;
  restingOffsetOf: (child: HTMLElement) => number;
};

const offsetOf = (element: HTMLElement, horizontal: boolean) => (horizontal ? element.offsetLeft : element.offsetTop);

const sizeOf = (element: HTMLElement, horizontal: boolean) => (horizontal ? element.offsetWidth : element.offsetHeight);

/**
 * The child nearest the current scroll offset. Nearest, not a threshold: snapping against scaled painted boxes
 * leaves the track a few pixels off its computed offset, and any threshold either fires on that or misses the seam.
 */
const restingChildIndex = ({ container, children, horizontal, restingOffsetOf }: LoopGeometry) => {
  const scroll = horizontal ? container.scrollLeft : container.scrollTop;

  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const [index, child] of children.entries()) {
    const distance = Math.abs(restingOffsetOf(child) - scroll);

    if (distance >= nearestDistance) continue;

    nearestDistance = distance;
    nearest = index;
  }

  return { nearest, nearestDistance, scroll };
};

/** Through the scrollable, because `scroll-snap-type: mandatory` silently overrules a programmatic offset. */
const scrollTo = ({ scrollable, horizontal }: Pick<LoopGeometry, 'scrollable' | 'horizontal'>, offset: number) =>
  scrollable.scrollToOffsetUnsnapped(horizontal ? { left: offset } : { top: offset });

/**
 * Keeps a looping carousel's scroll offset inside the real slides by shifting it a whole track's length once
 * scrolling has settled in the clones. Offsets are layout offsets, not rects, because a transition may scale
 * the slides.
 *
 * @internal
 */
export const useCarouselLoop = (config: CarouselLoopConfig) => {
  // The real slide to land on after the clones are (re)rendered. Tracked rather than read on the spot,
  // because by then the DOM has already changed under the old index.
  let lastRealIndex = 0;

  let alignedShape: string | null = null;

  const readGeometry = (): LoopGeometry | null => {
    const scrollable = config.scrollable();
    const scrollContainer = scrollable?.scrollContainerRef()?.nativeElement;
    const cloneCount = config.cloneCount();
    const count = config.count();

    if (!scrollable || !scrollContainer || !count) return null;

    const children = scrollable.scrollableChildren();

    // Mid-render the children signal can disagree with the counts; measuring then would be nonsense.
    if (children.length !== count + cloneCount * 2) return null;

    const horizontal = scrollable.direction() !== 'vertical';
    const rtl = horizontal && getComputedStyle(scrollContainer).direction === 'rtl';

    const viewport = horizontal ? scrollContainer.clientWidth : scrollContainer.clientHeight;
    const centred = config.slideAlign() === 'center';
    const restingOffsetOf = (child: HTMLElement) => {
      const offset = offsetOf(child, horizontal);
      const slack = viewport - sizeOf(child, horizontal);

      if (centred) return offset - slack / 2;

      return rtl ? offset - slack : offset;
    };

    const firstReal = children[cloneCount];
    const firstTrailing = children[cloneCount + count];
    const trackLength =
      cloneCount && firstReal && firstTrailing
        ? offsetOf(firstTrailing, horizontal) - offsetOf(firstReal, horizontal)
        : 0;

    return {
      scrollable,
      container: scrollContainer,
      horizontal,
      children,
      rtl,
      trackLength,
      restingOffsetOf,
    };
  };

  const readSettled = () => {
    const geometry = readGeometry();

    if (!geometry) return null;

    const { nearest: resting, nearestDistance, scroll } = restingChildIndex(geometry);
    const { container, children, horizontal, rtl, restingOffsetOf } = geometry;
    const scrollRange = Math.max(
      horizontal ? container.scrollWidth - container.clientWidth : container.scrollHeight - container.clientHeight,
      0,
    );
    const [minScroll, maxScroll] = rtl ? [-scrollRange, 0] : [0, scrollRange];

    return {
      resting,

      restsOn: (domIndex: number) => {
        const child = children[domIndex];

        if (domIndex === resting) return true;
        if (!child) return false;

        const reachable = Math.min(Math.max(restingOffsetOf(child), minScroll), maxScroll);

        return Math.abs(reachable - scroll) <= nearestDistance + 1;
      },

      /**
       * Shift the scroll offset a whole track's length if it has come to rest in the clones - the one way to
       * cross the seam on a native scroller without showing it. Never call it mid-scroll.
       */
      crossSeam: () => {
        const { container: scrollContainer, horizontal, trackLength } = geometry;
        const cloneCount = config.cloneCount();
        const scroll = horizontal ? scrollContainer.scrollLeft : scrollContainer.scrollTop;

        if (!trackLength) return false;

        if (resting < cloneCount) {
          scrollTo(geometry, scroll + trackLength);

          return true;
        }

        if (resting >= cloneCount + config.count()) {
          scrollTo(geometry, scroll - trackLength);

          return true;
        }

        return false;
      },
    };
  };

  effect(() => {
    const activeIndex = config.activeIndex();

    if (activeIndex >= 0) lastRealIndex = activeIndex;
  });

  effect(() => {
    const cloneCount = config.cloneCount();
    const count = config.count();
    const domCount = config.domCount();

    // Tracked so the alignment is retried once the carousel has layout: inside a hidden tab panel or a
    // collapsed accordion every offset reads as 0, and the container's size is the only thing here that
    // changes when that ends - `domCount` is a length, so re-rendering the same children notifies nothing.
    config.scrollable()?.scrollableDimensions();

    if (!cloneCount || !count) {
      alignedShape = null;

      return;
    }

    if (domCount !== count + cloneCount * 2) return;

    const shape = `${cloneCount}:${count}:${config.slideAlign()}`;

    if (alignedShape === shape) return;

    untracked(() => {
      const geometry = readGeometry();
      const target = geometry?.children[cloneCount + Math.min(lastRealIndex, count - 1)];

      if (!geometry || !geometry.trackLength || !target) return;

      scrollTo(geometry, geometry.restingOffsetOf(target));

      // Latched only on success: a failed measurement must not consume the one-shot alignment, or the track
      // stays parked on a clone for as long as the carousel lives.
      alignedShape = shape;
    });
  });

  return { readSettled };
};
