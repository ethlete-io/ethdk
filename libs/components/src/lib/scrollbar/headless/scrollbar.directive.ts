import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  RuntimeError,
  applyHostListeners,
  clamp,
  dragGestureFrom,
  injectHostElement,
  injectRenderer,
  signalElementDimensions,
  signalElementScrollState,
  signalHostAttributes,
  signalHostClasses,
  signalHostStyles,
} from '@ethlete/core';
import { EMPTY, concat, fromEvent, map, merge, of, scan, share, switchMap, tap, timer } from 'rxjs';
import { SCROLLBAR_ERROR_CODES } from '../scrollbar-errors';
import {
  NO_SCROLLBAR_GEOMETRY,
  measureScrollbar,
  readScrollDistance,
  readScrollMetrics,
  scrollToDistance,
} from './internals/scrollbar-geometry';
import { markScrollbarHost } from './internals/scrollbar-host-class';
import { ScrollbarGeometry, ScrollbarOrientation, ScrollbarTarget } from './scrollbar.types';

const AUTO_HIDE_DELAY = 800;

const ELEMENT_NODE_TYPE = 1;

/**
 * Mirrors one axis of a scroll container as a thumb the pointer can drag.
 *
 * The container keeps the scrolling. This directive never moves content itself - it reads the
 * container's scroll offset and content size, and writes an offset back when the thumb is dragged or
 * the track is pressed. Wheel, touch, keyboard and programmatic scrolling stay native, so a container
 * behaves the same whether or not a scrollbar mirrors it.
 *
 * One instance covers one axis. Apply two, with `orientation` set on each, for a container that
 * scrolls both ways.
 *
 * The target gets the `et-scrollbar-host` class, which hides its native scrollbar. The rule ships with
 * {@link ScrollbarComponent} - a headless consumer has to declare it.
 *
 * @example
 * <div class="list" #list>…</div>
 * <div etScrollbar [for]="list" orientation="vertical">
 *   <div etScrollbarThumb></div>
 * </div>
 */
@Directive({
  selector: '[etScrollbar]',
  exportAs: 'etScrollbar',
  host: {
    class: 'et-scrollbar',
  },
})
export class ScrollbarDirective {
  private hostElement = injectHostElement();
  private destroyRef = inject(DestroyRef);
  private renderer = injectRenderer();

  /** The scroll container to mirror. */
  public target = input<ScrollbarTarget>(null, { alias: 'for' });

  /** Which axis of the target this scrollbar mirrors. */
  public orientation = input<ScrollbarOrientation>('vertical');

  /** Show the thumb only while the target scrolls, while the pointer is over it, and while the thumb is dragged. */
  public autoHide = input(false, { transform: booleanAttribute });

  /** Shortest the thumb may get on a long track, in pixels. */
  public minThumbSize = input(24, { transform: numberAttribute });

  /** Hide the thumb and ignore the pointer. */
  public disabled = input(false, { transform: booleanAttribute });

  public targetElement = computed<HTMLElement | null>(() => {
    const value = this.target();
    const element = value instanceof ElementRef ? value.nativeElement : value;

    if (!element || typeof element !== 'object') return null;

    return (element as Node).nodeType === ELEMENT_NODE_TYPE ? element : null;
  });

  private targetScroll$ = toObservable(this.targetElement).pipe(
    // The repo's scroll-state helpers answer "does it overflow?" and re-measure on a resize. This needs
    // the offset itself, on every frame the target moves, which only the event carries.
    // eslint-disable-next-line ethlete/prefer-scroll-state
    switchMap((element) => (element ? fromEvent(element, 'scroll', { passive: true }) : EMPTY)),
    share(),
  );

  // A scroll event does not change the target's size, so the scroll state stays cached through it. The
  // geometry has to re-read the offset anyway, and this is what tells it to.
  private scrollTick = toSignal(this.targetScroll$.pipe(scan((tick) => tick + 1, 0)), { initialValue: 0 });

  private targetScrollState = signalElementScrollState(this.targetElement, {
    mutations: { childList: true, subtree: true, attributeFilter: ['class', 'hidden'] },
  });

  private trackDimensions = signalElementDimensions(this.hostElement);

  private trackSize = computed(() => {
    const client = this.trackDimensions().client;

    if (!client) return 0;

    return this.orientation() === 'horizontal' ? client.width : client.height;
  });

  /** Whether the target lays its inline axis out right to left. Always `false` for a vertical scrollbar. */
  public isRtl = computed(() => {
    const target = this.targetElement();

    this.targetScrollState();

    if (!target || this.orientation() !== 'horizontal') return false;

    return getComputedStyle(target).direction === 'rtl';
  });

  /** Where the thumb sits right now. */
  public geometry = computed<ScrollbarGeometry>(() => {
    this.scrollTick();
    this.targetScrollState();

    const target = this.targetElement();

    if (!target || this.disabled()) return NO_SCROLLBAR_GEOMETRY;

    return measureScrollbar({
      target,
      orientation: this.orientation(),
      trackSize: this.trackSize(),
      minThumbSize: this.minThumbSize(),
    });
  });

  public canScroll = computed(() => this.geometry().canScroll);

  private isScrolling = toSignal(
    this.targetScroll$.pipe(switchMap(() => concat(of(true), timer(AUTO_HIDE_DELAY).pipe(map(() => false))))),
    { initialValue: false },
  );

  private isPointerOverTarget = toSignal(
    toObservable(this.targetElement).pipe(
      switchMap((element) =>
        element
          ? merge(
              fromEvent(element, 'pointerenter').pipe(map(() => true)),
              fromEvent(element, 'pointerleave').pipe(map(() => false)),
            )
          : of(false),
      ),
    ),
    { initialValue: false },
  );

