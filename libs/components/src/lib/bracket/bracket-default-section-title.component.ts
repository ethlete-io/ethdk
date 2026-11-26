import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { BracketGridSection } from '@ethlete/bracket';
import { BRACKET_CARD_CONTEXT } from './bracket-card-context';
import { bracketSectionLabel, injectBracketLabels } from './bracket-labels';

/**
 * The bracket's default section title: the localized name of the part of the bracket it heads, one heading
 * level above the round headers.
 */
@Component({
  selector: 'et-bracket-default-section-title',
  template: `{{ name() }}`,
  styleUrl: './bracket-default-section-title.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-bracket-default-section-title-host',
    role: 'heading',
    '[attr.aria-level]': 'headingLevel()',
  },
})
export class BracketDefaultSectionTitleComponent<TRoundData = unknown, TMatchData = unknown> {
  private cardContext = inject(BRACKET_CARD_CONTEXT, { optional: true });
  private labels = injectBracketLabels();

  public bracketSection = input.required<BracketGridSection<TRoundData, TMatchData>>();

  protected headingLevel = computed(() => Math.max(1, (this.cardContext?.resolvedRoundHeaderLevel() ?? 3) - 1));

  protected name = computed(() => bracketSectionLabel(this.bracketSection().key, this.labels()));
}
