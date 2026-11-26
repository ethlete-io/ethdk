import { Component, ViewEncapsulation } from '@angular/core';
import { MATCH_CARD_IMPORTS, NormalizedMatch } from '@ethlete/components';
import { AWAY, HOME, KICK_OFF } from './match-outcome.data';

@Component({
  selector: 'app-match-outcome-example',
  template: `
    <div [style.inline-size.px]="360">
      <et-match-card [match]="match" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS],
})
export class MatchOutcomeExampleComponent {
  public match: NormalizedMatch = {
    id: 'm-1',
    status: 'finished',
    startTime: KICK_OFF,
    home: HOME,
    away: AWAY,
    homeScore: null,
    awayScore: null,
    resultKind: 'outcome',
    gameScores: null,
    winnerSide: 'home',
    label: 'Quarter-final 2',
  };
}
