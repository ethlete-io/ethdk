import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { BracketRound, BracketRoundSwissGroup } from '@ethlete/bracket';
import { BRACKET_CARD_CONTEXT } from '../../bracket-card-context';
import { injectSwissToneThemes, swissRecordTone } from './swiss-tone-themes';

/**
 * The default round header of `swissBracketLayout()`: the round's name, a rule and the group's record, in the
 * record's tone - the app's success, warning or error theme, neutral for the opening record.
 */
@Component({
  selector: 'et-bracket-swiss-round-header',
  template: `
    <span
      [etProvideColor]="theme()"
      [attr.data-swiss-tone]="tone()"
      [attr.data-swiss-toned]="theme() ? '' : null"
      class="et-bracket-swiss-round-header"
    >
      <span class="et-bracket-swiss-round-header-name">{{ bracketRound().name }}</span>
      <span class="et-bracket-swiss-round-header-rule" aria-hidden="true"></span>
      @if (bracketRoundSwissGroup()?.name; as record) {
        <span class="et-bracket-swiss-round-header-record">{{ record }}</span>
      }
    </span>
  `,
  styleUrl: './bracket-swiss-round-header.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective],
  host: {
    class: 'et-bracket-swiss-round-header-host',
    role: 'heading',
    '[attr.aria-level]': 'headingLevel()',
  },
})
export class BracketSwissRoundHeaderComponent<TRoundData = unknown, TMatchData = unknown> {
  private cardContext = inject(BRACKET_CARD_CONTEXT, { optional: true });
  private toneThemes = injectSwissToneThemes();

  public bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<TRoundData, TMatchData> | null>();

  protected headingLevel = computed(() => this.cardContext?.resolvedRoundHeaderLevel() ?? 3);
  protected tone = computed(() => swissRecordTone(this.bracketRoundSwissGroup()?.id));
  protected theme = computed(() => this.toneThemes()[this.tone()]);
}
