import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, MATCH_CARD_IMPORTS } from '@ethlete/components';
import { HOME } from './match-outcome.data';

@Component({
  selector: 'app-match-edit-slot-example',
  template: `
    <div class="match-edit-row">
      <et-match-participant [participant]="home">
        <button etMatchParticipantEdit et-button type="button" variant="outline">Change home</button>
      </et-match-participant>

      <et-match-scoreline [homeScore]="null" [awayScore]="null" time="18:30" />

      <et-match-participant [participant]="null">
        <button etMatchParticipantEdit et-button type="button" variant="outline">Select away team</button>
      </et-match-participant>
    </div>

    <et-match-participant [participant]="home">
      <button etMatchParticipantEdit="beside" et-button type="button" variant="outline">Edit</button>
    </et-match-participant>

    <et-match-scoreline [homeScore]="2" [awayScore]="1" time="18:30" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS, BUTTON_IMPORTS],
  styles: `
    .match-edit-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 16px;
    }
  `,
})
export class MatchEditSlotExampleComponent {
  public home = HOME;
}
