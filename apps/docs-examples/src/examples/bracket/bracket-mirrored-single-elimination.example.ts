import { Component, ViewEncapsulation } from '@angular/core';
import {
  BRACKET_DEFAULT_CARDS,
  BRACKET_IMPORTS,
  provideBracketConfig,
  SCROLLABLE_IMPORTS,
  SCROLLABLE_NAVIGATION_IMPORTS,
  mirroredSingleEliminationBracketLayout,
} from '@ethlete/components';
import { normalizeMatch, SOURCE } from './bracket-mirrored-single-elimination.data';

@Component({
  selector: 'app-bracket-mirrored-single-elimination-example',
  template: `
    <et-scrollable [etScrollableButtons]="{ sticky: true }">
      <et-bracket [source]="source" [columnWidth]="250" />
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BRACKET_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS],
  providers: [
    provideBracketConfig({
      layouts: [mirroredSingleEliminationBracketLayout()],
      ...BRACKET_DEFAULT_CARDS,
      matchNormalizer: normalizeMatch,
    }),
  ],
})
export class BracketMirroredSingleEliminationExampleComponent {
  public source = SOURCE;
}
