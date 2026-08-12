import { NgComponentOutlet } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  contentChildren,
  inject,
  input,
  output,
  ViewEncapsulation,
} from '@angular/core';
import { outputToObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import { RuntimeError } from '@ethlete/core';
import { injectGridLabels } from './grid-labels';
import { GRID_ERROR_CODES } from './grid-errors';
import { GridItemDefaultActionsComponent } from './grid-item-default-actions.component';
import { GridItemComponent } from './grid-item.component';
import { injectGridConfig } from './headless/grid-config';
import { GridItemDirective } from './headless/grid-item.directive';
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
   * The items to render - a live input reconciled on every change, see `GridDirective.items`. Typed
   * in the item payload, so `layoutChange` hands the same `TData` back instead of `unknown`.
   */
  public items = input<GridItemConfig<string, TData>[]>([]);

  /** Emitted after the layout changed on this side - see `GridDirective.layoutChange`. */
  public layoutChange = output<GridSerializedState<TData>>();

  // Only the items a consumer writes themselves: the ones stamped from a registration live in this
  // component's own view, which a content query never reaches. The two dev checks below depend on
  // that split.
  private projectedItems = contentChildren(GridItemDirective, { descendants: true });

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
    return this.grid.currentItems().flatMap((item) => {
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
    this.grid.hostItems.set(this.items);

    outputToObservable(this.grid.layoutChange)
      .pipe(
        tap((state) => this.layoutChange.emit(state)),
        takeUntilDestroyed(),
      )
      .subscribe();

    if (ngDevMode) {
      // After render, not during: a projected item's required itemId is only readable once the
      // consumer's bindings have run.
      afterRenderEffect(() => {
        const items = this.grid.currentItems();

        if (items.length === 0) return;

        const registrations = this.gridConfig.registrations;
        const projectedIds = new Set(this.projectedItems().map((item) => item.itemId()));
        const doubledIds = this.registeredItems()
          .map((entry) => entry.item.id)
          .filter((id) => projectedIds.has(id));

        if (doubledIds.length > 0) {
          throw new RuntimeError(
            GRID_ERROR_CODES.DUPLICATE_ITEM_RENDER,
            `[GridComponent] Grid item(s) ${doubledIds
              .map((id) => `"${id}"`)
              .join(
                ', ',
              )} are rendered twice: their type has a provideGridConfig() registration and a projected <et-grid-item> also covers them. Each item must be rendered by exactly one of the two - project only the items whose type is unregistered.`,
            doubledIds,
          );
        }

        const unrenderedItems = items.filter(
          (item) => !projectedIds.has(item.id) && !registrations.some((r) => r.type === item.type),
        );

        if (unrenderedItems.length > 0) {
          const unknownTypes = [...new Set(unrenderedItems.map((item) => item.type))];
          const registered = registrations.length ? registrations.map((r) => `"${r.type}"`).join(', ') : 'none';

          throw new RuntimeError(
            GRID_ERROR_CODES.UNKNOWN_ITEM_TYPE,
            `[GridComponent] Nothing renders grid item type(s) ${unknownTypes
              .map((type) => `"${type}"`)
              .join(
                ', ',
              )}. Registered types: ${registered}. Register the type via provideGridConfig(), or project an <et-grid-item [itemId]> for each of those items.`,
            unknownTypes,
          );
        }
      });
    }
  }
}
