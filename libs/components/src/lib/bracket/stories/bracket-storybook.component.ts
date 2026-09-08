import {
  booleanAttribute,
  Component,
  computed,
  input,
  numberAttribute,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { BUTTON_IMPORTS } from '../../button';
import { SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS } from '../../scrollable/scrollable.imports';
import { BRACKET_DENSITY, BracketDensity } from '../bracket-density';
import { BracketComponent } from '../bracket.component';
import { BRACKET_ROUND_HEADER_ALIGN, BracketRoundHeaderAlign } from '../bracket.config';
import { BRACKET_DATA_LAYOUT, BracketDataLayout } from '../core/layout';
import { BracketDataSource } from '../integrations/base';
import {
  doubleEliminationBracketLayout,
  mirroredDoubleEliminationBracketLayout,
  mirroredSingleEliminationBracketLayout,
  singleEliminationBracketLayout,
  swissBracketLayout,
} from '../layouts';
import { BracketMatch, BracketRound } from '../linked/bracket';
import { BracketRoundSwissGroup, BracketSwissColors } from '../linked/swiss';
import { demoMatchNormalizer, demoParticipant } from './demo-match-normalizer';

/**
 * Every layout the stories can draw, created once - the `layout` control picks between these two lists
 * rather than binding a removed input. Swiss has no mirrored variant, so a swiss source under the
 * mirrored control simply renders as normal swiss.
 */
const LEFT_TO_RIGHT_LAYOUTS = [
  singleEliminationBracketLayout(),
  doubleEliminationBracketLayout(),
  swissBracketLayout(),
];

const MIRRORED_LAYOUTS = [
  mirroredSingleEliminationBracketLayout(),
  mirroredDoubleEliminationBracketLayout(),
  swissBracketLayout(),
];

/**
 * Demo custom final-match card, wired via the `finalMatchComponent` input to show that
 * consumers can override the barebones defaults. Not part of the library's public API.
 */
@Component({
  selector: 'et-sb-final-match',
  template: `
    <p>Final</p>

    <p>{{ bracketMatch().id }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-sb-final-match-host',
  },
  styles: `
    @layer components {
      .et-sb-final-match-host {
        display: flex;
        flex-direction: column;
        padding: 8px;
        border: 1px solid orange;
        inline-size: 100%;
        block-size: 100%;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
        font-size: 12px;
      }
    }
  `,
})
export class StorybookFinalMatchComponent<TRoundData = unknown, TMatchData = unknown> {
  public bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  public bracketMatch = input.required<BracketMatch<TRoundData, TMatchData>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<TRoundData, TMatchData> | null>();
}

/**
 * A round header that sizes to its own text, which is what `alignRoundHeaders` moves - the shipped one
 * fills its column and looks the same either way. Not part of the library's public API.
 */
@Component({
  selector: 'et-sb-round-header',
  template: ` <span>{{ bracketRound().name }}</span> `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-sb-round-header-host',
  },
  styles: `
    @layer components {
      .et-sb-round-header-host {
        display: inline-flex;
        align-items: center;
        padding-inline: 8px;
        border: 1px dashed var(--et-surface-border-solid);
        border-radius: 4px;
        font-size: 12px;
        text-transform: uppercase;
      }
    }
  `,
})
export class StorybookRoundHeaderComponent<TRoundData = unknown, TMatchData = unknown> {
  public bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<TRoundData, TMatchData> | null>();
}

/**
 * The one-round panel: the same grid, clipped to one column, with `rowSpanRoundId` squeezing the rows of
 * the round on screen and `focusRoundId` bringing it to the inline start. Both move every cell and every
 * connector as one transition.
 */
@Component({
  selector: 'et-sb-bracket-squeeze',
  template: `
    <div class="flex items-center gap-2">
      <button (click)="step(-1)" et-button size="sm" type="button" data-testid="previous-round">Previous</button>
      <button (click)="step(1)" et-button size="sm" type="button" data-testid="next-round">Next</button>
      <span class="text-small" data-testid="focused-round">{{ focusedRoundId() }}</span>
    </div>

    <div
      [style.inline-size.px]="panelWidth()"
      class="mt-4 overflow-hidden"
      data-testid="panel"
      style="border: 1px solid var(--et-surface-border-solid)"
    >
      <et-bracket
        [source]="source()"
        [layouts]="LAYOUTS"
        [matchNormalizer]="MATCH_NORMALIZER"
        [rowSpanRoundId]="focusedRoundId()"
        [focusRoundId]="focusedRoundId()"
        [focusInset]="focusInset()"
        [alignRoundHeaders]="alignRoundHeaders()"
        [thirdPlaceTopOffset]="thirdPlaceTopOffset()"
        [finalRoundHeaderGap]="finalRoundHeaderGap()"
        [roundHeaderComponent]="ROUND_HEADER_COMPONENT"
      />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BracketComponent, BUTTON_IMPORTS],
})
export class StorybookBracketSqueezeComponent {
  public source = input.required<BracketDataSource<unknown, unknown>>();

