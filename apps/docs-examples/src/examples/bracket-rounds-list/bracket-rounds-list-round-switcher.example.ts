import { Component, signal, ViewEncapsulation } from '@angular/core';
import {
  BRACKET_DEFAULT_CARDS,
  BRACKET_ROUNDS_LIST_IMPORTS,
  BUTTON_IMPORTS,
  provideBracketConfig,
  singleEliminationBracketLayout,
} from '@ethlete/components';
import { normalizeMatch, SOURCE } from './bracket-rounds-list-round-switcher.data';

@Component({
  selector: 'app-bracket-rounds-list-round-switcher-example',
  template: `
    <div [style.max-inline-size.px]="420">
      <div class="app-example-row">
        <button
          [variant]="roundId() ? 'outline' : 'filled'"
          (click)="roundId.set(null)"
          et-button
          size="sm"
          type="button"
        >
          All rounds
        </button>

        @for (round of source.rounds; track round.id) {
          <button
            [variant]="roundId() === round.id ? 'filled' : 'outline'"
            (click)="roundId.set(round.id)"
            et-button
            size="sm"
            type="button"
          >
            {{ round.name }}
          </button>
        }
      </div>

      <et-bracket-rounds-list [source]="source" [selectedRoundId]="roundId()" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BRACKET_ROUNDS_LIST_IMPORTS, BUTTON_IMPORTS],
  providers: [
    provideBracketConfig({
      layouts: [singleEliminationBracketLayout()],
      ...BRACKET_DEFAULT_CARDS,
      matchNormalizer: normalizeMatch,
    }),
  ],
})
export class BracketRoundsListRoundSwitcherExampleComponent {
  public source = SOURCE;
  protected roundId = signal<string | null>(null);
}
