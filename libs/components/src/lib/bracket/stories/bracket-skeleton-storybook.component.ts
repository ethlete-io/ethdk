import { booleanAttribute, Component, computed, input, numberAttribute, ViewEncapsulation } from '@angular/core';
import { PlaceholderBracketShape, TOURNAMENT_MODE } from '@ethlete/bracket';
import { SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS } from '../../scrollable/scrollable.imports';
import { BRACKET_DEFAULT_CARDS } from '../bracket-default-cards';
import { BRACKET_DENSITY, BracketDensity } from '../bracket-density';
import { BracketSkeletonComponent } from '../bracket-skeleton.component';
import { BracketComponent } from '../bracket.component';
import { provideBracketConfig } from '../bracket.config';
import { doubleEliminationBracketLayout, singleEliminationBracketLayout } from '../layouts';
import { demoMatchNormalizer } from './demo-match-normalizer';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from './generate-bracket';

type SkeletonMode = PlaceholderBracketShape['mode'];

@Component({
  selector: 'et-sb-bracket-skeleton',
  template: `
    <et-scrollable [etScrollableButtons]="{ sticky: true }">
      @if (loaded()) {
        <et-bracket [source]="source()" [density]="density()" [matchNormalizer]="MATCH_NORMALIZER" />
      } @else {
        <et-bracket-skeleton [shape]="shape()" [density]="density()" [animated]="animated()" />
      }
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BracketComponent, BracketSkeletonComponent, ...SCROLLABLE_IMPORTS, ...SCROLLABLE_NAVIGATION_IMPORTS],
  providers: [
    provideBracketConfig({
      layouts: [singleEliminationBracketLayout(), doubleEliminationBracketLayout()],
      ...BRACKET_DEFAULT_CARDS,
    }),
  ],
})
export class StorybookBracketSkeletonComponent {
  public mode = input<SkeletonMode>(TOURNAMENT_MODE.SINGLE_ELIMINATION);
  public participantCount = input(8, { transform: numberAttribute });
  public density = input<BracketDensity>(BRACKET_DENSITY.DEFAULT);
  public animated = input(true, { transform: booleanAttribute });

  /** Swaps in the real bracket of the same shape, to check that nothing moves. */
  public loaded = input(false, { transform: booleanAttribute });

  protected shape = computed<PlaceholderBracketShape>(() => ({
    mode: this.mode(),
    participantCount: this.participantCount(),
  }));

  protected source = computed(() =>
    this.mode() === TOURNAMENT_MODE.SINGLE_ELIMINATION
      ? generateSingleEliminationBracket(this.participantCount())
      : generateDoubleEliminationBracket({ participantCount: this.participantCount() }),
  );

  protected readonly MATCH_NORMALIZER = demoMatchNormalizer;
}
