import { Directive, inject } from '@angular/core';
import { BRACKET_MATCH_ID_TOKEN, BRACKET_TOKEN } from '../../constants';

@Directive({
  standalone: true,
})
export class BracketMatchDirective {
  matchId = inject(BRACKET_MATCH_ID_TOKEN);
  bracket = inject(BRACKET_TOKEN);

  match$ = this.bracket.getBracketMatchById(this.matchId);
}
