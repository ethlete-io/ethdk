import { AsyncPipe } from '@angular/common';
import { Component, forwardRef, inject, ViewEncapsulation } from '@angular/core';
import { DynamicFormGroupDirective } from '../../../../directives/dynamic-form-group';
import { StaticFormGroupDirective } from '../../../../directives/static-form-group';
import { WriteableInputDirective } from '../../../../directives/writeable-input';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error/components/error';
import { RadioGroupDirective } from '../../directives/radio-group';

@Component({
  selector: 'et-radio-group',
  template: `
    <div class="et-radio-group-container">
      <ng-content />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  styleUrls: ['./radio-group.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-group et-radio-group et-legacy',
  },
  hostDirectives: [
    StaticFormGroupDirective,
    WriteableInputDirective,
    {
      directive: forwardRef(() => DynamicFormGroupDirective),
      inputs: ['hideErrorMessage'],
    },
    RadioGroupDirective,
  ],
  imports: [ErrorComponent, AsyncPipe],
})
export class RadioGroupComponent {
  protected readonly inputState = inject(InputStateService);
}
