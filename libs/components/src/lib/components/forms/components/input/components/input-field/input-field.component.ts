import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { DYNAMIC_FORM_FIELD_DIRECTIVE_PUBLIC_API } from '../../../../directives';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error';

@Component({
  selector: 'et-input-field',
  template: `
    <ng-content select="et-label" />
    <div class="et-input-field-input">
      <ng-content select="[et-field-prefix]" />
      <ng-content select="et-number-input, et-text-input, et-password-input" />
      <ng-content select="[et-field-suffix]" />
    </div>
    <et-error *ngIf="inputState.errors$ | async as errors" [errors]="errors" />
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-input-field',
  },
  hostDirectives: DYNAMIC_FORM_FIELD_DIRECTIVE_PUBLIC_API,
  imports: [ErrorComponent, NgIf, AsyncPipe],
})
export class InputFieldComponent {
  protected readonly inputState = inject(InputStateService);
}
