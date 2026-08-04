import { AsyncPipe } from '@angular/common';
import { Component, inject, ViewEncapsulation, input } from '@angular/core';
import { INPUT_TOKEN } from '../../../../directives/input';
import { SEARCH_INPUT_TOKEN } from '../../directives/search-input';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-search-input-clear',
  templateUrl: './search-input-clear.component.html',
  styleUrls: ['./search-input-clear.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-search-input-clear et-legacy',
  },
  imports: [AsyncPipe],
})
export class SearchInputClearComponent {
  protected readonly searchInput = inject(SEARCH_INPUT_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  readonly ariaLabel = input<string>();
}
