import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { ChartTick } from './chart.types';

@Component({
  selector: 'g[et-chart-grid]',
  template: `
    @for (line of lines(); track line.value) {
      <svg:line
        [attr.x1]="line.x1"
        [attr.y1]="line.y1"
        [attr.x2]="line.x2"
        [attr.y2]="line.y2"
        [class.et-chart-baseline]="line.value === 0"
        class="et-chart-grid-line"
        shape-rendering="crispEdges"
      />
    }
  `,
  styleUrl: './chart-grid.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-chart-grid',
    'aria-hidden': 'true',
  },
})
export class ChartGridComponent {
  public ticks = input.required<readonly Pick<ChartTick, 'value' | 'position'>[]>();
  public direction = input<'horizontal' | 'vertical'>('horizontal');
  public length = input.required<number>();

  protected lines = computed(() => {
    const length = this.length();
    const horizontal = this.direction() === 'horizontal';

    return this.ticks().map(({ value, position }) =>
      horizontal
        ? { value, x1: 0, y1: position, x2: length, y2: position }
        : { value, x1: position, y1: 0, x2: position, y2: length },
    );
  });
}
