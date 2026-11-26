import { Component, ViewEncapsulation } from '@angular/core';
import { STANDINGS_IMPORTS } from '@ethlete/components';
import { STANDINGS_ROWS, STANDINGS_ZONES } from './standings-compact.data';

@Component({
  selector: 'app-standings-compact-example',
  template: `
    <div [style.inline-size.px]="340" [style.max-inline-size]="'100%'">
      <et-standings [rows]="rows" [zones]="zones" highlightedRowId="neo" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STANDINGS_IMPORTS],
})
export class StandingsCompactExampleComponent {
  public rows = STANDINGS_ROWS;
  public zones = STANDINGS_ZONES;
}
