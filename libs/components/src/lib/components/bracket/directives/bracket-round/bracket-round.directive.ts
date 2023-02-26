import { Directive, inject } from '@angular/core';
import { BRACKET_ROUND_ID_TOKEN, BRACKET_TOKEN } from '../../constants';

@Directive({
  standalone: true,
})
export class BracketRoundDirective {
  roundId = inject(BRACKET_ROUND_ID_TOKEN);
  bracket = inject(BRACKET_TOKEN);

  round$ = this.bracket.getBracketRoundById(this.roundId);
}
