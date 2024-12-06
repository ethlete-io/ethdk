import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Type, ViewEncapsulation, forwardRef, inject } from '@angular/core';
import { DynamicFormFieldDirective } from '../../../../directives/dynamic-form-field';
import { StaticFormFieldDirective } from '../../../../directives/static-form-field';
import { WriteableInputDirective } from '../../../../directives/writeable-input';
import { InputStateService } from '../../../../services';
import { DecoratedFormFieldBase } from '../../../../utils';
import { ErrorComponent } from '../../../error/components/error';
import { SelectFieldDirective } from '../../directives/select-field';

@Component({
  selector: 'et-select-field',
  template: `
    <ng-content select="et-label" />
    <div class="et-select-field-input">
      <ng-content />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-select-field',
  },
  hostDirectives: [
    SelectFieldDirective,
    StaticFormFieldDirective,
    WriteableInputDirective,
    {
      directive: forwardRef(() => DynamicFormFieldDirective) as Type<DynamicFormFieldDirective>,
      inputs: ['hideErrorMessage'],
    },
  ],
  imports: [ErrorComponent, AsyncPipe],
})
export class SelectFieldComponent extends DecoratedFormFieldBase {
  protected readonly inputState = inject(InputStateService);
}
