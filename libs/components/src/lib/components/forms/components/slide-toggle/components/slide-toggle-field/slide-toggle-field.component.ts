import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { DYNAMIC_FORM_FIELD_DIRECTIVE_PUBLIC_API } from '../../../../directives';
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
    class: 'et-slide-toggle-field',
  },
  hostDirectives: DYNAMIC_FORM_FIELD_DIRECTIVE_PUBLIC_API,
  imports: [ErrorComponent, AsyncPipe],
})
export class SlideToggleFieldComponent {
  protected readonly inputState = inject(InputStateService);
}
