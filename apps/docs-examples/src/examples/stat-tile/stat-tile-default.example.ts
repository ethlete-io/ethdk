import { Component, ViewEncapsulation } from '@angular/core';
import { CARD_IMPORTS, STAT_TILE_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-stat-tile-default-example',
  template: `
    <div [style.inline-size.px]="280">
      <et-card>
        <et-stat-tile
          [value]="25240"
          [delta]="0.068"
          [deltaFormat]="{ style: 'percent', maximumFractionDigits: 1 }"
          caption="vs last week"
          label="Weekly active users"
        >
          <et-stat-tile-sparkline [values]="weeklyUsers" />
        </et-stat-tile>
      </et-card>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STAT_TILE_IMPORTS, CARD_IMPORTS],
})
export class StatTileDefaultExampleComponent {
  public weeklyUsers = [182, 176, 190, 201, 195, 210, 224, 218, 231, 240, 236, 252];
}
