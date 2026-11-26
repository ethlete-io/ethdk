import { Component, input, ViewEncapsulation } from '@angular/core';
import { NewBracketMatch } from './linked';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-new-bracket-default-continue',
  template: ` Next stage ({{ bracketMatches().length }}) `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-new-bracket-default-continue-host et-legacy',
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
