import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { DYNAMIC_FORM_GROUP_DIRECTIVE_PUBLIC_API } from '../../../../directives';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error';
import { SegmentedButtonGroupDirective } from '../../directives';

@Component({
  selector: 'et-segmented-button-group',
  template: `
    <div class="et-segmented-button-group-container">
      <ng-content select="et-segmented-button-field" />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  styleUrls: ['./segmented-button-group.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-group et-segmented-button-group',
  },
  hostDirectives: [...DYNAMIC_FORM_GROUP_DIRECTIVE_PUBLIC_API, SegmentedButtonGroupDirective],
  imports: [ErrorComponent, AsyncPipe],
})
export class SegmentedButtonGroupComponent {
  protected readonly inputState = inject(InputStateService);
}
