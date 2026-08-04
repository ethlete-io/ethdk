import { AsyncPipe } from '@angular/common';
import { Component, Type, ViewEncapsulation, forwardRef, inject } from '@angular/core';
import { DynamicFormFieldDirective } from '../../../../directives/dynamic-form-field';
import { StaticFormFieldDirective } from '../../../../directives/static-form-field';
import { WriteableInputDirective } from '../../../../directives/writeable-input';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error/components/error';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-slider-field',
  template: `
    <ng-content select="et-label" />
    <div class="et-slider-field-container">
      <ng-content select="et-slider" />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-slider-field et-legacy',
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
