import { Component, computed, ViewEncapsulation, viewChild } from '@angular/core';
import { GridItemComponent } from '../../grid-item.component';
import { GridComponent } from '../../grid.component';
import { GridBreakpointConfig, GridItemConfig, GridItemConstraintsConfig } from '../../headless/grid.types';

type ConstraintWidget = {
  id: string;
  title: string;
  note: string;
  perBreakpoint: GridItemConstraintsConfig['perBreakpoint'];
};

const BREAKPOINTS: GridBreakpointConfig[] = [
  { name: 'lg', columns: 12, minWidth: 1200 },
  { name: 'md', columns: 6, minWidth: 768 },
  { name: 'sm', columns: 2, minWidth: 0 },
];

const WIDGETS: ConstraintWidget[] = [
  {
    id: 'chart',
    title: 'Chart',
    note: 'base 4-12 · md 3-6 · sm full width',
    perBreakpoint: { md: { minColSpan: 3, maxColSpan: 6 }, sm: { minColSpan: 2, maxColSpan: 2 } },
  },
  {
    id: 'list',
    title: 'List',
    note: 'base 2-12 · sm one column only',
    perBreakpoint: { sm: { maxColSpan: 1 } },
  },
  {
    id: 'note',
    title: 'Note',
    note: 'base 2-12 · no override',
    perBreakpoint: undefined,
  },
];

const ITEMS: GridItemConfig[] = [
  {
    id: 'chart',
    type: 'demo',
    data: undefined,
    layout: {
      lg: { col: 0, row: 0, colSpan: 8, rowSpan: 2 },
      md: { col: 0, row: 0, colSpan: 6, rowSpan: 2 },
      sm: { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
    },
  },
  {
    id: 'list',
    type: 'demo',
    data: undefined,
    layout: {
      lg: { col: 8, row: 0, colSpan: 4, rowSpan: 2 },
      md: { col: 0, row: 2, colSpan: 3, rowSpan: 2 },
      sm: { col: 0, row: 2, colSpan: 2, rowSpan: 1 },
    },
  },
  {
    id: 'note',
    type: 'demo',
    data: undefined,
    layout: {
      lg: { col: 0, row: 2, colSpan: 4, rowSpan: 1 },
      md: { col: 3, row: 2, colSpan: 3, rowSpan: 2 },
      sm: { col: 0, row: 3, colSpan: 2, rowSpan: 1 },
    },
  },
];

@Component({
  selector: 'et-sb-grid-constraints',
  template: `
    <div class="flex flex-col gap-4">
      <p class="text-small" style="color: rgb(var(--et-surface-color-muted))">
        Active breakpoint: <strong>{{ activeBreakpoint() }}</strong> · resize the viewport to cross 1200px and 768px.
        Every row below reads the bounds the grid resolved for that item at the active breakpoint.
      </p>

      <et-grid [breakpoints]="BREAKPOINTS" [rowHeight]="100" [gap]="16" [items]="ITEMS">
        @for (widget of WIDGETS; track widget.id) {
          <et-grid-item
            [itemId]="widget.id"
            [ariaLabel]="widget.title"
            [minColSpan]="widget.id === 'chart' ? 4 : 2"
            [maxColSpan]="12"
            [minRowSpan]="1"
            [maxRowSpan]="4"
            [perBreakpointConstraints]="widget.perBreakpoint"
          >
            <div class="flex flex-col justify-center gap-1 h-full p-3 box-border">
              <span class="text-base" style="color: rgb(var(--et-surface-color))">{{ widget.title }}</span>
              <span class="text-small" style="color: rgb(var(--et-surface-color-muted))">{{ widget.note }}</span>
            </div>
          </et-grid-item>
        }
      </et-grid>

      <table class="text-small border-collapse" style="border: 1px solid rgb(var(--et-surface-border))">
        <thead>
          <tr style="background: rgb(var(--et-surface-border))">
            <th class="px-2 py-1 text-left">item</th>
            <th class="px-2 py-1 text-left">colSpan bounds here</th>
            <th class="px-2 py-1 text-left">current colSpan</th>
            <th class="px-2 py-1 text-left">resizable</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr style="border-top: 1px solid rgb(var(--et-surface-border))">
              <td class="px-2 py-1">{{ row.id }}</td>
              <td class="px-2 py-1">{{ row.bounds }}</td>
              <td class="px-2 py-1">{{ row.colSpan }}</td>
              <td class="px-2 py-1">{{ row.resizable }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [GridComponent, GridItemComponent],
})
export class GridConstraintsStorybookComponent {
  public gridRef = viewChild(GridComponent);

  public readonly BREAKPOINTS = BREAKPOINTS;
  public readonly WIDGETS = WIDGETS;
  public readonly ITEMS = ITEMS;

  protected activeBreakpoint = computed(() => this.gridRef()?.grid.activeBreakpoint() ?? '…');

  protected rows = computed(() => {
    const grid = this.gridRef()?.grid;
    const layout = grid?.layout() ?? [];

    return WIDGETS.map((widget) => {
      const constraints = grid?.getConstraints(widget.id);
      const position = layout.find((entry) => entry.id === widget.id)?.position;

      return {
        id: widget.id,
        bounds: constraints ? `${constraints.minColSpan} - ${constraints.maxColSpan}` : '…',
        colSpan: position?.colSpan ?? '…',
        resizable: constraints && constraints.maxColSpan > constraints.minColSpan ? 'yes' : 'no',
      };
    });
  });
}
