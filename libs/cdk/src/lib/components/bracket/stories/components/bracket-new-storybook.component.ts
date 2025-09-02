import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
  numberAttribute,
  ViewEncapsulation,
} from '@angular/core';
import { ScrollableImports } from '../../../scrollable/scrollable.imports';
import {
  BRACKET_DATA_LAYOUT,
  BracketDataLayout,
  BracketDataSource,
  NewBracketComponent,
} from '../../components/new-bracket';
import { NewBracketMatch, NewBracketRound } from '../../components/new-bracket/linked';

@Component({
  selector: 'et-sb-final-match',
  template: `
    <p>Final</p>

    <p>{{ bracketMatch().id }}</p>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-sb-final-match-host',
  },
  styles: `
    .et-sb-final-match-host {
      display: block;
      padding: 8px;
      border: 1px solid orange;
      inline-size: 100%;
      block-size: 200px;
      display: flex;
      justify-content: center;
      flex-direction: column;
      align-items: center;
      box-sizing: border-box;
      font-size: 12px;
    }
  `,
})
export class FinalMatchComponent<TRoundData = unknown, TMatchData = unknown> {
  bracketRound = input.required<NewBracketRound<TRoundData, TMatchData>>();
  bracketMatch = input.required<NewBracketMatch<TRoundData, TMatchData>>();
}

@Component({
  selector: 'et-sb-bracket-new',
  template: `
    <et-scrollable stickyButtons>
      <et-new-bracket
        [source]="source()"
        [finalMatchComponent]="finalMatchComponent"
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
        [upperLowerGap]="upperLowerGap()"
      />
    </et-scrollable>
  `,
  imports: [NewBracketComponent, ScrollableImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StorybookBracketNewComponent {
  source = input.required<BracketDataSource<unknown, unknown>>();

  columnWidth = input(250, { transform: numberAttribute });
  matchHeight = input(75, { transform: numberAttribute });
  roundHeaderHeight = input(50, { transform: numberAttribute });
  columnGap = input(60, { transform: numberAttribute });
  rowGap = input(30, { transform: numberAttribute });
  lineStartingCurveAmount = input(10, { transform: numberAttribute });
  lineEndingCurveAmount = input(0, { transform: numberAttribute });
  lineWidth = input(2, { transform: numberAttribute });
  lineDashArray = input(0, { transform: numberAttribute });
  lineDashOffset = input(0, { transform: numberAttribute });
  finalColumnWidth = input(400, { transform: numberAttribute });
  finalMatchHeight = input(200, { transform: numberAttribute });
  upperLowerGap = input(70, { transform: numberAttribute });

  layout = input<BracketDataLayout>(BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT);

  hideRoundHeaders = input(false, { transform: booleanAttribute });
  disableJourneyHighlight = input(false, { transform: booleanAttribute });

  finalMatchComponent = FinalMatchComponent;
}