  private isPointerOverSelf = signal(false);

  /** Whether the thumb is being dragged right now. */
  public isDragging = signal(false);

  public isVisible = computed(() => {
    if (!this.canScroll()) return false;
    if (!this.autoHide()) return true;

    return this.isScrolling() || this.isPointerOverTarget() || this.isPointerOverSelf() || this.isDragging();
  });

  /**
   * The element that moves along the track. Set by `etScrollbarThumb`.
   *
   * @internal
   */
  public thumbElement = signal<HTMLElement | null>(null);

  /** @internal */
  public hostAttributeBindings = signalHostAttributes({
    'data-orientation': this.orientation,
    'data-direction': computed(() => (this.isRtl() ? 'rtl' : null)),
  });

  /** @internal */
  public hostClassBindings = signalHostClasses({
    'et-scrollbar--visible': this.isVisible,
    'et-scrollbar--dragging': this.isDragging,
  });

  /** @internal */
  public hostStyleBindings = signalHostStyles({
    '--_et-scrollbar-thumb-size': computed(() => `${this.geometry().thumbSize}px`),
    '--_et-scrollbar-thumb-offset': computed(() => `${this.geometry().thumbOffset}px`),
  });

  constructor() {
    effect((onCleanup) => {
      const target = this.targetElement();

      if (!target) return;

      onCleanup(markScrollbarHost(this.renderer, target));
    });

    applyHostListeners({
      pointerenter: () => this.isPointerOverSelf.set(true),
      pointerleave: () => this.isPointerOverSelf.set(false),
      pointerdown: (event) => this.pageTowardsPointer(event),
    });

    if (ngDevMode) {
      effect(() => {
        const value = this.target();

        if (value === null || value === undefined || this.targetElement()) return;

        throw new RuntimeError(
          SCROLLBAR_ERROR_CODES.INVALID_TARGET,
          '[ScrollbarDirective] `for` must be an element or an ElementRef. ' +
            'A template reference variable on a component gives the component instance - read its element instead.',
          { value },
        );
      });

      afterNextRender(() => {
        if (!this.thumbElement()) {
          throw new RuntimeError(
            SCROLLBAR_ERROR_CODES.MISSING_THUMB,
            '[ScrollbarDirective] No thumb registered. Put `etScrollbarThumb` on the element that moves.',
            { element: this.hostElement },
          );
        }

        if (this.target() === null || this.target() === undefined) {
          throw new RuntimeError(
            SCROLLBAR_ERROR_CODES.MISSING_TARGET,
            '[ScrollbarDirective] No scroll container to mirror. Bind `for` to the element that scrolls.',
            { element: this.hostElement },
          );
        }
      });
    }
  }

  /**
   * Drag the target's scroll offset with the pointer. Call from a `pointerdown` on the thumb -
   * `etScrollbarThumb` already does.
   *
   * @internal
   */
  public startThumbDrag(event: PointerEvent) {
    if (event.button !== 0 || this.disabled()) return;

    event.stopPropagation();

    const target = this.targetElement();
    const thumb = this.thumbElement();

    if (!target || !thumb) return;

    const orientation = this.orientation();
    const isRtl = this.isRtl();
    const { maxScroll } = readScrollMetrics(target, orientation);
    const maxThumbOffset = this.trackSize() - this.geometry().thumbSize;

    if (maxScroll <= 0 || maxThumbOffset <= 0) return;

    const startDistance = readScrollDistance(target, orientation);

    const scrollTo = (distance: number) =>
      scrollToDistance({ target, orientation, distance, isRtl, behavior: 'instant' });

    dragGestureFrom(event, thumb, { commitThreshold: 0 })
      .pipe(
        tap((gesture) => {
          switch (gesture.type) {
            case 'start':
              this.isDragging.set(true);
              break;

            case 'move': {
              const physicalDelta = orientation === 'horizontal' ? gesture.data.totalDx : gesture.data.totalDy;
              const logicalDelta = isRtl ? -physicalDelta : physicalDelta;

              scrollTo(clamp(startDistance + (logicalDelta / maxThumbOffset) * maxScroll, 0, maxScroll));
              break;
            }

            // The user never let go, so the offset they were heading for is not one they chose.
            case 'cancelled':
              scrollTo(startDistance);
              this.isDragging.set(false);
              break;

            default:
              this.isDragging.set(false);
              break;
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Scroll the target one viewport towards a press on the track, the way a press beside a native thumb
   * pages. Ignores presses on the thumb, which start a drag instead.
   */
  public pageTowardsPointer(event: PointerEvent) {
    if (event.button !== 0 || this.disabled()) return;

    const target = this.targetElement();
    const geometry = this.geometry();

    if (!target || !geometry.canScroll) return;

    const orientation = this.orientation();
    const isHorizontal = orientation === 'horizontal';
    const isRtl = this.isRtl();
    const { viewportSize, maxScroll } = readScrollMetrics(target, orientation);
    const trackRect = this.hostElement.getBoundingClientRect();

    const physicalOffset = isHorizontal ? event.clientX - trackRect.left : event.clientY - trackRect.top;
    const logicalOffset = isRtl ? trackRect.width - physicalOffset : physicalOffset;
    const step = logicalOffset < geometry.thumbOffset ? -viewportSize : viewportSize;

    scrollToDistance({
      target,
      orientation,
      distance: clamp(readScrollDistance(target, orientation) + step, 0, maxScroll),
      isRtl,
      behavior: 'smooth',
    });
  }
}
