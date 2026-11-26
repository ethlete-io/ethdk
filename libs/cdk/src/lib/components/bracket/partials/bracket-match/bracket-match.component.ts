import { AsyncPipe } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { BracketMatchDirective } from '../../directives/bracket-match';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-bracket-match',
  templateUrl: './bracket-match.component.html',
  styleUrls: ['./bracket-match.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-bracket-match et-legacy',
  },
  imports: [AsyncPipe],
  hostDirectives: [BracketMatchDirective],
})
export class BracketMatchComponent {
  matchData = inject(BracketMatchDirective);
}
