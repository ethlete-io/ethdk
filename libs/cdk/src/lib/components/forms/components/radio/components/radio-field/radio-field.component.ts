import { Component, ViewEncapsulation } from '@angular/core';
import { StaticFormFieldDirective } from '../../../../directives/static-form-field';
import { RadioFieldDirective } from '../../directives/radio-field';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-radio-field, et-radio-card-field',
  template: `
    <div class="et-radio-field-container">
      <ng-content />
      <ng-content />
    </div>
  `,
  styleUrls: ['./radio-field.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-radio-field et-legacy',
  },
  hostDirectives: [StaticFormFieldDirective, RadioFieldDirective],
})
export class RadioFieldComponent {}
