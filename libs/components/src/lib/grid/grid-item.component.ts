import { Component, ViewEncapsulation, computed, effect, inject, input, output } from '@angular/core';
import {
  ProvideSurfaceDirective,
  ResizeHandlesComponent,
  SURFACE_PROVIDER,
  injectSurfaceThemes,
  resolveSurfaceByElevation,
} from '@ethlete/core';
import { GridDragDirective } from './headless/grid-drag.directive';
import { GridItemDirective } from './headless/grid-item.directive';
import { GridResizeDirective } from './headless/grid-resize.directive';
import { GRID_TOKEN } from './headless/grid.tokens';

@Component({
  selector: 'et-grid-item, [et-grid-item]',
  template: `
    <div (pointerdown)="blockPointerDownWhenReadOnly($event)" class="et-grid-item__content">
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
  imports: [ResizeHandlesComponent],
  hostDirectives: [
    {
      directive: GridItemDirective,
      inputs: ['itemId', 'minColSpan', 'maxColSpan', 'minRowSpan', 'maxRowSpan'],
    },
    GridDragDirective,
    GridResizeDirective,
    ProvideSurfaceDirective,
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
    .et-grid-item {
      position: absolute;
      top: 0;
      left: 0;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      outline: none;
      will-change: translate;
      border-radius: var(--et-grid-item-radius, 0);
      background: var(--et-grid-item-bg, var(--et-surface-background-solid));

      &:is(.et-grid-item--dragging, .et-grid-item--resizing, .et-grid-item--direct, .et-grid-item--settling) {
        z-index: 100;
      }

      &:is(.et-grid-item--dragging) {
        cursor: grabbing;
        user-select: none;
      }

      &:is(.et-grid-item--resizing) {
        user-select: none;
      }

      &:is(.et-grid-item--entering, .et-grid-item--leaving) {
        scale: 0.9;
        opacity: 0;
      }

      &:is(.et-grid-item--leaving) {
        pointer-events: none;
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
      background: var(--et-grid-item-resize-handle-color, var(--et-surface-color-solid));
      opacity: 0.2;
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

    .et-grid-item__content {
      flex: 1;
      min-height: 0;
    }

    .et-grid:not(.et-grid--readonly) .et-grid-item__content {
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
    }

    .et-grid-item--dragging .et-grid-item__content {
      cursor: grabbing;
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
  private grid = inject(GRID_TOKEN, { optional: true });
  private gridItem = inject(GridItemDirective);
  private provideSurface = inject(ProvideSurfaceDirective);
  private parentSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });
  public gridDrag = inject(GridDragDirective);
  public gridResize = inject(GridResizeDirective);

  private surfaceThemes = injectSurfaceThemes({ optional: true });

  public ariaLabel = input<string>('Grid item');

  public remove = output<void>();

  protected isReadOnly = computed(() => this.grid?.readOnly() ?? false);
  private resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;
    const parent = this.parentSurfaceProvider;
    if (!themes || !parent) return null;
    return resolveSurfaceByElevation(themes, parent.surfaceType() ?? 'dark', parent.elevation() + 1);
  });

  constructor() {
    effect(() => {
      const surface = this.resolvedSurface();
      if (surface) {
        this.provideSurface.forceSurface(surface.name);
      } else {
        this.provideSurface.clearForcedSurface();
      }
    });
  }

  protected blockPointerDownWhenReadOnly(event: PointerEvent) {
    if (this.isReadOnly()) {
      event.stopPropagation();
    }
  }

  public applyKeyboardShortcut(event: KeyboardEvent) {
    const grid = this.grid;

    if (!grid || this.isReadOnly()) return;
    const pos = this.gridItem.currentPosition();

    if (!pos) return;

    const columns = grid.activeColumns();

    if (event.ctrlKey || event.metaKey) {
      let handled = true;

      switch (event.key) {
        case 'ArrowLeft':
          grid.moveItem(this.gridItem.itemId(), { ...pos, col: Math.max(0, pos.col - 1) });
          break;
        case 'ArrowRight':
          grid.moveItem(this.gridItem.itemId(), { ...pos, col: Math.min(columns - pos.colSpan, pos.col + 1) });
          break;
        case 'ArrowUp':
          grid.moveItem(this.gridItem.itemId(), { ...pos, row: Math.max(0, pos.row - 1) });
          break;
        case 'ArrowDown':
          grid.moveItem(this.gridItem.itemId(), { ...pos, row: pos.row + 1 });
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
          grid.resizeItem({ id: this.gridItem.itemId(), newColSpan: pos.colSpan + 1, newRowSpan: pos.rowSpan });
          break;
        case 'ArrowLeft':
          grid.resizeItem({ id: this.gridItem.itemId(), newColSpan: pos.colSpan - 1, newRowSpan: pos.rowSpan });
          break;
        case 'ArrowDown':
          grid.resizeItem({ id: this.gridItem.itemId(), newColSpan: pos.colSpan, newRowSpan: pos.rowSpan + 1 });
          break;
        case 'ArrowUp':
          grid.resizeItem({ id: this.gridItem.itemId(), newColSpan: pos.colSpan, newRowSpan: pos.rowSpan - 1 });
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
        grid.removeItem(this.gridItem.itemId());
        this.remove.emit();
        event.preventDefault();
      }
    }
  }
}
