import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, ViewEncapsulation } from '@angular/core';
import { injectLocale } from '@ethlete/core';
import { GridItemDefaultActionsComponent } from './grid-item-default-actions.component';
import { GridItemComponent } from './grid-item.component';
import { injectGridConfig } from './headless/grid-config';
import { GridDirective } from './headless/grid.directive';
import { positionToPixelRect } from './headless/internals';

@Component({
  selector: 'et-grid, [et-grid]',
  template: `
    @if (grid.isReady()) {
      @for (entry of registeredItems(); track entry.item.id) {
        <et-grid-item
          [itemId]="entry.item.id"
          [minColSpan]="entry.reg.constraints?.minColSpan ?? 1"
          [maxColSpan]="entry.reg.constraints?.maxColSpan ?? 12"
          [minRowSpan]="entry.reg.constraints?.minRowSpan ?? 1"
          [maxRowSpan]="entry.reg.constraints?.maxRowSpan ?? 4"
        >
          <ng-container
            [ngComponentOutlet]="entry.reg.component"
            [ngComponentOutletInputs]="{ data: entry.item.data }"
          />
          @if (actionsComponent()) {
            <div etGridItemAction>
              <ng-container
                [ngComponentOutlet]="actionsComponent()!"
                [ngComponentOutletInputs]="{ data: entry.item.data, itemId: entry.item.id }"
              />
            </div>
          }
        </et-grid-item>
      }
      @if (ghostRect(); as ghost) {
        <div
          [style.translate]="ghost.x + 'px ' + ghost.y + 'px'"
          [style.width.px]="ghost.width"
          [style.height.px]="ghost.height"
          [style.transition]="ghostTransition()"
          class="et-grid-ghost"
        ></div>
      }
    }
    <ng-content />
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
    '[class.et-grid--readonly]': 'grid.readOnly()',
    '[attr.aria-label]': 'ariaLabel()',
  },
  styles: `
    @property --et-grid-padding {
      syntax: '<length>';
      inherits: false;
      initial-value: 0px;
    }

    .et-grid {
      display: block;
      box-sizing: border-box;
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
      position: absolute;
      top: 0;
      left: 0;
      z-index: 0;
      border-radius: 8px;
      background: rgb(var(--et-surface-color, 23 23 23) / 0.08);
      border: 2px dashed rgb(var(--et-surface-color, 23 23 23) / 0.2);
      box-sizing: border-box;
      pointer-events: none;
    }

    .et-grid--readonly {
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
  private gridConfig = injectGridConfig();
  private locale = injectLocale();

  protected actionsComponent = computed(() => {
    const configured = this.gridConfig.actionsComponent;
    return configured === undefined ? GridItemDefaultActionsComponent : configured;
  });

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

  protected ghostRect = computed(() => {
    const position = this.grid.ghostPosition();
    return position ? positionToPixelRect(position, this.grid.geometry()) : null;
  });

  protected ghostTransition = computed(() =>
    this.grid.animationsEnabled()
      ? 'translate 200ms cubic-bezier(0.2, 0, 0, 1), width 200ms cubic-bezier(0.2, 0, 0, 1), height 200ms cubic-bezier(0.2, 0, 0, 1)'
      : 'none',
  );
}
