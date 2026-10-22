import { Component, ViewEncapsulation } from '@angular/core';
import { MATCH_CARD_IMPORTS, NormalizedMatch } from '@ethlete/components';
import { AWAY, HOME, KICK_OFF } from './match-default.data';

@Component({
  selector: 'app-match-default-example',
  template: `
    <div [style.inline-size.px]="360">
      <et-match-card [match]="match" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS],
})
export class MatchDefaultExampleComponent {
  public match: NormalizedMatch = {
    id: 'm-1',
    status: 'finished',
    startTime: KICK_OFF,
    home: HOME,
    away: AWAY,
    homeScore: 2,
    awayScore: 1,
    resultKind: 'score',
    gameScores: null,
    winnerSide: 'home',
    label: 'Quarter-final 2',
  };
}
