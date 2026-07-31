import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { ICON_IMPORTS, provideIcons, TROPHY_ICON } from '../icon';
import { injectMatchLabels, MATCH_CARD_IMPORTS, matchParticipantDisplayName } from '../match';
import { createNormalizedBracketMatch } from './bracket-card-context';
import { injectBracketLabels } from './bracket-labels';
import { BracketMatch, BracketRound, BracketRoundSwissGroup } from './linked';

/**
 * The bracket's default **final** cell — deliberately not the same card as every other round. The match
 * inside it is a full [`et-match-card`](/components/match), so it keeps the accessible name, the score
 * live region and the series breakdown; around it sit the things only a final gets: the round's name
 * under a trophy, an accent frame in the color theme in scope, and — once the match is decided — a
 * champion line naming the winner.
 *
 * The bracket's `finalColumnWidth` / `finalMatchHeight` defaults (360×200) are sized for exactly this;
 * shrink them and the card inside falls back to the dense row rather than cropping.
 *
 * Replace it with `finalMatchComponent` when your brand wants its own hero treatment — that is the
 * expected thing to do with this one.
 */
@Component({
  selector: 'et-bracket-default-final-match',
  template: `
    @if (normalizedMatch(); as match) {
      <div class="et-bracket-final-header">
        <i [etIcon]="TROPHY" class="et-bracket-final-trophy" aria-hidden="true"></i>
        <span class="et-bracket-final-round">{{ bracketRound().name }}</span>
      </div>

      <!-- No pinned size: the default final column is wide enough for the featured card, and a narrower
           one should land on the dense row rather than crop a card it can't fit. -->
      <et-match-card [match]="match" class="et-bracket-final-card" />

      <p class="et-bracket-final-champion">{{ championText() }}</p>
    }
  `,
  styleUrl: './bracket-default-final-match.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS, ICON_IMPORTS],
  providers: [provideIcons(TROPHY_ICON)],
  host: {
    class: 'et-bracket-final-host',
    '[attr.data-decided]': 'championName() ? "" : null',
  },
})
export class BracketDefaultFinalMatchComponent<TRoundData = unknown, TMatchData = unknown> {
  private bracketLabels = injectBracketLabels();
  private matchLabels = injectMatchLabels();

  public bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  public bracketMatch = input.required<BracketMatch<TRoundData, TMatchData>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<TRoundData, TMatchData> | null>();

  protected normalizedMatch = createNormalizedBracketMatch(this.bracketMatch);

  protected readonly TROPHY = TROPHY_ICON.name;

  /** The champion's display name, or `null` while the final is undecided or drawn. */
  protected championName = computed(() => {
    const match = this.normalizedMatch();
    const winnerSide = match?.winnerSide;

    if (!match || !winnerSide) return null;

    return matchParticipantDisplayName({
      participant: winnerSide === 'home' ? match.home : match.away,
      labels: this.matchLabels(),
    });
  });

  /**
   * The champion line, which says something either way: a final with no winner yet is the most looked-at
   * cell in the bracket, so leaving its space blank would just look broken.
   */
  protected championText = computed(() => {
    const championName = this.championName();
    const labels = this.bracketLabels();

    return championName ? labels.champion(championName) : labels.championPending;
  });
}
