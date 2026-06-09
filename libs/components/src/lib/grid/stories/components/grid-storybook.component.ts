import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  booleanAttribute,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { GridComponent } from '../../grid.component';
import { GridItemComponent } from '../../grid-item.component';
import { GridBreakpointConfig, GridItemConfig } from '../../headless/grid.types';
import { DummyChartComponent, DummyTableComponent, DummyTextComponent } from './dummy-components';

const INITIAL_ITEMS: GridItemConfig[] = [
  {
    id: 'chart-1',
    type: 'chart',
    version: 1,
    data: undefined,
    layout: {
      lg: { col: 0, row: 0, colSpan: 4, rowSpan: 2 },
      md: { col: 0, row: 0, colSpan: 3, rowSpan: 2 },
      sm: { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
    },
  },
  {
    id: 'table-1',
    type: 'table',
    version: 1,
    data: undefined,
    layout: {
      lg: { col: 4, row: 0, colSpan: 4, rowSpan: 2 },
      md: { col: 3, row: 0, colSpan: 3, rowSpan: 2 },
      sm: { col: 0, row: 2, colSpan: 2, rowSpan: 2 },
    },
  },
  {
    id: 'text-1',
    type: 'text',
    version: 1,
    data: undefined,
    layout: {
      lg: { col: 8, row: 0, colSpan: 4, rowSpan: 1 },
      md: { col: 0, row: 2, colSpan: 3, rowSpan: 1 },
      sm: { col: 0, row: 4, colSpan: 2, rowSpan: 1 },
    },
  },
  {
    id: 'chart-2',
    type: 'chart',
    version: 1,
    data: undefined,
    layout: {
      lg: { col: 8, row: 1, colSpan: 4, rowSpan: 2 },
      md: { col: 3, row: 2, colSpan: 3, rowSpan: 2 },
      sm: { col: 0, row: 5, colSpan: 2, rowSpan: 2 },
    },
  },
];

// Constraints live on the component level, not in the persisted data structure.
// Each type registers its own min/max spans via et-grid-item inputs.
const COMPONENT_CONSTRAINTS: Record<
  string,
  { minColSpan: number; maxColSpan: number; minRowSpan: number; maxRowSpan: number }
> = {
  chart: { minColSpan: 2, maxColSpan: 8, minRowSpan: 1, maxRowSpan: 4 },
  table: { minColSpan: 2, maxColSpan: 8, minRowSpan: 1, maxRowSpan: 4 },
  text: { minColSpan: 2, maxColSpan: 6, minRowSpan: 1, maxRowSpan: 3 },
};

const DEFAULT_COMPONENT_CONSTRAINTS = { minColSpan: 1, maxColSpan: 12, minRowSpan: 1, maxRowSpan: 4 };

@Component({
  selector: 'et-sb-grid',
  template: `
    <div class="p-4 font-sans" style="color: rgb(var(--et-surface-color))">
      <div class="flex gap-2 mb-4">
        <button
          (click)="addChart()"
          class="px-3 py-1.5 text-sm rounded cursor-pointer"
          style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
        >
          Add Chart
        </button>
        <button
          (click)="addTable()"
          class="px-3 py-1.5 text-sm rounded cursor-pointer"
          style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
        >
          Add Table
        </button>
        <button
          (click)="addText()"
          class="px-3 py-1.5 text-sm rounded cursor-pointer"
          style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
        >
          Add Text
        </button>
        <button
          (click)="exportLayout()"
          class="px-3 py-1.5 text-sm rounded cursor-pointer"
          style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
        >
          Export Layout
        </button>
      </div>

      <et-grid
        #gridRef
        [breakpoints]="breakpoints()"
        [rowHeight]="rowHeight()"
        [gap]="gap()"
        [initialItems]="gridItems()"
        [readOnly]="readOnly()"
        (layoutChange)="saveLayout($event)"
      >
        @for (item of gridItems(); track item.id) {
          @let c = getConstraints(item.type);
          @let status = gridRef.grid.getMigrationStatus(item.id);
          <et-grid-item
            [itemId]="item.id"
            [minColSpan]="c.minColSpan"
            [maxColSpan]="c.maxColSpan"
            [minRowSpan]="c.minRowSpan"
            [maxRowSpan]="c.maxRowSpan"
            [ariaLabel]="item.type + ' widget'"
          >
            <div
              class="text-xs uppercase tracking-wide"
              etGridItemDragHandle
              style="color: rgb(var(--et-surface-color-muted))"
            >
              ⠿ {{ item.type }}
            </div>

            <button
              (click)="removeItem(item.id)"
              class="size-5 flex items-center justify-center rounded text-xs cursor-pointer"
              etGridItemAction
              style="color: rgb(var(--et-surface-color-muted))"
              aria-label="Remove item"
            >
              ✕
            </button>

            @if (status.state === 'needs-intervention' || status.state === 'failed') {
              <div class="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
                <span style="font-size: 24px">⚠️</span>
                <div class="text-sm font-semibold" style="color: rgb(var(--et-surface-color))">
                  {{ status.state === 'failed' ? 'Component failed to load' : 'Manual update required' }}
                </div>
                <div class="text-xs" style="color: rgb(var(--et-surface-color-muted))">
                  {{ item.type }} v{{ item.version }}
                  @if (status.state === 'needs-intervention') {
                    → needs upgrade to v{{ status.toVersion }}
                  }
                </div>
              </div>
            } @else {
              @switch (item.type) {
                @case ('chart') {
                  <et-sb-dummy-chart />
                }
                @case ('table') {
                  <et-sb-dummy-table />
                }
                @case ('text') {
                  <et-sb-dummy-text />
                }
              }
            }
          </et-grid-item>
        }
      </et-grid>

      @if (exportedLayout()) {
        <pre
          class="mt-4 p-3 rounded text-[11px] overflow-auto max-h-[200px]"
          style="background: rgb(var(--et-surface-background)); border: 1px solid rgb(var(--et-surface-border)); color: rgb(var(--et-surface-color-muted))"
          >{{ exportedLayout() }}</pre
        >
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridComponent, GridItemComponent, DummyChartComponent, DummyTableComponent, DummyTextComponent],
})
export class GridStorybookComponent {
  public rowHeight = input(100);
  public gap = input(16);
  public readOnly = input(false, { transform: booleanAttribute });
  public breakpoints = input<GridBreakpointConfig[]>([
    { name: 'lg', columns: 12, minWidth: 1200 },
    { name: 'md', columns: 6, minWidth: 768 },
    { name: 'sm', columns: 2, minWidth: 0 },
  ]);

  public gridRef = viewChild.required<GridComponent>('gridRef');

  public gridItems = signal<GridItemConfig[]>(INITIAL_ITEMS);
  public exportedLayout = signal<string | null>(null);

  private nextId = INITIAL_ITEMS.length + 1;

  public getConstraints(type: string) {
    return COMPONENT_CONSTRAINTS[type] ?? DEFAULT_COMPONENT_CONSTRAINTS;
  }

  public addChart() {
    this.addItem('chart');
  }

  public addTable() {
    this.addItem('table');
  }

  public addText() {
    this.addItem('text');
  }

  public removeItem(id: string) {
    this.gridItems.update((items) => items.filter((i) => i.id !== id));
  }

  public exportLayout() {
    this.exportedLayout.set(JSON.stringify(this.gridItems(), null, 2));
  }

  public saveLayout(_state: unknown) {
    // Could update the stored layout here
  }

  private addItem(type: string) {
    const id = `${type}-${this.nextId++}`;

    const item: GridItemConfig = {
      id,
      type,
      version: 1,
      data: undefined,
      layout: {},
    };

    this.gridItems.update((items) => [...items, item]);
  }
}
