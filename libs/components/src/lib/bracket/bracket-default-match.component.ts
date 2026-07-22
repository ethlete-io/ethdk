import { Component, input, ViewEncapsulation } from '@angular/core';
import { BracketRoundSwissGroup, BracketMatch, BracketRound } from './linked';

@Component({
  selector: 'et-bracket-default-match',
  template: ` {{ bracketMatch().id }} `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-bracket-default-match-host',
  },
  styles: `
    @layer components {
      .et-bracket-default-match-host {
        display: flex;
        padding: 8px;
        border: 1px solid yellow;
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
export class BracketDefaultMatchComponent<TRoundData = unknown, TMatchData = unknown> {
  public bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  public bracketMatch = input.required<BracketMatch<TRoundData, TMatchData>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<TRoundData, TMatchData> | null>();
}
