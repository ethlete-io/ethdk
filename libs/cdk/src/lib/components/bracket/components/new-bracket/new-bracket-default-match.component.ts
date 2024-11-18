import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { BracketMatch, BracketRound } from './bracket-new';

@Component({
  selector: 'et-new-bracket-default-match',
  template: ` {{ bracketMatch().id }} `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-new-bracket-default-match-host',
  },
  styles: `
    .et-new-bracket-default-match-host {
      display: block;
      padding: 8px;
      border: 1px solid yellow;
      inline-size: 250px;
      block-size: 75px;
      display: flex;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
      font-size: 12px;
    }
  `,
})
export class NewBracketDefaultMatchComponent<TRoundData = unknown, TMatchData = unknown> {
  bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  bracketMatch = input.required<BracketMatch<TRoundData, TMatchData>>();
}
