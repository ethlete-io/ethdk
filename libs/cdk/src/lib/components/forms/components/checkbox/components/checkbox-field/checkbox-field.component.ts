import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, forwardRef, inject, Type, ViewEncapsulation } from '@angular/core';
import { DynamicFormFieldDirective, StaticFormFieldDirective, WriteableInputDirective } from '../../../../directives';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error';
import { CheckboxFieldDirective } from '../../directives';

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
  standalone: true,
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
