import { Component, signal, ViewEncapsulation } from '@angular/core';
import { STANDINGS_PICK_IMPORTS } from '@ethlete/components';
import { PARTICIPANTS, STORED_PICKS } from './standings-pick-default.data';

@Component({
  selector: 'app-standings-pick-default-example',
  template: `
    <div [style.inline-size.px]="420" [style.max-inline-size]="'100%'">
      <et-standings-pick
        [(order)]="order"
        [participants]="participants"
        [storedPicks]="storedPicks"
        [advancingCount]="2"
      />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STANDINGS_PICK_IMPORTS],
})
export class StandingsPickDefaultExampleComponent {
  public participants = PARTICIPANTS;
  public storedPicks = STORED_PICKS;
  public order = signal<readonly string[] | null>(null);
}
