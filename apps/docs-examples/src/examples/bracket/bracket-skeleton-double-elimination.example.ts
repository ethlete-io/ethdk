import { Component, ViewEncapsulation } from '@angular/core';
import {
  BRACKET_DEFAULT_CARDS,
  BRACKET_SKELETON_IMPORTS,
  doubleEliminationBracketLayout,
  PlaceholderBracketShape,
  provideBracketConfig,
  SCROLLABLE_IMPORTS,
  SCROLLABLE_NAVIGATION_IMPORTS,
} from '@ethlete/components';

@Component({
  selector: 'app-bracket-skeleton-double-elimination-example',
  template: `
    <et-scrollable [etScrollableButtons]="{ sticky: true }">
      <et-bracket-skeleton [shape]="shape" [columnWidth]="250" />
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BRACKET_SKELETON_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS],
  providers: [provideBracketConfig({ layouts: [doubleEliminationBracketLayout()], ...BRACKET_DEFAULT_CARDS })],
})
export class BracketSkeletonDoubleEliminationExampleComponent {
  public shape: PlaceholderBracketShape = { mode: 'double-elimination', participantCount: 8, includeFinal: true };
}
