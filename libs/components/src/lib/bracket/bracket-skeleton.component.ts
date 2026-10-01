import { booleanAttribute, Component, computed, input, ViewEncapsulation } from '@angular/core';
import {
  BracketMatch,
  BracketRound,
  BracketRoundSwissGroup,
  createPlaceholderBracketSource,
  PlaceholderBracketShape,
} from '@ethlete/bracket';
import { SKELETON_IMPORTS } from '../skeleton';
import { BracketDensity } from './bracket-density';
import {
  nullableNumberAttribute,
  OptionalBooleanInput,
  optionalBooleanAttribute,
  OptionalNumberInput,
  optionalNumberAttribute,
} from './bracket-input-transforms';
import { BracketLayout } from './bracket-layout';
import { BracketComponent } from './bracket.component';

@Component({
  selector: 'et-bracket-skeleton-match',
  template: `
    <et-skeleton-item class="et-bracket-skeleton-side" shape="rect" />
    <et-skeleton-item class="et-bracket-skeleton-side" shape="rect" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SKELETON_IMPORTS],
  host: {
    class: 'et-bracket-skeleton-match',
  },
})
export class BracketSkeletonMatchComponent<TRoundData = unknown, TMatchData = unknown> {
  public bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  public bracketMatch = input.required<BracketMatch<TRoundData, TMatchData>>();
  public bracketRoundSwissGroup = input<BracketRoundSwissGroup<TRoundData, TMatchData> | null>(null);
}

@Component({
  selector: 'et-bracket-skeleton-final-match',
  template: `
    <et-skeleton-item class="et-bracket-skeleton-final-title" shape="text" />
    <et-skeleton-item class="et-bracket-skeleton-side" shape="rect" />
    <et-skeleton-item class="et-bracket-skeleton-side" shape="rect" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SKELETON_IMPORTS],
  host: {
    class: 'et-bracket-skeleton-match et-bracket-skeleton-final-match',
  },
})
export class BracketSkeletonFinalMatchComponent<TRoundData = unknown, TMatchData = unknown> {
  public bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  public bracketMatch = input.required<BracketMatch<TRoundData, TMatchData>>();
  public bracketRoundSwissGroup = input<BracketRoundSwissGroup<TRoundData, TMatchData> | null>(null);
}

@Component({
  selector: 'et-bracket-skeleton-round-header',
  template: `<et-skeleton-item class="et-bracket-skeleton-round-title" shape="text" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [SKELETON_IMPORTS],
  host: {
    class: 'et-bracket-skeleton-round-header',
  },
})
export class BracketSkeletonRoundHeaderComponent<TRoundData = unknown, TMatchData = unknown> {
  public bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  public bracketRoundSwissGroup = input<BracketRoundSwissGroup<TRoundData, TMatchData> | null>(null);
}

@Component({
  selector: 'et-bracket-skeleton-continue',
  template: `<et-skeleton-item class="et-bracket-skeleton-continue-bone" shape="rect" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [SKELETON_IMPORTS],
  host: {
    class: 'et-bracket-skeleton-continue',
  },
})
export class BracketSkeletonContinueComponent<TRoundData = unknown, TMatchData = unknown> {
  public bracketMatches = input.required<BracketMatch<TRoundData, TMatchData>[]>();
}

/**
 * A loading placeholder for `et-bracket`: the real bracket layout drawn with an empty source of the given
 * `shape` and skeleton cards, announced once through `et-skeleton`. Bind the same layout inputs as the
 * bracket it stands in for, so the swap does not move anything.
 *
 * @example
 * @if (source(); as source) {
 *   <et-bracket [source]="source" [columnWidth]="220" />
 * } @else {
 *   <et-bracket-skeleton [shape]="{ mode: 'single-elimination', participantCount: 16 }" [columnWidth]="220" />
 * }
 */
@Component({
  selector: 'et-bracket-skeleton',
  template: `
    <et-skeleton [loadingAllyText]="loadingAllyText()" [animated]="animated()" class="et-bracket-skeleton">
      <et-bracket
        [source]="source()"
        [layouts]="layouts()"
        [density]="density()"
        [columnWidth]="columnWidth()"
        [matchHeight]="matchHeight()"
        [finalColumnWidth]="finalColumnWidth()"
        [finalMatchHeight]="finalMatchHeight()"
        [roundHeaderHeight]="roundHeaderHeight()"
        [roundHeaderGap]="roundHeaderGap()"
        [finalRoundHeaderGap]="finalRoundHeaderGap()"
        [columnGap]="columnGap()"
        [rowGap]="rowGap()"
        [rowRoundGap]="rowRoundGap()"
        [thirdPlaceTopOffset]="thirdPlaceTopOffset()"
        [hideRoundHeaders]="hideRoundHeaders()"
        [matchComponent]="MATCH_COMPONENT"
        [finalMatchComponent]="FINAL_MATCH_COMPONENT"
        [roundHeaderComponent]="ROUND_HEADER_COMPONENT"
        [showContinueElement]="showContinueElement()"
        [continueColumnWidth]="continueColumnWidth()"
        [continueElementHeight]="continueElementHeight()"
        [continueComponent]="CONTINUE_COMPONENT"
        aria-hidden="true"
        disableJourneyHighlight
      />
    </et-skeleton>
  `,
  styleUrl: './bracket-skeleton.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [BracketComponent, SKELETON_IMPORTS],
  host: {
    class: 'et-bracket-skeleton-host',
  },
})
export class BracketSkeletonComponent {
  /** The structure to draw - match it to the bracket that is loading. */
  public shape = input.required<PlaceholderBracketShape>();

  /** What a screen reader announces while loading. `null` uses `LOADER_LABELS`' `loadingContent`. */
  public loadingAllyText = input<string | null>(null);

  /** Run the shimmer. @default true */
  public animated = input(true, { transform: booleanAttribute });

  public layouts = input<readonly BracketLayout[] | undefined>(undefined);
  public density = input<BracketDensity | undefined>(undefined);
  public columnWidth = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public matchHeight = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public finalColumnWidth = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public finalMatchHeight = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public roundHeaderHeight = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public roundHeaderGap = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public finalRoundHeaderGap = input<number | null | undefined, OptionalNumberInput>(undefined, {
    transform: nullableNumberAttribute,
  });
  public columnGap = input<number | undefined, OptionalNumberInput>(undefined, { transform: optionalNumberAttribute });
  public rowGap = input<number | undefined, OptionalNumberInput>(undefined, { transform: optionalNumberAttribute });
  public rowRoundGap = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public thirdPlaceTopOffset = input<number | null | undefined, OptionalNumberInput>(undefined, {
    transform: nullableNumberAttribute,
  });
  public hideRoundHeaders = input<boolean | undefined, OptionalBooleanInput>(undefined, {
    transform: optionalBooleanAttribute,
  });
  public showContinueElement = input<boolean | undefined, OptionalBooleanInput>(undefined, {
    transform: optionalBooleanAttribute,
  });
  public continueColumnWidth = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public continueElementHeight = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });

  protected source = computed(() => createPlaceholderBracketSource(this.shape()));

  protected readonly MATCH_COMPONENT = BracketSkeletonMatchComponent;
  protected readonly FINAL_MATCH_COMPONENT = BracketSkeletonFinalMatchComponent;
  protected readonly ROUND_HEADER_COMPONENT = BracketSkeletonRoundHeaderComponent;
  protected readonly CONTINUE_COMPONENT = BracketSkeletonContinueComponent;
}
