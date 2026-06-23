import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { injectLocale } from '@ethlete/core';
import { GridItemComponent } from './grid-item.component';
import { injectGridConfig } from './headless/grid-config';
import { GridDirective } from './headless/grid.directive';

@Component({
  selector: 'et-grid, [et-grid]',
  template: `
    @for (entry of registeredItems(); track entry.item.id) {
      <et-grid-item
        [itemId]="entry.item.id"
        [minColSpan]="entry.reg.constraints?.minColSpan ?? 1"
        [maxColSpan]="entry.reg.constraints?.maxColSpan ?? 12"
        [minRowSpan]="entry.reg.constraints?.minRowSpan ?? 1"
        [maxRowSpan]="entry.reg.constraints?.maxRowSpan ?? 4"
      >
        @if (dragHandleComponent()) {
          <div etGridItemDragHandle>
            <ng-container
              [ngComponentOutlet]="dragHandleComponent()!"
              [ngComponentOutletInputs]="{ data: entry.item.data, itemId: entry.item.id }"
            />
          </div>
        } @else {
          <div etGridItemDragHandle></div>
        }
        <ng-container [ngComponentOutlet]="entry.reg.component" [ngComponentOutletInputs]="{ data: entry.item.data }" />
        @if (actionsComponent()) {
          <div etGridItemAction>
            <ng-container
              [ngComponentOutlet]="actionsComponent()!"
              [ngComponentOutletInputs]="{ data: entry.item.data, itemId: entry.item.id }"
            />
          </div>
        } @else if (!isReadOnly()) {
          <button (click)="grid.removeItem(entry.item.id)" etGridItemAction>✕</button>
        }
      </et-grid-item>
    }
    <ng-content />
    @if (grid.ghostPosition(); as ghost) {
      <div
        #ghostRef
        [style.grid-column]="ghost.col + 1 + ' / span ' + ghost.colSpan"
        [style.grid-row]="ghost.row + 1 + ' / span ' + ghost.rowSpan"
        class="et-grid-ghost"
      ></div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridItemComponent, NgComponentOutlet],
  hostDirectives: [
    {
      directive: GridDirective,
      inputs: ['breakpoints', 'rowHeight', 'gap', 'initialItems', 'readOnly'],
      outputs: ['layoutChange'],
    },
  ],
  host: {
    class: 'et-grid',
    role: 'region',
    '[attr.aria-label]': 'ariaLabel()',
    '[style.--_et-grid-columns]': 'gridColumns()',
    '[style.--et-grid-gap]': 'gridGap()',
    '[style.--et-grid-row-height]': 'gridRowHeight()',
  },
  styles: `
    @property --et-grid-gap {
      syntax: '<length>';
      inherits: false;
      initial-value: 16px;
    }

    @property --et-grid-row-height {
      syntax: '<length>';
      inherits: false;
      initial-value: 100px;
    }

    @property --et-grid-padding {
      syntax: '<length>';
      inherits: false;
      initial-value: 0px;
    }

    .et-grid {
      display: grid;
      grid-template-columns: repeat(var(--_et-grid-columns, 12), 1fr);
      grid-auto-rows: var(--et-grid-row-height);
      gap: var(--et-grid-gap);
      padding: var(--et-grid-padding);
      position: relative;
      min-height: 0;

      &:has(.et-grid-item--dragging, .et-grid-item--resizing) {
        user-select: none;
        cursor: grabbing;
      }

      &:has(.et-grid-item--resizing) {
        cursor: nwse-resize;
      }
    }

    .et-grid-ghost {
      border-radius: 8px;
      background: rgb(var(--et-surface-color, 23 23 23) / 0.08);
      border: 2px dashed rgb(var(--et-surface-color, 23 23 23) / 0.2);
      pointer-events: none;
      transition:
        grid-column 0s,
        grid-row 0s;
    }

    .et-grid--readonly {
      .et-grid-item__drag-handle {
        cursor: default;
        pointer-events: none;
      }

      .et-grid-item__actions {
        display: none;
      }

      .et-grid-item:hover {
        .et-resize-handle--e::after,
        .et-resize-handle--s::after,
        .et-resize-handle--w::after,
        .et-resize-handle--n::after,
        .et-resize-handle--se::after,
        .et-resize-handle--sw::after,
        .et-resize-handle--ne::after,
        .et-resize-handle--nw::after {
          content: unset;
        }
      }
    }
  `,
})
export class GridComponent {
  public grid = inject(GridDirective);
  private ghostRef = viewChild<ElementRef<HTMLElement>>('ghostRef');
  private gridConfig = injectGridConfig();
  private locale = injectLocale();

  protected isReadOnly = computed(() => this.grid.readOnly());

  protected dragHandleComponent = computed(() => this.gridConfig.dragHandleComponent);
  protected actionsComponent = computed(() => this.gridConfig.actionsComponent);

  protected registeredItems = computed(() => {
    const registrations = this.gridConfig.registrations;
    return this.grid.items().flatMap((item) => {
      const reg = registrations.find((r) => r.type === item.type);
      return reg ? [{ item, reg }] : [];
    });
  });

  protected ariaLabel = computed(() => {
    const label = this.grid.readOnly() ? this.gridConfig.readonlyAriaLabel : this.gridConfig.interactiveAriaLabel;
    return this.gridConfig.transformer(label, this.locale.currentLocale());
  });

  protected gridColumns = computed(() => this.grid.activeColumns());
  protected gridGap = computed(() => `${this.grid.gap()}px`);
  protected gridRowHeight = computed(() => `${this.grid.rowHeight()}px`);

  constructor() {
    effect(() => {
      this.grid.setGhostElement(this.ghostRef()?.nativeElement ?? null);
    });
  }
}
