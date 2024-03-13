import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, forwardRef, inject } from '@angular/core';
import { DynamicFormGroupDirective } from '../../../../directives/dynamic-form-group';
import { StaticFormGroupDirective } from '../../../../directives/static-form-group';
import { WriteableInputDirective } from '../../../../directives/writeable-input';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error/components/error';
import { SegmentedButtonGroupDirective } from '../../directives/segmented-button-group';

@Component({
  selector: 'et-segmented-button-group',
  template: `
    <div class="et-segmented-button-group-container">
      <ng-content />
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
  hostDirectives: [
    StaticFormGroupDirective,
    WriteableInputDirective,
    {
      directive: forwardRef(() => DynamicFormGroupDirective),
      inputs: ['hideErrorMessage'],
    },
    SegmentedButtonGroupDirective,
  ],
  imports: [ErrorComponent, AsyncPipe],
})
export class SegmentedButtonGroupComponent {
  protected readonly inputState = inject(InputStateService);
}
