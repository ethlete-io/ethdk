import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { BracketRoundSwissGroup, NewBracketRound } from './linked';

@Component({
  selector: 'et-new-bracket-default-round-header',
  template: `
    {{ bracketRound().name }}

    @if (bracketRoundSwissGroup()) {
      ({{ bracketRoundSwissGroup()?.name }})
    }
  `,

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
      inline-size: 100%;
      block-size: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
    }
  `,
})
export class NewBracketDefaultRoundHeaderComponent<TRoundData = unknown, TMatchData = unknown> {
  bracketRound = input.required<NewBracketRound<TRoundData, TMatchData>>();
  bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<TRoundData, TMatchData> | null>();
}
