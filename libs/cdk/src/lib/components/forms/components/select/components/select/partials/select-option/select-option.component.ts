import { Component, ViewEncapsulation, inject } from '@angular/core';
import { SELECT_OPTION_TOKEN, SelectOptionDirective } from '../../directives/select-option';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-select-option',
  template: ` <ng-content /> `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-select-option et-legacy',
  },
  hostDirectives: [{ directive: SelectOptionDirective, inputs: ['value', 'disabled', 'label'] }],
})
export class SelectOptionComponent {
  protected readonly selectOption = inject(SELECT_OPTION_TOKEN);
}
