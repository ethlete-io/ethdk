import { Component, ViewEncapsulation } from '@angular/core';
import {
  BRACKET_DEFAULT_CARDS,
  BRACKET_IMPORTS,
  provideBracketConfig,
  SCROLLABLE_IMPORTS,
  SCROLLABLE_NAVIGATION_IMPORTS,
  doubleEliminationBracketLayout,
} from '@ethlete/components';
import { normalizeMatch, SOURCE } from './bracket-double-elimination.data';

@Component({
  selector: 'app-bracket-double-elimination-example',
  template: `
    <et-scrollable [etScrollableButtons]="{ sticky: true }">
      <et-bracket [source]="source" [columnWidth]="250" />
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BRACKET_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS],
  providers: [
    provideBracketConfig({
      layouts: [doubleEliminationBracketLayout()],
      ...BRACKET_DEFAULT_CARDS,
      matchNormalizer: normalizeMatch,
    }),
  ],
})
export class BracketDoubleEliminationExampleComponent {
  public source = SOURCE;
}
