import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Type, ViewEncapsulation, forwardRef, inject } from '@angular/core';
import { DynamicFormFieldDirective, StaticFormFieldDirective, WriteableInputDirective } from '../../../../directives';
import { InputStateService } from '../../../../services';
import { DecoratedFormFieldBase } from '../../../../utils';
import { ErrorComponent } from '../../../error';

@Component({
  selector: 'et-input-field',
  template: `
    <ng-content select="et-label" />
    <div class="et-input-field-input">
      <ng-content
        select="et-number-input, et-text-input, et-email-input, et-password-input, et-search-input, et-textarea-input"
      />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-input-field',
  },
  hostDirectives: [
    StaticFormFieldDirective,
    WriteableInputDirective,
    {
      directive: forwardRef(() => DynamicFormFieldDirective) as Type<DynamicFormFieldDirective>,
      inputs: ['hideErrorMessage'],
    },
  ],
  imports: [ErrorComponent, NgIf, AsyncPipe],
})
export class InputFieldComponent extends DecoratedFormFieldBase {
  protected readonly inputState = inject(InputStateService);
}
