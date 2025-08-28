import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  forwardRef,
  inject,
  input,
} from '@angular/core';
import { signalHostClasses } from '@ethlete/core';
import { DynamicFormGroupDirective } from '../../../../directives/dynamic-form-group';
import { StaticFormGroupDirective } from '../../../../directives/static-form-group';
import { WriteableInputDirective } from '../../../../directives/writeable-input';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error/components/error';
import { SegmentedButtonGroupDirective } from '../../directives/segmented-button-group';

export type SegmentedButtonGroupRenderAs = 'buttons' | 'tabs';

@Component({
  selector: 'et-segmented-button-group',
  template: `
    <div class="et-segmented-button-group-container">
      <ng-content />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  styleUrls: ['./segmented-button-group.component.scss'],
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

  renderAs = input<SegmentedButtonGroupRenderAs>('buttons');

  hostClassBindings = signalHostClasses({
    'et-segmented-button-group--tabs': computed(() => this.renderAs() === 'tabs'),
    'et-segmented-button-group--buttons': computed(() => this.renderAs() === 'buttons'),
  });
}
