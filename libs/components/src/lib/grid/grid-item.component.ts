import { Component, ViewEncapsulation, computed, effect, inject, input, output } from '@angular/core';
import {
  ProvideSurfaceDirective,
  ResizeHandlesComponent,
  injectParentSurface,
  injectSurfaceThemes,
  resolveSurfaceByElevation,
} from '@ethlete/core';
import { isFormInputTarget } from '../internals/form-input-target';
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
      (resizeCancelled)="gridResize.cancelResize()"
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
      inputs: ['itemId', 'minColSpan', 'maxColSpan', 'minRowSpan', 'maxRowSpan', 'perBreakpointConstraints'],
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
      /* The gap is dead space, so the hit strips grow out into it rather than eating content area.
         Never past half of it: adjacent items are siblings at one z-index, so overlapping strips
         would be resolved by DOM order and the later item would swallow its neighbour's handle. */
      --et-resize-handles-outset: min(8px, calc(var(--et-grid-gap, 16px) / 2));

      /* Core stops the e/w strips short of the bottom for the pip window's title bar; a grid item has
         none, and the full-height strip is what keeps the hover bar centred on the item. */
      --et-resize-handles-side-bottom: 0px;

      --et-grid-item-resize-bar-inset: calc(var(--et-resize-handles-outset) + 2px);
      --et-grid-item-resize-pip-inset: calc(var(--et-resize-handles-outset) + 3px);

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

      &:focus-visible {
        outline: 2px solid var(--et-theme-color-primary-solid, currentColor);
        outline-offset: -2px;
      }

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
      right: var(--et-grid-item-resize-bar-inset);
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 24px;
    }

    .et-grid-item:hover .et-resize-handle--w::after,
    .et-grid-item--resizing .et-resize-handle--w::after {
      left: var(--et-grid-item-resize-bar-inset);
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 24px;
    }

    .et-grid-item:hover .et-resize-handle--s::after,
    .et-grid-item--resizing .et-resize-handle--s::after {
      bottom: var(--et-grid-item-resize-bar-inset);
      left: 50%;
      transform: translateX(-50%);
      height: 3px;
      width: 24px;
    }

    .et-grid-item:hover .et-resize-handle--n::after,
    .et-grid-item--resizing .et-resize-handle--n::after {
      top: var(--et-grid-item-resize-bar-inset);
      left: 50%;
      transform: translateX(-50%);
      height: 3px;
      width: 24px;
    }

    .et-grid-item:hover .et-resize-handle--se::after,
    .et-grid-item--resizing .et-resize-handle--se::after {
      bottom: var(--et-grid-item-resize-pip-inset);
      right: var(--et-grid-item-resize-pip-inset);
      width: 8px;
      height: 8px;
      border-radius: 1px;
    }

    .et-grid-item:hover .et-resize-handle--sw::after,
    .et-grid-item--resizing .et-resize-handle--sw::after {
      bottom: var(--et-grid-item-resize-pip-inset);
      left: var(--et-grid-item-resize-pip-inset);
      width: 8px;
      height: 8px;
      border-radius: 1px;
    }

    .et-grid-item:hover .et-resize-handle--ne::after,
    .et-grid-item--resizing .et-resize-handle--ne::after {
      top: var(--et-grid-item-resize-pip-inset);
      right: var(--et-grid-item-resize-pip-inset);
      width: 8px;
      height: 8px;
      border-radius: 1px;
    }

    .et-grid-item:hover .et-resize-handle--nw::after,
    .et-grid-item--resizing .et-resize-handle--nw::after {
      top: var(--et-grid-item-resize-pip-inset);
      left: var(--et-grid-item-resize-pip-inset);
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
  private parentSurface = injectParentSurface();
  public gridDrag = inject(GridDragDirective);
  public gridResize = inject(GridResizeDirective);

  private surfaceThemes = injectSurfaceThemes({ optional: true });

  public ariaLabel = input<string>('Grid item');

  public remove = output<void>();

  protected isReadOnly = computed(() => this.grid?.readOnly() ?? false);
  private resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;
    const parent = this.parentSurface();
    if (!themes || !parent) return null;
    return resolveSurfaceByElevation(themes, parent.type, parent.elevation + 1);
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

  /** Remove this item from the grid and emit `remove` - the path the keyboard shortcut and the default actions take. */
  public removeItem() {
    this.grid?.removeItem(this.gridItem.itemId());
    this.remove.emit();
  }

  protected blockPointerDownWhenReadOnly(event: PointerEvent) {
    if (this.isReadOnly()) {
      event.stopPropagation();
    }
  }

  public applyKeyboardShortcut(event: KeyboardEvent) {
    const grid = this.grid;

    if (!grid || this.isReadOnly() || isFormInputTarget(event.target)) return;
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
    } else if (event.shiftKey) {
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
        this.removeItem();
        event.preventDefault();
      }
    }
  }
}
