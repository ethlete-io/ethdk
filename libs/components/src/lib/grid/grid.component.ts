import { NgComponentOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, output, ViewEncapsulation } from '@angular/core';
import { outputToObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import { RuntimeError } from '@ethlete/core';
import { injectGridLabels } from './grid-labels';
import { GRID_ERROR_CODES } from './grid-errors';
import { GridItemDefaultActionsComponent } from './grid-item-default-actions.component';
import { GridItemComponent } from './grid-item.component';
import { injectGridConfig } from './headless/grid-config';
import { GridDirective } from './headless/grid.directive';
import { GridItemConfig, GridSerializedState } from './headless/grid.types';
import { positionToPixelRect } from './headless/internals';

@Component({
  selector: 'et-grid, [et-grid]',
  template: `
    @if (grid.isReady()) {
      @for (entry of registeredItems(); track entry.item.id) {
        <!-- The registration's constraints reach the item through the grid's own resolver, so
             nothing is forwarded here - and an et-grid-item a consumer writes themselves can
             refine one bound without resetting the rest. -->
        <et-grid-item [itemId]="entry.item.id">
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
  imports: [GridItemComponent, NgComponentOutlet],
  hostDirectives: [
    {
      directive: GridDirective,
      inputs: ['breakpoints', 'rowHeight', 'gap', 'readOnly'],
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
export class GridComponent<TData = unknown> {
  private gridConfig = injectGridConfig();
  private labels = injectGridLabels();

  /**
   * The items to render. Despite the name this is a live input, not a one-shot seed - see
   * `GridDirective.initialItems`. Typed in the item payload, so `layoutChange` hands the same
   * `TData` back instead of `unknown`.
   */
  public initialItems = input<GridItemConfig<string, TData>[]>([]);

  /** Emitted after the layout changed on this side - see `GridDirective.layoutChange`. */
  public layoutChange = output<GridSerializedState<TData>>();

  // The one seam where the item type is re-attached: a host directive cannot be parameterized by its
  // component's generic, so the component owns the typed input/output pair above and hands them to
  // the directive, which is the same instance - only with `TData` spelled out.
  public grid = inject(GridDirective) as GridDirective<TData>;

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
    const labels = this.labels();

    return this.grid.readOnly() ? labels.readonlyGrid : labels.interactiveGrid;
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

  constructor() {
    this.grid.hostItems.set(this.initialItems);

    outputToObservable(this.grid.layoutChange)
      .pipe(
        tap((state) => this.layoutChange.emit(state)),
        takeUntilDestroyed(),
      )
      .subscribe();

    if (ngDevMode) {
      effect(() => {
        const items = this.grid.items();

        if (items.length === 0) return;

        const registrations = this.gridConfig.registrations;
        const unknownTypes = [
          ...new Set(items.filter((item) => !registrations.some((r) => r.type === item.type)).map((item) => item.type)),
        ];

        if (unknownTypes.length > 0) {
          const registered = registrations.length ? registrations.map((r) => `"${r.type}"`).join(', ') : 'none';

          throw new RuntimeError(
            GRID_ERROR_CODES.UNKNOWN_ITEM_TYPE,
            `[GridComponent] No component is registered for grid item type(s) ${unknownTypes
              .map((type) => `"${type}"`)
              .join(', ')}. Registered types: ${registered}. Register it via provideGridConfig().`,
            unknownTypes,
          );
        }
      });
    }
  }
}
