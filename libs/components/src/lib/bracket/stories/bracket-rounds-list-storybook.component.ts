import {
  booleanAttribute,
  Component,
  computed,
  input,
  numberAttribute,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { signalHostElementDimensions } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../button';
import { SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS } from '../../scrollable/scrollable.imports';
import { bracketFitsWidth, bracketNaturalWidth } from '../bracket-fits-width';
import { BracketRoundsListComponent } from '../bracket-rounds-list.component';
import { BracketComponent } from '../bracket.component';
import { BracketConfig } from '../bracket.config';
import { BracketDataSource } from '../integrations/base';
import { doubleEliminationBracketLayout, singleEliminationBracketLayout, swissBracketLayout } from '../layouts';
import { demoMatchNormalizer } from './demo-match-normalizer';

/** Every mode the stories feed these demos, created once and bound to both representations. */
const DEMO_LAYOUTS = [singleEliminationBracketLayout(), doubleEliminationBracketLayout(), swissBracketLayout()];

/**
 * The layout settings both representations run with, so the fit test predicts the bracket that renders -
 * `layouts` included, since how wide a bracket draws is the layout's answer.
 */
const DEMO_BRACKET_CONFIG: BracketConfig = { layouts: DEMO_LAYOUTS, columnWidth: 220, matchHeight: 75 };

@Component({
  selector: 'et-sb-bracket-rounds-list',
  template: `
    <div [style.max-inline-size.px]="maxWidth()">
      @if (withRoundSwitcher()) {
        <div class="mb-4 flex flex-wrap gap-2">
          <button
            [variant]="selectedRoundId() ? 'outline' : 'filled'"
            (click)="selectedRoundId.set(null)"
            et-button
            size="sm"
            type="button"
          >
            All rounds
          </button>

          @for (round of rounds(); track round.id) {
            <button
              [variant]="selectedRoundId() === round.id ? 'filled' : 'outline'"
              (click)="selectedRoundId.set(round.id)"
              et-button
              size="sm"
              type="button"
            >
              {{ round.name }}
            </button>
          }
        </div>
      }

      <et-bracket-rounds-list
        [source]="source()"
        [layouts]="LAYOUTS"
        [matchNormalizer]="MATCH_NORMALIZER"
        [selectedRoundId]="selectedRoundId()"
        [hideRoundHeaders]="hideRoundHeaders()"
        [roundHeaderLevel]="roundHeaderLevel()"
      />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BracketRoundsListComponent, BUTTON_IMPORTS],
})
export class StorybookBracketRoundsListComponent {
  public source = input.required<BracketDataSource<unknown, unknown>>();

  /** Constrains the list the way a phone or an article column would. */
  public maxWidth = input(420, { transform: numberAttribute });

  public hideRoundHeaders = input(false, { transform: booleanAttribute });
  public roundHeaderLevel = input(3, { transform: numberAttribute });

  /** Shows the round-switcher recipe: the list renders one round, the buttons pick it. */
  public withRoundSwitcher = input(false, { transform: booleanAttribute });

  protected selectedRoundId = signal<string | null>(null);

  protected rounds = computed(() => this.source().rounds);

  protected readonly LAYOUTS = DEMO_LAYOUTS;

  protected readonly MATCH_NORMALIZER = demoMatchNormalizer;
}

@Component({
  selector: 'et-sb-bracket-adaptive',
  template: `
    <p class="mb-2 text-small">
      {{ availableWidth() }}px available, bracket needs {{ naturalWidth() }}px -
      <strong>{{ fitsBracket() ? 'grid' : 'rounds list' }}</strong>
    </p>

    @if (fitsBracket()) {
      <et-scrollable [etScrollableButtons]="{ sticky: true }">
        <et-bracket [source]="source()" [layouts]="LAYOUTS" [matchNormalizer]="MATCH_NORMALIZER" [columnWidth]="220" />
      </et-scrollable>
    } @else {
      <et-bracket-rounds-list [source]="source()" [layouts]="LAYOUTS" [matchNormalizer]="MATCH_NORMALIZER" />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BracketComponent, BracketRoundsListComponent, ...SCROLLABLE_IMPORTS, ...SCROLLABLE_NAVIGATION_IMPORTS],
  host: {
    class: 'block',
    // `max-inline-size`, not `inline-size`: a demo about fitting the space available must not be wider
    // than the screen showing it, or the page scrolls sideways and shows the opposite of the point.
    '[style.max-inline-size.px]': 'containerWidth()',
  },
})
export class StorybookBracketAdaptiveComponent {
  public source = input.required<BracketDataSource<unknown, unknown>>();

  /** Stands in for the viewport - drag it down and the representation swaps. */
  public containerWidth = input(1200, { transform: numberAttribute });
  // The host is the measured container: it never grows past the width set on it, because the grid inside
  // it scrolls rather than pushing it wider. Measuring the scroll container itself would always fit.
  private dimensions = signalHostElementDimensions();

  protected availableWidth = computed(() => Math.round(this.dimensions().client?.width ?? 0));

  protected naturalWidth = computed(() => Math.round(bracketNaturalWidth(this.source(), DEMO_BRACKET_CONFIG)));

  protected fitsBracket = computed(() => bracketFitsWidth(this.source(), DEMO_BRACKET_CONFIG, this.availableWidth()));

  protected readonly LAYOUTS = DEMO_LAYOUTS;

  protected readonly MATCH_NORMALIZER = demoMatchNormalizer;
}
