import { Component, ViewEncapsulation } from '@angular/core';
import { SelectionListOptionDirective } from '../../directives/selection-list-option';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-selection-list-option',
  template: `
    <div class="et-selection-list-option-content">
      <ng-content />
    </div>

    <div class="et-selection-list-option-state">
      <div class="et-selection-list-option-state-check"></div>
    </div>
  `,
  styleUrls: ['./selection-list-option.component.scss'],
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: SelectionListOptionDirective, inputs: ['value', 'disabled', 'isResetOption'] }],
})
export class SelectionListOptionComponent {}
