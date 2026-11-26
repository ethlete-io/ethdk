import { AsyncPipe, NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { AnimatedOverlayDirective } from '../../../../../../../overlay/directives/animated-overlay';
import { CHEVRON_ICON } from '../../../../../../../icons/chevron-icon';
import { provideIcons } from '../../../../../../../icons/icon-provider';
import { IconDirective } from '../../../../../../../icons/icon.directive';
import { TIMES_ICON } from '../../../../../../../icons/times-icon';
import { OverlayCloseBlockerDirective } from '../../../../../../../overlay/directives/overlay-close-auto-blocker';
import { InputDirective } from '../../../../../../directives/input';
import { NativeInputRefDirective } from '../../../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../../../utils';
import { COMBOBOX_TOKEN, ComboboxDirective } from '../../directives/combobox';
import { ComboboxBodyComponent } from '../../partials/combobox-body';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-combobox',
  templateUrl: './combobox.component.html',
  styleUrls: ['./combobox.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-combobox et-legacy',
    '(click)': 'combobox.selectInputAndOpen()',
  },
  imports: [NativeInputRefDirective, AsyncPipe, NgTemplateOutlet, NgComponentOutlet, IconDirective],
  hostDirectives: [
    AnimatedOverlayDirective,
    OverlayCloseBlockerDirective,
    { directive: InputDirective, inputs: ['placeholder'] },
    {
      directive: ComboboxDirective,
      inputs: [
        'options',
        'initialValue',
        'filterInternal',
        'loading',
        'error',
        'placeholder',
        'multiple',
        'bindLabel',
        'bindValue',
        'bindDisabled',
        'allowCustomValues',
        'selectedOptionComponent',
        'optionComponent',
        'bodyErrorComponent',
        'bodyLoadingComponent',
        'bodyEmptyComponent',
        'bodyMoreItemsHintComponent',
        'showBodyMoreItemsHint',
        'bodyEmptyText',
        'bodyMoreItemsHintText',
        'optionComponentInputs',
        'selectedOptionComponentInputs',
        'bodyErrorComponentInputs',
        'bodyLoadingComponentInputs',
        'bodyEmptyComponentInputs',
        'bodyMoreItemsHintComponentInputs',
      ],
      outputs: ['filterChange', 'optionClick', 'userInteraction'],
    },
  ],
  providers: [provideIcons(CHEVRON_ICON, TIMES_ICON)],
})
export class ComboboxComponent extends DecoratedInputBase {
  protected readonly combobox = inject(COMBOBOX_TOKEN);

  constructor() {
    super();

    this.combobox.setBodyComponent(ComboboxBodyComponent);
  }
}
