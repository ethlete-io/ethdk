import { Directive, inject } from '@angular/core';
import { BRACKET_ROUND_ID_TOKEN, BRACKET_TOKEN } from '../../constants';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({})
export class BracketRoundDirective {
  roundId = inject(BRACKET_ROUND_ID_TOKEN);
  bracket = inject(BRACKET_TOKEN);

  round$ = this.bracket.getBracketRoundById(this.roundId);
}
