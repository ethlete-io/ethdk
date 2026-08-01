import { Component, input, ViewEncapsulation } from '@angular/core';
import { MATCH_CARD_IMPORTS } from '../match';
import { createNormalizedBracketMatch } from './bracket-card-context';
import { BracketMatch, BracketRound, BracketRoundSwissGroup } from './linked';

/**
 * The bracket's default match cell: an [`et-match-card`](/components/match) at `compact`, which is the
 * density a bracket column has room for - two rows, short codes, the winner emphasized.
 *
 * It reads your match through the registered `matchNormalizer`, so the bracket engine stays ignorant of
 * your API's shape. No normalizer, no card: dev mode throws
 * [`ET3412`](/components/error-codes#bracket-et34xx) naming the provider to add.
 *
 * **Not a link.** The bracket can't know your routes, and this card won't guess: to make cells navigate,
 * pass a `matchComponent` of your own that wraps `et-match-card` on an `<a>`. It is four lines, and the
 * guide has them.
 */
@Component({
  selector: 'et-bracket-default-match',
  template: `
    @if (normalizedMatch(); as match) {
      <et-match-card [match]="match" class="et-bracket-default-match-card" size="compact" />
    }
  `,
  styleUrl: './bracket-default-match.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS],
  host: {
    class: 'et-bracket-default-match-host',
  },
})
export class BracketDefaultMatchComponent<TRoundData = unknown, TMatchData = unknown> {
  public bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  public bracketMatch = input.required<BracketMatch<TRoundData, TMatchData>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<TRoundData, TMatchData> | null>();

  protected normalizedMatch = createNormalizedBracketMatch(this.bracketMatch);
}
