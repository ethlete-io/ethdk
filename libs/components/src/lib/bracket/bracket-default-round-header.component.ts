import { Component, input, ViewEncapsulation } from '@angular/core';
import { BracketRoundSwissGroup, BracketRound } from './linked';

@Component({
  selector: 'et-bracket-default-round-header',
  template: `
    {{ bracketRound().name }}

    @if (bracketRoundSwissGroup()) {
      ({{ bracketRoundSwissGroup()?.name }})
    }
  `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-bracket-default-round-header-host',
  },
  styles: `
    @layer components {
      .et-bracket-default-round-header-host {
        display: flex;
        padding: 8px;
        border: 1px solid green;
        inline-size: 100%;
        block-size: 100%;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
      }
    }
  `,
})
export class BracketDefaultRoundHeaderComponent<TRoundData = unknown, TMatchData = unknown> {
  public bracketRound = input.required<BracketRound<TRoundData, TMatchData>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<TRoundData, TMatchData> | null>();
}
