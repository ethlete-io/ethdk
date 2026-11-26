import { Component, ViewEncapsulation } from '@angular/core';
import { MATCH_CARD_IMPORTS, NormalizedMatch } from '@ethlete/components';
import { AWAY, HOME, KICK_OFF } from './match-outcome.data';

@Component({
  selector: 'app-match-loading-cancelled-example',
  template: `
    <div [style.inline-size.px]="360" [style.display]="'grid'" [style.gap.px]="12">
      <et-match-card [match]="null" loading />
      <et-match-card [match]="cancelled" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS],
})
export class MatchLoadingCancelledExampleComponent {
  public cancelled: NormalizedMatch = {
    id: 'm-2',
    status: 'cancelled',
    startTime: KICK_OFF,
    home: { ...HOME, country: { code: 'DE', name: 'Germany', flag: null } },
    away: { ...AWAY, country: { code: 'NL', name: 'Netherlands', flag: null } },
    homeScore: null,
    awayScore: null,
    resultKind: 'score',
    gameScores: null,
    winnerSide: null,
    label: 'Quarter-final 3',
  };
}
