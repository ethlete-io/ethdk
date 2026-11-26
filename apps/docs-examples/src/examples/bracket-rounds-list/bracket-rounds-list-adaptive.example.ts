import { Component, computed, ViewEncapsulation } from '@angular/core';
import {
  BRACKET_DEFAULT_CARDS,
  BRACKET_IMPORTS,
  BRACKET_ROUNDS_LIST_IMPORTS,
  bracketFitsWidth,
  BracketConfig,
  provideBracketConfig,
  SCROLLABLE_IMPORTS,
  singleEliminationBracketLayout,
} from '@ethlete/components';
import { signalHostElementDimensions } from '@ethlete/core';
import { normalizeMatch, SOURCE } from './bracket-rounds-list-adaptive.data';

@Component({
  selector: 'app-bracket-rounds-list-adaptive-example',
  template: `
    @if (fitsBracket()) {
      <et-scrollable>
        <et-bracket [source]="source" [columnWidth]="220" />
      </et-scrollable>
    } @else {
      <et-bracket-rounds-list [source]="source" />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BRACKET_IMPORTS, BRACKET_ROUNDS_LIST_IMPORTS, SCROLLABLE_IMPORTS],
  providers: [
    provideBracketConfig({
      layouts: [singleEliminationBracketLayout()],
      ...BRACKET_DEFAULT_CARDS,
      matchNormalizer: normalizeMatch,
    }),
  ],
  host: { class: 'app-adaptive' },
  styles: `
    .app-adaptive {
      display: block;
      max-inline-size: 1200px;
    }
  `,
})
export class BracketRoundsListAdaptiveExampleComponent {
  private dimensions = signalHostElementDimensions();

  public source = SOURCE;

  private readonly bracketConfig: BracketConfig = { layouts: [singleEliminationBracketLayout()], columnWidth: 220 };

  protected fitsBracket = computed(() =>
    bracketFitsWidth(this.source, this.bracketConfig, this.dimensions().client?.width ?? 0),
  );
}
