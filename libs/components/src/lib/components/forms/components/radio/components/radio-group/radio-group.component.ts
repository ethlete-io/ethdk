import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { DYNAMIC_FORM_GROUP_DIRECTIVE_PUBLIC_API } from '../../../../directives';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error';
import { RadioGroupDirective } from '../../directives';

@Component({
  selector: 'et-radio-group',
  template: `
    <div class="et-radio-group-container">
      <ng-content select="et-radio-field" />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  styleUrls: ['./radio-group.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-radio-group',
  },
  hostDirectives: [...DYNAMIC_FORM_GROUP_DIRECTIVE_PUBLIC_API, RadioGroupDirective],
  imports: [ErrorComponent, AsyncPipe],
})
export class RadioGroupComponent {
  protected readonly inputState = inject(InputStateService);
}
