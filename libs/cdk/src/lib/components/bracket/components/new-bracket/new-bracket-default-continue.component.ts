import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { NewBracketMatch } from './linked';

@Component({
  selector: 'et-new-bracket-default-continue',
  template: ` Next stage ({{ bracketMatches().length }}) `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-new-bracket-default-continue-host',
  },
  styles: `
    .et-new-bracket-default-continue-host {
      display: flex;
      padding: 8px;
      border: 1px dashed cyan;
      inline-size: 100%;
      block-size: 100%;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
      font-size: 12px;
    }
  `,
})
export class NewBracketDefaultContinueComponent<TRoundData = unknown, TMatchData = unknown> {
  bracketMatches = input.required<NewBracketMatch<TRoundData, TMatchData>[]>();
}
