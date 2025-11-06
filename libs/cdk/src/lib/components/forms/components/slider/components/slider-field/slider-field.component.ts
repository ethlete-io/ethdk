import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Type, ViewEncapsulation, forwardRef, inject } from '@angular/core';
import { DynamicFormFieldDirective } from '../../../../directives/dynamic-form-field';
import { StaticFormFieldDirective } from '../../../../directives/static-form-field';
import { WriteableInputDirective } from '../../../../directives/writeable-input';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error/components/error';

@Component({
  selector: 'et-slider-field',
  template: `
    <ng-content select="et-label" />
    <div class="et-slider-field-container">
      <ng-content select="et-slider" />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-slider-field',
  },
  hostDirectives: [
    StaticFormFieldDirective,
    WriteableInputDirective,
    {
      directive: forwardRef(() => DynamicFormFieldDirective) as Type<DynamicFormFieldDirective>,
      inputs: ['hideErrorMessage'],
    },
  ],
  imports: [ErrorComponent, AsyncPipe],
})
export class SliderFieldComponent {
  protected readonly inputState = inject(InputStateService);
}
