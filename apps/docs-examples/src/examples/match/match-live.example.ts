import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, MATCH_CARD_IMPORTS, MatchScoreChange, NormalizedMatch } from '@ethlete/components';
import { AWAY, HOME, KICK_OFF } from './match-live.data';

@Component({
  selector: 'app-match-live-example',
  template: `
    <div [style.inline-size.px]="360">
      <et-match-card [match]="match()" (scoreChange)="lastChange.set($event)" />
    </div>

    <div class="app-example-row">
      <button (click)="addGoal('home')" et-button size="xs" variant="transparent">Goal for {{ home.name }}</button>
      <button (click)="addGoal('away')" et-button size="xs" variant="transparent">Goal for {{ away.name }}</button>
    </div>

    @if (lastChange(); as change) {
      <p>Last scoreChange: {{ change.side }} {{ change.from }} → {{ change.to }} (delta {{ change.delta }})</p>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS, BUTTON_IMPORTS],
})
export class MatchLiveExampleComponent {
  protected home = HOME;
  protected away = AWAY;

  protected lastChange = signal<MatchScoreChange | null>(null);

  private goals = signal({ home: 1, away: 1 });

  protected match = computed<NormalizedMatch>(() => ({
    id: 'm-1',
    status: 'live',
    startTime: KICK_OFF,
    home: HOME,
    away: AWAY,
    homeScore: this.goals().home,
    awayScore: this.goals().away,
    resultKind: 'score',
    gameScores: null,
    winnerSide: null,
    label: 'Quarter-final 2',
  }));

  protected addGoal(side: 'home' | 'away') {
    this.goals.update((goals) => ({ ...goals, [side]: goals[side] + 1 }));
  }
}
