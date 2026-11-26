import { Component, ViewEncapsulation } from '@angular/core';
import { StaticFormGroupDirective } from '../../../../directives/static-form-group';
import { CheckboxGroupDirective } from '../../directives/checkbox-group';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-checkbox-group',
  template: ` <ng-content /> `,
  styleUrls: ['./checkbox-group.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-group et-checkbox-group et-legacy',
  },
  hostDirectives: [CheckboxGroupDirective, StaticFormGroupDirective],
})
export class CheckboxGroupComponent {}
