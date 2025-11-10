import { ChangeDetectionStrategy, Component, Type, ViewEncapsulation, forwardRef } from '@angular/core';
import { DynamicFormFieldDirective } from '../../../../directives/dynamic-form-field';
import { InputDirective } from '../../../../directives/input';
import { StaticFormFieldDirective } from '../../../../directives/static-form-field';
import { WriteableInputDirective } from '../../../../directives/writeable-input';
import { SelectionListFieldDirective } from '../../directives/selection-list-field';

@Component({
  selector: 'et-selection-list-field',
  template: `<ng-content />`,

  changeDetection: ChangeDetectionStrategy.OnPush,
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
