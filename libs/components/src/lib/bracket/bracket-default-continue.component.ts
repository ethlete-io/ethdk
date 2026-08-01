import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { ARROW_RIGHT_ICON, ICON_IMPORTS, provideIcons } from '../icon';
import { injectBracketLabels } from './bracket-labels';
import { BracketMatch } from './linked';

/**
 * The bracket's default continue cell: the "and then?" at the end of a stage that feeds a later one
 * rather than crowning a winner. Says how many winners advance, and carries an accessible label of its
 * own - its visible text is a fragment, and a fragment is not a name.
 *
 * Only rendered when `showContinueElement` is on and the layout runs left to right.
 */
@Component({
  selector: 'et-bracket-default-continue',
  template: `
    <i [etIcon]="ARROW_RIGHT" class="et-bracket-default-continue-icon" aria-hidden="true"></i>

    <span class="et-bracket-default-continue-text" aria-hidden="true">{{ advanceText() }}</span>
  `,
  styleUrl: './bracket-default-continue.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ICON_IMPORTS],
  providers: [provideIcons(ARROW_RIGHT_ICON)],
  host: {
    class: 'et-bracket-default-continue-host',
    role: 'group',
    '[attr.aria-label]': 'accessibleName()',
  },
})
export class BracketDefaultContinueComponent<TRoundData = unknown, TMatchData = unknown> {
  private labels = injectBracketLabels();

  public bracketMatches = input.required<BracketMatch<TRoundData, TMatchData>[]>();

  protected readonly ARROW_RIGHT = ARROW_RIGHT_ICON.name;

  protected advanceText = computed(() => this.labels().winnersAdvance(this.bracketMatches().length));

  protected accessibleName = computed(() => this.labels().continueLabel(this.bracketMatches().length));
}
