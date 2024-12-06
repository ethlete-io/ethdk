import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, forwardRef, inject, Type, ViewEncapsulation } from '@angular/core';
import { DynamicFormFieldDirective } from '../../../../directives/dynamic-form-field';
import { StaticFormFieldDirective } from '../../../../directives/static-form-field';
import { WriteableInputDirective } from '../../../../directives/writeable-input';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error/components/error';
import { CheckboxFieldDirective } from '../../directives/checkbox-field';

@Component({
  selector: 'et-checkbox-field, et-checkbox-card-field',
  template: `
    <div class="et-checkbox-field-container">
      <ng-content />
      <ng-content />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  styleUrls: ['./checkbox-field.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-checkbox-field',
  },
  hostDirectives: [
    StaticFormFieldDirective,
    WriteableInputDirective,
    {
      directive: forwardRef(() => DynamicFormFieldDirective) as Type<DynamicFormFieldDirective>,
      inputs: ['hideErrorMessage'],
    },
    CheckboxFieldDirective,
  ],
  imports: [ErrorComponent, AsyncPipe],
})
export class CheckboxFieldComponent {
  protected readonly inputState = inject(InputStateService);
}
