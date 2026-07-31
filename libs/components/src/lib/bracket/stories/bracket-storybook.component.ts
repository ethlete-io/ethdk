import { booleanAttribute, Component, input, numberAttribute, ViewEncapsulation } from '@angular/core';
import { SCROLLABLE_IMPORTS } from '../../scrollable/scrollable.imports';
import { BracketComponent } from '../bracket.component';
import { BracketSwissColors } from '../bracket.config';
import { BRACKET_DATA_LAYOUT, BracketDataLayout } from '../core/layout';
import { BracketDataSource } from '../integrations/base';
import { BracketMatch, BracketRound } from '../linked/bracket';
import { BracketRoundSwissGroup } from '../linked/swiss';
import { demoMatchNormalizer } from './demo-match-normalizer';

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

@Component({
  selector: 'et-sb-bracket',
  template: `
    <et-scrollable stickyButtons>
      <et-bracket
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
        [layout]="layout()"
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
      />
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BracketComponent, ...SCROLLABLE_IMPORTS],
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

  protected readonly FINAL_MATCH_COMPONENT = StorybookFinalMatchComponent;

  /** The story data carries no payload, so this derives its cards from the bracket's own structure. */
  protected readonly MATCH_NORMALIZER = demoMatchNormalizer;
}
