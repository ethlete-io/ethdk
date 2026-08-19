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
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, fromEvent, take, takeUntil, takeWhile, tap, timer } from 'rxjs';
import { dragGestureFrom, injectStyleManager, signalHostElementDimensions } from '@ethlete/core';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './headless/table-features';
import { TableDragScrollStylesComponent } from './table-drag-scroll-styles.component';

/** Options for {@link TableDragScrollDirective}. */
export type TableDragScrollConfig = TableFeatureConfig;

/**
 * Whether a press landed inside a scroll container of its own between the target and the table - a sub
 * table in a detail row, a scrolling panel in a cell. That container is what the gesture belongs to, so
 * the table must not pan instead: dragging in a sub table would scroll the list under it. One that fits
 * its content scrolls nothing, so it is left to the table.
 */
const hasOwnScroller = ({
  target,
  host,
  tableScroller,
}: {
  target: EventTarget | null;
  host: HTMLElement;
  tableScroller: HTMLElement;
}) => {
  let element = target instanceof Element ? target : null;

  while (element !== null && element !== host && element !== tableScroller) {
    const style = getComputedStyle(element);
    const scrollsInline = /^(auto|scroll)$/.test(style.overflowX) && element.scrollWidth > element.clientWidth;
    const scrollsBlock = /^(auto|scroll)$/.test(style.overflowY) && element.scrollHeight > element.clientHeight;

    if (scrollsInline || scrollsBlock) {
      return true;
    }

    element = element.parentElement;
  }

  return false;
};

/** Whether a press landed in something whose own drag is the point of it: selecting text, not panning. */
const isTextGesture = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  // True inside a contenteditable region as well, not only on the element carrying the attribute.
  (target instanceof HTMLElement && target.isContentEditable);

/**
 * Opt-in drag-to-scroll for `et-table`: pressing anywhere in the table and dragging scrolls it, the way
 * a map pans. A wide table is otherwise reachable only through the scrollbar or a horizontal wheel,
 * neither of which a mouse user has close to hand.
 *
 * A press that does not travel is still a click, so rows, row links and header controls behave exactly
 * as they did; a press that becomes a drag swallows the click it would have ended on, so panning off a
 * row link does not also follow it. Dragging inside a text field is left alone, and a touch pointer
 * keeps the browser's own scrolling. A press inside content that scrolls on its own - a sub table in a
 * detail row - belongs to that content, so the table stays put.
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" etTableDragScroll />
 */
@Directive({
  selector: '[etTableDragScroll]',
  exportAs: 'etTableDragScroll',
  host: {
    '[class.et-table-host--drag-scrollable]': 'scrollable()',
    '[class.et-table-host--dragging]': 'dragging()',
    '(pointerdown)': 'startDrag($event)',
    '(dragstart)': 'preventNativeDrag($event)',
    '(scroll)': 'syncScrollable()',
  },
})
export class TableDragScrollDirective {
  private table = injectTableFeatureHost('etTableDragScroll');
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);

  /** See {@link TableDragScrollConfig}. */
  public config = input({} as TableDragScrollConfig, {
    alias: 'etTableDragScroll',
    transform: tableFeatureConfig<TableDragScrollConfig>,
  });
  private hostDimensions = signalHostElementDimensions();

  /** Whether a drag is in progress, which is what the grabbing cursor reads. */
  public dragging = signal(false);

  /** Whether the table overflows at all - a table that fits takes no grab cursor. */
  protected scrollable = signal(false);

  private enabled = computed(() => this.config().enabled ?? true);

  constructor() {
    injectStyleManager().mount(TableDragScrollStylesComponent);

    // Whether the table overflows has no signal of its own: recheck whenever the host resizes or the
    // tracks change, both of which decide it.
    effect(() => {
      this.hostDimensions();
      this.table.columnWidths();
      this.table.visibleColumnsMeta();
      afterNextRender({ read: () => this.syncScrollable() }, { injector: this.injector });
    });
  }

  protected syncScrollable() {
    const scroller = this.table.scrollElement();
    const scrollable =
      this.enabled() && (scroller.scrollWidth > scroller.clientWidth || scroller.scrollHeight > scroller.clientHeight);

    if (scrollable !== this.scrollable()) this.scrollable.set(scrollable);
  }

  /**
   * A press that travels over an `<a>` or an image starts the browser's own drag-and-drop, which fires
   * `pointercancel` and takes the gesture away before it has moved far enough to count as a drag. A
   * table that pans by dragging has no room for the other kind.
   */
  protected preventNativeDrag(event: DragEvent) {
    if (this.enabled()) event.preventDefault();
  }

  protected startDrag(event: PointerEvent) {
    // Touch already pans by dragging, and a pen or a mouse is the only pointer the scrollbar is awkward
    // for. A non-primary button belongs to the browser's own menus.
    if (!this.enabled() || event.pointerType === 'touch' || event.button !== 0) return;
    if (!this.scrollable() || isTextGesture(event.target)) return;

    const host = this.elementRef.nativeElement;
    const scroller = this.table.scrollElement();

    if (hasOwnScroller({ target: event.target, host, tableScroller: scroller })) return;
    const startLeft = scroller.scrollLeft;
    const startTop = scroller.scrollTop;

    dragGestureFrom(event, host)
      .pipe(
        // Column reorder starts from this same pointerdown and claims the gesture in that handler, so
        // reading the claim here - once the drag has already travelled - gives the same answer
        // whichever of the two listeners the browser ran first.
        takeWhile(() => {
          const claim = this.table.pointerGestureClaim(event);

          return claim === null || claim === 'etTableDragScroll';
        }),
        tap((gesture) => {
          if (gesture.type === 'start') {
            this.dragging.set(true);
            this.table.claimPointerGesture(event, 'etTableDragScroll');
          }
          if (gesture.type === 'move') {
            scroller.scrollLeft = startLeft - gesture.data.totalDx;
            scroller.scrollTop = startTop - gesture.data.totalDy;
          }
          if (gesture.type === 'end' || gesture.type === 'cancelled') this.swallowNextClick();
        }),
        finalize(() => this.dragging.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * The release ends on a `click` at whatever the pointer landed on. After a drag that click was never
   * meant - the row under the pointer is not the row the user pressed - so it is eaten in the capture
   * phase, before a row link or a header control can act on it. Only that one click, and only if it
   * arrives on this turn of the loop: the next real click has to get through.
   */
  private swallowNextClick() {
    if (!this.dragging()) return;

    fromEvent<MouseEvent>(this.elementRef.nativeElement, 'click', { capture: true })
      .pipe(
        takeUntil(timer(0)),
        take(1),
        tap((click) => {
          click.preventDefault();
          click.stopPropagation();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
