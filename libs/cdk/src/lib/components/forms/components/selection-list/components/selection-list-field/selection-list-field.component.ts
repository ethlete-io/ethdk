import { Component, Type, ViewEncapsulation, forwardRef } from '@angular/core';
import { DynamicFormFieldDirective } from '../../../../directives/dynamic-form-field';
import { InputDirective } from '../../../../directives/input';
import { StaticFormFieldDirective } from '../../../../directives/static-form-field';
import { WriteableInputDirective } from '../../../../directives/writeable-input';
import { SelectionListFieldDirective } from '../../directives/selection-list-field';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-selection-list-field',
  template: `<ng-content />`,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    StaticFormFieldDirective,
    WriteableInputDirective,
    {
      directive: forwardRef(() => DynamicFormFieldDirective) as Type<DynamicFormFieldDirective>,
      inputs: ['hideErrorMessage'],
    },
    {
      directive: SelectionListFieldDirective,
      inputs: ['multiple'],
    },
    { directive: InputDirective },
  ],
})
export class SelectionListFieldComponent {}
