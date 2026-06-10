import { booleanAttribute, ChangeDetectionStrategy, Component, input, signal, ViewEncapsulation } from '@angular/core';
import { GridItemComponent } from '../../grid-item.component';
import { GridComponent } from '../../grid.component';
import { GridItemConfig } from '../../headless/grid.types';
import { DummyChartComponent, DummyTableComponent, DummyTextComponent } from './dummy-components';

const DEMO_ITEMS: GridItemConfig[] = [
  {
    id: 'chart-1',
    type: 'chart',
    data: undefined,
    layout: {
      lg: { col: 0, row: 0, colSpan: 8, rowSpan: 2 },
      md: { col: 0, row: 0, colSpan: 6, rowSpan: 2 },
      sm: { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
    },
  },
  {
    id: 'table-1',
    type: 'table',
    data: undefined,
    layout: {
      lg: { col: 8, row: 0, colSpan: 4, rowSpan: 2 },
      md: { col: 0, row: 2, colSpan: 6, rowSpan: 2 },
      sm: { col: 0, row: 2, colSpan: 2, rowSpan: 2 },
    },
  },
  {
    id: 'text-1',
    type: 'text',
    data: undefined,
    layout: {
      lg: { col: 0, row: 2, colSpan: 5, rowSpan: 2 },
      md: { col: 0, row: 4, colSpan: 6, rowSpan: 2 },
      sm: { col: 0, row: 4, colSpan: 2, rowSpan: 2 },
    },
  },
  {
    id: 'chart-2',
    type: 'chart',
    data: undefined,
    layout: {
      lg: { col: 5, row: 2, colSpan: 7, rowSpan: 2 },
      md: { col: 0, row: 6, colSpan: 6, rowSpan: 2 },
      sm: { col: 0, row: 6, colSpan: 2, rowSpan: 2 },
    },
  },
];

const CONSTRAINTS: Record<string, { minColSpan: number; maxColSpan: number; minRowSpan: number; maxRowSpan: number }> =
  {
    chart: { minColSpan: 3, maxColSpan: 12, minRowSpan: 2, maxRowSpan: 4 },
    table: { minColSpan: 2, maxColSpan: 12, minRowSpan: 2, maxRowSpan: 4 },
    text: { minColSpan: 2, maxColSpan: 12, minRowSpan: 1, maxRowSpan: 4 },
  };

const DEFAULT_CONSTRAINTS = { minColSpan: 1, maxColSpan: 12, minRowSpan: 1, maxRowSpan: 4 };

@Component({
  selector: 'et-sb-grid',
  template: `
    <et-grid
      [breakpoints]="breakpoints()"
      [rowHeight]="rowHeight()"
      [gap]="gap()"
      [readOnly]="readOnly()"
      [initialItems]="items()"
    >
      @for (item of items(); track item.id) {
        @let c = getConstraints(item.type);
        <et-grid-item
          [itemId]="item.id"
          [minColSpan]="c.minColSpan"
          [maxColSpan]="c.maxColSpan"
          [minRowSpan]="c.minRowSpan"
          [maxRowSpan]="c.maxRowSpan"
          [ariaLabel]="item.type + ' widget'"
        >
          <div
            class="text-[11px] uppercase tracking-wide"
            etGridItemDragHandle
            style="color: rgb(var(--et-surface-color-muted))"
          >
            ⠿ {{ item.type }}
          </div>

          <div etGridItemAction>
            <button
              (click)="removeItem(item.id)"
              class="size-5 flex items-center justify-center rounded text-xs cursor-pointer"
              style="color: rgb(var(--et-surface-color-muted))"
              aria-label="Remove widget"
            >
              ✕
            </button>
          </div>

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
        </et-grid-item>
      }
    </et-grid>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridComponent, GridItemComponent, DummyChartComponent, DummyTableComponent, DummyTextComponent],
})
export class GridStorybookComponent {
  public rowHeight = input(100);
  public gap = input(16);
  public readOnly = input(false, { transform: booleanAttribute });
  public breakpoints = input([
    { name: 'lg', columns: 12, minWidth: 1200 },
    { name: 'md', columns: 6, minWidth: 768 },
    { name: 'sm', columns: 2, minWidth: 0 },
  ]);

  public items = signal<GridItemConfig[]>(DEMO_ITEMS);

  public getConstraints(type: string) {
    return CONSTRAINTS[type] ?? DEFAULT_CONSTRAINTS;
  }

  public removeItem(id: string) {
    this.items.update((items) => items.filter((i) => i.id !== id));
  }
}
