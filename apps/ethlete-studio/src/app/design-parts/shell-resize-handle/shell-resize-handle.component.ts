import { Component, computed, model, output, signal, ViewEncapsulation } from '@angular/core';
import { DragHandleDirective, DragMoveEvent } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { clampSideWidth, SIDE_WIDTH, sideWidthForKey } from '../shell-main/side-width';

@Component({
  selector: 'ethlete-shell-resize-handle',
  template: `
    <div
      [attr.aria-label]="LABELS.sideWidth"
      [attr.aria-valuemin]="SIDE_WIDTH.min"
      [attr.aria-valuemax]="SIDE_WIDTH.max"
      [attr.aria-valuenow]="shownWidth()"
      [commitThreshold]="0"
      (dragStarted)="startResize()"
      (dragMoved)="moveResize($event)"
      (dragEnded)="endResize()"
      (dragCancelled)="cancelResize()"
      (keydown)="resizeByKey($event)"
      class="group absolute top-space-3 bottom-space-3 left-[calc(var(--space-3)+var(--st-side-width)-4px)] z-2 w-2 cursor-col-resize outline-none"
      role="separator"
      aria-orientation="vertical"
      tabindex="0"
      etDragHandle
      data-side-resize
    >
      <span
        class="absolute top-2.5 bottom-2.5 left-0.75 w-0.5 rounded-full [transition:var(--transition-state)] group-hover:bg-et-theme/50 group-focus-visible:bg-focus-ring group-active:bg-et-theme"
      ></span>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [DragHandleDirective],
})
export class ShellResizeHandleComponent {
  public width = model<number>(SIDE_WIDTH.rest);
  public dragWidthChange = output<number | null>();

  protected readonly LABELS = STUDIO_LABELS.shell;
  protected readonly SIDE_WIDTH = SIDE_WIDTH;

  private dragWidth = signal<number | null>(null);
  private dragFrom: number = SIDE_WIDTH.rest;

  protected shownWidth = computed(() => this.dragWidth() ?? clampSideWidth(this.width()));

  protected startResize() {
    this.dragFrom = this.shownWidth();
  }

  protected moveResize(event: DragMoveEvent) {
    this.setDragWidth(clampSideWidth(this.dragFrom + event.totalDx));
  }

  protected endResize() {
    const width = this.dragWidth();

    this.setDragWidth(null);

    if (width !== null) this.width.set(width);
  }

  protected cancelResize() {
    this.setDragWidth(null);
  }

  protected resizeByKey(event: KeyboardEvent) {
    const width = sideWidthForKey(this.shownWidth(), event.key);

    if (width === null) return;

    event.preventDefault();
    this.width.set(width);
  }

  private setDragWidth(width: number | null) {
    this.dragWidth.set(width);
    this.dragWidthChange.emit(width);
  }
}
