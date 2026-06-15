import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input, output } from '@angular/core';
import { ResizeHandlesComponent, injectLocale } from '@ethlete/core';
import { injectGridConfig } from './headless/grid-config';
import { GridDragDirective } from './headless/grid-drag.directive';
import { GridItemDirective } from './headless/grid-item.directive';
import { GridResizeDirective } from './headless/grid-resize.directive';
import { GRID_TOKEN } from './headless/grid.tokens';

@Component({
  selector: 'et-grid-item, [et-grid-item]',
  template: `
    <div [attr.aria-label]="dragHandleAriaLabel()" class="et-grid-item__drag-handle">
      <ng-content select="[etGridItemDragHandle]" />
    </div>

    <div (pointerdown)="$event.stopPropagation()" class="et-grid-item__content">
      <ng-content />
    </div>

    <et-resize-handles
      [edges]="gridResize.resizeEdges()"
      [disabled]="gridResize.isResizing() || isReadOnly()"
      (resizeStarted)="gridResize.beginResize()"
      (resizeMoved)="gridResize.updateResize($event)"
      (resizeEnded)="gridResize.finishResize()"
      (pointerdown)="$event.stopPropagation()"
    />

    <div (pointerdown)="$event.stopPropagation()" class="et-grid-item__actions">
      <ng-content select="[etGridItemAction]" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ResizeHandlesComponent],
  hostDirectives: [
    {
      directive: GridItemDirective,
      inputs: ['itemId', 'minColSpan', 'maxColSpan', 'minRowSpan', 'maxRowSpan'],
    },
    GridDragDirective,
    GridResizeDirective,
  ],
  host: {
    class: 'et-grid-item',
    '[class.et-grid-item--dragging]': '!isReadOnly() && gridDrag.dragHandle.isDragging()',
    '[class.et-grid-item--resizing]': 'gridResize.isResizing()',
    '[attr.role]': '"group"',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.tabindex]': '"0"',
    '(keydown)': 'applyKeyboardShortcut($event)',
  },
  styles: `
    @property --et-grid-item-border-radius {
      syntax: '<length>';
      inherits: false;
      initial-value: 8px;
    }

    @property --et-grid-item-bg {
      syntax: '<color>';
      inherits: false;
      initial-value: rgb(var(--et-surface-background, 255 255 255));
    }

    @property --et-grid-item-shadow {
      syntax: '*';
      inherits: false;
      initial-value: 0 1px 3px rgba(0, 0, 0, 0.12);
    }

    @property --et-grid-item-drag-handle-height {
      syntax: '<length>';
      inherits: false;
      initial-value: 32px;
    }

    .et-grid-item {
      position: relative;
      border-radius: var(--et-grid-item-border-radius);
      background: var(--et-grid-item-bg);
      box-shadow: var(--et-grid-item-shadow);
      border: 1px solid rgb(var(--et-surface-border, 229 229 229));
      color: rgb(var(--et-surface-color, 23 23 23));
      overflow: hidden;
      display: flex;
      flex-direction: column;
      outline: none;
      will-change: transform;

      &:focus-visible {
        box-shadow: 0 0 0 2px var(--et-grid-item-focus-ring-color, #2563eb);
      }

      &:is(.et-grid-item--dragging) {
        z-index: 100;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
        opacity: 0.95;
        cursor: grabbing;
        user-select: none;
      }

      &:is(.et-grid-item--resizing) {
        z-index: 100;
        user-select: none;
      }
    }

    .et-grid-item:hover .et-resize-handle--e::after,
    .et-grid-item:hover .et-resize-handle--s::after,
    .et-grid-item:hover .et-resize-handle--w::after,
    .et-grid-item:hover .et-resize-handle--n::after,
    .et-grid-item:hover .et-resize-handle--se::after,
    .et-grid-item:hover .et-resize-handle--sw::after,
    .et-grid-item:hover .et-resize-handle--ne::after,
    .et-grid-item:hover .et-resize-handle--nw::after,
    .et-grid-item--resizing .et-resize-handle--e::after,
    .et-grid-item--resizing .et-resize-handle--s::after,
    .et-grid-item--resizing .et-resize-handle--w::after,
    .et-grid-item--resizing .et-resize-handle--n::after,
    .et-grid-item--resizing .et-resize-handle--se::after,
    .et-grid-item--resizing .et-resize-handle--sw::after,
    .et-grid-item--resizing .et-resize-handle--ne::after,
    .et-grid-item--resizing .et-resize-handle--nw::after {
      content: '';
      position: absolute;
      border-radius: 2px;
      background: rgb(var(--et-surface-color, 23 23 23) / 0.2);
      transition: opacity 0.15s ease;
    }

    .et-grid-item:hover .et-resize-handle--e::after,
    .et-grid-item--resizing .et-resize-handle--e::after {
      right: 2px;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 24px;
    }

    .et-grid-item:hover .et-resize-handle--w::after,
    .et-grid-item--resizing .et-resize-handle--w::after {
      left: 2px;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 24px;
    }

    .et-grid-item:hover .et-resize-handle--s::after,
    .et-grid-item--resizing .et-resize-handle--s::after {
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      height: 3px;
      width: 24px;
    }

    .et-grid-item:hover .et-resize-handle--n::after,
    .et-grid-item--resizing .et-resize-handle--n::after {
      top: 2px;
      left: 50%;
      transform: translateX(-50%);
      height: 3px;
      width: 24px;
    }

    .et-grid-item:hover .et-resize-handle--se::after,
    .et-grid-item--resizing .et-resize-handle--se::after {
      bottom: 3px;
      right: 3px;
      width: 8px;
      height: 8px;
      border-radius: 1px;
    }

    .et-grid-item:hover .et-resize-handle--sw::after,
    .et-grid-item--resizing .et-resize-handle--sw::after {
      bottom: 3px;
      left: 3px;
      width: 8px;
      height: 8px;
      border-radius: 1px;
    }

    .et-grid-item:hover .et-resize-handle--ne::after,
    .et-grid-item--resizing .et-resize-handle--ne::after {
      top: 3px;
      right: 3px;
      width: 8px;
      height: 8px;
      border-radius: 1px;
    }

    .et-grid-item:hover .et-resize-handle--nw::after,
    .et-grid-item--resizing .et-resize-handle--nw::after {
      top: 3px;
      left: 3px;
      width: 8px;
      height: 8px;
      border-radius: 1px;
    }

    .et-grid-item__drag-handle {
      height: var(--et-grid-item-drag-handle-height);
      cursor: grab;
      display: flex;
      align-items: center;
      padding-inline: 8px;
      user-select: none;
      touch-action: none;

      .et-grid-item--dragging & {
        cursor: grabbing;
      }
    }

    .et-grid-item__content {
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    .et-grid-item__actions {
      position: absolute;
      top: 4px;
      right: 4px;
      display: flex;
      gap: 4px;
    }
  `,
})
export class GridItemComponent {
  private grid = inject(GRID_TOKEN);
  private gridItem = inject(GridItemDirective);

  public gridDrag = inject(GridDragDirective);
  public gridResize = inject(GridResizeDirective);

  public ariaLabel = input<string>('Grid item');

  public removed = output<void>();
  private gridConfig = injectGridConfig();
  private locale = injectLocale();

  protected isReadOnly = computed(() => this.grid.readOnly());

  protected dragHandleAriaLabel = computed(() =>
    this.gridConfig.transformer(this.gridConfig.dragHandleAriaLabel, this.locale.currentLocale()),
  );

  public applyKeyboardShortcut(event: KeyboardEvent) {
    if (this.isReadOnly()) return;
    const pos = this.gridItem.currentPosition();

    if (!pos) return;

    const columns = this.grid.activeColumns();

    if (event.ctrlKey || event.metaKey) {
      let handled = true;

      switch (event.key) {
        case 'ArrowLeft':
          this.grid.moveItem(this.gridItem.itemId(), { ...pos, col: Math.max(0, pos.col - 1) });
          break;
        case 'ArrowRight':
          this.grid.moveItem(this.gridItem.itemId(), { ...pos, col: Math.min(columns - pos.colSpan, pos.col + 1) });
          break;
        case 'ArrowUp':
          this.grid.moveItem(this.gridItem.itemId(), { ...pos, row: Math.max(0, pos.row - 1) });
          break;
        case 'ArrowDown':
          this.grid.moveItem(this.gridItem.itemId(), { ...pos, row: pos.row + 1 });
          break;
        default:
          handled = false;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    if (event.shiftKey) {
      let handled = true;

      switch (event.key) {
        case 'ArrowRight':
          this.grid.resizeItem({ id: this.gridItem.itemId(), newColSpan: pos.colSpan + 1, newRowSpan: pos.rowSpan });
          break;
        case 'ArrowLeft':
          this.grid.resizeItem({ id: this.gridItem.itemId(), newColSpan: pos.colSpan - 1, newRowSpan: pos.rowSpan });
          break;
        case 'ArrowDown':
          this.grid.resizeItem({ id: this.gridItem.itemId(), newColSpan: pos.colSpan, newRowSpan: pos.rowSpan + 1 });
          break;
        case 'ArrowUp':
          this.grid.resizeItem({ id: this.gridItem.itemId(), newColSpan: pos.colSpan, newRowSpan: pos.rowSpan - 1 });
          break;
        default:
          handled = false;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (event.ctrlKey || event.metaKey) {
        this.grid.removeItem(this.gridItem.itemId());
        this.removed.emit();
        event.preventDefault();
      }
    }
  }
}
