import { Component, ViewEncapsulation } from '@angular/core';
import {
  BRACKET_DEFAULT_CARDS,
  BRACKET_ROUNDS_LIST_IMPORTS,
  doubleEliminationBracketLayout,
  provideBracketConfig,
  singleEliminationBracketLayout,
} from '@ethlete/components';
import { normalizeMatch, SOURCE } from './bracket-rounds-list-double-elimination.data';

@Component({
  selector: 'app-bracket-rounds-list-double-elimination-example',
  template: `
    <div [style.max-inline-size.px]="420">
      <et-bracket-rounds-list [source]="source" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BRACKET_ROUNDS_LIST_IMPORTS],
  providers: [
    provideBracketConfig({
      layouts: [singleEliminationBracketLayout(), doubleEliminationBracketLayout()],
      ...BRACKET_DEFAULT_CARDS,
      matchNormalizer: normalizeMatch,
    }),
  ],
})
export class BracketRoundsListDoubleEliminationExampleComponent {
  public source = SOURCE;
}
