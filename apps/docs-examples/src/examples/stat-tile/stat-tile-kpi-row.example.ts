import { Component, ViewEncapsulation } from '@angular/core';
import { CARD_IMPORTS, STAT_TILE_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-stat-tile-kpi-row-example',
  template: `
    <div
      [style.display]="'grid'"
      [style.gap.px]="16"
      [style.grid-template-columns]="'repeat(auto-fill, minmax(200px, 1fr))'"
    >
      <et-card>
        <et-stat-tile
          [delta]="0.124"
          [deltaFormat]="{ style: 'percent', maximumFractionDigits: 1 }"
          [format]="{ style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }"
          [value]="4210000"
          caption="vs last month"
          label="Revenue"
        >
          <et-stat-tile-sparkline [values]="revenue" />
        </et-stat-tile>
      </et-card>
      <et-card>
        <et-stat-tile
          [delta]="18"
          [value]="212"
          caption="vs last month"
          goodDirection="down"
          label="p95 latency"
          unit="ms"
        >
          <et-stat-tile-sparkline [values]="latency" />
        </et-stat-tile>
      </et-card>
      <et-card>
        <et-stat-tile
          [delta]="-0.021"
          [deltaFormat]="{ style: 'percent', maximumFractionDigits: 1 }"
          [format]="{ style: 'percent', maximumFractionDigits: 1 }"
          [value]="0.034"
          caption="vs last month"
          goodDirection="down"
          label="Churn rate"
        />
      </et-card>
      <et-card>
        <et-stat-tile [delta]="0" [value]="1284" caption="vs last month" label="Open tickets" />
      </et-card>
      <et-card>
        <et-stat-tile
          [delta]="-310"
          [goodDirection]="null"
          [value]="12940"
          caption="vs last month"
          label="Page views"
        />
      </et-card>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STAT_TILE_IMPORTS, CARD_IMPORTS],
})
export class StatTileKpiRowExampleComponent {
  public revenue = [3.1, 3.3, 3.2, 3.6, 3.5, 3.8, 3.7, 3.9, 4.0, 3.9, 4.1, 4.21];
  public latency = [180, 185, 178, 190, 196, 188, 201, 199, 205, 210, 204, 212];
}
