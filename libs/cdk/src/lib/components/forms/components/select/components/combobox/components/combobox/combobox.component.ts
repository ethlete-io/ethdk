import { AsyncPipe, NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { AnimatedOverlayDirective } from '@ethlete/core';
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

@Component({
  selector: 'et-combobox',
  templateUrl: './combobox.component.html',
  styleUrls: ['./combobox.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-combobox',
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
        'emptyText',
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
      outputs: ['filterChange', 'optionClick'],
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
