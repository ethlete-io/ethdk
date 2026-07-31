import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { BRACKET_CARD_CONTEXT } from './bracket-card-context';
import { injectBracketLabels } from './bracket-labels';
import { BracketRound, BracketRoundSwissGroup } from './linked';

/**
 * The bracket's default column header: the round's name, its swiss group's name where there is one, and
 * how many matches it holds.
 *
 * It is a **real heading** (`role="heading"` with an `aria-level`), which is what turns a wall of
 * absolutely-positioned cells into something a screen reader can navigate by structure. The level comes
 * from the bracket's `roundHeaderLevel` — set that to sit correctly in your page's outline rather than
 * assuming this one is right.
 */
@Component({
  selector: 'et-bracket-default-round-header',
  template: `
    <span class="et-bracket-default-round-header-name">{{ bracketRound().name }}</span>

    @if (bracketRoundSwissGroup()?.name; as groupName) {
      <span class="et-bracket-default-round-header-group">{{ groupName }}</span>
    }

    <span class="et-bracket-default-round-header-count">{{ matchCountLabel() }}</span>
  `,
  styleUrl: './bracket-default-round-header.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-bracket-default-round-header-host',
    role: 'heading',
    '[attr.aria-level]': 'headingLevel()',
  },
})
export class BracketDefaultRoundHeaderComponent<TRoundData = unknown, TMatchData = unknown> {
  private cardContext = inject(BRACKET_CARD_CONTEXT, { optional: true });
  private labels = injectBracketLabels();

  public bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<TRoundData, TMatchData> | null>();

  protected headingLevel = computed(() => this.cardContext?.resolvedRoundHeaderLevel() ?? 3);

  protected matchCountLabel = computed(() => this.labels().roundMatchCount(this.bracketRound().matchCount));
}
