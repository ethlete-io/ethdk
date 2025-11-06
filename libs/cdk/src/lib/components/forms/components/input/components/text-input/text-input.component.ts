import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { TEXT_INPUT_TOKEN, TextInputDirective } from '../../directives/text-input';
@Component({
  selector: 'et-text-input',
  templateUrl: './text-input.component.html',
  styleUrls: ['./text-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-text-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [TextInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class TextInputComponent extends DecoratedInputBase {
  protected readonly textInput = inject(TEXT_INPUT_TOKEN);
}
