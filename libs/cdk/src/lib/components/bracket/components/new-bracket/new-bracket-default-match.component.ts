import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { NewBracketMatch, NewBracketRound } from './linked';

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
      inline-size: 100%;
      block-size: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
      font-size: 12px;
    }
  `,
})
export class NewBracketDefaultMatchComponent<TRoundData = unknown, TMatchData = unknown> {
  bracketRound = input.required<NewBracketRound<TRoundData, TMatchData>>();
  bracketMatch = input.required<NewBracketMatch<TRoundData, TMatchData>>();
}
