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
  container: HTMLElement;
  horizontal: boolean;
  /** The track's children, clones included, so a scroll offset can be read as a position among them. */
  children: HTMLElement[];
  /** The real slides' combined length, gaps included. */
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
 * track actually comes to rest at is not exactly the computed one — the scrollable re-snaps after any
 * programmatic scroll, and it measures with bounding rects, which a transition scaling the slides shifts by
 * a few pixels. A threshold tight enough to catch the seam would fire on that jitter and teleport a whole
 * track for nothing, and one loose enough to survive it would miss the seam. Nearest has no threshold to get
 * wrong: the children are a slide apart, so a few pixels either way cannot change the answer.
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

const scrollTo = (geometry: Pick<LoopGeometry, 'container' | 'horizontal'>, offset: number) =>
  geometry.container.scroll(
    geometry.horizontal ? { left: offset, behavior: 'instant' } : { top: offset, behavior: 'instant' },
  );

/**
 * Keeps a looping carousel's scroll offset inside the real slides by shifting it a whole track's length
 * whenever it drifts into the clones — the one way to cross the seam on a native scroller without showing
 * it. `teleport()` is called once the scrolling has settled (see `useCarouselScrollSettled`) — never during
 * it, or the jump would be visible.
 *
 * The measurements are layout offsets (`offsetLeft`/`offsetTop`) rather than bounding rects on purpose: a
 * transition may be scaling the slides, and a rect would then report the scaled box while the scroll
 * offsets stay in layout space. They are also *measured* rather than computed from `itemSize`, because
 * `itemSize="auto"` lets every slide be a different width — and the measurement is exact regardless,
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

    if (!scrollable || !scrollContainer || !cloneCount || !count) return null;

    const children = scrollable.scrollableChildren();

    // Mid-render the children signal can disagree with the counts; measuring then would be nonsense.
    if (children.length !== count + cloneCount * 2) return null;

    const firstReal = children[cloneCount];
    const firstTrailing = children[cloneCount + count];

    if (!firstReal || !firstTrailing) return null;

    const horizontal = scrollable.direction() !== 'vertical';
    const trackLength = offsetOf(firstTrailing, horizontal) - offsetOf(firstReal, horizontal);

    if (trackLength <= 0) return null;

    // Centred slides rest half a viewport earlier than start-aligned ones, and by a different amount per
    // slide when `itemSize="auto"` makes them different widths — so it is a function of the child, not a
    // constant.
    const viewport = horizontal ? scrollContainer.clientWidth : scrollContainer.clientHeight;
    const centred = config.slideAlign() === 'center';
    const restingOffsetOf = (child: HTMLElement) =>
      centred ? offsetOf(child, horizontal) - (viewport - sizeOf(child, horizontal)) / 2 : offsetOf(child, horizontal);

    return { container: scrollContainer, horizontal, children, trackLength, restingOffsetOf };
  };

  const teleport = () => {
    const geometry = readGeometry();

    if (!geometry) return;

    const { container: scrollContainer, horizontal, trackLength } = geometry;
    const cloneCount = config.cloneCount();
    const resting = restingChildIndex(geometry);
    const scroll = horizontal ? scrollContainer.scrollLeft : scrollContainer.scrollTop;

    // One shift is always enough: the clones on either side never span more than a full track, so adding or
    // subtracting one lands back inside the real run. And it lands on the *same picture*: the track repeats
    // every `count` slides, so a child and the clone a track away are the same slide at the same size.
    if (resting < cloneCount) {
      scrollTo(geometry, scroll + trackLength);
    } else if (resting >= cloneCount + config.count()) {
      scrollTo(geometry, scroll - trackLength);
    }
  };

  effect(() => {
    const activeIndex = config.activeIndex();

    if (activeIndex >= 0) lastRealIndex = activeIndex;
  });

  // A looping track starts scrolled to its first *clone*, which is not where slide 1 is — so the carousel
  // has to be put onto the real run before it is seen, and put back there whenever the clones are rebuilt
  // (a breakpoint change alters how many there are).
  effect(() => {
    const cloneCount = config.cloneCount();
    const count = config.count();
    const domCount = config.domCount();

    if (!cloneCount || !count) {
      alignedShape = null;

      return;
    }

    if (domCount !== count + cloneCount * 2) return;

    const shape = `${cloneCount}:${count}:${config.slideAlign()}`;

    if (alignedShape === shape) return;

    alignedShape = shape;

    untracked(() => {
      const geometry = readGeometry();
      const target = geometry?.children[cloneCount + Math.min(lastRealIndex, count - 1)];

      if (!geometry || !target) return;

      scrollTo(geometry, geometry.restingOffsetOf(target));
    });
  });

  /**
   * Which child the track is resting nearest right now, or `null` while the geometry can't be read. The
   * caller uses it to tell its own navigation apart from anything else that settles the scroll.
   */
  const restingDomIndex = () => {
    const geometry = readGeometry();

    return geometry ? restingChildIndex(geometry) : null;
  };

  return { teleport, restingDomIndex };
};
