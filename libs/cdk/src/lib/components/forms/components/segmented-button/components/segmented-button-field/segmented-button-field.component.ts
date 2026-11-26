import { Component, ViewEncapsulation } from '@angular/core';
import { StaticFormFieldDirective } from '../../../../directives/static-form-field';
import { SegmentedButtonFieldDirective } from '../../directives/segmented-button-field';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-segmented-button-field',
  template: `
    <div class="et-segmented-button-field-container">
      <ng-content />
    </div>
  `,
  styleUrls: ['./segmented-button-field.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-segmented-button-field et-legacy',
  },
  hostDirectives: [StaticFormFieldDirective, SegmentedButtonFieldDirective],
})
export class SegmentedButtonFieldComponent {}
