import { Component, ViewEncapsulation } from '@angular/core';
import { STANDINGS_IMPORTS } from '@ethlete/components';
import { STANDINGS_ROWS, STANDINGS_ZONES } from './standings-default.data';

@Component({
  selector: 'app-standings-default-example',
  template: `
    <div [style.inline-size.px]="760" [style.max-inline-size]="'100%'">
      <et-standings [rows]="rows" [zones]="zones" highlightedRowId="neo" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STANDINGS_IMPORTS],
})
export class StandingsDefaultExampleComponent {
  public rows = STANDINGS_ROWS;
  public zones = STANDINGS_ZONES;
}
