import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { DYNAMIC_FORM_FIELD_DIRECTIVE_PUBLIC_API } from '../../../../directives';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error';

@Component({
  selector: 'et-slider-field',
  template: `
    <ng-content select="et-label" />
    <div class="et-slider-field-container">
      <ng-content select="et-slider" />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-slider-field',
  },
  hostDirectives: DYNAMIC_FORM_FIELD_DIRECTIVE_PUBLIC_API,
  imports: [ErrorComponent, NgIf, AsyncPipe],
})
export class SliderFieldComponent {
  protected readonly inputState = inject(InputStateService);
}
