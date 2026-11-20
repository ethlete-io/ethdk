import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '../../button';
import { MatchParticipantComponent } from '../match-participant.component';
import { MatchScorelineComponent } from '../match-scoreline.component';
import { NormalizedMatchParticipant } from '../match.types';

@Component({
  selector: 'et-sb-match-editor',
  template: `
    <div
      class="grid max-w-2xl grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-lg p-3"
      style="background: var(--et-surface-background-solid)"
    >
      <et-match-participant [participant]="HOME">
        <button class="w-full min-w-0" etMatchParticipantEdit et-button type="button" variant="outlined">
          Change home
        </button>
      </et-match-participant>

      <et-match-scoreline [homeScore]="null" [awayScore]="null" time="18:30" />

      <et-match-participant [participant]="null">
        <button class="w-full min-w-0" etMatchParticipantEdit et-button type="button" variant="outlined">
          Select away team
        </button>
      </et-match-participant>
    </div>

    <div class="mt-4 max-w-2xl">
      <et-match-participant [participant]="HOME">
        <button class="w-full min-w-0" etMatchParticipantEdit="beside" et-button type="button" variant="outlined">
          Edit
        </button>
      </et-match-participant>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MatchParticipantComponent, MatchScorelineComponent, BUTTON_IMPORTS],
})
export class MatchEditorStorybookComponent {
  protected readonly HOME: NormalizedMatchParticipant = {
    id: 'fcb',
    name: 'FC Berlin',
    code: 'FCB',
    subtitle: null,
    emblem: null,
    seed: null,
  };
}
