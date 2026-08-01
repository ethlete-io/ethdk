import {
  afterNextRender,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { filter, fromEvent, merge, Subscription, take, tap, timer } from 'rxjs';
import { GRID_ERROR_CODES } from '../grid-errors';
import { GRID_TOKEN } from './grid.tokens';
import { PixelRect, pixelRectsEqual, positionsEqual, positionToPixelRect } from './internals';

const SETTLE_FALLBACK_MS = 350;

@Directive({
  selector: '[etGridItem]',
  exportAs: 'etGridItem',
  host: {
    class: 'et-grid-item',
    '[style.translate]': 'translateStyle()',
    '[style.width.px]': 'renderedRect()?.width',
    '[style.height.px]': 'renderedRect()?.height',
    '[style.transition]': 'transitionStyle()',
    '[class.et-grid-item--direct]': 'renderMode() === "direct"',
    '[class.et-grid-item--settling]': 'isSettling()',
    '[class.et-grid-item--entering]': 'entering()',
    '[class.et-grid-item--leaving]': 'leaving()',
  },
})
export class GridItemDirective {
  private grid = inject(GRID_TOKEN, { optional: true });
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  public hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  public itemId = input.required<string>();
  public minColSpan = input(1, { transform: numberAttribute });
  public maxColSpan = input(12, { transform: numberAttribute });
  public minRowSpan = input(1, { transform: numberAttribute });
  public maxRowSpan = input(4, { transform: numberAttribute });

  public isBeingDragged = computed(() => this.grid?.dragState()?.itemId === this.itemId());

  public currentPosition = computed(
    () => {
      const layout = this.grid?.layout() ?? [];
      const entry = layout.find((e) => e.id === this.itemId());
      return entry?.position ?? null;
    },
    { equal: positionsEqual },
  );

  /** The layout-derived target rect in container-relative pixels. */
  public slotRect = computed(
    () => {
      const pos = this.currentPosition();
      return pos && this.grid ? positionToPixelRect(pos, this.grid.geometry()) : null;
    },
    { equal: pixelRectsEqual },
  );

  private renderModeSignal = signal<'layout' | 'direct'>('layout');
  private liveRect = signal<PixelRect | null>(null);
  private isSettlingSignal = signal(false);
  private enteringSignal = signal(false);

  public renderMode = this.renderModeSignal.asReadonly();
  public isSettling = this.isSettlingSignal.asReadonly();

  protected entering = this.enteringSignal.asReadonly();
  protected leaving = computed(() => this.grid?.leavingIds().has(this.itemId()) ?? false);

  /** The rect currently bound to the host: pointer-driven while direct-controlled, the slot otherwise. */
  public renderedRect = computed(() => (this.renderModeSignal() === 'direct' ? this.liveRect() : this.slotRect()), {
    equal: pixelRectsEqual,
  });

  protected translateStyle = computed(() => {
    const rect = this.renderedRect();
    return rect ? `${rect.x}px ${rect.y}px` : null;
  });

  protected transitionStyle = computed(() => {
    if (!this.grid?.animationsEnabled() || this.renderModeSignal() === 'direct') return 'none';

    const move = 'var(--et-grid-anim-duration, 250ms) cubic-bezier(0.2, 0, 0, 1)';
    const fade = '200ms cubic-bezier(0.2, 0, 0, 1)';

    return `translate ${move}, width ${move}, height ${move}, scale ${fade}, opacity ${fade}`;
  });

  private settleListener: Subscription | null = null;

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.grid) {
          throw new RuntimeError(
            GRID_ERROR_CODES.MISSING_GRID,
            '[GridItemDirective] etGridItem must be placed inside an [etGrid] element (e.g. et-grid).',
          );
        }
      });
    }

    effect((onCleanup) => {
      const id = this.itemId();
      this.grid?.registerConstraints(id, {
        minColSpan: this.minColSpan(),
        maxColSpan: this.maxColSpan(),
        minRowSpan: this.minRowSpan(),
        maxRowSpan: this.maxRowSpan(),
      });
      onCleanup(() => this.grid?.unregisterConstraints(id));
    });

    // Items mounted mid-session (addItem) scale/fade in: they mount with the
    // entering styles already applied (CSS transitions never run on insertion),
    // then the class is cleared one frame later and transitions to the resting
    // state. Items mounted during initial load appear in place.
    if (untracked(() => this.grid?.animationsEnabled())) {
      this.enteringSignal.set(true);
      afterNextRender(() => this.enteringSignal.set(false), { injector: this.injector });
    }

    this.destroyRef.onDestroy(() => this.settleListener?.unsubscribe());
  }

  public startDirectControl() {
    this.settleListener?.unsubscribe();
    this.isSettlingSignal.set(false);
    this.liveRect.set(this.slotRect());
    this.renderModeSignal.set('direct');
  }

  public updateDirectRect(rect: PixelRect) {
    if (this.renderModeSignal() !== 'direct') return;

    this.liveRect.set(rect);
  }

  public stopDirectControl() {
    if (this.renderModeSignal() !== 'direct') return;

    this.renderModeSignal.set('layout');
    this.liveRect.set(null);

    if (!untracked(() => this.grid?.animationsEnabled())) return;

    this.isSettlingSignal.set(true);

    const el = this.hostElement.nativeElement;

    const settled$ = merge(
      fromEvent<TransitionEvent>(el, 'transitionend'),
      fromEvent<TransitionEvent>(el, 'transitioncancel'),
    ).pipe(
      filter(
        (event) =>
          event.target === el &&
          (event.propertyName === 'translate' || event.propertyName === 'width' || event.propertyName === 'height'),
      ),
    );

    this.settleListener?.unsubscribe();

    // The timer is the fallback for drops that land exactly in the current slot - no
    // transition fires then.
    this.settleListener = merge(settled$, timer(SETTLE_FALLBACK_MS))
      .pipe(
        take(1),
        tap(() => this.isSettlingSignal.set(false)),
      )
      .subscribe();
  }
}
