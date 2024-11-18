import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { BracketRound } from './bracket-new';

@Component({
  selector: 'et-new-bracket-default-round-header',
  template: ` {{ bracketRound().name }} `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-new-bracket-default-round-header-host',
  },
  styles: `
    .et-new-bracket-default-round-header-host {
      display: block;
      padding: 8px;
      border: 1px solid green;
      inline-size: 250px;
      block-size: 50px;
      display: flex;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
    }
  `,
})
export class NewBracketDefaultRoundHeaderComponent<TRoundData = unknown, TMatchData = unknown> {
  bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
}