  public panelWidth = input(360, { transform: numberAttribute });
  public focusInset = input(40, { transform: numberAttribute });
  public alignRoundHeaders = input<BracketRoundHeaderAlign>(BRACKET_ROUND_HEADER_ALIGN.CENTER);
  public thirdPlaceTopOffset = input<number | null>(null);
  public finalRoundHeaderGap = input<number | null>(null);

  public roundIndex = signal(0);

  protected focusedRoundId = computed(() => this.source().rounds[this.roundIndex()]?.id ?? null);

  protected readonly LAYOUTS = LEFT_TO_RIGHT_LAYOUTS;

  protected readonly ROUND_HEADER_COMPONENT = StorybookRoundHeaderComponent;

  protected readonly MATCH_NORMALIZER = demoMatchNormalizer;

  protected step(direction: number) {
    const lastIndex = this.source().rounds.length - 1;

    this.roundIndex.update((current) => Math.min(lastIndex, Math.max(0, current + direction)));
  }
}

/**
 * The density demo, which binds nothing but `density` - the whole point is that one input resizes the
 * bracket, and every explicit layout binding would override the preset it is meant to show.
 */
@Component({
  selector: 'et-sb-bracket-density',
  template: `
    <div [style.max-inline-size.px]="containerWidth()">
      <et-scrollable [etScrollableButtons]="{ sticky: true }">
        <et-bracket
          [source]="source()"
          [layouts]="LAYOUTS"
          [density]="density()"
          [matchNormalizer]="MATCH_NORMALIZER"
        />
      </et-scrollable>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BracketComponent, ...SCROLLABLE_IMPORTS, ...SCROLLABLE_NAVIGATION_IMPORTS],
})
export class StorybookBracketDensityComponent {
  public source = input.required<BracketDataSource<unknown, unknown>>();

  public density = input<BracketDensity>(BRACKET_DENSITY.DEFAULT);

  /** Stands in for the article column the compact bracket is meant to fit. */
  public containerWidth = input(760, { transform: numberAttribute });

  protected readonly LAYOUTS = LEFT_TO_RIGHT_LAYOUTS;

  protected readonly MATCH_NORMALIZER = demoMatchNormalizer;
}

@Component({
  selector: 'et-sb-bracket',
  template: `
    @if (withParticipantList()) {
      <!-- The supported pin affordance: a control *outside* the bracket driving focusedParticipantId.
           Nothing inside a card is a click target, so this is what touch and keyboard users get. -->
      <div class="mb-4 flex flex-wrap gap-2">
        @for (participant of participants(); track participant.id) {
          <button
            [variant]="focusedParticipantId() === participant.id ? 'filled' : 'outline'"
            (click)="toggleFocus(participant.id)"
            et-button
            size="sm"
            type="button"
          >
            {{ participant.name }}
          </button>
        }
      </div>
    }

    <et-scrollable [etScrollableButtons]="{ sticky: true }">
      <et-bracket
        [(focusedParticipantId)]="focusedParticipantId"
        [source]="source()"
        [matchNormalizer]="MATCH_NORMALIZER"
        [finalMatchComponent]="customFinalCard() ? FINAL_MATCH_COMPONENT : undefined"
        [roundHeaderLevel]="roundHeaderLevel()"
        [columnWidth]="columnWidth()"
        [matchHeight]="matchHeight()"
        [roundHeaderHeight]="roundHeaderHeight()"
        [columnGap]="columnGap()"
        [rowGap]="rowGap()"
        [lineStartingCurveAmount]="lineStartingCurveAmount()"
        [lineEndingCurveAmount]="lineEndingCurveAmount()"
        [lineWidth]="lineWidth()"
        [lineDashArray]="lineDashArray()"
        [lineDashOffset]="lineDashOffset()"
        [disableJourneyHighlight]="disableJourneyHighlight()"
        [layouts]="layouts()"
        [hideRoundHeaders]="hideRoundHeaders()"
        [finalColumnWidth]="finalColumnWidth()"
        [finalMatchHeight]="finalMatchHeight()"
        [rowRoundGap]="rowRoundGap()"
        [roundHeaderGap]="roundHeaderGap()"
        [swissGroupPadding]="swissGroupPadding()"
        [swissColors]="swissColors()"
        [showContinueElement]="showContinueElement()"
        [continueColumnWidth]="continueColumnWidth()"
        [continueElementHeight]="continueElementHeight()"
        [continueLineDashArray]="continueLineDashArray()"
        [focusRoundId]="focusRoundId()"
        [focusInset]="focusInset()"
        [alignRoundHeaders]="alignRoundHeaders()"
        [thirdPlaceTopOffset]="thirdPlaceTopOffset()"
        [finalRoundHeaderGap]="finalRoundHeaderGap()"
      />
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BracketComponent, BUTTON_IMPORTS, ...SCROLLABLE_IMPORTS, ...SCROLLABLE_NAVIGATION_IMPORTS],
})
export class StorybookBracketComponent {
  public source = input.required<BracketDataSource<unknown, unknown>>();

