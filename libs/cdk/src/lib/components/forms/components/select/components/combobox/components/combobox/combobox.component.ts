import { AsyncPipe, NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { AnimatedOverlayDirective, LetDirective } from '@ethlete/core';
import { ChevronIconComponent } from '../../../../../../../icons';
import { OverlayCloseBlockerDirective } from '../../../../../../../overlay';
import { InputDirective, NativeInputRefDirective } from '../../../../../../directives';
import { DecoratedInputBase } from '../../../../../../utils';
import { COMBOBOX_TOKEN, ComboboxDirective } from '../../directives';
import { ComboboxBodyComponent } from '../../partials';

@Component({
  selector: 'et-combobox',
  templateUrl: './combobox.component.html',
  styleUrls: ['./combobox.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-combobox',
    '(click)': 'combobox.selectInputAndOpen()',
  },
  imports: [
    NativeInputRefDirective,
    AsyncPipe,
    ChevronIconComponent,
    LetDirective,
    NgTemplateOutlet,
    NgComponentOutlet,
  ],
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
      // eslint-disable-next-line @angular-eslint/no-outputs-metadata-property
      outputs: ['filterChange'],
    },
  ],
})
export class ComboboxComponent extends DecoratedInputBase {
  protected readonly combobox = inject(COMBOBOX_TOKEN);

  constructor() {
    super();

    this.combobox.setBodyComponent(ComboboxBodyComponent);
  }
}
