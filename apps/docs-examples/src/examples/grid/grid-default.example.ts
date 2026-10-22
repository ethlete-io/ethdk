import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { GRID_IMPORTS, GridBreakpointConfig, GridItemConfig, provideGridConfig } from '@ethlete/components';

type WidgetData = { title: string };

@Component({
  selector: 'app-grid-bars-widget',
  template: `
    <div class="example-grid-widget">
      <p class="example-grid-widget-title">{{ data().title }}</p>
      <div class="example-grid-bars">
        @for (bar of BARS; track $index) {
          <div [style.height.%]="bar" class="example-grid-bar"></div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class GridBarsWidgetComponent {
  public data = input.required<WidgetData>();

  protected readonly BARS = [65, 40, 80, 55, 90, 45, 70, 60, 85, 50];
}

@Component({
  selector: 'app-grid-text-widget',
  template: `
    <div class="example-grid-widget">
      <p class="example-grid-widget-title">{{ data().title }}</p>
      <p class="example-grid-widget-text">
        Drag an item by its body, resize it from a corner, or focus it and use the arrow keys.
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class GridTextWidgetComponent {
  public data = input.required<WidgetData>();
}

@Component({
  selector: 'app-grid-default-example',
  template: `<et-grid [breakpoints]="BREAKPOINTS" [items]="items()" [rowHeight]="100" [gap]="16" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [GRID_IMPORTS],
  providers: [
    ...provideGridConfig({
      registrations: [
        {
          type: 'chart',
          component: GridBarsWidgetComponent,
          constraints: { minColSpan: 3, maxColSpan: 12, minRowSpan: 2, maxRowSpan: 4 },
        },
        {
          type: 'text',
          component: GridTextWidgetComponent,
          constraints: { minColSpan: 2, maxColSpan: 12, minRowSpan: 1, maxRowSpan: 4 },
        },
      ],
    }),
  ],
  styles: `
    .example-grid-widget {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      block-size: 100%;
      padding: 12px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 8px;
      background: var(--et-surface-background-solid);
    }

    .example-grid-widget p {
      margin: 0;
    }

    .example-grid-widget-title {
      margin-block-end: 8px;
      font-weight: 600;
    }

    .example-grid-widget-text {
      color: var(--et-surface-color-muted-solid);
    }

    .example-grid-bars {
      display: flex;
      flex: 1;
      align-items: flex-end;
      gap: 3px;
      min-block-size: 0;
    }

    .example-grid-bar {
      flex: 1;
      min-block-size: 4px;
      border-radius: 2px 2px 0 0;
      background: var(--et-theme-color-primary-solid);
    }
  `,
})
export class GridDefaultExampleComponent {
  protected readonly BREAKPOINTS: GridBreakpointConfig[] = [
    { name: 'lg', columns: 12, minWidth: 1200 },
    { name: 'md', columns: 6, minWidth: 768 },
    { name: 'sm', columns: 2, minWidth: 0 },
  ];

  protected items = signal<GridItemConfig<string, WidgetData>[]>([
    {
      id: 'chart-1',
      type: 'chart',
      data: { title: 'Visits' },
      layout: {
        lg: { col: 0, row: 0, colSpan: 8, rowSpan: 2 },
        md: { col: 0, row: 0, colSpan: 6, rowSpan: 2 },
        sm: { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
      },
    },
    {
      id: 'text-1',
      type: 'text',
      data: { title: 'How it works' },
      layout: {
        lg: { col: 8, row: 0, colSpan: 4, rowSpan: 2 },
        md: { col: 0, row: 2, colSpan: 6, rowSpan: 2 },
        sm: { col: 0, row: 2, colSpan: 2, rowSpan: 2 },
      },
    },
    {
      id: 'chart-2',
      type: 'chart',
      data: { title: 'Orders' },
      layout: {
        lg: { col: 0, row: 2, colSpan: 7, rowSpan: 2 },
        md: { col: 0, row: 4, colSpan: 6, rowSpan: 2 },
        sm: { col: 0, row: 4, colSpan: 2, rowSpan: 2 },
      },
    },
  ]);
}
