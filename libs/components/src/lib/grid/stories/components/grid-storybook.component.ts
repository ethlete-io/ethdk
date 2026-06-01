import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { GridComponent } from '../../grid.component';
import { GridItemComponent } from '../../grid-item.component';
import { GridBreakpointConfig, GridItemConfig } from '../../headless/grid.types';
import { DummyChartComponent, DummyTableComponent, DummyTextComponent } from './dummy-components';

const INITIAL_ITEMS: GridItemConfig[] = [
  {
    id: 'chart-1',
    componentType: 'chart',
    layout: {
      lg: { col: 0, row: 0, colSpan: 4, rowSpan: 2 },
      md: { col: 0, row: 0, colSpan: 3, rowSpan: 2 },
      sm: { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
    },
    constraints: { minColSpan: 2, maxColSpan: 8, minRowSpan: 1, maxRowSpan: 4 },
  },
  {
    id: 'table-1',
    componentType: 'table',
    layout: {
      lg: { col: 4, row: 0, colSpan: 4, rowSpan: 2 },
      md: { col: 3, row: 0, colSpan: 3, rowSpan: 2 },
      sm: { col: 0, row: 2, colSpan: 2, rowSpan: 2 },
    },
    constraints: { minColSpan: 2, maxColSpan: 8, minRowSpan: 1, maxRowSpan: 4 },
  },
  {
    id: 'text-1',
    componentType: 'text',
    layout: {
      lg: { col: 8, row: 0, colSpan: 4, rowSpan: 1 },
      md: { col: 0, row: 2, colSpan: 3, rowSpan: 1 },
      sm: { col: 0, row: 4, colSpan: 2, rowSpan: 1 },
    },
    constraints: { minColSpan: 2, maxColSpan: 6, minRowSpan: 1, maxRowSpan: 3 },
  },
  {
    id: 'chart-2',
    componentType: 'chart',
    layout: {
      lg: { col: 8, row: 1, colSpan: 4, rowSpan: 2 },
      md: { col: 3, row: 2, colSpan: 3, rowSpan: 2 },
      sm: { col: 0, row: 5, colSpan: 2, rowSpan: 2 },
    },
    constraints: { minColSpan: 2, maxColSpan: 8, minRowSpan: 1, maxRowSpan: 4 },
  },
];

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
        [breakpoints]="breakpoints()"
        [rowHeight]="rowHeight()"
        [gap]="gap()"
        [initialItems]="gridItems()"
        (layoutChange)="onLayoutChange($event)"
      >
        @for (item of gridItems(); track item.id) {
          <et-grid-item
            [itemId]="item.id"
            [minColSpan]="item.constraints.minColSpan"
            [maxColSpan]="item.constraints.maxColSpan"
            [minRowSpan]="item.constraints.minRowSpan"
            [maxRowSpan]="item.constraints.maxRowSpan"
            [ariaLabel]="item.componentType + ' widget'"
          >
            <div
              class="text-xs uppercase tracking-wide"
              etGridItemDragHandle
              style="color: rgb(var(--et-surface-color-muted))"
            >
              ⠿ {{ item.componentType }}
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

            @switch (item.componentType) {
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
  public breakpoints = input<GridBreakpointConfig[]>([
    { name: 'lg', columns: 12, minWidth: 1200 },
    { name: 'md', columns: 6, minWidth: 768 },
    { name: 'sm', columns: 2, minWidth: 0 },
  ]);

  public gridItems = signal<GridItemConfig[]>(INITIAL_ITEMS);
  public exportedLayout = signal<string | null>(null);

  private nextId = INITIAL_ITEMS.length + 1;

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

  public onLayoutChange(_state: unknown) {
    // Could update the stored layout here
  }

  private addItem(type: string) {
    const id = `${type}-${this.nextId++}`;

    const item: GridItemConfig = {
      id,
      componentType: type,
      layout: {},
      constraints: {
        minColSpan: 2,
        maxColSpan: type === 'text' ? 6 : 8,
        minRowSpan: 1,
        maxRowSpan: type === 'text' ? 3 : 4,
      },
    };

    this.gridItems.update((items) => [...items, item]);
  }
}