  public columnWidth = input(250, { transform: numberAttribute });
  public matchHeight = input(75, { transform: numberAttribute });
  public roundHeaderHeight = input(50, { transform: numberAttribute });
  public columnGap = input(60, { transform: numberAttribute });
  public rowGap = input(30, { transform: numberAttribute });
  public lineStartingCurveAmount = input(10, { transform: numberAttribute });
  public lineEndingCurveAmount = input(0, { transform: numberAttribute });
  public lineWidth = input(2, { transform: numberAttribute });
  public lineDashArray = input(0, { transform: numberAttribute });
  public lineDashOffset = input(0, { transform: numberAttribute });
  public finalColumnWidth = input(400, { transform: numberAttribute });
  public finalMatchHeight = input(200, { transform: numberAttribute });
  public rowRoundGap = input(70, { transform: numberAttribute });
  public roundHeaderGap = input(20, { transform: numberAttribute });
  public swissGroupPadding = input(10, { transform: numberAttribute });
  public focusRoundId = input<string | null>(null);
  public focusInset = input(0, { transform: numberAttribute });
  public alignRoundHeaders = input<BracketRoundHeaderAlign>(BRACKET_ROUND_HEADER_ALIGN.START);
  public thirdPlaceTopOffset = input<number | null>(null);
  public finalRoundHeaderGap = input<number | null>(null);

  /**
   * The story control for the fold. There is no `layout` input on `et-bracket` any more - the fold is a
   * property of the registered layout, so this picks which set of layout factories gets bound.
   */
  public layout = input<BracketDataLayout>(BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT);

  public hideRoundHeaders = input(false, { transform: booleanAttribute });
  public disableJourneyHighlight = input(false, { transform: booleanAttribute });

  public showContinueElement = input(false, { transform: booleanAttribute });
  public continueColumnWidth = input(250, { transform: numberAttribute });
  public continueElementHeight = input(75, { transform: numberAttribute });
  public continueLineDashArray = input(6, { transform: numberAttribute });

  public swissColors = input<BracketSwissColors | undefined>(undefined);

  /** Swap the shipped final card for the demo custom one, to show the override still works. */
  public customFinalCard = input(false, { transform: booleanAttribute });
  public roundHeaderLevel = input(3, { transform: numberAttribute });

  /** Render the participants legend that pins a journey - the focus-mode demo. */
  public withParticipantList = input(false, { transform: booleanAttribute });

  protected focusedParticipantId = signal<string | null>(null);

  /** What the `layout` control resolves to: the mirrored factories, or the plain ones. */
  protected layouts = computed(() =>
    this.layout() === BRACKET_DATA_LAYOUT.MIRRORED ? MIRRORED_LAYOUTS : LEFT_TO_RIGHT_LAYOUTS,
  );

  /** Every participant in the source, in first-appearance order, named the way the cards name them. */
  protected participants = computed(() => {
    const ids = new Set(this.source().matches.flatMap((match) => [match.home, match.away]));

    return Array.from(ids)
      .map((id) => demoParticipant(id))
      .filter((participant) => !!participant);
  });

  protected readonly FINAL_MATCH_COMPONENT = StorybookFinalMatchComponent;

  /** The story data carries no payload, so this derives its cards from the bracket's own structure. */
  protected readonly MATCH_NORMALIZER = demoMatchNormalizer;

  protected toggleFocus(participantId: string) {
    this.focusedParticipantId.update((current) => (current === participantId ? null : participantId));
  }
}
