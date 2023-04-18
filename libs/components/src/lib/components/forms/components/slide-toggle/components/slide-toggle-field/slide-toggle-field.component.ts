import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, forwardRef, inject, Type, ViewEncapsulation } from '@angular/core';
import { DynamicFormFieldDirective, StaticFormFieldDirective, WriteableInputDirective } from '../../../../directives';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error';

@Component({
  selector: 'et-slide-toggle-field',
  template: `
    <div class="et-slide-toggle-field-container">
      <ng-content select="et-slide-toggle" />
      <ng-content select="et-label" />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-slide-toggle-field',
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
export class SlideToggleFieldComponent {
  protected readonly inputState = inject(InputStateService);
}
