import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { ScrollableImports } from '../../../scrollable/scrollable.imports';
import { NewBracketComponent } from '../../components/new-bracket';
import { BracketDataSource, BracketMatch, BracketRound } from '../../components/new-bracket/bracket-new';

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
      inline-size: 250px;
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
  bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  bracketMatch = input.required<BracketMatch<TRoundData, TMatchData>>();
}

@Component({
  selector: 'et-sb-bracket-new',
  template: `
    <et-scrollable stickyButtons>
      <et-new-bracket [source]="bracketData()" [finalMatchComponent]="finalMatchComponent" />
    </et-scrollable>
  `,
  styles: [``],
  standalone: true,
  imports: [NewBracketComponent, ScrollableImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StorybookBracketNewComponent {
  bracketData = input.required<BracketDataSource<unknown, unknown>>();
  finalMatchComponent = FinalMatchComponent;
}
