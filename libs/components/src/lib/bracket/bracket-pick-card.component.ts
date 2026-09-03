import { booleanAttribute, Component, computed, input, output, ViewEncapsulation } from '@angular/core';
import { FocusRingDirective } from '../focus-ring';
import { MatchParticipantComponent, NormalizedMatch, resolveNormalizedMatchSideState } from '../match';
import { MatchParticipantSide } from './core';
import { BracketMatch } from './linked';

@Component({
  selector: 'et-bracket-pick-card',
  templateUrl: './bracket-pick-card.component.html',
  styleUrl: './bracket-pick-card.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [FocusRingDirective, MatchParticipantComponent],
  host: {
    class: 'et-bracket-pick-card',
    '[attr.data-locked]': 'locked() ? "" : null',
    '[attr.data-disabled]': 'disabled() ? "" : null',
  },
})
export class BracketPickCardComponent<TRoundData = unknown, TMatchData = unknown> {
  public bracketMatch = input.required<BracketMatch<TRoundData, TMatchData>>();
  public normalized = input.required<NormalizedMatch>();
  public pickedSide = input<MatchParticipantSide | null>(null);
  public locked = input(false, { transform: booleanAttribute });
  public disabled = input(false, { transform: booleanAttribute });
  public predictedLabel = input('Prediction');
  public unresolvableLabel = input('Choose earlier picks first');
  public unavailableLabel = input('Unavailable');

  public pick = output<MatchParticipantSide>();

  protected sides = computed(() => {
    const bracketMatch = this.bracketMatch();
    const normalized = this.normalized();
    const sideItems = (['home', 'away'] as const).map((side) => {
      const state = resolveNormalizedMatchSideState(normalized, side);
      const source = side === 'home' ? bracketMatch.homeSource : bracketMatch.awaySource;

      return { side, state, source, participant: normalized[side] };
    });
    const matchIsSelectable = sideItems.every(
      ({ participant, source, state }) =>
        participant !== null && (state === 'occupied' || state === 'predicted') && source?.kind !== 'bye',
    );

    return sideItems.map(({ side, state, source, participant }) => {
      return {
        side,
        state,
        participant,
        selected: this.pickedSide() === side,
        selectable: matchIsSelectable && !this.locked() && !this.disabled(),
        emptyLabel: source?.label ?? (state === 'unresolvable' ? this.unresolvableLabel() : this.unavailableLabel()),
      };
    });
  });
}
