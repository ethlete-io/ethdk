import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Type, ViewEncapsulation, forwardRef, inject } from '@angular/core';
import { DynamicFormFieldDirective, StaticFormFieldDirective, WriteableInputDirective } from '../../../../directives';
import { InputStateService } from '../../../../services';
import { DecoratedFormFieldBase } from '../../../../utils';
import { ErrorComponent } from '../../../error';
import { SelectFieldDirective } from '../../directives';

@Component({
  selector: 'et-select-field',
  template: `
    <ng-content select="et-label" />
    <div class="et-select-field-input">
      <ng-content />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  standalone: true,
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
