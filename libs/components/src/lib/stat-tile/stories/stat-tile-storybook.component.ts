import { booleanAttribute, Component, input, ViewEncapsulation } from '@angular/core';
import { CARD_IMPORTS } from '../../card';
import { StatTileGoodDirection } from '../stat-tile.types';
import { STAT_TILE_IMPORTS } from '../stat-tile.imports';

const WEEKLY_USERS = [182, 176, 190, 201, 195, 210, 224, 218, 231, 240, 236, 252];

@Component({
  selector: 'et-sb-stat-tile',
  template: `
    <div [style.inline-size.px]="280" class="p-8 font-sans">
      <et-card>
        <et-stat-tile
          [label]="label()"
          [value]="value()"
          [unit]="unit()"
          [delta]="delta()"
          [deltaFormat]="{ style: 'percent', maximumFractionDigits: 1 }"
          [goodDirection]="goodDirection()"
          [caption]="caption()"
          [loading]="loading()"
        >
          @if (sparkline()) {
            <et-stat-tile-sparkline [values]="TREND" />
          }
        </et-stat-tile>
      </et-card>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STAT_TILE_IMPORTS, CARD_IMPORTS],
})
export class StatTileStorybookComponent {
  public label = input('Weekly active users');
  public value = input<number | string | null>(25_240);
  public unit = input<string | null>(null);
  public delta = input<number | null>(0.068);
  public goodDirection = input<StatTileGoodDirection | null>('up');
  public caption = input<string | null>('vs last week');
  public loading = input(false, { transform: booleanAttribute });
  public sparkline = input(true, { transform: booleanAttribute });

  protected readonly TREND = WEEKLY_USERS;
}

@Component({
  selector: 'et-sb-stat-tile-row',
  template: `
    <div class="flex flex-col gap-6 p-8 font-sans">
      @for (surface of surfaces(); track surface) {
        <div [style.grid-template-columns]="'repeat(auto-fill, minmax(200px, 1fr))'" class="grid gap-4">
          <et-card [surface]="surface">
            <et-stat-tile
              [delta]="0.124"
              [deltaFormat]="{ style: 'percent', maximumFractionDigits: 1 }"
              [format]="{ style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }"
              [loading]="loading()"
              [value]="4210000"
              caption="vs last month"
              label="Revenue"
            >
              <et-stat-tile-sparkline [values]="REVENUE" />
            </et-stat-tile>
          </et-card>
          <et-card [surface]="surface">
            <et-stat-tile
              [delta]="18"
              [loading]="loading()"
              [value]="212"
              caption="vs last month"
              goodDirection="down"
              label="p95 latency"
              unit="ms"
            >
              <et-stat-tile-sparkline [values]="LATENCY" />
            </et-stat-tile>
          </et-card>
          <et-card [surface]="surface">
            <et-stat-tile
              [delta]="-0.021"
              [deltaFormat]="{ style: 'percent', maximumFractionDigits: 1 }"
              [loading]="loading()"
              [value]="0.034"
              [format]="{ style: 'percent', maximumFractionDigits: 1 }"
              caption="vs last month"
              goodDirection="down"
              label="Churn rate"
            />
          </et-card>
          <et-card [surface]="surface">
            <et-stat-tile
              [delta]="0"
              [loading]="loading()"
              [value]="1284"
              caption="vs last month"
              label="Open tickets"
            />
          </et-card>
          <et-card [surface]="surface">
            <et-stat-tile
              [delta]="-310"
              [goodDirection]="null"
              [loading]="loading()"
              [value]="12940"
              caption="vs last month"
              label="Page views"
            />
          </et-card>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STAT_TILE_IMPORTS, CARD_IMPORTS],
})
export class StatTileRowStorybookComponent {
  public surfaces = input<readonly string[]>(['dark']);
  public loading = input(false, { transform: booleanAttribute });

  protected readonly REVENUE = [3.1, 3.3, 3.2, 3.6, 3.5, 3.8, 3.7, 3.9, 4.0, 3.9, 4.1, 4.21];
  protected readonly LATENCY = [180, 185, 178, 190, 196, 188, 201, 199, 205, 210, 204, 212];
}
