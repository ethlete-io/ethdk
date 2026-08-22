import { Signal, effect, untracked } from '@angular/core';
import { ScrollableDirective } from '../../../scrollable';
import { CarouselSlideAlign } from '../carousel.directive';

export type CarouselLoopConfig = {
  scrollable: Signal<ScrollableDirective | null | undefined>;
  cloneCount: Signal<number>;
  count: Signal<number>;
  domCount: Signal<number>;
  /** Where a slide comes to rest, which is what a scroll offset has to be read against. */
  slideAlign: Signal<CarouselSlideAlign>;
  /** The current real slide, so re-cloning (a breakpoint change) lands back on it. */
  activeIndex: Signal<number>;
};

type LoopGeometry = {
  scrollable: ScrollableDirective;
  container: HTMLElement;
  horizontal: boolean;
  /** The track's children, clones included, so a scroll offset can be read as a position among them. */
  children: HTMLElement[];
  /** The real slides' combined length, gaps included - `0` when there are no clones, so no seam to cross. */
  trackLength: number;
  /** The scroll offset at which a child sits where `slideAlign` says it should. */
  restingOffsetOf: (child: HTMLElement) => number;
};

const offsetOf = (element: HTMLElement, horizontal: boolean) => (horizontal ? element.offsetLeft : element.offsetTop);

const sizeOf = (element: HTMLElement, horizontal: boolean) => (horizontal ? element.offsetWidth : element.offsetHeight);

/**
 * Which child the track is resting on: the one whose resting offset is nearest the current scroll offset.
 *
 * Deliberately "nearest" rather than a comparison against the first real slide's position. The offset the
 * track actually comes to rest at is not exactly the computed one - CSS scroll snap resolves against the
 * slides' *painted* boxes, which a transition scaling them shifts by a few pixels, and a fling can be left
 * fractions of a pixel out. A threshold tight enough to catch the seam would fire on that jitter and teleport
 * a whole track for nothing, and one loose enough to survive it would miss the seam. Nearest has no threshold
 * to get wrong: the children are a slide apart, so a few pixels either way cannot change the answer.
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

  return nearest;
};

/**
 * Move the scroll offset to exactly this number.
 *
 * Through the scrollable rather than the element, because the track snaps: `scroll-snap-type: mandatory` does
 * not merely bias where a scroll settles, it overrules a programmatic offset outright and silently. The
 * teleport's offset happens to *be* a snap position - the track repeats with a period of `count` slides, so a
 * slide and its clone are the same distance from their snap point - but "happens to be" is not a thing to
 * stake a seamless loop on. See `ScrollableDirective.suspendSnap`.
 */
const scrollTo = ({ scrollable, horizontal }: Pick<LoopGeometry, 'scrollable' | 'horizontal'>, offset: number) =>
  scrollable.scrollToOffsetUnsnapped(horizontal ? { left: offset } : { top: offset });

/**
 * Keeps a looping carousel's scroll offset inside the real slides by shifting it a whole track's length
 * whenever it drifts into the clones - the one way to cross the seam on a native scroller without showing
 * it. `readSettled().crossSeam()` is called once the scrolling has settled (see `useCarouselScrollSettled`)
 * - never during it, or the jump would be visible.
 *
 * The measurements are layout offsets (`offsetLeft`/`offsetTop`) rather than bounding rects on purpose: a
 * transition may be scaling the slides, and a rect would then report the scaled box while the scroll
 * offsets stay in layout space. They are also *measured* rather than computed from `itemSize`, because
 * `itemSize="auto"` lets every slide be a different width - and the measurement is exact regardless,
 * because the track repeats with a period of `count` slides, so the distance from a slide to its clone is
 * the same wherever it is taken.
 *
 * @internal
 */
export const useCarouselLoop = (config: CarouselLoopConfig) => {
  // The real slide to land on after the clones are (re)rendered. Tracked rather than read on the spot,
  // because by then the DOM has already changed under the old index.
  let lastRealIndex = 0;

  // Which `cloneCount:count` shape has been aligned, so the carousel is put onto a real slide once per
  // shape rather than every time the children signal fires.
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

    // Centred slides rest half a viewport earlier than start-aligned ones, and by a different amount per
    // slide when `itemSize="auto"` makes them different widths - so it is a function of the child, not a
    // constant.
    const viewport = horizontal ? scrollContainer.clientWidth : scrollContainer.clientHeight;
    const centred = config.slideAlign() === 'center';
    const restingOffsetOf = (child: HTMLElement) =>
      centred ? offsetOf(child, horizontal) - (viewport - sizeOf(child, horizontal)) / 2 : offsetOf(child, horizontal);

    // Without clones there is no seam to cross, but the resting child is still worth knowing - it is how the
    // carousel tells its own navigation's arrival apart from any other settling of the scroll.
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
      trackLength: trackLength > 0 ? trackLength : 0,
      restingOffsetOf,
    };
  };

  /**
   * The state of the track at rest, read in one pass.
   *
   * One pass matters because the caller needs two things from it - which child the track landed on, and then
   * whether to cross the seam - and every read of it is a forced layout plus an `offsetLeft` for every child,
   * clones included. Asking twice measured the same unchanged geometry twice, at the one moment in a gesture
   * where the main thread is least free: the frame the scrolling stops.
   */
  const readSettled = () => {
    const geometry = readGeometry();

    if (!geometry) return null;

    const resting = restingChildIndex(geometry);

    return {
      /** Which child of the track, clones included, the scroll offset is nearest. */
      resting,

      /**
       * Shift the scroll offset a whole track's length if it has come to rest in the clones - the one way to
       * cross the seam on a native scroller without showing it. Never call it mid-scroll.
       *
       * One shift is always enough: the clones on either side never span more than a full track, so adding or
       * subtracting one lands back inside the real run. And it lands on the *same picture*: the track repeats
       * every `count` slides, so a child and the clone a track away are the same slide at the same size.
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

  // A looping track starts scrolled to its first *clone*, which is not where slide 1 is - so the carousel
  // has to be put onto the real run before it is seen, and put back there whenever the clones are rebuilt
  // (a breakpoint change alters how many there are).
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

      // No measurable track length with clones present means the slides have no layout yet - every offset
      // reads as 0, so there is no resting place to put the carousel on.
      if (!geometry || !geometry.trackLength || !target) return;

      scrollTo(geometry, geometry.restingOffsetOf(target));

      // Latched only on success: a failed measurement must not consume the one-shot alignment, or the track
      // stays parked on a clone for as long as the carousel lives.
      alignedShape = shape;
    });
  });

  return { readSettled };
};
