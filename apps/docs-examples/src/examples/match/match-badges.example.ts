import { Component, ViewEncapsulation } from '@angular/core';
import { BADGE_IMPORTS, MATCH_CARD_IMPORTS, NormalizedMatch } from '@ethlete/components';
import { AWAY, HOME, KICK_OFF } from './match-outcome.data';

@Component({
  selector: 'app-match-badges-example',
  template: `
    <div [style.inline-size.px]="360">
      <et-match-card [match]="match">
        <et-badge etMatchCardBadge="Highlighted" size="sm">★</et-badge>
        <et-badge etMatchCardBadge="Video on demand" size="sm" variant="outline">VOD</et-badge>
      </et-match-card>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS, BADGE_IMPORTS],
})
export class MatchBadgesExampleComponent {
  public match: NormalizedMatch = {
    id: 'm-1',
    status: 'finished',
    startTime: KICK_OFF,
    home: HOME,
    away: AWAY,
    homeScore: 3,
    awayScore: 1,
    resultKind: 'score',
    gameScores: null,
    winnerSide: 'home',
    label: 'Quarter-final 2',
  };
}
