import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { DYNAMIC_FORM_FIELD_DIRECTIVE_PUBLIC_API } from '../../../../directives';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error';
import { CheckboxFieldDirective } from '../../directives';

@Component({
  selector: 'et-checkbox-field',
  template: `
    <div class="et-checkbox-field-container">
      <ng-content select="et-checkbox" />
      <ng-content select="et-label" />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-checkbox-field',
  },
  hostDirectives: [...DYNAMIC_FORM_FIELD_DIRECTIVE_PUBLIC_API, CheckboxFieldDirective],
  imports: [ErrorComponent, AsyncPipe],
})
export class CheckboxFieldComponent {
  protected readonly inputState = inject(InputStateService);
}
