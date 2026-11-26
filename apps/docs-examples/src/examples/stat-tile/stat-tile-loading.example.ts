import { Component, ViewEncapsulation } from '@angular/core';
import { CARD_IMPORTS, STAT_TILE_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-stat-tile-loading-example',
  template: `
    <div [style.inline-size.px]="280">
      <et-card>
        <et-stat-tile [value]="null" caption="vs last month" label="Revenue" loading>
          <et-stat-tile-sparkline [values]="revenue" />
        </et-stat-tile>
      </et-card>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STAT_TILE_IMPORTS, CARD_IMPORTS],
})
export class StatTileLoadingExampleComponent {
  public revenue = [3.1, 3.3, 3.2, 3.6, 3.5, 3.8, 3.7, 3.9, 4.0, 3.9, 4.1, 4.21];
}
