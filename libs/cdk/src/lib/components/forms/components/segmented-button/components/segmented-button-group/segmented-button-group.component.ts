import { AsyncPipe } from '@angular/common';
import { Component, ViewEncapsulation, computed, forwardRef, inject, input } from '@angular/core';
import { signalHostClasses } from '@ethlete/core';
import { DynamicFormGroupDirective } from '../../../../directives/dynamic-form-group';
import { StaticFormGroupDirective } from '../../../../directives/static-form-group';
import { WriteableInputDirective } from '../../../../directives/writeable-input';
import { InputStateService } from '../../../../services';
import { ErrorComponent } from '../../../error/components/error';
import { SegmentedButtonGroupDirective } from '../../directives/segmented-button-group';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type SegmentedButtonGroupRenderAs = 'buttons' | 'tabs';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-segmented-button-group',
  template: `
    <div class="et-segmented-button-group-container">
      <ng-content />
    </div>
    <et-error [errors]="inputState.errors$ | async" />
  `,
  styleUrls: ['./segmented-button-group.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-group et-segmented-button-group et-legacy',
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
