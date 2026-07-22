import { Component, input, ViewEncapsulation } from '@angular/core';
import { BracketMatch } from './linked';

@Component({
  selector: 'et-bracket-default-continue',
  template: ` Next stage ({{ bracketMatches().length }}) `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-bracket-default-continue-host',
  },
  styles: `
    @layer components {
      .et-bracket-default-continue-host {
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
    }
  `,
})
export class BracketDefaultContinueComponent<TRoundData = unknown, TMatchData = unknown> {
  public bracketMatches = input.required<BracketMatch<TRoundData, TMatchData>[]>();
}
