import { ChangeDetectionStrategy, Component, Type, ViewEncapsulation, forwardRef } from '@angular/core';
import {
  DynamicFormFieldDirective,
  InputDirective,
  StaticFormFieldDirective,
  WriteableInputDirective,
} from '../../../../directives';
import { SelectionListFieldDirective } from '../../directives';

@Component({
  selector: 'et-selection-list-field',
  template: `<ng-content />`,
  standalone: true,
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
