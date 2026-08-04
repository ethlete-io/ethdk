import { AsyncPipe } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { BracketRoundDirective } from '../../directives/bracket-round';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-bracket-round-header',
  templateUrl: './bracket-round-header.component.html',
  styleUrls: ['./bracket-round-header.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-bracket-round-header et-legacy',
  },
  imports: [AsyncPipe],
  hostDirectives: [BracketRoundDirective],
})
export class BracketRoundHeaderComponent {
  roundData = inject(BracketRoundDirective);
}
