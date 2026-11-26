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
import { injectGridLabels } from './grid-labels';

const KEY_SHORTCUTS =
  'Control+ArrowLeft Control+ArrowRight Control+ArrowUp Control+ArrowDown ' +
  'Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Control+Delete';

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
  styleUrl: './grid-item.component.css',
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
    '[attr.aria-label]': 'accessibleLabel()',
    '[attr.aria-keyshortcuts]': 'isReadOnly() ? null : KEY_SHORTCUTS',
    '[attr.tabindex]': '"0"',
    '(keydown)': 'applyKeyboardShortcut($event)',
  },
})
export class GridItemComponent {
  private grid = inject(GRID_TOKEN, { optional: true });
  private gridItem = inject(GridItemDirective);
  private provideSurface = inject(ProvideSurfaceDirective);
  private parentSurface = injectParentSurface();
  public gridDrag = inject(GridDragDirective);
  public gridResize = inject(GridResizeDirective);

  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private labels = injectGridLabels();

  public ariaLabel = input<string>();

  public remove = output<void>();

  protected accessibleLabel = computed(() => this.ariaLabel() ?? this.labels().item);

  protected readonly KEY_SHORTCUTS = KEY_SHORTCUTS;

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
