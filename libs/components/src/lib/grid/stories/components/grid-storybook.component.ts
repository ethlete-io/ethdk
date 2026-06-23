import { booleanAttribute, ChangeDetectionStrategy, Component, input, signal, ViewEncapsulation } from '@angular/core';
import { GridComponent } from '../../grid.component';
import { GridBreakpointConfig, GridItemConfig } from '../../headless/grid.types';

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

@Component({
  selector: 'et-sb-grid',
  template: `
    <et-grid
      [breakpoints]="breakpoints()"
      [rowHeight]="rowHeight()"
      [gap]="gap()"
      [readOnly]="readOnly()"
      [initialItems]="items()"
    />
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridComponent],
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

  public items = signal<GridItemConfig[]>(DEMO_ITEMS);
}
