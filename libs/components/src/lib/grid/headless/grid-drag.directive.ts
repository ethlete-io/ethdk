import { afterNextRender, computed, Directive, ElementRef, inject, Injector, signal } from '@angular/core';
import { DragHandleDirective, DragMoveEvent, injectRenderer, signalHostStyles } from '@ethlete/core';
import { outputToObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, tap } from 'rxjs';
import { GridItemDirective } from './grid-item.directive';
import { GRID_TOKEN } from './grid.tokens';

@Directive({
  selector: '[etGridDrag]',
  hostDirectives: [
    {
      directive: DragHandleDirective,
      outputs: ['dragStarted', 'dragMoved', 'dragEnded'],
    },
  ],
  host: {
    class: 'et-grid-drag',
    '[class.et-grid-drag--active]': '!grid.readOnly() && dragHandle.isDragging()',
    '[attr.aria-grabbed]': '!grid.readOnly() && dragHandle.isDragging()',
  },
})
export class GridDragDirective {
  protected grid = inject(GRID_TOKEN);
  private gridItem = inject(GridItemDirective);
  private injector = inject(Injector);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  public dragHandle = inject(DragHandleDirective);
  private renderer = injectRenderer();

  private dragStartClient = signal<{ x: number; y: number } | null>(null);
  private dragPixelOffset = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  public hostStyles = signalHostStyles({
    transform: computed(() => {
      const offset = this.dragPixelOffset();
      return `translate(${offset.x}px, ${offset.y}px)`;
    }),
  });

  constructor() {
    outputToObservable(this.dragHandle.dragStarted)
      .pipe(
        filter(() => !this.grid.readOnly()),
        tap(() => {
          this.dragPixelOffset.set({ x: 0, y: 0 });
          this.dragStartClient.set(null);

          // Lift out of document flow before beginDrag changes the layout
          const rect = this.elementRef.nativeElement.getBoundingClientRect();
          this.applyFixed(rect);

          this.grid.beginDrag(this.gridItem.itemId());
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    outputToObservable<DragMoveEvent>(this.dragHandle.dragMoved)
      .pipe(
        filter(() => !this.grid.readOnly()),
        tap((event) => {
          const startClient = this.dragStartClient();
          const anchor = startClient ?? { x: event.clientX, y: event.clientY };

          if (!startClient) {
            this.dragStartClient.set(anchor);
          }

          const totalDx = event.clientX - anchor.x;
          const totalDy = event.clientY - anchor.y;

          this.dragPixelOffset.set({ x: totalDx, y: totalDy });

          const columns = this.grid.activeColumns();
          const containerWidth = this.grid.containerWidth();
          const rowHeight = this.grid.rowHeight();
          const gap = this.grid.gap();

          const cellWidth = (containerWidth - gap * (columns - 1)) / columns;
          const cellHeight = rowHeight + gap;

          const colDelta = Math.round(totalDx / (cellWidth + gap));
          const rowDelta = Math.round(totalDy / cellHeight);

          const originPos = this.grid.dragState()?.originPosition;

          if (!originPos) return;

          const newCol = Math.max(0, Math.min(originPos.col + colDelta, columns - originPos.colSpan));
          const newRow = Math.max(0, originPos.row + rowDelta);

          const currentGhost = this.grid.ghostPosition();
          const ghostWillMove = !currentGhost || currentGhost.col !== newCol || currentGhost.row !== newRow;

          if (ghostWillMove) {
            this.grid.snapshotRects();
          }

          this.grid.updateDragTarget({
            col: newCol,
            row: newRow,
            colSpan: originPos.colSpan,
            rowSpan: originPos.rowSpan,
          });

          if (ghostWillMove) {
            this.grid.animateLayoutTransition({ excludeIds: new Set([this.gridItem.itemId()]) });
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    outputToObservable(this.dragHandle.dragEnded)
      .pipe(
        filter(() => !this.grid.readOnly()),
        tap(() => {
          const currentOffset = this.dragPixelOffset();
          const ghostPos = this.grid.ghostPosition();
          const originPos = this.grid.dragState()?.originPosition;

          const containerWidth = this.grid.containerWidth();
          const columns = this.grid.activeColumns();
          const rowHeight = this.grid.rowHeight();
          const gap = this.grid.gap();
          const cellWidth = (containerWidth - gap * (columns - 1)) / columns;
          const cellHeight = rowHeight + gap;

          let settleFromX = 0;
          let settleFromY = 0;

          if (ghostPos && originPos) {
            const targetPixelX = (ghostPos.col - originPos.col) * (cellWidth + gap);
            const targetPixelY = (ghostPos.row - originPos.row) * cellHeight;
            settleFromX = currentOffset.x - targetPixelX;
            settleFromY = currentOffset.y - targetPixelY;
          }

          // Reset transform — element stays position:fixed at original screen coords
          this.dragStartClient.set(null);
          this.dragPixelOffset.set({ x: 0, y: 0 });
          this.grid.snapshotRects();
          this.grid.commitDrag();
          this.grid.animateLayoutTransition({ excludeIds: new Set([this.gridItem.itemId()]) });

          afterNextRender(
            () => {
              const el = this.elementRef.nativeElement;

              // Briefly release fixed to measure where the element landed in the grid,
              // then re-anchor fixed there so the settle animation stays out of flow.
              this.releaseFixed();
              const finalRect = el.getBoundingClientRect();
              this.applyFixed(finalRect);

              el.getAnimations().forEach((a) => a.cancel());

              const releaseFixed = () => this.releaseFixed();

              if (Math.abs(settleFromX) > 1 || Math.abs(settleFromY) > 1) {
                const anim = el.animate(
                  [
                    { transform: `translate(${settleFromX}px, ${settleFromY}px)` },
                    { transform: 'translate(0px, 0px)' },
                  ],
                  { duration: 250, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
                );
                anim.onfinish = releaseFixed;
                anim.oncancel = releaseFixed;
              } else {
                releaseFixed();
              }
            },
            { injector: this.injector },
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  private applyFixed(rect: { left: number; top: number; width: number; height: number }) {
    const el = this.elementRef.nativeElement;
    this.renderer.setStyle(el, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  private releaseFixed() {
    const el = this.elementRef.nativeElement;
    this.renderer.removeStyles(el, 'position', 'left', 'top', 'width', 'height');
  }
}
