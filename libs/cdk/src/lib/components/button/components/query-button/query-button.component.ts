import { AsyncPipe } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { QueryDirective } from '@ethlete/query';
import { ButtonDirective } from '../../directives/button';
import { QueryButtonDirective } from '../../directives/query-button';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: '[et-query-button]',
  templateUrl: './query-button.component.html',
  styleUrls: ['./query-button.component.scss'],
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    { directive: QueryButtonDirective, inputs: ['query', 'skipSuccess', 'skipFailure', 'skipLoading'] },
    { directive: ButtonDirective, inputs: ['disabled', 'type', 'pressed'] },
  ],
  imports: [QueryDirective, AsyncPipe],
  host: {
    class: 'et-query-button et-legacy',
  },
})
export class QueryButtonComponent {
  protected queryButton = inject(QueryButtonDirective);
}
